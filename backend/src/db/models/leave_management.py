import uuid
from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Optional
import sqlalchemy as sa
from sqlalchemy import Column, DateTime, ForeignKey, Text, UniqueConstraint, Boolean, Integer, Numeric
from sqlalchemy.dialects import postgresql as pg
from sqlmodel import SQLModel, Field

class LeaveCancellationStatus(str, Enum):
    NoneRequested = "NoneRequested"
    Pending = "Pending"
    Approved = "Approved"
    Rejected = "Rejected"

class LeaveRequestStatus(str, Enum):
    Pending = "Pending"
    Approved = "Approved"
    Rejected = "Rejected"
    Cancelled = "Cancelled"


class LeaveTypeCode(str, Enum):
    EL = "EL"
    CL = "CL"
    SL = "SL"
    ML = "ML"
    PL = "PL"


class HolidayCalendar(SQLModel, table=True):
    __tablename__ = "holiday_calendar"

    uid: uuid.UUID = Field(sa_column=Column(pg.UUID(as_uuid=True), primary_key=True, nullable=False, default=uuid.uuid4))
    holiday_date: date = Field(sa_column=Column(pg.DATE, nullable=False, index=True))
    name: str = Field(sa_column=Column(pg.VARCHAR(150), nullable=False))
    description: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    is_active: bool = Field(default=True, sa_column=Column(Boolean, nullable=False, server_default=sa.text("true")))
    user_uid: uuid.UUID = Field(foreign_key="users.uid", nullable=False, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow, sa_column=Column(DateTime(timezone=True), nullable=False))
    updated_at: datetime = Field(default_factory=datetime.utcnow, sa_column=Column(DateTime(timezone=True), nullable=False, onupdate=datetime.utcnow))


class LeaveType(SQLModel, table=True):
    __tablename__ = "leave_types"

    uid: uuid.UUID = Field(sa_column=Column(pg.UUID(as_uuid=True), primary_key=True, nullable=False, default=uuid.uuid4))
    code: str = Field(sa_column=Column(pg.VARCHAR(100),nullable=False))
    name: str = Field(sa_column=Column(pg.VARCHAR(100), nullable=False))
    annual_days: Decimal = Field(default=Decimal("0.00"),sa_column=Column(Numeric(6, 2), nullable=False, server_default="0"))
    auto_allocate: bool = Field(default=True,sa_column=Column(Boolean, nullable=False, server_default=sa.text("true")))
    requires_manual_grant: bool = Field(default=False,sa_column=Column(Boolean, nullable=False, server_default=sa.text("false")))
    carry_forward_allowed: bool = Field(default=False,sa_column=Column(Boolean, nullable=False, server_default=sa.text("false")))
    carry_forward_cap: Optional[Decimal] = Field(default=None,sa_column=Column(Numeric(6, 2), nullable=True))
    is_active: bool = Field(default=True,sa_column=Column(Boolean, nullable=False, server_default=sa.text("true")))
    user_uid: uuid.UUID = Field(foreign_key="users.uid", nullable=False, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow, sa_column=Column(DateTime(timezone=True), nullable=False))
    updated_at: datetime = Field(default_factory=datetime.utcnow, sa_column=Column(DateTime(timezone=True), nullable=False, onupdate=datetime.utcnow))


