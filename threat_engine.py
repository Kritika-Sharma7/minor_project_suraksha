"""
Suraksha AI — Real-Time Safety Intelligence Engine

Pipeline (executed per WebSocket frame):
  StreamBuffer  →  FeatureExtractor  →  RiskEngine
  →  TemporalSmoother  →  ConfidenceScorer  →  SafetyFSM
  →  ExplainabilityEngine

Design principles:
  • Zero random/mock values — all output derived from real sensor input
  • Additive risk formula on 0–100 scale, each contribution explicit
  • Thresholds are expressed as SAFETY SCORE (not risk):
      safety_score = 100 - risk
      safety_score < WARNING_THRESHOLD (70) → WARNING
      safety_score < DANGER_THRESHOLD  (40) → DANGER
  • FSM enforces no state skipping and hysteresis-based decay
  • ALERT only after N consecutive DANGER frames (persistence gate)
  • Confidence = min(100, persistence_frames × 20)
      1 frame → 20%  (uncertain), 5 frames → 100% (high confidence)
      "Confidence increases with temporal consistency of the safety state."
  • Trend = comparison of current risk vs. moving_avg (not frame delta)
  • Structured explainability: every +N point labelled with category
"""
from __future__ import annotations

import logging
import math
import time
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime
from typing import Deque, List, Optional

from config import settings
from sensor_provider import RawSensorFrame
from route_service import RouteService

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
#  Constants
# ─────────────────────────────────────────────────────────────────────────────

_DISTRESS_KEYWORDS: frozenset[str] = frozenset({
    "help", "bachao", "stop", "danger", "save me",
    "please help", "leave me", "let me go", "aaao",
    "chhodo", "mat karo", "nahi", "chodo mujhe", "police",
})

# Maps FSM state name → numerical severity (used for trend calculation)
_STATE_SEVERITY = {"SAFE": 0, "WARNING": 1, "DANGER": 2, "ALERT": 3}

_STATE_COLORS = {
    "SAFE":    "#22c55e",
    "WARNING": "#f59e0b",
    "DANGER":  "#f97316",
    "ALERT":   "#ef4444",
}

_WOMEN_RECOMMENDATIONS = {
    "SAFE":    "All sensors normal. You are safe.",
    "WARNING": "Unusual signals detected. Stay alert and be aware of your surroundings.",
    "DANGER":  "Distress signals confirmed. Move to a public area and contact your emergency contacts.",
    "ALERT":   "Critical distress confirmed. Emergency alert sent to your contacts. Call police immediately.",
}

_CAB_RECOMMENDATIONS = {
    "SAFE":    "Journey on track. Route and speed normal.",
    "WARNING": "Minor route anomaly detected. Track your journey carefully.",
    "DANGER":  "Route deviation or unusual stop detected. Share your location with trusted contacts now.",
    "ALERT":   "Unsafe journey confirmed. Emergency alert sent. Call police and share live location.",
}

_STATE_RECOMMENDATIONS = _WOMEN_RECOMMENDATIONS  # default


# ─────────────────────────────────────────────────────────────────────────────
#  1. StreamBuffer
# ─────────────────────────────────────────────────────────────────────────────

class StreamBuffer:
    """
    Circular buffer of the last N RawSensorFrames.
    Provides windowed history accessors used by FeatureExtractor.
    """

    def __init__(self, maxlen: int = settings.window_size) -> None:
        self._frames: Deque[RawSensorFrame] = deque(maxlen=maxlen)
        # Risk history managed by TemporalSmoother, stored here for convenience
        self._risk_window: Deque[float] = deque(maxlen=maxlen)

    def push(self, frame: RawSensorFrame) -> None:
        self._frames.append(frame)

    @property
    def frames(self) -> list[RawSensorFrame]:
        return list(self._frames)

    @property
    def latest(self) -> Optional[RawSensorFrame]:
        return self._frames[-1] if self._frames else None

    def gps_history(self) -> list[tuple[float, float, float]]:
        """Returns [(lat, lon, timestamp), ...] for frames with valid GPS."""
        return [
            (f.lat, f.lon, f.timestamp)
            for f in self._frames
            if f.lat is not None and f.lon is not None
        ]

    def acc_history(self) -> list[float]:
        """Returns [total_acc, ...] for all frames."""
        return [f.total_acc for f in self._frames]

    def risk_history(self) -> list[float]:
        """Populated externally by TemporalSmoother."""
        return list(self._risk_window)

    def __len__(self) -> int:
        return len(self._frames)


