"""
WebSocket router — pushes threat state updates to connected clients.
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)
router = APIRouter()

# Global connection registry
_connections: Set[WebSocket] = set()


@router.websocket("/ws/threat-stream")
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
            # Keep alive ping every 30 s
            await asyncio.sleep(30)
            await websocket.send_json({"type": "ping"})
    except WebSocketDisconnect:
        _connections.discard(websocket)
        logger.info("WS client disconnected (%d remaining)", len(_connections))


async def broadcast(payload: dict):
    """Broadcast a threat update to all connected WS clients."""
    dead = set()
    msg = json.dumps(payload)
    for ws in list(_connections):
        try:
            await ws.send_text(msg)
        except Exception:
            dead.add(ws)
    _connections -= dead
