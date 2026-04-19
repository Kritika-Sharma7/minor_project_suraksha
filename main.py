"""
Suraksha AI — FastAPI Backend (v3)
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from contextlib import asynccontextmanager
import asyncio
import logging

from config import settings
import risk
import audio
import alerts
import ws
import profile
import storage
from threat_engine import ThreatEngine
from route_service import RouteService
from alert_service import start_offline_flush_task

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    logger.info("🚀 Starting Suraksha AI Safety System v3")
    storage.init_db()
    app.state.threat_engine = ThreatEngine()
    app.state.route_service  = RouteService()
    # Background task: retry queued SMS messages on Twilio failure
    asyncio.create_task(start_offline_flush_task())
    yield
    logger.info("🛑 Shutting down")


app = FastAPI(
    title="Suraksha AI — Safety Intelligence API",
    description="Real-time multi-modal threat detection with FSM classification and explainability",
    version="3.0.0",
    lifespan=lifespan,
)

# ── Middleware ──────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# ── Routers ─────────────────────────────────────────────────────────────────
app.include_router(risk.router,    prefix="/api/v1", tags=["Risk Analysis"])
app.include_router(audio.router,   prefix="/api/v1", tags=["Audio Detection"])
app.include_router(alerts.router,  prefix="/api/v1", tags=["Alerts"])
app.include_router(ws.router,      prefix="/api/v1", tags=["WebSocket"])
app.include_router(profile.router, prefix="/api/v1", tags=["Profile & Storage"])


@app.get("/health")
async def health():
    return {"status": "ok", "version": "3.0.0"}
