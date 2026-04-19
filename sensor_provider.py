"""
Suraksha AI — Sensor Ingestion Layer
Normalises incoming WebSocket payloads into a unified RawSensorFrame,
regardless of which schema the client is sending:

  NEW spec schema:        { timestamp, gps, accelerometer, audio_text, mode }
  OLD frontend schema:    { location, motion, audio, timestamp }
  React Native schema:    { coords:{latitude,longitude,speed,accuracy}, ... }

No risk scoring happens here — just field extraction and unit normalisation.
"""
from __future__ import annotations

import math
import time
import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class RawSensorFrame:
    """Unified internal representation of one sensor tick."""
    # Identity
    timestamp: float
    mode: str = "women"           # women | cab | elder

    # GPS (raw, may be None if unavailable)
    lat: float | None = None
    lon: float | None = None
    gps_speed: float = 0.0        # m/s from GPS provider
    speed_kmh: float = 0.0        # km/h from GPS provider (preferred when > 0)
    gps_accuracy: float = 100.0   # metres accuracy radius

    # Raw accelerometer axes (m/s²)
    ax: float = 0.0
    ay: float = 0.0
    az: float = 0.0
    total_acc: float = 9.81       # √(ax²+ay²+az²)

    # Audio
    audio_text: str = ""
    audio_rms: float = 0.0        # Root Mean Square energy  0.0–1.0
    audio_zcr: float = 0.0        # Zero Crossing Rate       0.0–1.0
    audio_freq: float = 0.0       # dominant frequency  Hz

    # Legacy pass-through (for storage / backward compat)
    audio_class: str = "N/A"


# ─────────────────────────────────────────────────────────────────────────────
#  Schema detection + normalisation
# ─────────────────────────────────────────────────────────────────────────────

class SensorIngestionLayer:
    """
    Detects which schema the client uses and normalises to RawSensorFrame.
    Supports three schemas:
      1. NEW spec   { gps, accelerometer, audio_text, mode, timestamp }
      2. OLD frontend { location, motion, audio, timestamp }
      3. React Native Geolocation { coords:{latitude,longitude,speed}, timestamp }

    Thread-safe (stateless — all state lives in StreamBuffer).
    """

    def normalize(self, payload: dict[str, Any]) -> RawSensorFrame:
        if "gps" in payload:
            return self._parse_new_schema(payload)
        elif "coords" in payload:
            return self._parse_rn_schema(payload)
        elif "location" in payload or "motion" in payload or "audio" in payload:
            return self._parse_old_schema(payload)
        else:
            logger.warning("Unknown payload schema — using defaults")
            return RawSensorFrame(timestamp=time.time())

    # ── New spec schema ──────────────────────────────────────────────────────

    def _parse_new_schema(self, p: dict) -> RawSensorFrame:
        gps  = p.get("gps") or {}
        acc  = p.get("accelerometer") or {}
        lat  = _f(gps.get("lat"))
        lon  = _f(gps.get("lon"))
        ax   = _f(acc.get("ax"))
        ay   = _f(acc.get("ay"))
        az   = _f(acc.get("az"))
        total_acc = math.sqrt(ax**2 + ay**2 + az**2)
        speed_kmh = _f(gps.get("speed_kmh"))

        return RawSensorFrame(
            timestamp    = _f(p.get("timestamp"), time.time()),
            mode         = str(p.get("mode", "women")).lower(),
            lat          = lat if lat != 0.0 else None,
            lon          = lon if lon != 0.0 else None,
            gps_speed    = speed_kmh / 3.6 if speed_kmh > 0 else 0.0,
            speed_kmh    = speed_kmh,
            gps_accuracy = _f(gps.get("accuracy"), 10.0),
            ax=ax, ay=ay, az=az,
            total_acc    = total_acc if total_acc > 0 else 9.81,
            audio_text   = str(p.get("audio_text", "")).lower().strip(),
            audio_rms    = _f(p.get("audio_rms")),
            audio_zcr    = _f(p.get("audio_zcr")),
            audio_freq   = _f(p.get("audio_freq")),
            audio_class  = str(p.get("audio_class", "N/A")),
        )

    # ── Old frontend schema ──────────────────────────────────────────────────

    def _parse_old_schema(self, p: dict) -> RawSensorFrame:
        location = p.get("location") or {}
        motion   = p.get("motion") or {}
        audio    = p.get("audio") or {}

        lat = _f(location.get("lat"))
        lon = _f(location.get("lon"))
        raw_speed = _f(location.get("speed"), 0.0)   # m/s
        speed_kmh = raw_speed * 3.6

        # Old schema doesn't send ax/ay/az — reconstruct from magnitude.
        # Gravity dominantly on Y axis, shake distributed on X/Z.
        accel_mag  = _f(motion.get("accelMag"), 9.81)
        shake      = _f(motion.get("shakeScore"), 0.0)   # 0–1
        _fall_prob = _f(motion.get("fallProb"),   0.0)   # unused but kept

        ax = shake * 15.0
        az = 0.5 * shake * accel_mag
        ay = math.sqrt(max(0.0, accel_mag**2 - ax**2 - az**2))
        total_acc = accel_mag

        keyword     = str(audio.get("keyword", "")).lower().strip()
        kw_detected = bool(audio.get("keyword_detected", False)) or bool(keyword)
        audio_text  = keyword if kw_detected else ""
        audio_rms   = _f(audio.get("rms"), 0.0)
        audio_zcr   = _f(audio.get("zcr"), 0.0)
        audio_freq  = _f(audio.get("freq"), 0.0)
        audio_class = str(audio.get("audioClass", "N/A"))

        return RawSensorFrame(
            timestamp    = _f(p.get("timestamp"), time.time()),
            mode         = str(p.get("mode", "women")).lower(),
            lat          = lat if lat != 0.0 else None,
            lon          = lon if lon != 0.0 else None,
            gps_speed    = raw_speed,
            speed_kmh    = speed_kmh,
            gps_accuracy = _f(location.get("accuracy"), 100.0),
            ax=ax, ay=ay, az=az,
            total_acc    = total_acc,
            audio_text   = audio_text,
            audio_rms    = audio_rms,
            audio_zcr    = audio_zcr,
            audio_freq   = audio_freq,
            audio_class  = audio_class,
        )

    # ── React Native Geolocation schema ──────────────────────────────────────
    # Input: { coords:{latitude,longitude,speed,accuracy}, timestamp, motion:{}, audio:{} }

    def _parse_rn_schema(self, p: dict) -> RawSensorFrame:
        coords  = p.get("coords") or {}
        motion  = p.get("motion") or {}
        audio   = p.get("audio") or {}

        lat = _f(coords.get("latitude"))
        lon = _f(coords.get("longitude"))
        raw_speed = _f(coords.get("speed"), 0.0)   # m/s (RN standard)
        speed_kmh = raw_speed * 3.6

        accel_mag = _f(motion.get("accelMag"), 9.81)
        shake     = _f(motion.get("shakeScore"), 0.0)
        ax = shake * 15.0
        az = 0.5 * shake * accel_mag
        ay = math.sqrt(max(0.0, accel_mag**2 - ax**2 - az**2))

        keyword     = str(audio.get("keyword", "")).lower().strip()
        kw_detected = bool(audio.get("keyword_detected", False)) or bool(keyword)

        return RawSensorFrame(
            timestamp    = _f(p.get("timestamp"), time.time()),
            mode         = str(p.get("mode", "women")).lower(),
            lat          = lat if lat != 0.0 else None,
            lon          = lon if lon != 0.0 else None,
            gps_speed    = raw_speed,
            speed_kmh    = speed_kmh,
            gps_accuracy = _f(coords.get("accuracy"), 100.0),
            ax=ax, ay=ay, az=az,
            total_acc    = accel_mag,
            audio_text   = keyword if kw_detected else "",
            audio_rms    = _f(audio.get("rms"), 0.0),
            audio_zcr    = _f(audio.get("zcr"), 0.0),
            audio_freq   = _f(audio.get("freq"), 0.0),
            audio_class  = str(audio.get("audioClass", "N/A")),
        )


