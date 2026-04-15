import logging
import os
import time
from urllib.parse import urlparse

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.requests import Request

from src.config import Config

logger = logging.getLogger("uvicorn.access")
logger.disabled = True


def _extract_host(value: str | None) -> str | None:
    if not value:
        return None

    candidate = value.strip()
    if not candidate:
        return None

    if "://" not in candidate:
        candidate = f"https://{candidate}"

    parsed = urlparse(candidate)
    return parsed.hostname


def _build_allowed_hosts() -> list[str]:
    allowed_hosts = {"localhost", "127.0.0.1", "*.vercel.app"}

    for value in (
        Config.BACKEND_URL,
        Config.FRONTEND_URL,
        os.getenv("VERCEL_URL"),
    ):
        host = _extract_host(value)
        if host:
            allowed_hosts.add(host)

    return sorted(allowed_hosts)


def register_middleware(app: FastAPI):
    @app.middleware("http")
    async def custom_logging(request: Request, call_next):
        start_time = time.time()

        response = await call_next(request)
        processing_time = time.time() - start_time

        message = f"{request.client.host}:{request.client.port} - {request.method} - {request.url.path} - {response.status_code} completed after {processing_time}s"

        print(message)
        return response

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
        allow_credentials=True,
    )

    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=_build_allowed_hosts(),
    )
