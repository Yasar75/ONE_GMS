import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Any, Type
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

def parse_uuid(value: str | uuid.UUID, field_name: str = "referred field") -> uuid.UUID:
    try:
        return value if isinstance(value, uuid.UUID) else uuid.UUID(value)
    except ValueError:
        raise InvalidUUID(f"Invalid UUID for {field_name}")

async def validate_unique_field(
    session: AsyncSession,
    model: Type,
    field,
    value: Any,
    exclude_uid: Any = None,
    log_message: str | None = None,
    logger=None,
):
    col = getattr(model, field)
    statement = select(model).where(col == value)

    if exclude_uid is not None:
        statement = statement.where(model.uid != exclude_uid)

    result = await session.exec(statement)
    existing = result.first()

    if existing:
        if logger and log_message:
            logger.warning(log_message)
        raise NotUniqueError(log_message)

async def get_model_uuid(
    uid: str|uuid.UUID,
    model: Type,
    session: AsyncSession
):
    uid = parse_uuid(uid, f"{model.__name__}")
    record = await session.get(model, uid)
    if not record:
        raise NotFoundError(f'There is no {model.__name__} with this ID')
    return record