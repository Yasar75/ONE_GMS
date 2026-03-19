import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel
from src.db.models import PunchType, AttendanceStatus


class AttendancePunchRequest(BaseModel):
    pass


class AttendancePunchLogRead(BaseModel):
    uid: uuid.UUID
    user_uid: uuid.UUID
    employee_uid: uuid.UUID
    attendance_uid: uuid.UUID
    attendance_date: date
    punch_type: PunchType
    punch_time: datetime
    is_valid: bool
    invalid_reason: Optional[str]
    source: Optional[str]
    created_at: datetime


class AttendancePunchActionResponse(BaseModel):
    attendance_uid: uuid.UUID
    employee_uid: uuid.UUID
    attendance_date: date
    first_punch_in: Optional[datetime]
    last_punch_out: Optional[datetime]
    total_assigned_shift_hours: Decimal
    total_worked_hours: Decimal
    status: AttendanceStatus
    message: str