import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


class PayslipRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    uid: uuid.UUID
    created_by: uuid.UUID
    employee_uid: uuid.UUID
    salary_month: int
    salary_year: int
    original_filename: Optional[str]
    file_url: Optional[str]
    cloudinary_public_id: Optional[str]
    file_format: Optional[str]
    file_size: Optional[int]
    created_at: datetime
    updated_at: datetime


class PayslipListResponse(BaseModel):
    total: int
    items: list[PayslipRead]


class PayslipUploadResponse(BaseModel):
    message: str
    data: PayslipRead


class PayslipDownloadResponse(BaseModel):
    message: str
    download_url: str
    data: PayslipRead


class PayslipMonthYearParams(BaseModel):
    month: int = Field(..., ge=1, le=12)
    year: int = Field(..., ge=2000, le=2100)

    @field_validator("year")
    @classmethod
    def validate_year(cls, value: int) -> int:
        if value < 2000:
            raise ValueError("Year must be valid.")
        return value
