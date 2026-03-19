## DB Helper Functions
import os
import ssl
from dataclasses import dataclass
from urllib.parse import urlparse, parse_qsl, urlencode, urlunparse
from src.config import Config


@dataclass(frozen=True)
class DbConfig:
    url: str
    connect_args: dict


def _strip_query_param(url: str, param: str) -> str:
    p = urlparse(url)
    q = [(k, v) for k, v in parse_qsl(p.query, keep_blank_values=True) if k.lower() != param.lower()]
    return urlunparse(p._replace(query=urlencode(q)))


def normalize_asyncpg_url(raw_url: str) -> str:
    if not raw_url:
        raise RuntimeError("DATABASE_URL is not set")

    url = raw_url.strip()

    # Normalize scheme for asyncpg
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)

    # asyncpg doesn't accept sslmode=...
    url = _strip_query_param(url, "sslmode")
    return url


def _is_aiven_host(raw_url: str) -> bool:
    try:
        host = (urlparse(raw_url).hostname or "").lower()
    except Exception:
        return False
    return "aivencloud.com" in host


def _url_requested_ssl(raw_url: str) -> bool:
    try:
        for k, v in parse_qsl(urlparse(raw_url).query, keep_blank_values=True):
            if k.lower() == "sslmode" and v.lower() in ("require", "verify-ca", "verify-full"):
                return True
    except Exception:
        pass
    return False

def _is_localhost(raw_url: str) -> bool:
    try:
        host = (urlparse(raw_url).hostname or "").lower()
    except Exception:
        return False
    return host in ("localhost", "127.0.0.1")

def should_use_ssl(raw_url: str) -> bool:
    """
    SSL decision:
    - Never use SSL for localhost/127.0.0.1 (local dev Postgres often rejects SSL upgrade)
    - DB_DISABLE_SSL=true  -> never SSL
    - DB_FORCE_SSL=true    -> always SSL (for non-local hosts)
    - Aiven host OR sslmode=require in URL -> SSL
    """
    # ✅ hard-stop: local dev should not try SSL
    if _is_localhost(raw_url):
        return False

    if Config.DB_DISABLE_SSL:
        return False
    if Config.DB_FORCE_SSL:
        return True

    return _is_aiven_host(raw_url) or _url_requested_ssl(raw_url)


def make_ssl_context() -> ssl.SSLContext:
    """
    For Aiven: add CA to trust chain (recommended).
    For Render: no cert required; if SSL is used, default system CAs are fine.
    """
    ctx = ssl.create_default_context()

    if Config.DB_SSL_CA_CERT:
        ctx.load_verify_locations(cadata=Config.DB_SSL_CA_CERT)
        return ctx
    
    # No custom CA provided -> rely on system trust store
    return ctx


def build_db_config(raw_url: str) -> DbConfig:
    url = normalize_asyncpg_url(raw_url)
    connect_args: dict = {}

    if should_use_ssl(raw_url):
        connect_args["ssl"] = make_ssl_context()

    app_name = Config.DB_APP_NAME
    if app_name:
        connect_args.setdefault("server_settings", {})
        connect_args["server_settings"]["application_name"] = app_name

    return DbConfig(url=url, connect_args=connect_args)
## END DB Helper Functions