# ─────────────────────────────────────────────────────────────────────────────
#  Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _f(value: Any, default: float = 0.0) -> float:
    """Safe float cast."""
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _is_night_now() -> bool:
    """Night window: 20:00–06:00 (wider than 21/5 to be conservative)."""
    h = datetime.now().hour
    return h >= 20 or h <= 6


# ─────────────────────────────────────────────────────────────────────────────
#  Legacy shim — keeps existing risk.py import working unchanged
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class SensorFrame:
    """Legacy dataclass used by risk.py / alert_service legacy path."""
    location_risk: int  = 0
    time_risk: int      = 0
    motion_risk: int    = 0
    audio_risk: int     = 0
    events: list        = field(default_factory=list)
    is_night: bool      = False
    lat: float | None   = None
    lon: float | None   = None
    audio_class: str    = "N/A"


class WebSensorProvider:
    """Legacy shim for any code that still calls WebSensorProvider().parse()."""

    _ingestion = SensorIngestionLayer()

    def parse(self, payload: dict[str, Any]) -> SensorFrame:
        frame = self._ingestion.normalize(payload)
        is_night = _is_night_now()

        isolation = min(1.0, frame.gps_accuracy / 200.0)
        loc_base = min(255.0, 50 + isolation * 120)
        if is_night:
            loc_base += 35
        if frame.gps_speed < 0.4:
            loc_base += 10
        location_risk = int(max(0, min(255, loc_base)))

        motion_excess = max(0.0, frame.total_acc - 9.81)
        motion_risk = int(min(255, motion_excess * 8))

        keyword_bonus = 150 if frame.audio_text else 0
        audio_risk = int(min(255, frame.audio_rms * 255 + keyword_bonus))

        time_risk = 180 if is_night else 70

        events: list[str] = []
        if frame.audio_text:
            events.append("DISTRESS_KEYWORD")
        if frame.total_acc > 25:
            events.append("FALL_DETECTED")

        return SensorFrame(
            location_risk=location_risk,
            time_risk=time_risk,
            motion_risk=motion_risk,
            audio_risk=audio_risk,
            events=events,
            is_night=is_night,
            lat=frame.lat,
            lon=frame.lon,
            audio_class=frame.audio_class,
        )
