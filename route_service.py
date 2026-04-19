"""
Suraksha AI — Route Service
Fetches a driving route from Mapbox or Google Maps Directions API,
decodes the polyline, stores it per-session, and computes GPS deviation.

If no API key is configured the system continues gracefully:
  - deviation = None  (not False — treated as "unknown" in risk engine)
  - "Route tracking unavailable" appears in explainability reasons

Viva note: "Route-based detection is enabled when route data is available;
otherwise the system falls back to motion and context-based detection."
"""
from __future__ import annotations

import logging
import math
from typing import Optional

import httpx

from config import settings

logger = logging.getLogger(__name__)

# Type alias: route = list of (lat, lon) tuples
Route = list[tuple[float, float]]


# ─────────────────────────────────────────────────────────────────────────────
#  Polyline decoder (Google encoded polyline format used by both APIs)
# ─────────────────────────────────────────────────────────────────────────────

def decode_polyline(encoded: str) -> Route:
    """Decode Google-format encoded polyline string → list of (lat, lon)."""
    points: Route = []
    index = 0
    lat = 0
    lng = 0
    while index < len(encoded):
        result = 0
        shift = 0
        while True:
            b = ord(encoded[index]) - 63
            index += 1
            result |= (b & 0x1F) << shift
            shift += 5
            if b < 0x20:
                break
        dlat = ~(result >> 1) if result & 1 else result >> 1
        lat += dlat

        result = 0
        shift = 0
        while True:
            b = ord(encoded[index]) - 63
            index += 1
            result |= (b & 0x1F) << shift
            shift += 5
            if b < 0x20:
                break
        dlng = ~(result >> 1) if result & 1 else result >> 1
        lng += dlng

        points.append((lat / 1e5, lng / 1e5))
    return points


# ─────────────────────────────────────────────────────────────────────────────
#  Haversine helpers
# ─────────────────────────────────────────────────────────────────────────────

_R = 6_371_000.0  # Earth radius in metres

def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance between two GPS points in metres."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return 2 * _R * math.asin(math.sqrt(a))


def _point_to_segment_distance(
    px: float, py: float,
    ax: float, ay: float,
    bx: float, by: float,
) -> float:
    """
    Minimum distance (metres) from point P to segment AB.
    Uses a simplified Cartesian projection for short segments (< 10 km).
    """
    def to_m(lat: float, lon: float) -> tuple[float, float]:
        x = _R * math.radians(lon) * math.cos(math.radians(ay))
        y = _R * math.radians(lat)
        return x, y

    qx, qy = to_m(px, py)
    sx, sy = to_m(ax, ay)
    ex, ey = to_m(bx, by)

    dx, dy = ex - sx, ey - sy
    seg_len_sq = dx * dx + dy * dy
    if seg_len_sq == 0:
        return math.hypot(qx - sx, qy - sy)

    t = max(0.0, min(1.0, ((qx - sx) * dx + (qy - sy) * dy) / seg_len_sq))
    closest_x = sx + t * dx
    closest_y = sy + t * dy
    return math.hypot(qx - closest_x, qy - closest_y)


def _min_route_distance(lat: float, lon: float, route: Route) -> float:
    """Minimum distance in metres from (lat, lon) to any segment of route."""
    if len(route) < 2:
        if len(route) == 1:
            return _haversine(lat, lon, route[0][0], route[0][1])
        return float("inf")

    min_dist = float("inf")
    for i in range(len(route) - 1):
        d = _point_to_segment_distance(
            lat, lon,
            route[i][0], route[i][1],
            route[i + 1][0], route[i + 1][1],
        )
        if d < min_dist:
            min_dist = d
    return min_dist


# ─────────────────────────────────────────────────────────────────────────────
#  RouteService
# ─────────────────────────────────────────────────────────────────────────────