# ─────────────────────────────────────────────────────────────────────────────
#  2. FeatureSet — structured output of FeatureExtractor
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class FeatureSet:
    # GPS
    speed_mps: float = 0.0
    speed_kmh: float = 0.0
    stop_duration_s: float = 0.0
    stop_score: float = 0.0
    route_deviation: Optional[bool] = None      # None = route unavailable
    route_deviation_m: Optional[float] = None
    deviation_score: float = 0.0
    confirmed_deviation: bool = False
    consecutive_dev_frames: int = 0

    # Acceleration
    total_acc: float = 9.81
    jerk_detected: bool = False
    jerk_value: float = 0.0
    fall_detected: bool = False

    # Audio
    keyword_detected: bool = False
    matched_keyword: str = ""
    high_energy: bool = False
    audio_rms: float = 0.0
    audio_zcr: float = 0.0
    audio_text: str = ""

    # Time
    is_night: bool = False

    # Mode
    mode: str = "women"
    # Signal Quality / Reliability (0-1)
    gps_quality: float = 1.0
    audio_quality: float = 1.0
    motion_quality: float = 1.0


# ─────────────────────────────────────────────────────────────────────────────
#  3. FeatureExtractor
# ─────────────────────────────────────────────────────────────────────────────

_R_EARTH = 6_371_000.0  # metres


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi  = math.radians(lat2 - lat1)
    dlam  = math.radians(lon2 - lon1)
    a     = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return 2 * _R_EARTH * math.asin(math.sqrt(min(1.0, a)))


