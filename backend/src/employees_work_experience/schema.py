import uuid
from decimal import Decimal
from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator, model_validator, ConfigDict


def _normalize_text(value: Optional[str]) -> Optional[str]:
    if value is None:
        return value
    value = value.strip()
    return value or None


class EmployeeWorkExperienceCreate(BaseModel):
    employee_uid: uuid.UUID
    company_name: str = Field(..., min_length=1, max_length=150)
    job_title: str = Field(..., min_length=1, max_length=120)
    employment_type: Optional[str] = Field(default=None, max_length=50)
    location: Optional[str] = Field(default=None, max_length=120)
    start_date: date
    end_date: Optional[date] = None
    is_current: bool = False
    responsibilities: Optional[str] = None
    year_of_exp: Optional[Decimal] = Field(default=None, ge=0)
    last_salary: Optional[Decimal] = Field(default=None, ge=0)
    reason_for_leaving: Optional[str] = None
    remarks: Optional[str] = None

    @field_validator("company_name", "job_title")
    @classmethod
    def validate_required_text(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("This field cannot be empty.")
        return v

    @field_validator(
        "employment_type",
        "location",
        "responsibilities",
        "reason_for_leaving",
        "remarks",
        mode="before",
    )
    @classmethod
    def normalize_optional_fields(cls, v):
        return _normalize_text(v)

    @model_validator(mode="after")
    def validate_dates(self):
        if self.end_date and self.start_date > self.end_date:
            raise ValueError("start_date cannot be greater than end_date.")

        if self.is_current and self.end_date is not None:
            raise ValueError("Current experience should not have end_date.")

        return self


class EmployeeWorkExperienceUpdate(BaseModel):
    company_name: Optional[str] = Field(default=None, min_length=1, max_length=150)
    job_title: Optional[str] = Field(default=None, min_length=1, max_length=120)
    employment_type: Optional[str] = Field(default=None, max_length=50)
    location: Optional[str] = Field(default=None, max_length=120)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_current: Optional[bool] = None
    responsibilities: Optional[str] = None
    year_of_exp: Optional[Decimal] = Field(default=None, ge=0)
    last_salary: Optional[Decimal] = Field(default=None, ge=0)
    reason_for_leaving: Optional[str] = None
    remarks: Optional[str] = None

    @field_validator("company_name", "job_title")
    @classmethod
    def validate_optional_required_text(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("This field cannot be empty.")
        return v

    @field_validator(
        "employment_type",
        "location",
        "responsibilities",
        "reason_for_leaving",
        "remarks",
        mode="before",
    )
    @classmethod
    def normalize_optional_fields(cls, v):
        return _normalize_text(v)


class EmployeeWorkExperienceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    uid: uuid.UUID
    user_uid: uuid.UUID
    employee_uid: uuid.UUID
    company_name: str
    job_title: str
    employment_type: Optional[str]
    location: Optional[str]
    start_date: date
    end_date: Optional[date]
    is_current: bool
    responsibilities: Optional[str]
    year_of_exp: Optional[Decimal]
    last_salary: Optional[Decimal]
    reason_for_leaving: Optional[str]
    remarks: Optional[str]
    created_at: datetime
    updated_at: datetime


class EmployeeWorkExperienceList(BaseModel):
    items: List[EmployeeWorkExperienceRead]
    total: int