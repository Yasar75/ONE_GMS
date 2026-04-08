import uuid
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, field_validator


class ProjectBase(BaseModel):
    project_code: str
    project_name: str
    description: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[str] = None

    @field_validator("project_code")
    @classmethod
    def validate_project_code(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("project_code is required")
        if len(value) > 30:
            raise ValueError("project_code must be at most 30 characters")
        return value

    @field_validator("project_name")
    @classmethod
    def validate_project_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("project_name is required")
        if len(value) > 150:
            raise ValueError("project_name must be at most 150 characters")
        return value

    @field_validator("status")
    @classmethod
    def normalize_status(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        value = value.strip()
        return value or None



class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    project_code: Optional[str] = None
    project_name: Optional[str] = None
    description: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[str] = None

    @field_validator("project_code")
    @classmethod
    def validate_project_code(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        value = value.strip()
        if not value:
            raise ValueError("project_code cannot be blank")
        if len(value) > 30:
            raise ValueError("project_code must be at most 30 characters")
        return value

    @field_validator("project_name")
    @classmethod
    def validate_project_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        value = value.strip()
        if not value:
            raise ValueError("project_name cannot be blank")
        if len(value) > 150:
            raise ValueError("project_name must be at most 150 characters")
        return value

 


class ProjectRead(ProjectBase):
    model_config = ConfigDict(from_attributes=True)

    uid: uuid.UUID
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime


class ProjectListResponse(BaseModel):
    items: list[ProjectRead]
    total: int


class ProjectMessageResponse(BaseModel):
    message: str