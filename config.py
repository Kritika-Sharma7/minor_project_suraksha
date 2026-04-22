"""
Suraksha AI — Central Configuration
All settings read from environment variables / .env file.
"""
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # ── App ──────────────────────────────────────────────────────────────────
    app_env: str = "development"
    app_port: int = 8000
    allowed_origins: List[str] = ["http://localhost:3000", "http://localhost:3001"]

    # ── Database ─────────────────────────────────────────────────────────────
    db_path: str = "suraksha.db"

    # ── Twilio (SMS) ─────────────────────────────────────────────────────────
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_from_number: str = ""
    alert_to_number: str = ""

    # ── Email (SMTP) ─────────────────────────────────────────────────────────
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    alert_email_to: str = ""

    # ── Route API ────────────────────────────────────────────────────────────
    mapbox_token: str = ""
    google_maps_key: str = ""
    # Which provider to use: "mapbox" | "google"
    route_api_provider: str = "google"

    # ── Sliding-window / Temporal ────────────────────────────────────────────
    window_size: int = 15                   # frames kept in StreamBuffer
    persistence_frames: int = 3             # consecutive frames for ALERT
    event_persistence_frames: int = 3       # legacy compat

    # ── Acceleration thresholds ──────────────────────────────────────────────
    jerk_threshold: float = 8.0             # m/s²  — sudden impact
    fall_spike_threshold: float = 25.0      # m/s²  — fall phase-1 spike
    fall_quiet_threshold: float = 2.0       # m/s²  — fall phase-2 stillness
    fall_quiet_frames: int = 2              # consecutive quiet frames required

    # ── GPS thresholds ───────────────────────────────────────────────────────
    stop_speed_threshold: float = 1.0       # m/s  — below this = stationary
    stop_time_threshold: int = 180          # seconds before stationary penalty
    stop_score_window_s: int = 300          # seconds for normalized stop_score (0–1)
    route_deviation_meters: float = 200.0   # meters off-route

    # ── Audio thresholds ─────────────────────────────────────────────────────
    audio_keyword_energy_threshold: float = 0.15   # RMS for keyword+energy combo
    audio_high_energy_threshold: float = 0.25      # RMS for energy-only alert

    # ── FSM thresholds — expressed as SAFETY SCORE (0–100) ──────────────────
    # "Thresholds represent safety score, not risk."
    # safety_score = 100 - risk
    # safety_score < 70  →  at least WARNING  (equivalent: risk > 30)
    # safety_score < 40  →  at least DANGER   (equivalent: risk > 60)
    warning_threshold: float = 70.0
    danger_threshold: float = 40.0

    # ── Legacy thresholds (0–255 scale kept for backward compat) ────────────
    critical_threshold: int = 192
    high_threshold: int = 128
    suspicious_threshold: int = 64
    default_alert_threshold: int = 192

    # ── Alert cooldown ───────────────────────────────────────────────────────
    alert_cooldown_seconds: int = 60

    # ── Route ────────────────────────────────────────────────────────────────
    # Live map URL embedded in SMS when coordinates are available
    maps_live_url_template: str = "https://maps.google.com/?q={lat},{lon}"
    route_deviation_consecutive_frames: int = 3   # frames off-route before risk fires

    # ── SMS offline queue ────────────────────────────────────────────────────
    sms_max_offline_queue: int = 20               # max queued messages on Twilio failure
    offline_queue_flush_interval_s: int = 30      # seconds between retry sweeps
    alert_sms_sender_name: str = "Suraksha AI"    # prefix in SMS body

    # ── Fall detection ───────────────────────────────────────────────────────
    fall_window_s: float = 5.0                    # seconds post-spike to detect quiet

    # ── GPS quality ──────────────────────────────────────────────────────────
    min_gps_valid_frames: int = 3                 # frames before haversine speed trusted

    # ── Audio: ZCR speech gate ───────────────────────────────────────────────
    # ZCR >= this threshold is characteristic of voiced speech
    # Used to gate high-energy alert: only fires if speech-like (not impact noise)
    audio_zcr_speech_threshold: float = 0.15

    # ── Cab mode ─────────────────────────────────────────────────────────────
    # Crawl speed (m/s) below which we flag slow movement while route is active
    cab_speed_suspicion_mps: float = 2.0
    # Seconds a cab can be stopped before triggering a stop-behaviour penalty
    cab_stop_threshold_s: int = 120

    # ── WebSocket heartbeat ──────────────────────────────────────────────────
    ws_heartbeat_interval_s: int = 25             # server-ping interval (seconds)

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"   # silently skip VITE_ and other frontend-only vars


settings = Settings()
