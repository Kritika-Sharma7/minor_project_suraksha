"""
Alert Service — Twilio SMS + SMTP Email
"""
from __future__ import annotations

import logging
from datetime import datetime

from config import settings

logger = logging.getLogger(__name__)


class AlertService:
    """Handles SMS via Twilio and email via SMTP."""

    # ── SMS ───────────────────────────────────────────────────────────────

    async def send_sms(self, message: str) -> bool:
        if not all([settings.twilio_account_sid, settings.twilio_auth_token, settings.twilio_from_number]):
            logger.warning("Twilio credentials not configured — skipping SMS")
            return False
        try:
            from twilio.rest import Client
            client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
            msg = client.messages.create(
                body=message,
                from_=settings.twilio_from_number,
                to=settings.alert_to_number,
            )
            logger.info("SMS sent: %s", msg.sid)
            return True
        except Exception as e:
            logger.error("SMS failed: %s", e)
            return False

    # ── Email ─────────────────────────────────────────────────────────────

    async def send_email(self, subject: str, body: str) -> bool:
        if not all([settings.smtp_user, settings.smtp_password, settings.alert_email_to]):
            logger.warning("Email credentials not configured — skipping email")
            return False
        try:
            import aiosmtplib
            from email.mime.text import MIMEText
            from email.mime.multipart import MIMEMultipart

            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"]    = settings.smtp_user
            msg["To"]      = settings.alert_email_to

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
            logger.info("Email sent to %s", settings.alert_email_to)
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
    ) -> dict:
        ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        body = (
            f"⚠️ THREAT LEVEL: {threat_level}\n"
            f"Risk Score: {combined_score:.1f}/255\n"
            f"Location Risk: {location_risk}/255\n"
            f"Time Risk: {time_risk}/255\n"
            f"Motion Risk: {motion_risk}/255\n"
            f"Audio Risk: {audio_risk}/255 ({audio_class})\n"
            f"Time: {ts}"
        )
        sms_ok   = await self.send_sms(f"🚨 SAFETY ALERT — {threat_level} | Score: {combined_score:.0f}/255 | {ts}")
        email_ok = await self.send_email(f"🚨 CRITICAL Safety Alert — {ts}", body)
        return {
            "sms_sent":   sms_ok,
            "email_sent": email_ok,
            "message":    body,
            "timestamp":  ts,
        }
