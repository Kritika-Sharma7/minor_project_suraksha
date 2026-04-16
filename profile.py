from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, Field

import storage

router = APIRouter()


class SafeZone(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    lat: float
    lon: float


class ProfileUpdate(BaseModel):
    name: str = Field(default="Primary User", min_length=1, max_length=80)
    alert_threshold: int = Field(default=192, ge=64, le=255)
    safe_zones: list[SafeZone] = Field(default_factory=list)


class ContactCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    phone: str | None = None
    email: str | None = None


@router.get("/profile")
async def get_profile():
    return storage.get_profile()


@router.put("/profile")
async def update_profile(payload: ProfileUpdate):
    return storage.upsert_profile(
        name=payload.name,
        alert_threshold=payload.alert_threshold,
        safe_zones=[z.model_dump() for z in payload.safe_zones],
    )


@router.get("/contacts")
async def get_contacts():
    return {"items": storage.list_contacts()}


@router.post("/contacts")
async def create_contact(payload: ContactCreate):
    return storage.add_contact(payload.name, payload.phone, payload.email)


@router.get("/incidents")
async def get_incidents(limit: int = 100):
    return {"items": storage.list_incidents(limit=limit)}


@router.get("/threat-map")
async def threat_map(limit: int = 300):
    incidents = storage.list_incidents(limit=limit)
    points = [
        {
            "id": i["id"],
            "lat": i["lat"],
            "lon": i["lon"],
            "threat_level": i["threat_level"],
            "combined_score": i["combined_score"],
            "created_at": i["created_at"],
        }
        for i in incidents
        if i.get("lat") is not None and i.get("lon") is not None
    ]
    return {"points": points}
