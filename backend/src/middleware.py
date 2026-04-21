import logging
import time
from urllib.parse import urlparse

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.requests import Request

from src.config import Config

logger = logging.getLogger("uvicorn.access")
logger.disabled = True


def _normalize_origin(value: str | None) -> str | None:
    if not value:
        return None
    value = value.strip().rstrip("/")
    if not value:
        return None
    if "://" not in value:
        return f"https://{value}"
    return value


def _extract_host(value: str | None) -> str | None:
    if not value:
        return None

    value = value.strip().rstrip("/")
    if not value:
        return None

    if "://" not in value:
        return value.split("/")[0]

    parsed = urlparse(value)
    return parsed.hostname


def register_middleware(app: FastAPI):
    @app.middleware("http")
    async def custom_logging(request: Request, call_next):
        start_time = time.time()
        response = await call_next(request)
        processing_time = time.time() - start_time

        message = (
            f"{request.client.host}:{request.client.port} - "
            f"{request.method} - {request.url.path} - "
            f"{response.status_code} completed after {processing_time}s"
        )
        print(message)
        return response

    allowed_origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    frontend_origin = _normalize_origin(Config.FRONTEND_URL)
    backend_origin = _normalize_origin(Config.BACKEND_URL)

    if frontend_origin and frontend_origin not in allowed_origins:
        allowed_origins.append(frontend_origin)

    if backend_origin and backend_origin not in allowed_origins:
        allowed_origins.append(backend_origin)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_origin_regex=r"https://.*\.vercel\.app",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["*"],
    )

    allowed_hosts = [
        "localhost",
        "127.0.0.1",
        "*.vercel.app",
    ]

    backend_host = _extract_host(Config.BACKEND_URL)
    frontend_host = _extract_host(Config.FRONTEND_URL)

    if backend_host and backend_host not in allowed_hosts:
        allowed_hosts.append(backend_host)

    if frontend_host and frontend_host not in allowed_hosts:
        allowed_hosts.append(frontend_host)

    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=allowed_hosts,
    )