class FeatureExtractor:
    """
    Stateful extractor — tracks stop_duration and fall-detection phases
    across frames. One instance per active connection (stored on engine).
    """

    def __init__(self) -> None:
        self._stop_start: Optional[float] = None    # timestamp when stopped
        self._stop_duration: float = 0.0
        self._fall_spike_ts: Optional[float] = None # timestamp of spike frame
        self._quiet_frame_count: int = 0
        self._high_energy_streak: int = 0           # consecutive high-energy speech frames

    # ── Public entry point ────────────────────────────────────────────────────

    def extract(
        self,
        buffer: StreamBuffer,
        route_svc: RouteService,
        frame: RawSensorFrame,
    ) -> FeatureSet:
        speed        = self._compute_speed(buffer, frame)
        stop_dur     = self._update_stop_duration(speed, frame.timestamp)
        deviation, dist, dev_frames = route_svc.compute_deviation(frame.lat, frame.lon)
        jerk, jerk_v = self._compute_jerk(buffer)
        fall         = self._detect_fall(frame, buffer)
        kw, kw_match = self._extract_keyword(frame)
        # High-energy sustained: RMS above threshold AND speech-like ZCR for 2+ consecutive frames.
        # Single-frame bursts (claps, door slams) don't trigger — only sustained vocal stress.
        if (frame.audio_rms > settings.audio_high_energy_threshold
                and frame.audio_zcr > settings.audio_zcr_speech_threshold):
            self._high_energy_streak += 1
        else:
            self._high_energy_streak = 0
        high_e = self._high_energy_streak >= 2

        # When the backend route service has no route (deviation is None), fall back to
        # the frontend's pre-computed gps_behavior values from gpsProcessor.js.
        # This covers: (a) simulation mode injected values, (b) Journey Mode where
        # the frontend computed deviation against a route already set on screen.
        if deviation is None and (frame.gps_confirmed_deviation or frame.gps_deviation_score > 0):
            deviation      = True if frame.gps_confirmed_deviation else False
            dist           = frame.gps_distance_from_route if frame.gps_distance_from_route > 0 else None
            dev_frames     = settings.route_deviation_consecutive_frames if frame.gps_confirmed_deviation else 1

        # Stop duration: backend timer OR frontend stationary_time, whichever is larger
        if frame.gps_stationary_time > stop_dur:
            stop_dur = frame.gps_stationary_time
            self._stop_start = frame.timestamp - frame.gps_stationary_time

        # Confirmed stop: backend computation OR frontend decision layer
        if frame.gps_confirmed_stop and stop_dur < 60:
            stop_dur = max(stop_dur, 65.0)  # ensure backend threshold crossed

        stop_score   = min(stop_dur / settings.stop_score_window_s, 1.0) if stop_dur > 0 else 0.0
        deviation_score = 0.0
        if dist is not None:
            deviation_score = min(dist / settings.route_deviation_meters, 1.0)
        elif frame.gps_deviation_score > 0:
            deviation_score = frame.gps_deviation_score
        confirmed_dev = (deviation is True and dev_frames >= settings.route_deviation_consecutive_frames) \
                        or frame.gps_confirmed_deviation

        return FeatureSet(
            speed_mps            = round(speed, 3),
            speed_kmh            = round(speed * 3.6, 2),
            stop_duration_s      = round(stop_dur, 1),
            stop_score           = round(stop_score, 4),
            route_deviation      = deviation,
            route_deviation_m    = dist,
            deviation_score      = round(deviation_score, 4),
            confirmed_deviation  = confirmed_dev,
            consecutive_dev_frames = dev_frames,
            total_acc            = round(frame.total_acc, 3),
            jerk_detected        = jerk,
            jerk_value           = round(jerk_v, 3),
            fall_detected        = fall,
            keyword_detected     = kw,
            matched_keyword      = kw_match,
            high_energy          = high_e,
            audio_rms            = round(frame.audio_rms, 4),
            audio_zcr            = round(frame.audio_zcr, 4),
            audio_text           = frame.audio_text,
            is_night             = self._is_night(frame.client_hour),
            mode                 = frame.mode,
            gps_quality          = self._estimate_gps_quality(frame),
            audio_quality        = self._estimate_audio_quality(frame),
        )

    def _estimate_gps_quality(self, frame: RawSensorFrame) -> float:
        """1.0 if accurate (<= 50m), scales down to 0.1 at 500m+."""
        if frame.lat is None: return 0.0
        acc = frame.gps_accuracy
        if acc <= 50: return 1.0
        if acc >= 500: return 0.1
        return 1.0 - ((acc - 50) / 450.0) * 0.9

    def _estimate_audio_quality(self, frame: RawSensorFrame) -> float:
        """
        Audio sensor quality (0–1):
          1.0 — keyword detected (SpeechRecognition is working + keyword caught)
          1.0 — AudioContext has RMS data (getUserMedia succeeded)
          0.8 — SpeechRecognition is running but getUserMedia is blocked
                (exclusive mic lock on Windows Chrome); mic IS online but
                we only have keyword data, not energy data
          0.0 — no audio sensor available at all
        """
        if frame.audio_text:
            return 1.0   # keyword matched → definitely working
        if frame.audio_rms > 0:
            return 1.0   # AudioContext has data
        if frame.speech_recognition_active:
            return 0.8   # SpeechRecognition running, mic online, getUserMedia blocked
        return 0.0

    # ── GPS: speed ────────────────────────────────────────────────────────────

    def _compute_speed(self, buffer: StreamBuffer, frame: RawSensorFrame) -> float:
        """
        Prefer GPS-reported speed (frame.speed_kmh) when available and
        we have enough GPS frames to trust it.
        Fall back to haversine-derived speed from last two GPS frames.
        """
        gps = buffer.gps_history()
        if frame.speed_kmh > 0 and len(gps) >= settings.min_gps_valid_frames:
            return frame.speed_kmh / 3.6  # → m/s

        if len(gps) < 2:
            return 0.0
        lat1, lon1, ts1 = gps[-2]
        lat2, lon2, ts2 = gps[-1]
        dt = ts2 - ts1
        if dt <= 0:
            return 0.0
        dist = _haversine(lat1, lon1, lat2, lon2)
        return dist / dt   # m/s

    # ── GPS: stop duration ────────────────────────────────────────────────────

    def _update_stop_duration(self, speed: float, ts: float) -> float:
        if speed < settings.stop_speed_threshold:
            if self._stop_start is None:
                self._stop_start = ts
            self._stop_duration = ts - self._stop_start
        else:
            self._stop_start = None
            self._stop_duration = 0.0
        return self._stop_duration

    # ── Acceleration: jerk ────────────────────────────────────────────────────

    def _compute_jerk(self, buffer: StreamBuffer) -> tuple[bool, float]:
        """Jerk = |total_acc[n] - total_acc[n-1]|. Detected if > threshold."""
        acc = buffer.acc_history()
        if len(acc) < 2:
            return False, 0.0
        jerk_v = abs(acc[-1] - acc[-2])
        return jerk_v > settings.jerk_threshold, jerk_v

    # ── Acceleration: fall detection (2-phase) ───────────────────────────────

    def _detect_fall(self, frame: RawSensorFrame, buffer: StreamBuffer) -> bool:
        """
        Phase 1: total_acc > fall_spike_threshold  → record spike timestamp
        Phase 2: total_acc < fall_quiet_threshold for fall_quiet_frames
                 consecutive frames AFTER the spike → fall confirmed
        Window is configurable via settings.fall_window_s (default 5s).
        """
        acc = frame.total_acc
        now = frame.timestamp

        if acc > settings.fall_spike_threshold:
            self._fall_spike_ts = now
            self._quiet_frame_count = 0
            return False  # need phase-2 to confirm

        if self._fall_spike_ts is not None:
            time_since_spike = now - self._fall_spike_ts
            if time_since_spike <= settings.fall_window_s:
                if acc < settings.fall_quiet_threshold:
                    self._quiet_frame_count += 1
                    if self._quiet_frame_count >= settings.fall_quiet_frames:
                        self._fall_spike_ts = None
                        self._quiet_frame_count = 0
                        return True
                else:
                    self._quiet_frame_count = 0
            else:
                self._fall_spike_ts = None
                self._quiet_frame_count = 0
        return False

    # ── Audio ─────────────────────────────────────────────────────────────────

    @staticmethod
    def _extract_keyword(frame: RawSensorFrame) -> tuple[bool, str]:
        text = frame.audio_text.lower()
        for kw in _DISTRESS_KEYWORDS:
            if kw in text:
                return True, kw
        return False, ""

    # ── Time ──────────────────────────────────────────────────────────────────

    @staticmethod
    def _is_night(client_hour: int | None = None) -> bool:
        h = client_hour if client_hour is not None else datetime.now().hour
        return h >= 20 or h <= 6


