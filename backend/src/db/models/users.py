from __future__ import annotations  # Important for forward references

import uuid
from datetime import datetime
from typing import List, Optional
import sqlalchemy as sa
import sqlalchemy.dialects.postgresql as pg
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.mutable import MutableDict
from sqlalchemy.orm import Mapped
from sqlmodel import Column, Field, Relationship, SQLModel


class User(SQLModel, table=True):
    __tablename__ = "users"

    uid: uuid.UUID = Field(
        sa_column=Column(pg.UUID, primary_key=True, default=uuid.uuid4, nullable=False)
    )
    username: str
    email: str = Field(pg.VARCHAR, nullable=False, unique=True)
    first_name: str = Field(sa_column=Column(pg.VARCHAR, nullable=True))
    last_name: str = Field(sa_column=Column(pg.VARCHAR, nullable=True))
    role_id: uuid.UUID = Field(foreign_key="roles.uid", nullable=False)
    is_verified: bool = Field(default=False)
    password_hash: str = Field(exclude=True)
    ##New Field
    is_locked: bool = Field(default=False,sa_column=Column(sa.Boolean, nullable=False, server_default=sa.text("false")))
    locked_at: Optional[datetime] = Field(default=None,sa_column=Column(pg.TIMESTAMP(timezone=True), nullable=True))
    locked_reason: Optional[str] = Field(default=None,sa_column=Column(pg.TEXT, nullable=True))
    first_login_at: Optional[datetime] = Field(default=None,sa_column=Column(pg.TIMESTAMP(timezone=True), nullable=True))
    unlocked_at: Optional[datetime] = Field(default=None,sa_column=Column(pg.TIMESTAMP(timezone=True), nullable=True))
    
    created_at: datetime = Field(sa_column=Column(pg.TIMESTAMP, default=datetime.now))
    updated_at: datetime = Field(default_factory=datetime.utcnow, sa_column_kwargs={"onupdate": datetime.utcnow})

    def __repr__(self):
        return f"<User(username={self.username}, email={self.email}, uid={self.uid})>"