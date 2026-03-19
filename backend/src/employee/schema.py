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


class EmployeeSkillSummary(BaseModel):
    uid: uuid.UUID
    skill: str

    model_config = ConfigDict(from_attributes=True)


class EmployeeDocumentSummary(BaseModel):
    uid: uuid.UUID
    document_type: str
    name: str
    file_url: Optional[str] = None
    upload_date: Optional[date] = None
    file_format: Optional[str] = None
    file_size: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class EmployeeProfileRead(BaseModel):
    employee: Optional[EmployeeBase] = None
    nickname: Optional[str] = None
    profile_image_url: Optional[str] = None
    can_edit_profile_details: bool = True
    profile_completed_at: Optional[datetime] = None
    must_change_password: bool = False
    skills: List[EmployeeSkillSummary] = PydField(default_factory=list)
    documents: List[EmployeeDocumentSummary] = PydField(default_factory=list)


class EmployeeSelfProfileUpdate(BaseModel):
    first_name: Optional[str] = PydField(default=None, max_length=120)
    last_name: Optional[str] = PydField(default=None, max_length=120)
    position: Optional[str] = PydField(default=None, max_length=120)
    department: Optional[str] = PydField(default=None, max_length=120)
    email: Optional[EmailStr] = None
    phone: Optional[str] = PydField(default=None, max_length=50)
    join_date: Optional[date] = None
    birth_date: Optional[date] = None
    address: Optional[str] = None
    gender: Optional[str] = None
    caste: Optional[str] = None
    emergency_contact: Optional[str] = None
    blood_group: Optional[str] = PydField(default=None, max_length=10)
    employee_type: Optional[EmployeeType] = None
    work_location: Optional[str] = PydField(default=None, max_length=120)
    nickname: Optional[str] = PydField(default=None, max_length=120)
    skills: Optional[List[str]] = None


class EmployeeProfileEditLockRequest(BaseModel):
    can_edit_profile_details: bool


class EmployeeProfileRequestRead(BaseModel):
    employee_uid: uuid.UUID
    user_uid: uuid.UUID
    employee_code: str
    full_name: str
    email: Optional[EmailStr] = None
    status: EmployeeStatus
    can_edit_profile_details: bool
    profile_completed_at: Optional[datetime] = None
    must_change_password: bool = False
    is_locked: bool = False
    locked_reason: Optional[str] = None