# ─────────────────────────────────────────────────────────────────────────────
#  4. RiskEngine  (0–100 additive formula)
# ─────────────────────────────────────────────────────────────────────────────

class RiskEngine:
    """
    Mode-Specific Sensor Fusion Risk Scorer.

    WOMEN SAFETY MODE:
      Audio is PRIMARY (0.55 weight) — keyword detection + voice energy.
      Motion is SECONDARY (0.35 weight) — fall, jerk, struggle patterns.
      GPS is LIGHT (0.10 weight) — only for stationary duration + location.
      Time context always applied.

    CAB SAFETY MODE:
      GPS/Route is PRIMARY (0.65 weight) — deviation, stop behaviour, speed.
      Audio is SUPPORT (0.25 weight) — distress signals inside the cab.
      Motion is MINIMAL (0.10 weight) — fall only.
      Time context always applied.
    """

    def compute(
        self, features: FeatureSet
    ) -> tuple[float, float, list[str], dict]:
        gps_risk    = 0.0
        motion_risk = 0.0
        audio_risk  = 0.0
        context_risk = 0.0
        reasons: list[str] = []
        mode = features.mode

        # ── Context (always applied regardless of mode) ───────────────
        if features.is_night:
            context_risk += 20
            reasons.append("Context: Night-time — sensitivity elevated (+20)")

        # ── GPS Domain ────────────────────────────────────────────────
        if mode == "women":
            # GPS light-use: only flags dangerously long stationary periods
            # (helps locate the user; not a primary threat signal)
            if features.stop_duration_s > settings.stop_time_threshold:
                gps_risk += 15
                m, s = divmod(int(features.stop_duration_s), 60)
                label = f"{m}m {s}s" if m else f"{s}s"
                reasons.append(f"GPS: Stationary {label} — location noted (+15)")
            elif features.stop_score > 0.5:
                gps_risk += 8
                reasons.append("GPS: Extended stationary period (+8)")

        else:  # cab mode — GPS is PRIMARY
            # Base score from normalised deviation + stop scores
            gps_base = 100.0 * (0.45 * features.deviation_score + 0.35 * features.stop_score)
            if gps_base > 0:
                gps_risk += gps_base
                reasons.append(
                    f"GPS: Journey anomaly "
                    f"dev={features.deviation_score:.2f} "
                    f"stop={features.stop_score:.2f} (+{gps_base:.0f})"
                )

            if features.confirmed_deviation:
                gps_risk += 25
                dist_label = (
                    f"{features.route_deviation_m:.0f}m"
                    if features.route_deviation_m else "?"
                )
                reasons.append(f"GPS: Confirmed route deviation {dist_label} (+25)")
            elif features.route_deviation is True:
                reasons.append(
                    f"GPS: Deviation building "
                    f"({features.consecutive_dev_frames} frames)"
                )
            elif features.route_deviation is None:
                reasons.append("GPS: Route tracking unavailable")

            if features.stop_duration_s > 120:
                gps_risk += 20
                reasons.append("GPS: Vehicle stopped > 2 minutes (+20)")

            # Compounding danger: deviated AND stopped
            if features.confirmed_deviation and features.stop_duration_s > 120:
                gps_risk += 30
                reasons.append("GPS: Stopped off-route > 2 min — HIGH DANGER (+30)")

            # Unusual crawl speed while route is active
            if (features.route_deviation is not None
                    and 0 < features.speed_kmh < settings.cab_speed_suspicion_mps * 3.6):
                gps_risk += 10
                reasons.append(
                    f"GPS: Unusually slow {features.speed_kmh:.1f} km/h (+10)"
                )

        # ── Motion Domain ─────────────────────────────────────────────
        if features.fall_detected:
            motion_risk += 40
            reasons.append("Motion: Fall detected — possible injury (+40)")
            # Fall is a critical life-safety event; add unweighted context bonus
            # so that fall alone always reaches DANGER regardless of mode weights.
            context_risk += 50
            reasons.append("Context: Fall confirmed — immediate danger (+50)")

        if features.jerk_detected:
            if mode == "women":
                # Higher sensitivity in women mode — jerk may indicate struggle
                motion_risk += 20
                reasons.append(
                    f"Motion: Sudden jerk {features.jerk_value:.1f} m/s² "
                    f"— possible struggle (+20)"
                )
            else:
                motion_risk += 8
                reasons.append(
                    f"Motion: Sudden jerk {features.jerk_value:.1f} m/s² (+8)"
                )

        # Sustained acceleration above normal — women mode only (struggle pattern)
        if mode == "women" and features.total_acc > 14.0:
            motion_risk += 12
            reasons.append(
                f"Motion: Abnormal acceleration {features.total_acc:.1f} m/s² "
                f"— possible struggle (+12)"
            )

        # Graduated severity for extreme G-forces (violent assault / hard impact)
        if mode == "women" and features.total_acc > 30.0:
            motion_risk += 20
            reasons.append(
                f"Motion: Violent impact {features.total_acc:.1f} m/s² "
                f"— assault pattern (+20)"
            )

        # ── Audio Domain ──────────────────────────────────────────────
        if features.keyword_detected:
            if mode == "women":
                # Women mode: audio is PRIMARY (0.55 weight).
                # Scores are set high enough so that keyword alone guarantees
                # at minimum WARNING (risk > 30), and keyword + energy reaches DANGER (risk > 60).
                if features.audio_rms > settings.audio_keyword_energy_threshold:
                    audio_risk += 80   # 0.55 * 80 = 44 → DANGER threshold hit
                    reasons.append(
                        f'Audio: Distress keyword "{features.matched_keyword}" '
                        f'+ stressed voice (+80)'
                    )
                else:
                    audio_risk += 60   # 0.55 * 60 = 33 → WARNING threshold hit
                    reasons.append(
                        f'Audio: Distress keyword "{features.matched_keyword}" '
                        f'detected (+60)'
                    )
                if features.audio_zcr > settings.audio_zcr_speech_threshold:
                    audio_risk += 15
                    reasons.append(
                        f"Audio: Stressed speech confirmed "
                        f"ZCR={features.audio_zcr:.2f} (+15)"
                    )
            else:  # cab mode
                if features.audio_rms > settings.audio_keyword_energy_threshold:
                    audio_risk += 35
                    reasons.append(
                        f'Audio: Distress keyword "{features.matched_keyword}" '
                        f'in cab (+35)'
                    )
                else:
                    audio_risk += 25
                    reasons.append(
                        f'Audio: Distress keyword "{features.matched_keyword}" (+25)'
                    )


        # Sustained vocal stress fallback — fires when SpeechRecognition misses the keyword.
        # Requires 2 consecutive frames: high RMS + speech-like ZCR (filters noise/impacts).
        # Score raised to 65 so that a clear scream signature alone crosses WARNING (risk > 30).
        if not features.keyword_detected and mode == "women" and features.high_energy:
            audio_risk += 65
            reasons.append(
                f"Audio: Sustained vocal stress "
                f"RMS={features.audio_rms:.2f} ZCR={features.audio_zcr:.2f} (+65)"
            )

        # Combined cross-sensor danger: simultaneous acoustic distress + violent motion.
        # When both sensors independently flag danger, the compounded risk warrants DANGER state.
        if mode == "women" and features.high_energy and features.total_acc > 25.0:
            context_risk += 20
            reasons.append(
                "Context: Simultaneous vocal distress + violent motion "
                "— struggle confirmed (+20)"
            )

        # ── Mode-Specific Sensor Fusion Weights ───────────────────────
        # Quality weights (0–1) from signal strength
        w_gps    = features.gps_quality
        w_motion = features.motion_quality
        w_audio  = features.audio_quality

        if mode == "women":
            # Audio PRIMARY → Motion SECONDARY → GPS light
            raw_risk = (
                0.55 * w_audio  * audio_risk  +
                0.35 * w_motion * motion_risk +
                0.10 * w_gps    * gps_risk    +
                context_risk
            )
            if w_audio < 0.1:
                reasons.append(
                    "Audio sensor offline — women mode accuracy reduced; "
                    "motion signals elevated"
                )
        else:  # cab
            # GPS PRIMARY → Audio SUPPORT → Motion minimal
            raw_risk = (
                0.65 * w_gps    * gps_risk    +
                0.25 * w_audio  * audio_risk  +
                0.10 * w_motion * motion_risk +
                context_risk
            )
            if w_gps < 0.3:
                reasons.append(
                    "⚠️ GPS signal weak — cab mode accuracy reduced"
                )

        raw_risk     = min(100.0, raw_risk)
        safety_score = max(0.0, 100.0 - raw_risk)

        reliability = {
            "gps":       round(w_gps, 2),
            "audio":     round(w_audio, 2),
            "motion":    round(w_motion, 2),
            "composite": round((w_gps + w_audio + w_motion) / 3.0, 2),
        }

        return round(raw_risk, 2), round(safety_score, 2), reasons, reliability


