"""
Router: /api/v1/analyze-risk
"""
from __future__ import annotations

from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel, Field, field_validator

from threat_engine import (
    ThreatEngine, RiskSnapshot, state_color, recommendation
)
from alert_service import AlertService
from ws import broadcast

router = APIRouter()
alert_svc = AlertService()


class RiskInput(BaseModel):
    location_risk: int = Field(..., ge=0, le=255, description="Location danger score 0-255")
    time_risk:     int = Field(..., ge=0, le=255, description="Time-of-day risk score 0-255")
    motion_risk:   int = Field(..., ge=0, le=255, description="Abnormal motion score 0-255")
    audio_risk:    int = Field(..., ge=0, le=255, description="Audio classification risk 0-255")
    audio_class:   str = Field(default="N/A", description="Audio class label from ML model")
    events: list[str] = Field(default_factory=list)


class RiskResponse(BaseModel):
    combined_score: float
    moving_avg:     float
    risk_delta:     float
    threat_level:   str
    alert_triggered: bool
    window_scores:  list[float]
    weights:        dict[str, float]
    events:         list[str]
    state_color:    str
    recommendation: str
    timestamp:      float
    confidence:     float
    reasons:        list[str]
    mode:           str
    trend:          str




@router.post("/analyze-risk", response_model=RiskResponse)
async def analyze_risk(payload: RiskInput, request: Request):
    """
    Analyze multi-modal risk inputs through the FSM threat engine.
    Returns current threat level, combined score, and sliding-window state.
    Auto-triggers alerts when CRITICAL threshold is reached (with cooldown).
    """
    engine = request.app.state.threat_engine
    snap   = engine.analyze(
        location_risk=payload.location_risk,
        time_risk=payload.time_risk,
        motion_risk=payload.motion_risk,
        audio_risk=payload.audio_risk,
        events=payload.events,
    )

    # If engine flagged alert and we should dispatch
    if snap.alert_triggered:
        import asyncio
        asyncio.create_task(
            alert_svc.trigger_critical_alert(
                threat_level=snap.threat_level,
                combined_score=snap.combined_score,
                location_risk=payload.location_risk,
                time_risk=payload.time_risk,
                motion_risk=payload.motion_risk,
                audio_risk=payload.audio_risk,
                audio_class=payload.audio_class,
                reasons=snap.reasons,
            )
        )

    response = RiskResponse(
        combined_score=snap.combined_score,
        moving_avg=snap.moving_avg,
        risk_delta=snap.risk_delta,
        threat_level=snap.threat_level,
        alert_triggered=snap.alert_triggered,
        window_scores=engine.window_scores,
        weights=snap.weights,
        events=snap.events,
        state_color=state_color(snap.state),
        recommendation=recommendation(snap.state),
        timestamp=snap.timestamp,
        confidence=snap.confidence,
        reasons=snap.reasons,
        mode=snap.mode,
        trend=snap.trend,
    )

    await broadcast(
        {
            "type": "risk_update",
            "threat_level": response.threat_level,
            "combined_score": response.combined_score,
            "moving_avg": response.moving_avg,
            "risk_delta": response.risk_delta,
            "trend": response.trend,
            "events": response.events,
            "weights": response.weights,
            "window_scores": response.window_scores,
            "state_color": response.state_color,
            "recommendation": response.recommendation,
            "alert_triggered": response.alert_triggered,
            "timestamp": response.timestamp,
            "confidence": response.confidence,
            "reasons": response.reasons,
            "mode": response.mode,
            "inputs": {
                "location": payload.location_risk,
                "time": payload.time_risk,
                "motion": payload.motion_risk,
                "audio": payload.audio_risk,
            },
        }
    )

    return response


@router.get("/history")
async def get_history(request: Request, limit: int = 50):
    """Return recent risk analysis history."""
    engine = request.app.state.threat_engine
    history = engine.history[-limit:]
    return {
        "count": len(history),
        "items": [
            {
                "timestamp":     s.timestamp,
                "threat_level":  s.threat_level,
                "combined_score": s.combined_score,
                "moving_avg":    s.moving_avg,
                "trend":         s.trend,
                "inputs": {
                    "location": s.location_risk,
                    "time":     s.time_risk,
                    "motion":   s.motion_risk,
                    "audio":    s.audio_risk,
                },
                "events": s.events,
                "risk_delta": s.risk_delta,
                "alert_triggered": s.alert_triggered,
                "confidence": s.confidence,
                "reasons": s.reasons,
                "mode": s.mode,
            }
            for s in history
        ],
    }


@router.post("/reset")
async def reset_engine(request: Request):
    """Hard-reset the FSM to SAFE state."""
    request.app.state.threat_engine.reset()
    return {"status": "reset", "state": "SAFE"}
