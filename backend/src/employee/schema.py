import uuid
from datetime import datetime, date
from enum import Enum
from typing import Optional, List
from pydantic import EmailStr, Field as PydField,ConfigDict
from pydantic import BaseModel


class EmployeeStatus(str, Enum):
    Active = "Active"
    Inactive = "Inactive"
    Resigned = "Resigned"
    Terminated = "Terminated"


class EmployeeType(str, Enum):
    FullTime = "FullTime"
    PartTime = "PartTime"
    Contract = "Contract"
    Intern = "Intern"
    
class EmployeeBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    uid: uuid.UUID
    user_uid: uuid.UUID
    employee_code: str 
    first_name: str 
    last_name:str
    position: Optional[str] 
    department: Optional[str] 
    email: Optional[EmailStr] 
    phone: Optional[str] 
    join_date: Optional[date] 
    status: EmployeeStatus 
    birth_date: Optional[date] 
    address: Optional[str] 
    gender: Optional[str] 
    caste: Optional[str] 
    emergency_contact: Optional[str] 
    blood_group: Optional[str]
    employee_type: Optional[EmployeeType] 
    work_location: Optional[str] 
    manager_employee_uid: Optional[uuid.UUID] 
    hr_employee_uid: Optional[uuid.UUID] = None
    team_lead_employee_uid: Optional[uuid.UUID] = None
    coordinator_employee_uid: Optional[uuid.UUID] = None
    role_type: Optional[uuid.UUID] = None
    created_at: datetime
    updated_at: datetime


class EmployeeCreate(BaseModel):
    employee_code: str = PydField(max_length=20)
    first_name: str = PydField(max_length=120)
    last_name: str = PydField(max_length=120)
    position: Optional[str] = PydField(default=None, max_length=120)
    department: Optional[str] = PydField(default=None, max_length=120)
    email: Optional[EmailStr] = None
    phone: Optional[str] = PydField(default=None, max_length=50)
    join_date: Optional[date] = None
    status: EmployeeStatus = EmployeeStatus.Active
    birth_date: Optional[date] = None
    address: Optional[str] = None
    gender: Optional[str] 
    caste: Optional[str] 
    emergency_contact: Optional[str] = None
    blood_group: Optional[str] = PydField(default=None, max_length=10)
    employee_type: Optional[EmployeeType] = None
    work_location: Optional[str] = PydField(default=None, max_length=120)
    manager_employee_uid: Optional[uuid.UUID] = None
    hr_employee_uid: Optional[uuid.UUID] = None
    team_lead_employee_uid: Optional[uuid.UUID] = None
    coordinator_employee_uid: Optional[uuid.UUID] = None
    role_type: uuid.UUID


class EmployeeUpdate(BaseModel):
    employee_code: Optional[str] = PydField(default=None, max_length=20)
    first_name: Optional[str] = PydField(default=None, max_length=120)
    last_name: Optional[str] = PydField(default=None, max_length=120)
    position: Optional[str] = PydField(default=None, max_length=120)
    department: Optional[str] = PydField(default=None, max_length=120)
    email: Optional[EmailStr] = None
    phone: Optional[str] = PydField(default=None, max_length=50)
    join_date: Optional[date] = None
    status: Optional[EmployeeStatus] = None
    birth_date: Optional[date] = None
    address: Optional[str] = None
    gender: Optional[str] 
    caste: Optional[str] 
    emergency_contact: Optional[str] = None
    blood_group: Optional[str] = PydField(default=None, max_length=10)
    employee_type: Optional[EmployeeType] = None
    work_location: Optional[str] = PydField(default=None, max_length=120)
    manager_employee_uid: Optional[uuid.UUID] = None
    hr_employee_uid: Optional[uuid.UUID] = None
    team_lead_employee_uid: Optional[uuid.UUID] = None
    coordinator_employee_uid: Optional[uuid.UUID] = None
    role_type: Optional[uuid.UUID] = None


