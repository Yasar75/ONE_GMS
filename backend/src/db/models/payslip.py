import uuid
from datetime import datetime
from typing import Optional

import sqlalchemy as sa
import sqlalchemy.dialects.postgresql as pg
from sqlalchemy import Column, DateTime, ForeignKey, Text
from sqlmodel import Field, SQLModel


class Payslip(SQLModel, table=True):
    __tablename__ = "payslips"
    __table_args__ = (
        sa.UniqueConstraint("employee_uid", "salary_month", "salary_year", name="uq_payslips_employee_month_year"),
        sa.CheckConstraint("salary_month >= 1 AND salary_month <= 12", name="ck_payslips_salary_month"),
    )

    uid: uuid.UUID = Field(sa_column=Column(pg.UUID(as_uuid=True), primary_key=True, nullable=False, default=uuid.uuid4))
    created_by: uuid.UUID = Field(foreign_key="users.uid", nullable=False, index=True)
    employee_uid: uuid.UUID = Field(sa_column=Column(pg.UUID(as_uuid=True), ForeignKey("employees.uid", ondelete="CASCADE"), nullable=False, index=True))

    salary_month: int = Field(nullable=False, index=True)
    salary_year: int = Field(nullable=False, index=True)

    original_filename: Optional[str] = Field(default=None, sa_column=Column(pg.VARCHAR(255), nullable=True))
    file_url: str = Field(sa_column=Column(Text, nullable=False))
    cloudinary_public_id: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    file_format: Optional[str] = Field(default="pdf", sa_column=Column(pg.VARCHAR(50), nullable=True))
    file_size: Optional[int] = Field(default=None, nullable=True)

    created_at: datetime = Field(default_factory=datetime.utcnow, sa_column=Column(DateTime(timezone=True), nullable=False))
    updated_at: datetime = Field(default_factory=datetime.utcnow, sa_column=Column(DateTime(timezone=True), nullable=False, onupdate=datetime.utcnow))

    def __repr__(self):
        return f"{self.employee_uid} - {self.salary_month}/{self.salary_year}"
