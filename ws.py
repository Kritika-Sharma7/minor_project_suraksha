"""
WebSocket router — pushes threat state updates to connected clients.
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

import storage
from sensor_provider import WebSensorProvider
from threat_engine import ThreatLevel

logger = logging.getLogger(__name__)
router = APIRouter()

# Global connection registry
_connections: Set[WebSocket] = set()
_provider = WebSensorProvider()


def _recommendation(level: ThreatLevel) -> str:
    return {
        ThreatLevel.SAFE: "Environment appears safe. Continue monitoring.",
        ThreatLevel.SUSPICIOUS: "Anomalies detected. Stay alert and keep trusted contacts informed.",
        ThreatLevel.HIGH: "High threat indicators detected. Move to a safer/public area.",
        ThreatLevel.CRITICAL: "Critical danger detected. Triggering emergency escalation.",
    }[level]


def _state_color(level: ThreatLevel) -> str:
    return {
        ThreatLevel.SAFE: "#22c55e",
        ThreatLevel.SUSPICIOUS: "#f59e0b",
        ThreatLevel.HIGH: "#f97316",
        ThreatLevel.CRITICAL: "#ef4444",
    }[level]


@router.websocket("/ws")
async def threat_stream(websocket: WebSocket):
    """
    WebSocket endpoint. Clients connect here to receive real-time threat
    updates pushed from the /analyze-risk endpoint.
    """
    await websocket.accept()
    _connections.add(websocket)
    logger.info("WS client connected (%d total)", len(_connections))
    try:
        while True:
            raw = await websocket.receive_text()
            message = json.loads(raw)
            msg_type = message.get("type")

            if msg_type == "sensor_frame":
                payload = message.get("payload") or {}
                frame = _provider.parse(payload)
                engine = websocket.app.state.threat_engine
                snap = engine.analyze(
                    location_risk=frame.location_risk,
                    time_risk=frame.time_risk,
                    motion_risk=frame.motion_risk,
                    audio_risk=frame.audio_risk,
                    events=frame.events,
                    is_night=frame.is_night,
                )

                update = {
                    "type": "risk_update",
                    "threat_level": snap.threat_level.value,
                    "combined_score": snap.combined_score,
                    "moving_avg": snap.moving_avg,
                    "risk_delta": snap.risk_delta,
                    "trend": snap.trend,
                    "weights": snap.weights,
                    "events": snap.events,
                    "window_scores": engine.window_scores,
                    "state_color": _state_color(snap.threat_level),
                    "recommendation": _recommendation(snap.threat_level),
                    "alert_triggered": snap.alert_triggered,
                    "timestamp": snap.timestamp,
                    "confidence": snap.confidence,
                    "reasons": snap.reasons,
                    "mode": snap.mode,
                    "inputs": {
                        "location": frame.location_risk,
                        "time": frame.time_risk,
                        "motion": frame.motion_risk,
                        "audio": frame.audio_risk,
                    },
                    "geo": {"lat": frame.lat, "lon": frame.lon},
                }

                storage.save_risk_snapshot(
                    timestamp=snap.timestamp,
                    threat_level=snap.threat_level.value,
                    combined_score=snap.combined_score,
                    moving_avg=snap.moving_avg,
                    location_risk=frame.location_risk,
                    time_risk=frame.time_risk,
                    motion_risk=frame.motion_risk,
                    audio_risk=frame.audio_risk,
                    lat=frame.lat,
                    lon=frame.lon,
                    events=snap.events,
                )

                if snap.threat_level in {ThreatLevel.HIGH, ThreatLevel.CRITICAL}:
                    incident = storage.save_incident(
                        threat_level=snap.threat_level.value,
                        combined_score=snap.combined_score,
                        lat=frame.lat,
                        lon=frame.lon,
                        events=snap.events,
                        audio_class=frame.audio_class,
                        sensor=payload,
                    )
                    update["incident"] = incident

                await broadcast(update)
            elif msg_type == "set_mode":
                new_mode = message.get("mode")
                if new_mode:
                    websocket.app.state.threat_engine.set_mode(new_mode)
                    await websocket.send_json({"type": "mode_set", "mode": new_mode})
            elif msg_type == "subscribe":
                await websocket.send_json({"type": "subscribed", "ok": True})
            elif msg_type == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        _connections.discard(websocket)
        logger.info("WS client disconnected (%d remaining)", len(_connections))
    except Exception as exc:
        _connections.discard(websocket)
        logger.warning("WS client error (%s), remaining=%d", exc, len(_connections))


async def broadcast(payload: dict):
    """Broadcast a threat update to all connected WS clients."""
    dead = set()
    msg = json.dumps(payload)
    for ws in list(_connections):
        try:
            await ws.send_text(msg)
        except Exception:
            dead.add(ws)
    _connections.difference_update(dead)

