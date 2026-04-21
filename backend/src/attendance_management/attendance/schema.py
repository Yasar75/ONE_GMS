import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, Field
from src.db.models import AttendanceStatus


class AttendanceRead(BaseModel):
    uid: uuid.UUID
    user_uid: uuid.UUID
    employee_uid: uuid.UUID
    attendance_date: date
    first_punch_in: Optional[datetime]
    last_punch_out: Optional[datetime]
    total_assigned_shift_hours: Decimal
    total_worked_hours: Decimal
    status: AttendanceStatus
    is_regularized: bool
    leave_request_uid: Optional[uuid.UUID]
    leave_type_uid: Optional[uuid.UUID]
    remarks: Optional[str]
    created_at: datetime
    updated_at: datetime


class AttendanceUpdate(BaseModel):
    first_punch_in: Optional[datetime] = None
    last_punch_out: Optional[datetime] = None
    total_worked_hours: Optional[Decimal] = Field(default=None, ge=Decimal("0"))
    status: Optional[AttendanceStatus] = None
    is_regularized: Optional[bool] = None
    remarks: Optional[str] = Field(default=None, max_length=1000)


class AttendanceSyncRequest(BaseModel):
    start_date: date
    end_date: Optional[date] = None


class AttendanceSyncResponse(BaseModel):
    start_date: date
    end_date: date
    total_days: int
    employees_processed: int
    created_count: int
    updated_count: int