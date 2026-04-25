"""
Suraksha AI — WebSocket Router
Bidirectional real-time channel between client and threat engine.

Supported incoming message types:
  { type: "sensor_frame", payload: {...} }    → runs full pipeline, broadcasts risk_update
  { type: "set_route", start:[lat,lon], destination:[lat,lon] } → fetches & stores route
  { type: "set_mode", mode: "women|cab|elder" }               → switches detection mode
  { type: "subscribe" }                                         → ACK
  { type: "ping" }                                              → pong

Output schema (risk_update):
  {
    type, state, risk, safety_score, confidence, moving_avg, trend,
    alert_triggered, reasons, explain, features, geo, mode,
    state_color, recommendation, timestamp,
    incident (if saved)
  }
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

import storage
from sensor_provider import SensorIngestionLayer
from threat_engine import (
    ThreatEngine, RiskSnapshot, state_color, recommendation
)
from route_service import RouteService
from alert_service import AlertService

logger = logging.getLogger(__name__)
router = APIRouter()

# Global connection registry
_connections: Set[WebSocket] = set()
_ingestion = SensorIngestionLayer()
_alert_svc = AlertService()


# ─────────────────────────────────────────────────────────────────────────────
#  WebSocket endpoint
# ─────────────────────────────────────────────────────────────────────────────

@router.websocket("/ws")
async def threat_stream(websocket: WebSocket):
    """
    Primary WebSocket endpoint.
    Clients send sensor frames and receive real-time threat state updates.
    A heartbeat ping is sent every settings.ws_heartbeat_interval_s seconds
    to detect and clean up dead connections.
    """
    await websocket.accept()
    _connections.add(websocket)
    logger.info("WS client connected (%d total)", len(_connections))

    # Per-connection state
    engine: ThreatEngine = websocket.app.state.threat_engine
    route_svc: RouteService = websocket.app.state.route_service

    # Heartbeat task
    from config import settings
    heartbeat_task = asyncio.create_task(
        _heartbeat(websocket, settings.ws_heartbeat_interval_s)
    )

    try:
        while True:
            raw = await websocket.receive_text()
            message = json.loads(raw)
            msg_type = message.get("type")

            # ── sensor_frame ──────────────────────────────────────────
            if msg_type == "sensor_frame":
                payload = message.get("payload") or {}
                frame = _ingestion.normalize(payload)
                snap = engine.process(frame, route_svc)
                update = _build_risk_update(snap, payload)

                # Persist to DB
                storage.save_risk_snapshot(
                    timestamp     = snap.timestamp,
                    threat_level  = snap.threat_level,
                    combined_score= snap.risk,
                    moving_avg    = snap.moving_avg,
                    location_risk = snap.location_risk,
                    time_risk     = snap.time_risk,
                    motion_risk   = snap.motion_risk,
                    audio_risk    = snap.audio_risk,
                    lat           = snap.lat,
                    lon           = snap.lon,
                    events        = snap.events,
                )

                # Save incident for HIGH / CRITICAL states
                if snap.state in {"DANGER", "ALERT"}:
                    incident = storage.save_incident(
                        threat_level  = snap.threat_level,
                        combined_score= snap.risk,
                        lat           = snap.lat,
                        lon           = snap.lon,
                        events        = snap.events,
                        audio_class   = snap.audio_class,
                        sensor        = payload,
                    )
                    update["incident"] = incident

                # Trigger external alert on ALERT state
                if snap.alert_triggered:
                    async def _fire_alert_and_log(snap=snap):
                        result = await _alert_svc.trigger_critical_alert(
                            threat_level  = snap.threat_level,
                            combined_score= snap.risk,
                            reasons       = snap.reasons,
                            lat           = snap.lat,
                            lon           = snap.lon,
                        )
                        logger.info(
                            "[Alert] SMS=%s | Email=%s | Level=%s | Score=%.1f | lat=%s lon=%s",
                            "✓ SENT" if result["sms_sent"]   else "✗ FAILED",
                            "✓ SENT" if result["email_sent"] else "✗ FAILED",
                            snap.threat_level,
                            snap.risk,
                            f"{snap.lat:.5f}" if snap.lat else "N/A",
                            f"{snap.lon:.5f}" if snap.lon else "N/A",
                        )
                        await broadcast({
                            "type":       "alert_sent",
                            "sms_sent":   result["sms_sent"],
                            "email_sent": result["email_sent"],
                            "timestamp":  result["timestamp"],
                        })
                    asyncio.create_task(_fire_alert_and_log())

                await broadcast(update)

            # ── set_route ─────────────────────────────────────────────
            elif msg_type == "set_route":
                waypoints_raw = message.get("waypoints")
                ok = False
                if (isinstance(waypoints_raw, list) and len(waypoints_raw) >= 2):
                    # Frontend sends pre-computed route points (correct travel mode).
                    # Store them directly — no second API fetch needed.
                    route = [(float(w[0]), float(w[1])) for w in waypoints_raw]
                    route_svc.store_route(route)
                    ok = True
                else:
                    start_raw = message.get("start")       # [lat, lon]
                    dest_raw  = message.get("destination") # [lat, lon]
                    if (start_raw and dest_raw
                            and len(start_raw) == 2 and len(dest_raw) == 2):
                        start = (float(start_raw[0]), float(start_raw[1]))
                        dest  = (float(dest_raw[0]),  float(dest_raw[1]))
                        ok = await route_svc.fetch_and_store(start, dest)
                summary = route_svc.route_summary()
                await websocket.send_json({
                    "type":      "route_set",
                    "ok":        ok,
                    "waypoints": summary["waypoints"],
                    "provider":  summary["provider"],
                    "summary":   summary,
                    "error":     None if ok else "Invalid route data.",
                })

            # ── set_mode ──────────────────────────────────────────────
            elif msg_type == "set_mode":
                new_mode = message.get("mode", "")
                engine.set_mode(new_mode)
                await websocket.send_json({"type": "mode_set", "mode": new_mode})

            # ── subscribe ─────────────────────────────────────────────
            elif msg_type == "subscribe":
                await websocket.send_json({"type": "subscribed", "ok": True})

            # ── ping ──────────────────────────────────────────────────
            elif msg_type == "ping":
                await websocket.send_json({"type": "pong", "ts": time.time()})

    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.warning("WS client error: %s", exc)
    finally:
        heartbeat_task.cancel()
        _connections.discard(websocket)
        logger.info("WS client disconnected (%d remaining)", len(_connections))


# ─────────────────────────────────────────────────────────────────────────────
#  Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _build_risk_update(snap: RiskSnapshot, raw_payload: dict) -> dict:
    """
    Construct the full risk_update payload.
    All fields are plain JSON-serialisable types.
    """
    feat = snap.features
    return {
        "type":            "risk_update",
        # Core state
        "state":           snap.state,
        "risk":            snap.risk,
        "safety_score":    snap.safety_score,
        "confidence":      snap.confidence,
        "moving_avg":      snap.moving_avg,
        "trend":           snap.trend,
        "alert_triggered": snap.alert_triggered,
        # Intelligence Layer
        "danger_streak":   snap.danger_streak,
        "countdown_max":   snap.countdown_max,
        "reliability":     snap.reliability,
        # Explainability
        "reasons":         snap.reasons,
        "explain":         snap.explain,
        # Feature detail
        "features": {
            "speed_mps":            feat.speed_mps,
            "speed_kmh":            feat.speed_kmh,
            "stop_duration_s":      feat.stop_duration_s,
            "stop_score":           feat.stop_score,
            "route_deviation":      feat.route_deviation,
            "route_deviation_m":    feat.route_deviation_m,
            "deviation_score":      feat.deviation_score,
            "confirmed_deviation":  feat.confirmed_deviation,
            "consecutive_dev_frames": feat.consecutive_dev_frames,
            "total_acc":            feat.total_acc,
            "jerk_detected":        feat.jerk_detected,
            "jerk_value":           feat.jerk_value,
            "fall_detected":        feat.fall_detected,
            "keyword_detected":     feat.keyword_detected,
            "matched_keyword":      feat.matched_keyword,
            "audio_rms":            feat.audio_rms,
            "audio_zcr":            feat.audio_zcr,
            "high_energy":          feat.high_energy,
            "is_night":             feat.is_night,
        },
        # Individual sensor contributions for InputDashboard cards (0-100 scale)
        "inputs": {
            "audio":    round(min(100, (
                80 if feat.keyword_detected and feat.audio_rms > 0.15 else
                60 if feat.keyword_detected else
                int(feat.audio_rms * 200 + feat.audio_zcr * 100)
            )), 1),
            "motion":   round(min(100, (
                70 if feat.fall_detected else
                40 if feat.jerk_detected else
                max(0, (feat.total_acc - 9.81) * 5)
            )), 1),
            "location": round(min(100, (
                60 if feat.confirmed_deviation and feat.stop_duration_s > 120 else
                40 if feat.confirmed_deviation else
                15 if feat.stop_duration_s > 180 else
                int(feat.deviation_score * 30 + feat.stop_score * 15)
            )), 1),
            "time":     80 if feat.is_night else 30,
        },
        # Location + metadata
        "geo":             {"lat": snap.lat, "lon": snap.lon},
        "mode":            snap.mode,
        "state_color":     state_color(snap.state),
        "recommendation":  recommendation(snap.state, snap.mode),
        "timestamp":       snap.timestamp,
        # Legacy compatibility fields
        "window_scores":   snap.window_scores,
        "events":          snap.events,
        "threat_level":    snap.threat_level,
        "combined_score":  snap.combined_score,
    }


async def _heartbeat(websocket: WebSocket, interval: float) -> None:
    """Send a server-side ping at `interval` seconds to detect dead connections."""
    try:
        while True:
            await asyncio.sleep(interval)
            await websocket.send_json({"type": "ping", "ts": time.time()})
    except Exception:
        pass  # Connection already dead — cleaned up by main handler


async def broadcast(payload: dict) -> None:
    """Broadcast a threat update to all connected WS clients."""
    dead: Set[WebSocket] = set()
    msg = json.dumps(payload)
    for ws in list(_connections):
        try:
            await ws.send_text(msg)
        except Exception:
            dead.add(ws)
    _connections.difference_update(dead)
