import uuid
from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Optional
import sqlalchemy as sa
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Numeric, Text, UniqueConstraint
from sqlalchemy.dialects import postgresql as pg
from sqlmodel import Field, SQLModel


class AttendanceStatus(str, Enum):
    Present = "Present"
    HalfDay = "HalfDay"
    Absent = "Absent"
    Leave = "Leave"
    WO = "WO"
    PendingRegularization = "PendingRegularization"


class PunchType(str, Enum):
    IN = "IN"
    OUT = "OUT"


class RegularizationStatus(str, Enum):
    Pending = "Pending"
    Approved = "Approved"
    Rejected = "Rejected"


class Attendance(SQLModel, table=True):
    __tablename__ = "attendance"

    uid: uuid.UUID = Field(sa_column=Column(pg.UUID(as_uuid=True), primary_key=True, nullable=False, default=uuid.uuid4))
    user_uid: uuid.UUID = Field(foreign_key="users.uid", nullable=False, index=True)
    employee_uid: uuid.UUID = Field(sa_column=Column(pg.UUID(as_uuid=True), ForeignKey("employees.uid", ondelete="CASCADE"), nullable=False, index=True))
    attendance_date: date = Field(sa_column=Column(pg.DATE, nullable=False, index=True))
    first_punch_in: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True))
    last_punch_out: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True))
    total_assigned_shift_hours: Decimal = Field(default=Decimal("0.00"),sa_column=Column(Numeric(6, 2), nullable=False, server_default="0"))
    total_worked_hours: Decimal = Field(default=Decimal("0.00"),sa_column=Column(Numeric(6, 2), nullable=False, server_default="0"))
    status: AttendanceStatus = Field(default=AttendanceStatus.Absent,sa_column=Column(pg.ENUM(AttendanceStatus, name="attendance_status", create_type=True),nullable=False,server_default="Absent",),)
    is_regularized: bool = Field(default=False,sa_column=Column(Boolean, nullable=False, server_default=sa.text("false")))
    leave_request_uid: Optional[uuid.UUID] = Field(default=None,sa_column=Column(pg.UUID(as_uuid=True),ForeignKey("leave_request.uid", ondelete="SET NULL"),nullable=True,index=True,))
    leave_type_uid: Optional[uuid.UUID] = Field(default=None,sa_column=Column(pg.UUID(as_uuid=True),ForeignKey("leave_types.uid", ondelete="SET NULL"),nullable=True,index=True,))
    remarks: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    created_at: datetime = Field(default_factory=datetime.utcnow, sa_column=Column(DateTime(timezone=True), nullable=False))
    updated_at: datetime = Field(default_factory=datetime.utcnow,sa_column=Column(DateTime(timezone=True), nullable=False, onupdate=datetime.utcnow),)


class AttendancePunchLog(SQLModel, table=True):
    __tablename__ = "attendance_punch_logs"

    uid: uuid.UUID = Field(sa_column=Column(pg.UUID(as_uuid=True), primary_key=True, nullable=False, default=uuid.uuid4))
    user_uid: uuid.UUID = Field(foreign_key="users.uid", nullable=False, index=True)
    employee_uid: uuid.UUID = Field(sa_column=Column(pg.UUID(as_uuid=True), ForeignKey("employees.uid", ondelete="CASCADE"), nullable=False, index=True))
    attendance_uid: uuid.UUID = Field(sa_column=Column(pg.UUID(as_uuid=True), ForeignKey("attendance.uid", ondelete="CASCADE"), nullable=False, index=True))
    attendance_date: date = Field(sa_column=Column(pg.DATE, nullable=False, index=True))
    punch_type: PunchType = Field(sa_column=Column(pg.ENUM(PunchType, name="attendance_punch_type", create_type=True), nullable=False))
    punch_time: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False, index=True))
    is_valid: bool = Field(default=True,sa_column=Column(Boolean, nullable=False, server_default=sa.text("true")))
    invalid_reason: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    source: Optional[str] = Field(default="SELF", sa_column=Column(pg.VARCHAR(20), nullable=True))
    created_at: datetime = Field(default_factory=datetime.utcnow, sa_column=Column(DateTime(timezone=True), nullable=False))


class AttendanceRegularization(SQLModel, table=True):
    __tablename__ = "attendance_regularizations"

    uid: uuid.UUID = Field(sa_column=Column(pg.UUID(as_uuid=True), primary_key=True, nullable=False, default=uuid.uuid4))
    user_uid: uuid.UUID = Field(foreign_key="users.uid", nullable=False, index=True)
    employee_uid: uuid.UUID = Field(sa_column=Column(pg.UUID(as_uuid=True), ForeignKey("employees.uid", ondelete="CASCADE"), nullable=False, index=True))
    attendance_uid: Optional[uuid.UUID] = Field(default=None,sa_column=Column(pg.UUID(as_uuid=True), ForeignKey("attendance.uid", ondelete="SET NULL"), nullable=True, index=True))
    regularization_date: date = Field(sa_column=Column(pg.DATE, nullable=False, index=True))
    requested_punch_in: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True))
    requested_punch_out: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True))
    requested_worked_hours: Optional[Decimal] = Field(default=None, sa_column=Column(Numeric(6, 2), nullable=True))
    reason: str = Field(sa_column=Column(Text, nullable=False))
    status: RegularizationStatus = Field(default=RegularizationStatus.Pending,sa_column=Column(pg.ENUM(RegularizationStatus, name="attendance_regularization_status", create_type=True),nullable=False,server_default="Pending",))
    approver_employee_uid: Optional[uuid.UUID] = Field(default=None,sa_column=Column(pg.UUID(as_uuid=True), ForeignKey("employees.uid", ondelete="SET NULL"), nullable=True, index=True))
    reviewer_note: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    reviewed_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True))
    created_at: datetime = Field(default_factory=datetime.utcnow, sa_column=Column(DateTime(timezone=True), nullable=False))
    updated_at: datetime = Field(default_factory=datetime.utcnow,sa_column=Column(DateTime(timezone=True), nullable=False, onupdate=datetime.utcnow))


class AttendanceRegularizationLog(SQLModel, table=True):
    __tablename__ = "attendance_regularization_logs"

    uid: uuid.UUID = Field(sa_column=Column(pg.UUID(as_uuid=True), primary_key=True, nullable=False, default=uuid.uuid4))
    regularization_uid: uuid.UUID = Field(sa_column=Column(pg.UUID(as_uuid=True),ForeignKey("attendance_regularizations.uid", ondelete="CASCADE"),nullable=False,index=True,))
    actor_employee_uid: Optional[uuid.UUID] = Field(default=None,sa_column=Column(pg.UUID(as_uuid=True), ForeignKey("employees.uid", ondelete="SET NULL"), nullable=True, index=True))
    action: str = Field(sa_column=Column(pg.VARCHAR(30), nullable=False))
    note: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    created_at: datetime = Field(default_factory=datetime.utcnow, sa_column=Column(DateTime(timezone=True), nullable=False))