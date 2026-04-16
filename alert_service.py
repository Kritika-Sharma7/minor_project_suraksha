"""
Alert Service — Twilio SMS + SMTP Email
"""
from __future__ import annotations

import logging
from datetime import datetime

from config import settings
import storage

logger = logging.getLogger(__name__)


class AlertService:
    """Handles SMS via Twilio and email via SMTP."""

    def _recipient_numbers(self) -> list[str]:
        numbers = []
        if settings.alert_to_number:
            numbers.append(settings.alert_to_number)
        for c in storage.list_contacts():
            if c.get("phone"):
                numbers.append(c["phone"])
        # Keep order while removing duplicates.
        return list(dict.fromkeys(numbers))

    def _recipient_emails(self) -> list[str]:
        emails = []
        if settings.alert_email_to:
            emails.append(settings.alert_email_to)
        for c in storage.list_contacts():
            if c.get("email"):
                emails.append(c["email"])
        return list(dict.fromkeys(emails))

    # ── SMS ───────────────────────────────────────────────────────────────

    async def send_sms(self, message: str) -> bool:
        if not all([settings.twilio_account_sid, settings.twilio_auth_token, settings.twilio_from_number]):
            logger.warning("Twilio credentials not configured — skipping SMS")
            return False
        recipients = self._recipient_numbers()
        if not recipients:
            logger.warning("No SMS recipients configured")
            return False
        try:
            from twilio.rest import Client
            client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
            for to in recipients:
                msg = client.messages.create(
                    body=message,
                    from_=settings.twilio_from_number,
                    to=to,
                )
                logger.info("SMS sent to %s: %s", to, msg.sid)
            return True
        except Exception as e:
            logger.error("SMS failed: %s", e)
            return False

    # ── Email ─────────────────────────────────────────────────────────────

    async def send_email(self, subject: str, body: str) -> bool:
        recipients = self._recipient_emails()
        if not all([settings.smtp_user, settings.smtp_password]) or not recipients:
            logger.warning("Email credentials not configured — skipping email")
            return False
        try:
            import aiosmtplib
            from email.mime.text import MIMEText
            from email.mime.multipart import MIMEMultipart

            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"]    = settings.smtp_user
            msg["To"]      = ", ".join(recipients)

            html_body = f"""
            <html><body style="font-family:sans-serif;background:#0f0f0f;color:#fff;padding:24px">
              <div style="background:#1a0000;border:2px solid #ff3333;border-radius:12px;padding:24px;max-width:500px">
                <h2 style="color:#ff3333;margin:0 0 16px">🚨 CRITICAL SAFETY ALERT</h2>
                <p style="margin:0 0 8px">{body}</p>
                <hr style="border-color:#333;margin:16px 0"/>
                <small style="color:#888">Women Safety Detection System • {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}</small>
              </div>
            </body></html>
            """
            msg.attach(MIMEText(body,      "plain"))
            msg.attach(MIMEText(html_body, "html"))

            await aiosmtplib.send(
                msg,
                hostname=settings.smtp_host,
                port=settings.smtp_port,
                username=settings.smtp_user,
                password=settings.smtp_password,
                start_tls=True,
            )
            logger.info("Email sent to %s", recipients)
            return True
        except Exception as e:
            logger.error("Email failed: %s", e)
            return False

    # ── Combined alert ────────────────────────────────────────────────────

    async def trigger_critical_alert(
        self,
        threat_level: str,
        combined_score: float,
        location_risk: int,
        time_risk: int,
        motion_risk: int,
        audio_risk: int,
        audio_class: str = "N/A",
        reasons: list[str] = None,
        lat: float = None,
        lon: float = None,
    ) -> dict:
        ts = datetime.now().strftime("%I:%M %p") # 10:34 PM format
        reasons = reasons or []
        reason_str = "\n".join([f"- {r}" for r in reasons]) if reasons else "No specific reasons determined."
        
        loc_str = f"{lat}, {lon}" if lat and lon else "Location data pending"

        # Dynamically set header based on level
        header = "🚨 CRITICAL ALERT"
        if threat_level == "HIGH":
            header = "⚠️ HIGH THREAT WARNING"
        elif threat_level == "SUSPICIOUS":
            header = "🔍 SUSPICIOUS ACTIVITY"

        body = (
            f"{header}\n\n"
            f"Reason:\n{reason_str}\n\n"
            f"Location: {loc_str}\n"
            f"Time: {ts}\n"
            f"Date: {datetime.now().strftime('%Y-%m-%d')}\n\n"
            f"-- Technical Context --\n"
            f"Severity Index: {combined_score:.1f}/255\n"
            f"Sensor Fusion: Active\n"
        )
        
        # Short SMS for immediate notice
        sms_msg = f"{header}: {reasons[0] if reasons else threat_level} at {ts}. Link: [Secure Portal]"
        
        sms_ok   = await self.send_sms(sms_msg)
        email_ok = await self.send_email(f"{header} — {datetime.now().strftime('%Y-%m-%d %H:%M')}", body)
        
        return {
            "sms_sent":   sms_ok,
            "email_sent": email_ok,
            "message":    body,
            "timestamp":  ts,
        }
