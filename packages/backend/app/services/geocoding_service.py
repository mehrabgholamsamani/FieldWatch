import httpx

from app.config import settings

NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse"


def reverse_geocode(lat: float, lng: float) -> str | None:
    """Call Nominatim reverse geocoding API.

    Returns display_name string or None on failure.
    Nominatim requires a descriptive User-Agent and a max of 1 req/sec.
    """
    try:
        resp = httpx.get(
            NOMINATIM_URL,
            params={"lat": lat, "lon": lng, "format": "json"},
            headers={"User-Agent": settings.nominatim_user_agent},
            timeout=10.0,
        )
        resp.raise_for_status()
        data: dict[str, object] = resp.json()
        address = data.get("display_name")
        return str(address) if address else None
    except Exception:  # noqa: BLE001
        return None
