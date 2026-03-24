import uuid
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, Field, field_validator


class LeaveTypeCreate(BaseModel):
    code: str = Field(..., min_length=1, max_length=100)
    name: str = Field(..., min_length=2, max_length=100)
    annual_days: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0"))
    auto_allocate: bool = True
    requires_manual_grant: bool = False
    carry_forward_allowed: bool = False
    carry_forward_cap: Optional[Decimal] = Field(default=None, ge=Decimal("0"))

    @field_validator("code", "name")
    @classmethod
    def validate_text_fields(cls, v: str) -> str:
        v = " ".join(v.strip().split())
        if not v:
            raise ValueError("This field cannot be empty.")
        return v


class LeaveTypeUpdate(BaseModel):
    code: Optional[str] = Field(default=None, min_length=1, max_length=100)
    name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    annual_days: Optional[Decimal] = Field(default=None, ge=Decimal("0"))
    auto_allocate: Optional[bool] = None
    requires_manual_grant: Optional[bool] = None
    carry_forward_allowed: Optional[bool] = None
    carry_forward_cap: Optional[Decimal] = Field(default=None, ge=Decimal("0"))
    is_active: Optional[bool] = None

    @field_validator("code", "name")
    @classmethod
    def validate_optional_text_fields(cls, v):
        if v is None:
            return v
        v = " ".join(v.strip().split())
        if not v:
            raise ValueError("This field cannot be empty.")
        return v


class LeaveTypeRead(BaseModel):
    uid: uuid.UUID
    code: str
    name: str
    annual_days: Decimal
    auto_allocate: bool
    requires_manual_grant: bool
    carry_forward_allowed: bool
    carry_forward_cap: Optional[Decimal]
    is_active: bool

    class Config:
        from_attributes = True