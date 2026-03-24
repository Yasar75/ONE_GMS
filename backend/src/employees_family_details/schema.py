from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Optional, List

from pydantic import BaseModel, Field, field_validator, ConfigDict


def _normalize_text(value: Optional[str]) -> Optional[str]:
    if value is None:
        return value
    value = value.strip()
    return value or None


class EmployeeFamilyDetailCreate(BaseModel):
    employee_uid: uuid.UUID
    relation: str = Field(..., min_length=1, max_length=100)
    full_name: str = Field(..., min_length=1, max_length=150)
    date_of_birth: Optional[date] = None
    phone: Optional[str] = Field(default=None, max_length=20)
    occupation: Optional[str] = Field(default=None, max_length=120)
    is_dependent: bool = False
    address: Optional[str] = None
    remarks: Optional[str] = None

    @field_validator("relation", "full_name")
    @classmethod
    def validate_required_text(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("This field cannot be empty.")
        return v

    @field_validator("phone", "occupation", "address", "remarks", mode="before")
    @classmethod
    def normalize_optional_fields(cls, v):
        return _normalize_text(v)


class EmployeeFamilyDetailUpdate(BaseModel):
    relation: Optional[str] = Field(default=None, min_length=1, max_length=100)
    full_name: Optional[str] = Field(default=None, min_length=1, max_length=150)
    date_of_birth: Optional[date] = None
    phone: Optional[str] = Field(default=None, max_length=20)
    occupation: Optional[str] = Field(default=None, max_length=120)
    is_dependent: Optional[bool] = None
    address: Optional[str] = None
    remarks: Optional[str] = None

    @field_validator("relation", "full_name")
    @classmethod
    def validate_optional_text(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("This field cannot be empty.")
        return v

    @field_validator("phone", "occupation", "address", "remarks", mode="before")
    @classmethod
    def normalize_optional_fields(cls, v):
        return _normalize_text(v)


class EmployeeFamilyDetailRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    uid: uuid.UUID
    user_uid: uuid.UUID
    employee_uid: uuid.UUID
    relation: str
    full_name: str
    date_of_birth: Optional[date]
    phone: Optional[str]
    occupation: Optional[str]
    is_dependent: bool
    address: Optional[str]
    remarks: Optional[str]
    created_at: datetime
    updated_at: datetime


class EmployeeFamilyDetailList(BaseModel):
    items: List[EmployeeFamilyDetailRead]
    total: int