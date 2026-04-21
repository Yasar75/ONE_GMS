import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, Field
from src.db.models import RegularizationStatus
from typing import Literal, Optional

class AttendanceRegularizationCreate(BaseModel):
    regularization_date: date
    requested_punch_in: Optional[datetime] = None
    requested_punch_out: Optional[datetime] = None
    requested_worked_hours: Optional[Decimal] = None
    reason: str = Field(..., min_length=3, max_length=1000)


class AttendanceRegularizationDecision(BaseModel):
    reviewer_note: Optional[str] = Field(default=None, max_length=1000)


class AttendanceRegularizationRead(BaseModel):
    uid: uuid.UUID
    user_uid: uuid.UUID
    employee_uid: uuid.UUID
    attendance_uid: Optional[uuid.UUID]
    regularization_date: date
    requested_punch_in: Optional[datetime]
    requested_punch_out: Optional[datetime]
    requested_worked_hours: Optional[Decimal]
    reason: str
    status: RegularizationStatus
    approver_employee_uid: Optional[uuid.UUID]
    reviewer_note: Optional[str]
    reviewed_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime


## For Manager Level Approval
class AttendanceRegularizationManagerDecision(BaseModel):
    action: Literal["approve", "reject"]
    reviewer_note: Optional[str] = Field(default=None, max_length=1000)