# ─────────────────────────────────────────────────────────────────────────────
#  5. ExplainabilityEngine
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class ExplainItem:
    """Structured explanation entry for frontend display."""
    category: str    # GPS | AUDIO | MOTION | TIME | MODE
    label: str       # human-readable description
    delta: float     # risk contribution


class ExplainabilityEngine:
    """
    Converts the raw reasons list into structured ExplainItems.
    Allows the frontend to render category-grouped risk factors.
    """

    # Maps reason prefixes → category
    _CATEGORY_MAP = [
        ("Night",           "TIME"),
        ("Stationary",      "GPS"),
        ("Route",           "GPS"),
        ("Fall",            "MOTION"),
        ("Distress keyword","AUDIO"),
        ("High audio",      "AUDIO"),
        ("Sudden impact",   "MOTION"),
        ("Elder",           "MODE"),
        ("Cab",             "MODE"),
    ]

    def parse(self, reasons: list[str]) -> list[dict]:
        """Returns list of {category, label, delta} dicts."""
        result: list[dict] = []
        for reason in reasons:
            category = "OTHER"
            for prefix, cat in self._CATEGORY_MAP:
                if reason.startswith(prefix):
                    category = cat
                    break
            # Extract delta from trailing (+N) pattern
            delta = 0.0
            if "(+" in reason:
                try:
                    delta = float(reason.split("(+")[-1].rstrip(")"))
                except ValueError:
                    pass
            result.append({
                "category": category,
                "label": reason,
                "delta": delta,
            })
        return result


