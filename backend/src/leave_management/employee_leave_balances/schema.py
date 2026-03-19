import uuid
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict
from pydantic import BaseModel, Field


class GenerateEmployeeLeaveBalanceRequest(BaseModel):
    year: int = Field(..., ge=2000, le=2100)
    employee_uid: Optional[uuid.UUID] = None


class ManualGrantLeaveBalanceRequest(BaseModel):
    employee_uid: uuid.UUID
    leave_type_uid: uuid.UUID
    year: int = Field(..., ge=2000, le=2100)
    days: Decimal = Field(..., gt=Decimal("0"))


class EmployeeLeaveBalanceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    uid: uuid.UUID
    employee_uid: uuid.UUID
    leave_type_uid: uuid.UUID
    year: int
    opening_balance: Decimal
    annual_allocation: Decimal
    carry_forward_in: Decimal
    manual_granted: Decimal
    used_days: Decimal
    pending_days: Decimal
    lapsed_days: Decimal
    available_balance: Decimal