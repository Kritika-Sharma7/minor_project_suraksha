from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    app_env: str = "development"
    app_port: int = 8000
    allowed_origins: List[str] = ["http://localhost:3000"]
    db_path: str = "suraksha.db"

    # Twilio
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_from_number: str = ""
    alert_to_number: str = ""

    # Email
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    alert_email_to: str = ""

    # Threat Engine
    alert_cooldown_seconds: int = 60
    critical_threshold: int = 192
    high_threshold: int = 128
    suspicious_threshold: int = 64
    window_size: int = 5
    event_persistence_frames: int = 3
    default_alert_threshold: int = 192

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