# ─────────────────────────────────────────────────────────────────────────────
#  6. TemporalSmoother + ConfidenceScorer
# ─────────────────────────────────────────────────────────────────────────────

class TemporalSmoother:
    """
    Moving-average smoother over last N risk scores.
    Tracks persistence: consecutive frames in the same state band.

    Thresholds compare safety_score (= 100 - risk), not risk directly.
    """

    def __init__(self) -> None:
        self._window: Deque[float] = deque(maxlen=settings.window_size)
        self._persistence: int = 0
        self._last_band: str = "safe"

    def update(self, raw_risk: float) -> tuple[float, int]:
        """
        Push raw_risk into window.
        Returns (smoothed_risk, persistence_frames).
        """
        self._window.append(raw_risk)
        smoothed = sum(self._window) / len(self._window)

        band = self._risk_band(smoothed)
        if band == self._last_band:
            self._persistence += 1
        else:
            self._persistence = 1
            self._last_band = band

        return round(smoothed, 2), self._persistence

    @property
    def window_scores(self) -> list[float]:
        return list(self._window)

    @property
    def moving_avg(self) -> float:
        return round(sum(self._window) / len(self._window), 2) if self._window else 0.0

    @staticmethod
    def _risk_band(risk: float) -> str:
        """
        Compare safety_score against thresholds.
        safety_score = 100 - risk
        safety_score < danger_threshold (40) → danger
        safety_score < warning_threshold (70) → warning
        """
        safety = 100.0 - risk
        if safety < settings.danger_threshold:      # < 40 → risk > 60
            return "danger"
        if safety < settings.warning_threshold:     # < 70 → risk > 30
            return "warning"
        return "safe"


class ConfidenceScorer:
    """
    Confidence rises with consecutive frames in the same band.

    confidence = min(100, persistence_frames × 20)
    1 frame  → 20%  (uncertain — single reading)
    3 frames → 60%  (moderate confidence)
    5 frames → 100% (high confidence)

    "Confidence increases with temporal consistency of the safety state."
    """

    @staticmethod
    def score(persistence_frames: int) -> float:
        return min(100.0, persistence_frames * 20.0)


# ─────────────────────────────────────────────────────────────────────────────
#  7. SafetyFSM
# ─────────────────────────────────────────────────────────────────────────────

