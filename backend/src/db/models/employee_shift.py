import uuid
from datetime import datetime, time, date
from typing import Optional
from sqlalchemy import Column, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlmodel import SQLModel, Field

class EmployeeShift(SQLModel, table=True):
    """
    Assignment table: an employee can have multiple shifts.
    You can also keep effective date range for changes.
    """
    __tablename__ = "employees_shifts"

    uid: uuid.UUID = Field(sa_column=Column(PGUUID(as_uuid=True), primary_key=True, nullable=False, default=uuid.uuid4))
    employee_uid: uuid.UUID = Field(sa_column=Column(PGUUID(as_uuid=True), ForeignKey("employees.uid", ondelete="CASCADE"), nullable=False, index=True))
    shift_uid: uuid.UUID = Field(sa_column=Column(PGUUID(as_uuid=True), ForeignKey("shift_roster.uid", ondelete="RESTRICT"), nullable=False, index=True))
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow,sa_column=Column(DateTime(timezone=True), nullable=False))
    updated_at: datetime = Field(default_factory=datetime.utcnow,sa_column=Column(DateTime(timezone=True), nullable=False, onupdate=datetime.utcnow))
    user_uid: uuid.UUID = Field(foreign_key="users.uid", nullable=False, index=True)


    def __repr__(self):
        return f"{self.employee_uid} - {self.created_at} "