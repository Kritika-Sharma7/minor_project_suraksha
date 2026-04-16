"""
Women Safety Threat Detection System — FastAPI Backend
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from contextlib import asynccontextmanager
import logging

from config import settings
import risk
import audio
import alerts
import ws
import profile
import storage
from threat_engine import ThreatEngine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    logger.info("🚀 Starting Women Safety Detection System")
    storage.init_db()
    app.state.threat_engine = ThreatEngine()
    yield
    logger.info("🛑 Shutting down")


app = FastAPI(
    title="Women Safety Threat Detection API",
    description="Real-time multi-modal threat detection with FSM classification",
    version="2.0.0",
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
    return {"status": "ok", "version": "2.0.0"}