class EmployeeLeaveBalance(SQLModel, table=True):
    __tablename__ = "employee_leave_balances"
    
    uid: uuid.UUID = Field(sa_column=Column(pg.UUID(as_uuid=True), primary_key=True, nullable=False, default=uuid.uuid4))
    user_uid: uuid.UUID = Field(foreign_key="users.uid", nullable=False, index=True)
    employee_uid: uuid.UUID = Field(sa_column=Column(pg.UUID(as_uuid=True), ForeignKey("employees.uid", ondelete="CASCADE"), nullable=False, index=True))
    leave_type_uid: uuid.UUID = Field(sa_column=Column(pg.UUID(as_uuid=True), ForeignKey("leave_types.uid", ondelete="CASCADE"), nullable=False, index=True))
    year: int = Field(sa_column=Column(Integer, nullable=False, index=True))
    opening_balance: Decimal = Field(default=Decimal("0.00"), sa_column=Column(Numeric(6, 2), nullable=False, server_default="0"))
    annual_allocation: Decimal = Field(default=Decimal("0.00"), sa_column=Column(Numeric(6, 2), nullable=False, server_default="0"))
    carry_forward_in: Decimal = Field(default=Decimal("0.00"), sa_column=Column(Numeric(6, 2), nullable=False, server_default="0"))
    manual_granted: Decimal = Field(default=Decimal("0.00"), sa_column=Column(Numeric(6, 2), nullable=False, server_default="0"))
    used_days: Decimal = Field(default=Decimal("0.00"), sa_column=Column(Numeric(6, 2), nullable=False, server_default="0"))
    pending_days: Decimal = Field(default=Decimal("0.00"), sa_column=Column(Numeric(6, 2), nullable=False, server_default="0"))
    lapsed_days: Decimal = Field(default=Decimal("0.00"), sa_column=Column(Numeric(6, 2), nullable=False, server_default="0"))
    created_at: datetime = Field(default_factory=datetime.utcnow, sa_column=Column(DateTime(timezone=True), nullable=False))
    updated_at: datetime = Field(default_factory=datetime.utcnow, sa_column=Column(DateTime(timezone=True), nullable=False, onupdate=datetime.utcnow))



class LeaveRequest(SQLModel, table=True):
    __tablename__ = "leave_request"

    uid: uuid.UUID = Field(sa_column=Column(pg.UUID(as_uuid=True), primary_key=True, nullable=False, default=uuid.uuid4))
    user_uid: uuid.UUID = Field(foreign_key="users.uid", nullable=False, index=True)
    employee_uid: uuid.UUID = Field(sa_column=Column(pg.UUID(as_uuid=True),ForeignKey("employees.uid", ondelete="CASCADE"),nullable=False,index=True))
    leave_type_uid: uuid.UUID = Field(sa_column=Column(pg.UUID(as_uuid=True), ForeignKey("leave_types.uid", ondelete="RESTRICT"), nullable=False, index=True))
    start_date: date = Field(sa_column=Column(pg.DATE, nullable=False))
    end_date: date = Field(sa_column=Column(pg.DATE, nullable=False))
    applied_days: Decimal = Field(sa_column=Column(Numeric(6, 2), nullable=False))
    reason: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))    
    status: LeaveRequestStatus = Field(default=LeaveRequestStatus.Pending,sa_column=Column(pg.ENUM(LeaveRequestStatus, name="leave_request_status", create_type=True), nullable=False, server_default="Pending"))
    approver_employee_uid: Optional[uuid.UUID] = Field(default=None,sa_column=Column(pg.UUID(as_uuid=True), ForeignKey("employees.uid", ondelete="SET NULL"), nullable=True, index=True))
    reviewer_note: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    reviewed_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True))

    cancellation_status: LeaveCancellationStatus = Field(default=LeaveCancellationStatus.NoneRequested,sa_column=Column(pg.ENUM(LeaveCancellationStatus, name="leave_cancellation_status", create_type=True),nullable=False,server_default="NoneRequested",
        index=True))
    cancellation_reason: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    cancellation_requested_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True))
    cancellation_reviewer_note: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    cancellation_reviewed_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True), nullable=True))
    cancellation_approver_employee_uid: Optional[uuid.UUID] = Field(
        default=None,
        sa_column=Column(pg.UUID(as_uuid=True),ForeignKey("employees.uid", ondelete="SET NULL"),nullable=True,index=True))

    created_at: datetime = Field(default_factory=datetime.utcnow,sa_column=Column(DateTime(timezone=True), nullable=False))
    updated_at: datetime = Field(default_factory=datetime.utcnow,sa_column=Column(DateTime(timezone=True), nullable=False, onupdate=datetime.utcnow))

    def __repr__(self):
        return f"{self.employee_uid} - {self.leave_type_uid} {self.status} "