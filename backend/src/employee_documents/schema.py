import uuid
from datetime import date, datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field, field_validator, ConfigDict


class EmployeeDocumentType(str, Enum):
    AADHAAR = "AADHAAR"
    PAN = "PAN"
    OTHER = "OTHER"


class EmployeeDocumentBase(BaseModel):
    employee_uid: uuid.UUID
    document_type: EmployeeDocumentType
    name: str = Field(..., min_length=2, max_length=255)

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Document name cannot be empty.")
        return v


class EmployeeDocumentCreate(EmployeeDocumentBase):
    pass


class EmployeeDocumentUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=255)
    document_type: Optional[EmployeeDocumentType] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("Document name cannot be empty.")
        return v


class EmployeeDocumentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    uid: uuid.UUID
    user_uid: uuid.UUID
    employee_uid: uuid.UUID
    document_type: EmployeeDocumentType
    name: str
    upload_date: Optional[date]
    file_url: Optional[str]
    cloudinary_public_id: Optional[str]
    file_format: Optional[str]
    file_size: Optional[int]
    created_at: datetime
    updated_at: datetime


class EmployeeDocumentListResponse(BaseModel):
    total: int
    items: list[EmployeeDocumentRead]


class EmployeeDocumentUploadResponse(BaseModel):
    message: str
    data: EmployeeDocumentRead