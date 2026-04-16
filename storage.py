from __future__ import annotations

import json
import sqlite3
from datetime import datetime
from typing import Any

from config import settings


def _conn() -> sqlite3.Connection:
    conn = sqlite3.connect(settings.db_path)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with _conn() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS profiles (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                name TEXT DEFAULT 'Primary User',
                alert_threshold INTEGER DEFAULT 192,
                safe_zones_json TEXT DEFAULT '[]',
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS emergency_contacts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                phone TEXT,
                email TEXT,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS risk_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp REAL NOT NULL,
                threat_level TEXT NOT NULL,
                combined_score REAL NOT NULL,
                moving_avg REAL NOT NULL,
                location_risk INTEGER NOT NULL,
                time_risk INTEGER NOT NULL,
                motion_risk INTEGER NOT NULL,
                audio_risk INTEGER NOT NULL,
                lat REAL,
                lon REAL,
                events_json TEXT DEFAULT '[]'
            );

            CREATE TABLE IF NOT EXISTS incidents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL,
                threat_level TEXT NOT NULL,
                combined_score REAL NOT NULL,
                lat REAL,
                lon REAL,
                events_json TEXT DEFAULT '[]',
                audio_class TEXT DEFAULT 'N/A',
                sensor_json TEXT DEFAULT '{}'
            );
            """
        )
        conn.execute(
            """
            INSERT OR IGNORE INTO profiles (id, name, alert_threshold, safe_zones_json, updated_at)
            VALUES (1, 'Primary User', ?, '[]', ?)
            """,
            (settings.default_alert_threshold, datetime.utcnow().isoformat()),
        )


def get_profile() -> dict[str, Any]:
    with _conn() as conn:
        row = conn.execute("SELECT * FROM profiles WHERE id = 1").fetchone()
        if not row:
            return {
                "name": "Primary User",
                "alert_threshold": settings.default_alert_threshold,
                "safe_zones": [],
            }
        return {
            "name": row["name"],
            "alert_threshold": row["alert_threshold"],
            "safe_zones": json.loads(row["safe_zones_json"] or "[]"),
            "updated_at": row["updated_at"],
        }


def upsert_profile(name: str, alert_threshold: int, safe_zones: list[dict[str, Any]]) -> dict[str, Any]:
    updated_at = datetime.utcnow().isoformat()
    with _conn() as conn:
        conn.execute(
            """
            UPDATE profiles
            SET name = ?, alert_threshold = ?, safe_zones_json = ?, updated_at = ?
            WHERE id = 1
            """,
            (name, alert_threshold, json.dumps(safe_zones), updated_at),
        )
    return get_profile()


def add_contact(name: str, phone: str | None, email: str | None) -> dict[str, Any]:
    created_at = datetime.utcnow().isoformat()
    with _conn() as conn:
        cur = conn.execute(
            """
            INSERT INTO emergency_contacts (name, phone, email, created_at)
            VALUES (?, ?, ?, ?)
            """,
            (name, phone, email, created_at),
        )
        contact_id = cur.lastrowid

    return {
        "id": contact_id,
        "name": name,
        "phone": phone,
        "email": email,
        "created_at": created_at,
    }


def list_contacts() -> list[dict[str, Any]]:
    with _conn() as conn:
        rows = conn.execute(
            "SELECT id, name, phone, email, created_at FROM emergency_contacts ORDER BY id DESC"
        ).fetchall()
    return [dict(r) for r in rows]


def save_risk_snapshot(
    *,
    timestamp: float,
    threat_level: str,
    combined_score: float,
    moving_avg: float,
    location_risk: int,
    time_risk: int,
    motion_risk: int,
    audio_risk: int,
    lat: float | None,
    lon: float | None,
    events: list[str],
) -> None:
    with _conn() as conn:
        conn.execute(
            """
            INSERT INTO risk_history (
                timestamp, threat_level, combined_score, moving_avg,
                location_risk, time_risk, motion_risk, audio_risk,
                lat, lon, events_json
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                timestamp,
                threat_level,
                combined_score,
                moving_avg,
                location_risk,
                time_risk,
                motion_risk,
                audio_risk,
                lat,
                lon,
                json.dumps(events),
            ),
        )


def list_recent_history(limit: int = 100) -> list[dict[str, Any]]:
    with _conn() as conn:
        rows = conn.execute(
            """
            SELECT * FROM risk_history
            ORDER BY id DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    out = []
    for row in rows:
        rec = dict(row)
        rec["events"] = json.loads(rec.get("events_json") or "[]")
        out.append(rec)
    return out


def save_incident(
    *,
    threat_level: str,
    combined_score: float,
    lat: float | None,
    lon: float | None,
    events: list[str],
    audio_class: str,
    sensor: dict[str, Any],
) -> dict[str, Any]:
    created_at = datetime.utcnow().isoformat()
    with _conn() as conn:
        cur = conn.execute(
            """
            INSERT INTO incidents (
                created_at, threat_level, combined_score, lat, lon,
                events_json, audio_class, sensor_json
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                created_at,
                threat_level,
                combined_score,
                lat,
                lon,
                json.dumps(events),
                audio_class,
                json.dumps(sensor),
            ),
        )
        incident_id = cur.lastrowid

    return {
        "id": incident_id,
        "created_at": created_at,
        "threat_level": threat_level,
        "combined_score": combined_score,
        "lat": lat,
        "lon": lon,
        "events": events,
        "audio_class": audio_class,
    }


def list_incidents(limit: int = 200) -> list[dict[str, Any]]:
    with _conn() as conn:
        rows = conn.execute(
            "SELECT * FROM incidents ORDER BY id DESC LIMIT ?",
            (limit,),
        ).fetchall()
    out = []
    for row in rows:
        rec = dict(row)
        rec["events"] = json.loads(rec.get("events_json") or "[]")
        rec["sensor"] = json.loads(rec.get("sensor_json") or "{}")
        out.append(rec)
    return out
