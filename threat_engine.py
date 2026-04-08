"""
Threat Engine — Python reimplementation of the Verilog FSM-based classifier.

Verilog FSM States  →  Python Enum
  SAFE        (2'b00)  →  ThreatLevel.SAFE
  SUSPICIOUS  (2'b01)  →  ThreatLevel.SUSPICIOUS
  HIGH        (2'b10)  →  ThreatLevel.HIGH
  CRITICAL    (2'b11)  →  ThreatLevel.CRITICAL

Risk score range: 0–255  (matches 8-bit Verilog register)
Weighted formula mirrors the RTL adder tree:
  combined = (loc*0.30 + time*0.20 + motion*0.30 + audio*0.20) scaled to 255
"""

from __future__ import annotations

import time
from collections import deque
from enum import Enum
from dataclasses import dataclass, field
from typing import Deque, List

from config import settings


class ThreatLevel(str, Enum):
    SAFE       = "SAFE"
    SUSPICIOUS = "SUSPICIOUS"
    HIGH       = "HIGH"
    CRITICAL   = "CRITICAL"


# Weight vector (must sum to 1.0)
WEIGHTS = {
    "location": 0.30,
    "time":     0.20,
    "motion":   0.30,
    "audio":    0.20,
}

# FSM transition table (mirrors Verilog case statement)
#   key   = (current_state, combined_score_band)
#   value = next_state
_FSM: dict[tuple[ThreatLevel, str], ThreatLevel] = {
    # From SAFE
    (ThreatLevel.SAFE,       "safe"):       ThreatLevel.SAFE,
    (ThreatLevel.SAFE,       "suspicious"): ThreatLevel.SUSPICIOUS,
    (ThreatLevel.SAFE,       "high"):       ThreatLevel.SUSPICIOUS,   # can't skip
    (ThreatLevel.SAFE,       "critical"):   ThreatLevel.HIGH,

    # From SUSPICIOUS
    (ThreatLevel.SUSPICIOUS, "safe"):       ThreatLevel.SAFE,
    (ThreatLevel.SUSPICIOUS, "suspicious"): ThreatLevel.SUSPICIOUS,
    (ThreatLevel.SUSPICIOUS, "high"):       ThreatLevel.HIGH,
    (ThreatLevel.SUSPICIOUS, "critical"):   ThreatLevel.HIGH,

    # From HIGH
    (ThreatLevel.HIGH,       "safe"):       ThreatLevel.SUSPICIOUS,   # decay, not instant reset
    (ThreatLevel.HIGH,       "suspicious"): ThreatLevel.SUSPICIOUS,
    (ThreatLevel.HIGH,       "high"):       ThreatLevel.HIGH,
    (ThreatLevel.HIGH,       "critical"):   ThreatLevel.CRITICAL,

    # From CRITICAL
    (ThreatLevel.CRITICAL,   "safe"):       ThreatLevel.HIGH,
    (ThreatLevel.CRITICAL,   "suspicious"): ThreatLevel.HIGH,
    (ThreatLevel.CRITICAL,   "high"):       ThreatLevel.HIGH,
    (ThreatLevel.CRITICAL,   "critical"):   ThreatLevel.CRITICAL,
}


def _score_to_band(score: float) -> str:
    if score >= settings.critical_threshold:
        return "critical"
    if score >= settings.high_threshold:
        return "high"
    if score >= settings.suspicious_threshold:
        return "suspicious"
    return "safe"


@dataclass
class RiskSnapshot:
    timestamp: float
    location_risk: int
    time_risk: int
    motion_risk: int
    audio_risk: int
    combined_score: float
    moving_avg: float
    threat_level: ThreatLevel
    alert_triggered: bool = False


@dataclass
class ThreatEngine:
    """
    Stateful FSM threat classifier with sliding-window moving average.
    Thread-safe for single-process FastAPI (asyncio single thread).
    """
    _state: ThreatLevel = field(default=ThreatLevel.SAFE, init=False)
    _window: Deque[float] = field(default_factory=lambda: deque(maxlen=settings.window_size), init=False)
    _history: List[RiskSnapshot] = field(default_factory=list, init=False)
    _last_alert_time: float = field(default=0.0, init=False)

    # ── Public API ────────────────────────────────────────────────────────

    def analyze(
        self,
        location_risk: int,
        time_risk: int,
        motion_risk: int,
        audio_risk: int,
    ) -> RiskSnapshot:
        """
        Main entry point. Mirrors the Verilog always@(posedge clk) block:
          1. Compute weighted score
          2. Push into sliding window
          3. Compute moving average (like Verilog shift-register accumulator)
          4. FSM transition
          5. Return snapshot
        """
        # 1. Weighted score (0–255 range)
        combined = (
            location_risk * WEIGHTS["location"]
            + time_risk   * WEIGHTS["time"]
            + motion_risk * WEIGHTS["motion"]
            + audio_risk  * WEIGHTS["audio"]
        )
        combined = max(0.0, min(255.0, combined))

        # 2 & 3. Sliding window → moving average
        self._window.append(combined)
        moving_avg = sum(self._window) / len(self._window)

        # 4. FSM transition using moving average (more stable than raw score)
        band = _score_to_band(moving_avg)
        self._state = _FSM[(self._state, band)]

        # 5. Alert cooldown check
        now = time.time()
        alert_triggered = False
        if self._state == ThreatLevel.CRITICAL:
            if (now - self._last_alert_time) >= settings.alert_cooldown_seconds:
                alert_triggered = True
                self._last_alert_time = now

        snap = RiskSnapshot(
            timestamp=now,
            location_risk=location_risk,
            time_risk=time_risk,
            motion_risk=motion_risk,
            audio_risk=audio_risk,
            combined_score=round(combined, 2),
            moving_avg=round(moving_avg, 2),
            threat_level=self._state,
            alert_triggered=alert_triggered,
        )
        self._history.append(snap)
        # Keep last 200 snapshots in memory
        if len(self._history) > 200:
            self._history.pop(0)

        return snap

    def reset(self):
        """Hard reset — mirrors Verilog active-low reset."""
        self._state = ThreatLevel.SAFE
        self._window.clear()

    @property
    def current_state(self) -> ThreatLevel:
        return self._state

    @property
    def history(self) -> List[RiskSnapshot]:
        return list(self._history)

    @property
    def window_scores(self) -> List[float]:
        return list(self._window)
