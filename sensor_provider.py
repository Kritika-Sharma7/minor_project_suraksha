from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any


@dataclass
class SensorFrame:
    location_risk: int
    time_risk: int
    motion_risk: int
    audio_risk: int
    events: list[str]
    is_night: bool
    lat: float | None = None
    lon: float | None = None
    audio_class: str = "N/A"


class SensorProvider:
    def parse(self, payload: dict[str, Any]) -> SensorFrame:
        raise NotImplementedError


class WebSensorProvider(SensorProvider):
    def parse(self, payload: dict[str, Any]) -> SensorFrame:
        location = payload.get("location") or {}
        motion = payload.get("motion") or {}
        audio = payload.get("audio") or {}

        lat = _as_float(location.get("lat"))
        lon = _as_float(location.get("lon"))
        speed = _as_float(location.get("speed"), 0.0)
        accuracy = _as_float(location.get("accuracy"), 100.0)
        isolation = _as_float(location.get("isolation"), 0.5)

        accel_mag = _as_float(motion.get("accelMag"), 0.0)
        gyro_mag = _as_float(motion.get("gyroMag"), 0.0)
        shake_score = _as_float(motion.get("shakeScore"), 0.0)
        fall_prob = _as_float(motion.get("fallProb"), 0.0)
        running_score = _as_float(motion.get("runningScore"), 0.0)

        rms = _as_float(audio.get("rms"), 0.0)
        scream_score = _as_float(audio.get("screamScore"), 0.0)
        freq = _as_float(audio.get("freq"), 0.0)
        keyword = (audio.get("keyword") or "").strip().lower()
        audio_class = (audio.get("audioClass") or "N/A").strip() or "N/A"

        is_night = _is_night_now()

        # Location risk combines night multiplier, poor GPS confidence, and isolation estimate.
        location_base = min(255.0, 50 + isolation * 120 + max(0.0, 40 - accuracy / 3))
        if is_night:
            location_base += 35
        if speed < 0.4:
            location_base += 10
        location_risk = int(max(0, min(255, round(location_base))))

        # Motion risk from composite phone dynamics.
        motion_base = (
            min(1.0, accel_mag / 25.0) * 90
            + min(1.0, gyro_mag / 18.0) * 60
            + min(1.0, shake_score) * 70
            + min(1.0, fall_prob) * 80
            + min(1.0, running_score) * 40
        )
        motion_risk = int(max(0, min(255, round(motion_base))))

        keyword_detected = audio.get("keyword_detected", False)
        keyword_risk = 0
        events: list[str] = []
        if keyword_detected or keyword:
            keyword_weights = {
                "help": 80, "danger": 95, "stop": 70, "leave me": 85, "save me": 90, "please help": 90
            }
            candidates = [keyword_weights.get(word, 0) for word in keyword.split()]
            candidates.append(keyword_weights.get(keyword, 0))
            if keyword_detected and not any(candidates):
                candidates.append(70)
                
            base_weight = max(candidates) if candidates else 0
            if base_weight > 0:
                keyword_risk = int(min(100, base_weight + (len(keyword)/10)*20) * 2.55)
                events.append("DISTRESS_KEYWORD")

        # Refined scream detection: High RMS + High Frequency band (2k-4k typical for screams)
        if scream_score > 0.7 or (rms > 0.3 and 1800 < freq < 4500):
            events.append("ACOUSTIC_ANOMALY")

        if shake_score > 0.8: events.append("PHONE_SHAKE")
        if running_score > 0.8: events.append("RUNNING_PATTERN")
        if fall_prob > 0.75: events.append("FALL_DETECTED")

        audio_base = min(255.0, rms * 300 + scream_score * 120 + keyword_risk)
        audio_risk = int(max(0, min(255, round(audio_base))))

        time_risk = 180 if is_night else 70

        return SensorFrame(
            location_risk=location_risk,
            time_risk=time_risk,
            motion_risk=motion_risk,
            audio_risk=audio_risk,
            events=events,
            is_night=is_night,
            lat=lat,
            lon=lon,
            audio_class=audio_class,
        )


def _as_float(value: Any, default: float | None = None) -> float:
    try:
        if value is None:
            raise ValueError("None")
        return float(value)
    except Exception:
        if default is None:
            return 0.0
        return default


def _is_night_now() -> bool:
    h = datetime.now().hour
    return h < 6 or h >= 19
