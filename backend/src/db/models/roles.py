from __future__ import annotations  # Important for forward references

import uuid
from datetime import datetime
from typing import List, Optional

import sqlalchemy.dialects.postgresql as pg
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.mutable import MutableDict
from sqlalchemy.orm import Mapped
from sqlmodel import Column, Field, Relationship, SQLModel


class Role(SQLModel, table=True):
    __tablename__ = "roles"

    uid: uuid.UUID = Field(
        sa_column=Column(pg.UUID, primary_key=True, default=uuid.uuid4, nullable=False)
    )
    role_name: str = Field(sa_column=Column(pg.VARCHAR, nullable=False, unique=True))
    description: Optional[str] = Field(sa_column=Column(pg.VARCHAR, nullable=True))
    permissions: dict = Field(sa_column=Column(MutableDict.as_mutable(JSONB), nullable=True, default=dict))
    created_at: datetime = Field(sa_column=Column(pg.TIMESTAMP, default=datetime.now))
    updated_at: datetime = Field(default_factory=datetime.utcnow, sa_column_kwargs={"onupdate": datetime.utcnow}
    )
    created_by: Optional[uuid.UUID] = Field(default=None, nullable=True)

    # users: Mapped[List[User]] = Relationship(back_populates="role")

    def __repr__(self):
        return f"<Role(role_name={self.role_name}, uid={self.uid})>"


