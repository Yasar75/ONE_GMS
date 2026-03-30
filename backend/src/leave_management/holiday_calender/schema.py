import uuid
from datetime import date
from typing import Optional

from pydantic import BaseModel, Field


class HolidayCalendarCreate(BaseModel):
    holiday_date: date
    name: str = Field(..., min_length=2, max_length=150)
    description: Optional[str] = " "
    is_active: bool = True


class HolidayCalendarUpdate(BaseModel):
    holiday_date: Optional[date] = None
    name: Optional[str] = Field(default=None, min_length=2, max_length=150)
    description: Optional[str] = " "
    is_active: Optional[bool] 


class HolidayCalendarRead(BaseModel):
    uid: uuid.UUID
    holiday_date: date
    name: str
    description: Optional[str]
    is_active: bool
