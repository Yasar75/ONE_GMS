import uuid
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession

from src.config import Config
from src.db.db_url import build_db_config


dbcfg = build_db_config(Config.DATABASE_URL)

# Async SQLModel engine
async_engine = create_async_engine(
    url=dbcfg.url,
    echo=True,
    connect_args=dbcfg.connect_args,
    pool_size=Config.DB_POOL_SIZE,
    max_overflow=Config.DB_MAX_OVERFLOW,
    pool_timeout=Config.DB_POOL_TIMEOUT,
    pool_recycle=Config.DB_POOL_RECYCLE,
    pool_pre_ping=True,
)


# DEFAULT_METADATA_ENTRIES = [
#     ("department", "Engineering", "Engineering", "Engineering business unit", 1),
#     ("department", "HR", "HR", "Human resources", 2),
#     ("department", "Finance", "Finance", "Finance and accounting", 3),
#     ("department", "Marketing", "Marketing", "Marketing function", 4),
#     ("department", "Sales", "Sales", "Sales function", 5),
#     ("department", "Operations", "Operations", "Operations function", 6),
#     ("position", "Engineering", "Engineering", "Engineering role", 1),
#     ("position", "HR", "HR", "HR role", 2),
#     ("position", "Finance", "Finance", "Finance role", 3),
#     ("position", "Marketing", "Marketing", "Marketing role", 4),
#     ("position", "Sales", "Sales", "Sales role", 5),
#     ("position", "Operations", "Operations", "Operations role", 6),
#     ("status", "Active", "Active", "Currently active employee", 1),
#     ("status", "Inactive", "Inactive", "Inactive employee", 2),
#     ("status", "Resigned", "Resigned", "Resigned employee", 3),
#     ("status", "Terminated", "Terminated", "Terminated employee", 4),
#     ("work_location", "Onsite", "Onsite", "Primarily onsite", 1),
#     ("work_location", "Remote", "Remote", "Primarily remote", 2),
#     ("work_location", "Hybrid", "Hybrid", "Hybrid work mode", 3),
#     ("employee_type", "FullTime", "Full Time", "Full time employee", 1),
#     ("employee_type", "PartTime", "Part Time", "Part time employee", 2),
#     ("employee_type", "Contract", "Contract", "Contract resource", 3),
#     ("employee_type", "Intern", "Intern", "Intern resource", 4),
#     ("blood_group", "A+", "A+", "A positive", 1),
#     ("blood_group", "A-", "A-", "A negative", 2),
#     ("blood_group", "B+", "B+", "B positive", 3),
#     ("blood_group", "B-", "B-", "B negative", 4),
#     ("blood_group", "AB+", "AB+", "AB positive", 5),
#     ("blood_group", "AB-", "AB-", "AB negative", 6),
#     ("blood_group", "O+", "O+", "O positive", 7),
#     ("blood_group", "O-", "O-", "O negative", 8),
# ]


async def _ensure_employee_columns(conn) -> None:
    alter_statements = [
        'ALTER TABLE employees ADD COLUMN IF NOT EXISTS client_email VARCHAR(255)',
    ]
    for stmt in alter_statements:
        await conn.execute(text(stmt))


async def _seed_default_roles(conn) -> None:
    await conn.execute(
        text(
            """
            INSERT INTO roles (uid, role_name, description, permissions, created_at, updated_at, created_by)
            SELECT
                CAST(:uid AS UUID),
                CAST(:role_name AS VARCHAR),
                CAST(:description AS VARCHAR),
                '{}'::jsonb,
                NOW(),
                NOW(),
                NULL
            WHERE NOT EXISTS (
                SELECT 1
                FROM roles
                WHERE LOWER(role_name) = LOWER(CAST(:role_name AS VARCHAR))
            )
            """
        ),
        {
            "uid": str(uuid.uuid4()),
            "role_name": "Delivary",
            "description": "Delivery operations role",
        },
    )


# async def _seed_employee_metadata(conn) -> None:
#     for category, value, label, description, sort_order in DEFAULT_METADATA_ENTRIES:
#         await conn.execute(
#             text(
#                 """
#                 INSERT INTO employee_metadata (uid, category, value, label, description, is_active, sort_order, created_at, updated_at)
#                 VALUES (:uid, :category, :value, :label, :description, true, :sort_order, NOW(), NOW())
#                 ON CONFLICT (category, value) DO NOTHING
#                 """
#             ),
#             {
#                 "uid": str(uuid.uuid4()),
#                 "category": category,
#                 "value": value,
#                 "label": label,
#                 "description": description,
#                 "sort_order": sort_order,
#             },
#         )


async def init_db() -> None:
    """Create all tables based on SQLModel metadata and patch additive schema changes."""
    async with async_engine.begin() as conn:
        import src.db.models  # noqa: F401

        await conn.run_sync(SQLModel.metadata.create_all)
        await _ensure_employee_columns(conn)
        await _seed_default_roles(conn)


async def get_session() -> AsyncSession:
    """Yield an AsyncSession for dependency injection."""
    Session = sessionmaker(bind=async_engine, class_=AsyncSession, expire_on_commit=False)

    async with Session() as session:
        yield session
