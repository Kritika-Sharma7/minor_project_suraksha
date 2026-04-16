"""
Router: /api/v1/trigger-alert
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from alert_service import AlertService

router = APIRouter()
alert_svc = AlertService()


class ManualAlertRequest(BaseModel):
    threat_level:   str   = "CRITICAL"
    combined_score: float = 255.0
    location_risk:  int   = 255
    time_risk:      int   = 255
    motion_risk:    int   = 255
    audio_risk:     int   = 255
    audio_class:    str   = "manual"
    message:        str   = ""


class AlertResponse(BaseModel):
    sms_sent:    bool
    email_sent:  bool
    message:     str
    timestamp:   str


@router.post("/trigger-alert", response_model=AlertResponse)
async def trigger_alert(payload: ManualAlertRequest):
    """
    Manually trigger emergency alerts (SMS + Email).
    Used for panic button / override scenarios.
    """
    result = await alert_svc.trigger_critical_alert(
        threat_level=payload.threat_level,
        combined_score=payload.combined_score,
        location_risk=payload.location_risk,
        time_risk=payload.time_risk,
        motion_risk=payload.motion_risk,
        audio_risk=payload.audio_risk,
        audio_class=payload.audio_class,
    )
    return AlertResponse(**result)


@router.get("/alert-status")
async def alert_status():
    """Returns alert service configuration status (no secrets exposed)."""
    from config import settings
    import storage
    contacts = storage.list_contacts()
    return {
        "sms_configured":   bool(settings.twilio_account_sid and settings.twilio_auth_token),
        "email_configured": bool(settings.smtp_user and settings.smtp_password),
        "cooldown_seconds": settings.alert_cooldown_seconds,
        "alert_to_number":  f"***{settings.alert_to_number[-4:]}" if settings.alert_to_number else None,
        "alert_email_to":   settings.alert_email_to,
        "contact_count": len(contacts),
        "contacts_with_phone": len([c for c in contacts if c.get("phone")]),
        "contacts_with_email": len([c for c in contacts if c.get("email")]),
    }