class RouteService:
    """
    Manages the expected route for a monitoring session.
    One instance per app — stored on app.state.route_service.
    """

    def __init__(self) -> None:
        self._route: Route = []
        self._has_route: bool = False
        self._provider_used: str = "none"
        self._dev_streak: int = 0   # consecutive frames currently off-route

    @property
    def has_route(self) -> bool:
        return self._has_route and len(self._route) >= 2

    def store_route(self, route: Route) -> None:
        self._route = route
        self._has_route = bool(route)
        self._dev_streak = 0
        logger.info("Route stored: %d waypoints", len(route))

    def clear_route(self) -> None:
        self._route = []
        self._has_route = False
        self._dev_streak = 0

    def get_live_map_url(self, lat: float, lon: float) -> str:
        """
        Returns a Google Maps deep-link for the given coordinate.
        Embedded in the SMS body when coordinates are available.
        """
        return settings.maps_live_url_template.format(lat=lat, lon=lon)

    def route_summary(self) -> dict:
        """Returns a summary dict for the set_route WS response."""
        return {
            "stored": self.has_route,
            "waypoints": len(self._route),
            "provider": self._provider_used,
        }

    async def fetch_and_store(
        self,
        start: tuple[float, float],
        destination: tuple[float, float],
    ) -> bool:
        """
        Fetch route from configured provider and store it.
        Returns True on success, False on failure (non-breaking).

        Viva answer: "Route-based detection is enabled when route data is
        available; otherwise the system falls back to motion and
        context-based detection."
        """
        provider = settings.route_api_provider.lower()
        try:
            if provider == "mapbox" and settings.mapbox_token:
                route = await self._fetch_mapbox(start, destination)
                self._provider_used = "mapbox"
            elif provider == "google" and settings.google_maps_key:
                route = await self._fetch_google(start, destination)
                self._provider_used = "google"
            else:
                logger.warning(
                    "No route API key configured (provider=%s). "
                    "System falls back to motion and context-based detection.",
                    provider,
                )
                return False

            if route:
                self.store_route(route)
                return True
            return False
        except Exception as exc:
            logger.error("Route fetch failed: %s", exc)
            return False

    async def _fetch_mapbox(
        self, start: tuple[float, float], dest: tuple[float, float]
    ) -> Route:
        """Fetch from Mapbox Directions API."""
        lat1, lon1 = start
        lat2, lon2 = dest
        url = (
            f"https://api.mapbox.com/directions/v5/mapbox/driving/"
            f"{lon1},{lat1};{lon2},{lat2}"
            f"?access_token={settings.mapbox_token}&geometries=polyline&overview=full"
        )
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
        routes = data.get("routes", [])
        if not routes:
            return []
        geometry = routes[0].get("geometry", "")
        return decode_polyline(geometry)

    async def _fetch_google(
        self, start: tuple[float, float], dest: tuple[float, float]
    ) -> Route:
        """Fetch from Google Maps Directions API."""
        lat1, lon1 = start
        lat2, lon2 = dest
        url = "https://maps.googleapis.com/maps/api/directions/json"
        params = {
            "origin": f"{lat1},{lon1}",
            "destination": f"{lat2},{lon2}",
            "key": settings.google_maps_key,
        }
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
        routes = data.get("routes", [])
        if not routes:
            return []
        poly = routes[0]["overview_polyline"]["points"]
        return decode_polyline(poly)

    # ── Deviation computation ─────────────────────────────────────────────────

    def compute_deviation(
        self, lat: float, lon: float
    ) -> tuple[Optional[bool], Optional[float], int]:
        """
        Returns (is_deviating, distance_metres, consecutive_off_route_frames).
        Returns (None, None, 0) if no route is stored — caller treats this as
        "route tracking unavailable" — NOT as safe.

        consecutive_off_route_frames: sustained deviation counter used by
        RiskEngine to fire penalty only after N consecutive frames off-route.
        """
        if lat is None or lon is None:
            return (None, None, 0)
        if not self.has_route:
            return (None, None, 0)

        dist = _min_route_distance(lat, lon, self._route)
        is_deviating = dist > settings.route_deviation_meters

        if is_deviating:
            self._dev_streak += 1
        else:
            self._dev_streak = 0

        return (is_deviating, round(dist, 1), self._dev_streak)
