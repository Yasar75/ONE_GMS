import uuid
from datetime import datetime, time, date
from typing import Optional
from sqlalchemy import Column, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlmodel import SQLModel, Field


class ShiftRoster(SQLModel, table=True):
    __tablename__ = "shift_roster"

    uid: uuid.UUID = Field(sa_column=Column(PGUUID(as_uuid=True), primary_key=True, nullable=False, default=uuid.uuid4))
    code: str = Field(index=True, max_length=20)
    name: str = Field(max_length=80)
    start_time: time
    end_time: time
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow,sa_column=Column(DateTime(timezone=True), nullable=False))
    updated_at: datetime = Field(default_factory=datetime.utcnow,sa_column=Column(DateTime(timezone=True), nullable=False, onupdate=datetime.utcnow))
    user_uid: uuid.UUID = Field(foreign_key="users.uid", nullable=False, index=True)

    def __repr__(self):
        return f"{self.name} - {self.created_at} "
  