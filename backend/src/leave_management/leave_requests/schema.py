import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional, List
from typing import Literal, Optional
from pydantic import BaseModel, Field

from src.db.models.leave_management import LeaveRequestStatus,LeaveCancellationStatus


class LeaveRequestCreate(BaseModel):
    leave_type_uid: uuid.UUID
    start_date: date
    end_date: date
    reason: Optional[str] = Field(default=None, max_length=1000)


class LeaveRequestDecision(BaseModel):
    reviewer_note: Optional[str] = Field(default=None, max_length=1000)


class LeaveRequestRead(BaseModel):
    uid: uuid.UUID
    employee_uid: uuid.UUID
    leave_type_uid: uuid.UUID
    start_date: date
    end_date: date
    applied_days: Decimal
    reason: Optional[str]
    status: LeaveRequestStatus
    approver_employee_uid: Optional[uuid.UUID]
    reviewer_note: Optional[str]
    reviewed_at: Optional[datetime]
    cancellation_status: LeaveCancellationStatus
    cancellation_reason: Optional[str]
    cancellation_requested_at: Optional[datetime]
    cancellation_reviewer_note: Optional[str]
    cancellation_reviewed_at: Optional[datetime]
    cancellation_approver_employee_uid: Optional[uuid.UUID]


class LeaveDayPreviewRead(BaseModel):
    start_date: date
    end_date: date
    total_calendar_days: int
    excluded_weekends: List[date]
    excluded_holidays: List[date]
    applied_days: Decimal

## Manager Level Leave Approval and Reject schema ######
class LeaveRequestManagerDecision(BaseModel):
    action: Literal["approve", "reject"]
    reviewer_note: Optional[str] = Field(default=None, max_length=1000)

## Leave Cancellation
class LeaveCancellationCreate(BaseModel):
    cancellation_reason: Optional[str] = Field(default=None, max_length=1000)


class LeaveCancellationDecision(BaseModel):
    reviewer_note: Optional[str] = Field(default=None, max_length=1000)


class LeaveRequestUpdate(BaseModel):
    leave_type_uid: uuid.UUID
    start_date: date
    end_date: date
    reason: Optional[str] = Field(default=None, max_length=1000)