import uuid
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field

from src.db.models.leave_management import LeaveTypeCode


class LeaveTypeCreate(BaseModel):
    code: LeaveTypeCode
    name: str = Field(..., min_length=2, max_length=100)
    annual_days: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0"))
    auto_allocate: bool = True
    requires_manual_grant: bool = False
    carry_forward_allowed: bool = False
    carry_forward_cap: Optional[Decimal] = Field(default=None, ge=Decimal("0"))


class LeaveTypeUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    annual_days: Optional[Decimal] = Field(default=None, ge=Decimal("0"))
    auto_allocate: Optional[bool] = None
    requires_manual_grant: Optional[bool] = None
    carry_forward_allowed: Optional[bool] = None
    carry_forward_cap: Optional[Decimal] = Field(default=None, ge=Decimal("0"))
    is_active: Optional[bool] = None


class LeaveTypeRead(BaseModel):
    uid: uuid.UUID
    code: LeaveTypeCode
    name: str
    annual_days: Decimal
    auto_allocate: bool
    requires_manual_grant: bool
    carry_forward_allowed: bool
    carry_forward_cap: Optional[Decimal]
    is_active: bool