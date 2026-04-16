import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

logger = logging.getLogger(__name__)

from app.api.ai import router as ai_router
from app.api.auth import router as auth_router
from app.api.devices import router as devices_router
from app.api.health import router as health_router
from app.api.images import router as images_router
from app.api.reports import router as reports_router
from app.api.users import router as users_router
from app.config import settings
from app.core.limiter import limiter

app = FastAPI(title="FieldWatch API", version="0.1.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception(
        "Unhandled error on %s %s", request.method, request.url.path,
        extra={"request_id": request.headers.get("X-Request-ID")},
    )
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


app.include_router(health_router)  # /health — no version prefix (infra endpoint)
app.include_router(auth_router, prefix="/v1")
app.include_router(users_router, prefix="/v1")
app.include_router(reports_router, prefix="/v1")
app.include_router(images_router, prefix="/v1")
app.include_router(devices_router, prefix="/v1")
app.include_router(ai_router, prefix="/v1")
