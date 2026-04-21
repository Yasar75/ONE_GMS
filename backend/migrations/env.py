import asyncio
import os
import ssl
from logging.config import fileConfig
from urllib.parse import urlparse, parse_qsl, urlencode, urlunparse

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import create_async_engine
from sqlmodel import SQLModel

import src.db.models  # noqa: F401


config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = SQLModel.metadata


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _strip_query_param(url: str, param: str) -> str:
    parsed = urlparse(url)
    query = [
        (k, v)
        for k, v in parse_qsl(parsed.query, keep_blank_values=True)
        if k.lower() != param.lower()
    ]
    return urlunparse(parsed._replace(query=urlencode(query)))


def _normalize_asyncpg_url(raw_url: str) -> str:
    if not raw_url:
        raise RuntimeError("DATABASE_URL is not set")

    url = raw_url.strip()

    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)

    url = _strip_query_param(url, "sslmode")
    return url


def _is_localhost(raw_url: str) -> bool:
    try:
        host = (urlparse(raw_url).hostname or "").lower()
    except Exception:
        return False
    return host in {"localhost", "127.0.0.1"}


def _is_aiven_host(raw_url: str) -> bool:
    try:
        host = (urlparse(raw_url).hostname or "").lower()
    except Exception:
        return False
    return "aivencloud.com" in host


def _url_requested_ssl(raw_url: str) -> bool:
    try:
        for k, v in parse_qsl(urlparse(raw_url).query, keep_blank_values=True):
            if k.lower() == "sslmode" and v.lower() in {"require", "verify-ca", "verify-full"}:
                return True
    except Exception:
        pass
    return False


def _should_use_ssl(raw_url: str) -> bool:
    if _is_localhost(raw_url):
        return False

    if _env_bool("DB_DISABLE_SSL", False):
        return False

    if _env_bool("DB_FORCE_SSL", True):
        return True

    return _is_aiven_host(raw_url) or _url_requested_ssl(raw_url)


def _make_connect_args(raw_url: str) -> dict:
    connect_args: dict = {}

    if _should_use_ssl(raw_url):
        ctx = ssl.create_default_context()
        ca_cert = os.getenv("DB_SSL_CA_CERT")
        if ca_cert:
            ctx.load_verify_locations(cadata=ca_cert)
        connect_args["ssl"] = ctx

    app_name = os.getenv("DB_APP_NAME")
    if app_name:
        connect_args["server_settings"] = {"application_name": app_name}

    return connect_args


RAW_DATABASE_URL = os.getenv("DATABASE_URL", "")
DATABASE_URL = _normalize_asyncpg_url(RAW_DATABASE_URL)
CONNECT_ARGS = _make_connect_args(RAW_DATABASE_URL)


def run_migrations_offline() -> None:
    context.configure(
        url=DATABASE_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = create_async_engine(
        DATABASE_URL,
        connect_args=CONNECT_ARGS,
        poolclass=pool.NullPool,
        pool_pre_ping=True,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
