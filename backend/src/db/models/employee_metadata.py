import uuid
from datetime import datetime
from enum import Enum
from typing import Optional

import sqlalchemy as sa
import sqlalchemy.dialects.postgresql as pg
from sqlmodel import Column, Field, SQLModel


class MetadataCategory(str, Enum):
    DEPARTMENT = "department"
    POSITION = "position"
    STATUS = "status"
    WORK_LOCATION = "work_location"
    EMPLOYEE_TYPE = "employee_type"
    BLOOD_GROUP = "blood_group"


class EmployeeMetadata(SQLModel, table=True):
    __tablename__ = "employee_metadata"
    __table_args__ = (
        sa.UniqueConstraint("category", "value", name="uq_employee_metadata_category_value"),
    )

    uid: uuid.UUID = Field(
        sa_column=Column(pg.UUID(as_uuid=True), primary_key=True, nullable=False, default=uuid.uuid4)
    )
    category: MetadataCategory = Field(
        sa_column=Column(pg.VARCHAR(40), nullable=False, index=True)
    )
    value: str = Field(sa_column=Column(pg.VARCHAR(120), nullable=False))
    label: str = Field(sa_column=Column(pg.VARCHAR(120), nullable=False))
    description: Optional[str] = Field(default=None, sa_column=Column(pg.VARCHAR(255), nullable=True))
    is_active: bool = Field(default=True, nullable=False)
    sort_order: int = Field(default=0, nullable=False)
    created_by: Optional[uuid.UUID] = Field(default=None, foreign_key="users.uid", nullable=True)
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column=Column(pg.TIMESTAMP(timezone=True), nullable=False, default=datetime.utcnow),
    )
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column=Column(pg.TIMESTAMP(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow),
    )
