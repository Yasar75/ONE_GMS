from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, Field, field_validator


def _normalize_skill(value: str) -> str:
    return value.strip()


class EmployeeSkillCreate(BaseModel):
    employee_uid: uuid.UUID = Field(...)
    skill: str = Field(..., min_length=1, max_length=80)

    @field_validator("skill")
    @classmethod
    def validate_skill(cls, v: str) -> str:
        v = _normalize_skill(v)
        if not v:
            raise ValueError("Skill cannot be empty.")
        # Optional: block overly-short or purely-symbolic strings
        if len(v) < 2:
            raise ValueError("Skill must be at least 2 characters.")
        return v


class EmployeeSkillUpdate(BaseModel):
    # Only skill is updatable typically
    skill: Optional[str] = Field(default=None, min_length=1, max_length=80)

    @field_validator("skill")
    @classmethod
    def validate_skill(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = _normalize_skill(v)
        if not v:
            raise ValueError("Skill cannot be empty.")
        if len(v) < 2:
            raise ValueError("Skill must be at least 2 characters.")
        return v


class EmployeeSkillRead(BaseModel):
    uid: uuid.UUID
    user_uid: uuid.UUID
    employee_uid: uuid.UUID
    skill: str 
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class EmployeeSkillList(BaseModel):
    items: List[EmployeeSkillRead]
    total: int