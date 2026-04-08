"""
Router: /api/v1/audio-detect
"""
from __future__ import annotations

from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel

from services.audio_ml import AudioMLService

router = APIRouter()
audio_svc = AudioMLService()


class AudioResponse(BaseModel):
    audio_class:  str
    confidence:   float
    risk_score:   int
    label_emoji:  str
    description:  str


_DESCRIPTIONS = {
    "scream":   "Scream detected — high likelihood of distress or emergency.",
    "distress": "Distress sounds detected — elevated concern for safety.",
    "normal":   "No threatening audio detected — environment appears calm.",
}

_EMOJIS = {"scream": "🆘", "distress": "⚠️", "normal": "✅"}


@router.post("/audio-detect", response_model=AudioResponse)
async def audio_detect(file: UploadFile = File(...)):
    """
    Upload a WAV/MP3 audio clip. Returns ML classification result and risk score.

    - scream   → risk 210–255
    - distress → risk 130–200
    - normal   → risk 0–40
    """
    allowed = ("audio/wav", "audio/mpeg", "audio/ogg", "audio/webm", "audio/mp4")
    if file.content_type and file.content_type not in allowed:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported audio type: {file.content_type}",
        )

    audio_bytes = await file.read()
    if len(audio_bytes) > 10 * 1024 * 1024:   # 10 MB cap
        raise HTTPException(status_code=413, detail="Audio file too large (max 10 MB)")

    result = await audio_svc.classify(audio_bytes)

    return AudioResponse(
        audio_class=result.audio_class,
        confidence=result.confidence,
        risk_score=result.risk_score,
        label_emoji=_EMOJIS.get(result.audio_class, "❓"),
        description=_DESCRIPTIONS.get(result.audio_class, ""),
    )
