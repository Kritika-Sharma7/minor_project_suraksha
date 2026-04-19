"""
Suraksha AI — Alert Service
Handles Twilio SMS and SMTP Email alerts.

Key design decisions:
  1. Twilio client.messages.create() is synchronous — wrapped in
     asyncio.to_thread() to avoid blocking the FastAPI event loop.
  2. Live Google Maps URL embedded in SMS when coordinates are available.
  3. Offline queue (asyncio.Queue) buffers messages on Twilio failure;
     a background task retries every offline_queue_flush_interval_s seconds.
  4. Severity index on 0–100 scale (matches new risk engine).
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from typing import Optional

from config import settings
import storage

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
#  Offline SMS queue
# ─────────────────────────────────────────────────────────────────────────────

# Holds (recipients: list[str], body: str) tuples
_offline_queue: asyncio.Queue = asyncio.Queue(maxsize=settings.sms_max_offline_queue)


async def start_offline_flush_task() -> None:
    """
    Background task that retries queued SMS messages periodically.
    Call once from main.py lifespan startup.
    """
    while True:
        await asyncio.sleep(settings.offline_queue_flush_interval_s)
        flushed = 0
        retry: list = []
        while not _offline_queue.empty():
            item = await _offline_queue.get()
            recipients, body = item
            ok = await _send_sms_now(recipients, body)
            if not ok:
                retry.append(item)
            else:
                flushed += 1
        # Re-queue failures (best-effort, drop if queue is full)
        for item in retry:
            try:
                _offline_queue.put_nowait(item)
            except asyncio.QueueFull:
                logger.warning("Offline SMS queue full — dropping retry item")
        if flushed:
            logger.info("Offline SMS flush: sent %d queued message(s)", flushed)


# ─────────────────────────────────────────────────────────────────────────────
#  AlertService
# ─────────────────────────────────────────────────────────────────────────────

class AlertService:
    """Handles SMS via Twilio and email via SMTP."""

    def _recipient_numbers(self) -> list[str]:
        numbers = []
        if settings.alert_to_number:
            numbers.append(settings.alert_to_number)
        for c in storage.list_contacts():
            if c.get("phone"):
                numbers.append(c["phone"])
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

        ok = await _send_sms_now(recipients, message)
        if not ok:
            # Attempt to queue for later retry
            try:
                _offline_queue.put_nowait((recipients, message))
                logger.info("SMS queued for offline retry (queue size: %d)", _offline_queue.qsize())
            except asyncio.QueueFull:
                logger.error("Offline SMS queue full — message dropped")
        return ok

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
                <p style="margin:0 0 8px;white-space:pre-line">{body}</p>
                <hr style="border-color:#333;margin:16px 0"/>
                <small style="color:#888">Suraksha AI Safety System • {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}</small>
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
        location_risk: int = 0,
        time_risk: int = 0,
        motion_risk: int = 0,
        audio_risk: int = 0,
        audio_class: str = "N/A",
        reasons: Optional[list[str]] = None,
        lat: Optional[float] = None,
        lon: Optional[float] = None,
    ) -> dict:
        ts = datetime.now().strftime("%I:%M %p")
        reasons = reasons or []
        reason_str = "\n".join([f"- {r}" for r in reasons]) if reasons else "No specific reasons determined."

        # Live map link — embedded when coordinates are available
        map_link = ""
        if lat is not None and lon is not None:
            map_url = settings.maps_live_url_template.format(lat=lat, lon=lon)
            map_link = f"\nLive Location: {map_url}"

        loc_str = f"{lat:.5f}, {lon:.5f}" if (lat is not None and lon is not None) else "Location data pending"

        header = "🚨 CRITICAL ALERT"
        if threat_level == "HIGH":
            header = "⚠️ HIGH THREAT WARNING"
        elif threat_level == "SUSPICIOUS":
            header = "🔍 SUSPICIOUS ACTIVITY"

        body = (
            f"{header}\n\n"
            f"Reason:\n{reason_str}\n\n"
            f"Location: {loc_str}{map_link}\n"
            f"Time: {ts}\n"
            f"Date: {datetime.now().strftime('%Y-%m-%d')}\n\n"
            f"-- Technical Context --\n"
            f"Severity Index: {combined_score:.1f}/100\n"
            f"Sensor Fusion: Active\n"
            f"Sent by: {settings.alert_sms_sender_name}\n"
        )

        # Short SMS: first reason + map link
        sms_body = (
            f"{settings.alert_sms_sender_name} {header}: "
            f"{reasons[0] if reasons else threat_level} at {ts}."
            f"{map_link if map_link else ' [Secure Portal]'}"
        )

        sms_ok   = await self.send_sms(sms_body)
        email_ok = await self.send_email(
            f"{header} — {datetime.now().strftime('%Y-%m-%d %H:%M')}", body
        )

        return {
            "sms_sent":   sms_ok,
            "email_sent": email_ok,
            "message":    body,
            "timestamp":  ts,
        }


# ─────────────────────────────────────────────────────────────────────────────
#  Internal helper — actual Twilio call (uses asyncio.to_thread)
# ─────────────────────────────────────────────────────────────────────────────

async def _send_sms_now(recipients: list[str], body: str) -> bool:
    """
    Sends SMS via Twilio.
    The synchronous client.messages.create() is offloaded to a thread pool
    via asyncio.to_thread() to avoid blocking the FastAPI event loop.
    """
    try:
        from twilio.rest import Client

        def _blocking_send() -> list[str]:
            client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
            sids = []
            for to in recipients:
                msg = client.messages.create(
                    body=body,
                    from_=settings.twilio_from_number,
                    to=to,
                )
                sids.append(msg.sid)
            return sids

        sids = await asyncio.to_thread(_blocking_send)
        logger.info("SMS sent to %d recipient(s): %s", len(sids), sids)
        return True
    except Exception as e:
        logger.error("SMS send failed: %s", e)
        return False