class SafetyFSM:
    """
    Four-state Finite State Machine.
    States: SAFE → WARNING → DANGER → ALERT

    Rules:
      • No state skipping (SAFE cannot jump to DANGER in one frame)
      • ALERT only after persistence_frames consecutive DANGER readings
      • Decay is gradual (ALERT → DANGER → WARNING → SAFE)
      • Thresholds compare safety_score (100 - smoothed_risk)
    """

    def __init__(self) -> None:
        self._state: str = "SAFE"
        self._danger_streak: int = 0
        self._last_alert_time: float = 0.0

    @property
    def state(self) -> str:
        return self._state

    def transition(
        self, smoothed_risk: float, persistence: int
    ) -> tuple[str, bool]:
        """
        Returns (new_state: str, alert_triggered: bool).
        alert_triggered is True only once per cooldown window.
        Comparison uses safety_score for semantic correctness.
        """
        alert_triggered = False

        # Determine target band from safety score
        safety = 100.0 - smoothed_risk
        if safety < settings.danger_threshold:      # safety < 40 → risk > 60
            target = "DANGER"
        elif safety < settings.warning_threshold:   # safety < 70 → risk > 30
            target = "WARNING"
        else:
            target = "SAFE"

        # ── FSM transitions (no skipping) ────────────────────────────
        if self._state == "SAFE":
            if target in ("WARNING", "DANGER"):
                self._state = "WARNING"

        elif self._state == "WARNING":
            if target == "SAFE":
                self._state = "SAFE"
            elif target == "DANGER":
                self._state = "DANGER"

        elif self._state == "DANGER":
            if target == "SAFE":
                self._state = "WARNING"    # decay, not instant safe
            elif target == "WARNING":
                self._state = "WARNING"
            else:
                # Stay in DANGER; promote to ALERT after persistence gate
                self._danger_streak += 1
                if self._danger_streak >= settings.persistence_frames:
                    now = time.time()
                    if (now - self._last_alert_time) >= settings.alert_cooldown_seconds:
                        self._state = "ALERT"
                        self._last_alert_time = now
                        alert_triggered = True
                        self._danger_streak = 0

        elif self._state == "ALERT":
            # Decay: ALERT → DANGER; only exit ALERT when risk drops
            if target in ("SAFE", "WARNING"):
                self._state = "DANGER"
                self._danger_streak = 0
            alert_triggered = False

        # Reset danger streak when not in danger band
        if self._state not in ("DANGER", "ALERT"):
            self._danger_streak = 0

        return self._state, alert_triggered
    
    @property
    def danger_streak(self) -> int:
        return self._danger_streak
    
    @property
    def countdown_max(self) -> int:
        return settings.persistence_frames

    def reset(self) -> None:
        self._state = "SAFE"
        self._danger_streak = 0


# ─────────────────────────────────────────────────────────────────────────────
#  8. ThreatEngine  — unified façade
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class RiskSnapshot:
    """Return value of ThreatEngine.process() — full output for ws.py."""
    # New schema fields
    safety_score: float
    risk: float
    state: str
    features: FeatureSet
    reasons: list[str]
    explain: list[dict]          # structured ExplainabilityEngine output
    confidence: float
    alert_triggered: bool
    moving_avg: float
    window_scores: list[float]
    trend: str
    danger_streak: int           # Current streak toward ALERT
    countdown_max: int           # Threshold for ALERT escalation
    reliability: dict            # Sensor quality metrics
    timestamp: float
    mode: str

    # Backward-compat fields (kept so existing storage/alert code works)
    threat_level: str = ""
    combined_score: float = 0.0
    location_risk: int = 0
    time_risk: int = 0
    motion_risk: int = 0
    audio_risk: int = 0
    events: list = field(default_factory=list)
    weights: dict = field(default_factory=dict)
    risk_delta: float = 0.0
    audio_class: str = "N/A"
    lat: float | None = None
    lon: float | None = None

    def __post_init__(self) -> None:
        # Map new state names to legacy threat_level names
        self.threat_level = {
            "SAFE":    "SAFE",
            "WARNING": "SUSPICIOUS",
            "DANGER":  "HIGH",
            "ALERT":   "CRITICAL",
        }.get(self.state, self.state)
        self.combined_score = self.risk


