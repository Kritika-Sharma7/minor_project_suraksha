"""
Suraksha AI — FastAPI Backend (v3)
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager
import asyncio
import logging
import os

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
_cors_origins = settings.allowed_origins
# Allow localhost (dev), ngrok tunnels, and any HTTPS origin (for mobile testing)
_cors_regex = r"(http://localhost:\d+|https://.*\.ngrok(-free)?\.app|https://.*\.ngrok\.io)"

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_origin_regex=_cors_regex,
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


# ── Serve React SPA (production build) ──────────────────────────────────────
# The `dist/` folder is created by `npm run build` inside the project directory.
# All API routes are registered above, so this static mount only handles
# frontend assets. Unknown paths fall back to index.html (SPA routing).
_dist = os.path.join(os.path.dirname(__file__), "dist")
if os.path.isdir(_dist):
    app.mount("/assets", StaticFiles(directory=os.path.join(_dist, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def spa_fallback(full_path: str):
        return FileResponse(os.path.join(_dist, "index.html"))