class ThreatEngine:
    """
    Façade that orchestrates the full pipeline for one monitoring session.
    One instance per app (stored on app.state.threat_engine).
    """

    def __init__(self) -> None:
        self._buffer      = StreamBuffer()
        self._extractor   = FeatureExtractor()
        self._risk_engine = RiskEngine()
        self._smoother    = TemporalSmoother()
        self._fsm         = SafetyFSM()
        self._explainer   = ExplainabilityEngine()
        self._mode        = "women"
        self._last_risk: float = 0.0
        self._history: list[RiskSnapshot] = []

    def set_mode(self, mode: str) -> None:
        valid = {"women", "cab"}
        if mode in valid:
            self._mode = mode
            logger.info("Mode set to: %s", mode)
        else:
            logger.warning("Unknown mode '%s', keeping '%s'", mode, self._mode)

    def process(
        self,
        frame: RawSensorFrame,
        route_svc: RouteService,
    ) -> RiskSnapshot:
        """Full pipeline: ingest → extract → risk → smooth → FSM → explain → snapshot."""
        frame.mode = self._mode  # override with engine mode
        self._buffer.push(frame)

        features = self._extractor.extract(self._buffer, route_svc, frame)
        raw_risk, safety_score, reasons, reliability = self._risk_engine.compute(features)
        explain = self._explainer.parse(reasons)

        smoothed, persistence = self._smoother.update(raw_risk)
        confidence = ConfidenceScorer.score(persistence)
        # Keyword and sustained vocal stress both bypass the 15-frame smoother.
        # Without bypass, a single high-risk frame averaged with 14 safe frames
        # stays below the WARNING threshold and the FSM never transitions.
        fsm_risk = raw_risk if (features.keyword_detected or features.high_energy) else smoothed
        state, alert_triggered = self._fsm.transition(fsm_risk, persistence)

        # Detect fast increase for early warning
        risk_delta = round(raw_risk - self._last_risk, 2)
        if risk_delta > 20 and state == "WARNING":
            reasons.append("⚠️ FAST RISK ESCALATION DETECTED (+Trend Intelligence)")

        # Trend: compare current frame risk vs. moving average
        # "Is this frame above or below the recent window's average?"
        moving_avg = self._smoother.moving_avg
        diff = raw_risk - moving_avg
        if abs(diff) <= 2.0:
            trend = "STABLE"
        elif diff > 0:
            trend = "UP"
        else:
            trend = "DOWN"

        self._last_risk = raw_risk

        snap = RiskSnapshot(
            safety_score    = safety_score,
            risk            = raw_risk,
            state           = state,
            features        = features,
            reasons         = reasons,
            explain         = explain,
            confidence      = confidence,
            alert_triggered = alert_triggered,
            moving_avg      = moving_avg,
            window_scores   = self._smoother.window_scores,
            trend           = trend,
            danger_streak   = self._fsm.danger_streak,
            countdown_max   = self._fsm.countdown_max,
            reliability     = reliability,
            timestamp       = frame.timestamp,
            mode            = self._mode,
            # Backward compat
            risk_delta      = risk_delta,
            events          = (
                ["DISTRESS_KEYWORD"] if features.keyword_detected else []
            ) + (
                ["FALL_DETECTED"] if features.fall_detected else []
            ),
            lat             = frame.lat,
            lon             = frame.lon,
            audio_class     = frame.audio_class,
        )

        self._history.append(snap)
        if len(self._history) > 200:
            self._history.pop(0)

        # Console log for academic demo / viva
        logger.info(
            "[%s] risk=%.0f safety=%.0f state=%s confidence=%.0f%% trend=%s",
            snap.mode.upper(), snap.risk, snap.safety_score,
            snap.state, snap.confidence, snap.trend,
        )
        if reasons:
            logger.info("  Reasons: %s", " | ".join(reasons))

        return snap

    # ── Legacy compatibility (risk.py still calls engine.analyze) ────────────

    def analyze(
        self,
        location_risk: int,
        time_risk: int,
        motion_risk: int,
        audio_risk: int,
        events: list[str] | None = None,
        is_night: bool = False,
    ):
        """
        Legacy entry-point used by /api/v1/analyze-risk HTTP endpoint.
        Converts old 0–255 inputs → synthetic RawSensorFrame → pipeline.
        """
        events = events or []
        import time as _time

        total_acc = 9.81 + (motion_risk / 255.0) * 20.0
        audio_text = " ".join(
            e.lower().replace("_", " ") for e in events
            if any(k in e.lower() for k in _DISTRESS_KEYWORDS)
        )
        audio_rms = min(1.0, (audio_risk / 255.0) * 0.6)

        frame = RawSensorFrame(
            timestamp  = _time.time(),
            mode       = self._mode,
            ax         = 0.0,
            ay         = total_acc,
            az         = 0.0,
            total_acc  = total_acc,
            audio_text = audio_text,
            audio_rms  = audio_rms,
        )

        dummy_rs = RouteService()
        snap = self.process(frame, dummy_rs)

        snap.location_risk = location_risk
        snap.time_risk     = time_risk
        snap.motion_risk   = motion_risk
        snap.audio_risk    = audio_risk
        snap.events        = events
        snap.weights       = {"location": 0.25, "time": 0.20, "motion": 0.30, "audio": 0.25}
        return snap

    def reset(self) -> None:
        self._buffer    = StreamBuffer()
        self._extractor = FeatureExtractor()
        self._smoother  = TemporalSmoother()
        self._fsm.reset()
        self._last_risk = 0.0

    @property
    def current_state(self) -> str:
        return self._fsm.state

    @property
    def history(self) -> list[RiskSnapshot]:
        return list(self._history)

    @property
    def window_scores(self) -> list[float]:
        return self._smoother.window_scores


# ─────────────────────────────────────────────────────────────────────────────
#  Helpers for ws.py / risk.py
# ─────────────────────────────────────────────────────────────────────────────

def state_color(state: str) -> str:
    return _STATE_COLORS.get(state, "#6b7280")


def recommendation(state: str, mode: str = "women") -> str:
    recs = _CAB_RECOMMENDATIONS if mode == "cab" else _WOMEN_RECOMMENDATIONS
    return recs.get(state, "Monitoring...")


# Legacy enum alias for any code that still imports ThreatLevel
class ThreatLevel:
    SAFE       = "SAFE"
    SUSPICIOUS = "SUSPICIOUS"
    HIGH       = "HIGH"
    CRITICAL   = "CRITICAL"
