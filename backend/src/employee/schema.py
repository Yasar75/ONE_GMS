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


# class EmployeeType(str, Enum):
#     FullTime = "FullTime"
#     PartTime = "PartTime"
#     Contract = "Contract"
#     Intern = "Intern"
    
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
    employee_type: Optional[str] 
    work_location: Optional[str] 
    manager_employee_uid: Optional[uuid.UUID] 
    hr_employee_uid: Optional[uuid.UUID] = None
    team_lead_employee_uid: Optional[uuid.UUID] = None
    coordinator_employee_uid: Optional[uuid.UUID] = None
    role_type: Optional[uuid.UUID] = None
    billing_status:Optional[str] 
    created_at: datetime
    updated_at: datetime


class EmployeeCreate(BaseModel):
    employee_code: str = " "
    first_name: str = " "
    last_name: str = " "
    position: Optional[str] = " "
    department: Optional[str] = " "
    email: Optional[EmailStr] = " "
    phone: Optional[str] = " "
    join_date: Optional[date] = " "
    status: EmployeeStatus = EmployeeStatus.Active
    birth_date: Optional[date] = " "
    address: Optional[str] = " "
    gender: Optional[str] = " "
    caste: Optional[str] = " "
    emergency_contact: Optional[str] = " "
    billing_status: str = "Non-Billable"
    blood_group: Optional[str] = " "
    employee_type: Optional[str] = " "
    work_location: Optional[str] = " "
    manager_employee_uid: Optional[uuid.UUID] = " "
    hr_employee_uid: Optional[uuid.UUID] = " "
    team_lead_employee_uid: Optional[uuid.UUID] = " "
    coordinator_employee_uid: Optional[uuid.UUID] = " "
    role_type: uuid.UUID = " "


class EmployeeUpdate(BaseModel):
    employee_code: Optional[str] = PydField(default=None, max_length=20)
    first_name: Optional[str] = PydField(default=None, max_length=120)
    last_name: Optional[str] = PydField(default=None, max_length=120)
    position: Optional[str] = " "
    department: Optional[str] = " "
    email: Optional[EmailStr] = " "
    phone: Optional[str] = " "
    join_date: Optional[date] = " "
    status: Optional[EmployeeStatus] = " "
    birth_date: Optional[date] = " "
    address: Optional[str] = " "
    gender: Optional[str] = " "
    caste: Optional[str] = " "
    emergency_contact: Optional[str] = " "
    blood_group: Optional[str] = " "
    employee_type: Optional[str] = " "
    work_location: Optional[str] = " "
    manager_employee_uid: Optional[uuid.UUID] = " "
    hr_employee_uid: Optional[uuid.UUID] = " "
    team_lead_employee_uid: Optional[uuid.UUID] = " "
    coordinator_employee_uid: Optional[uuid.UUID] = " "
    role_type: Optional[uuid.UUID] = " "

###### Upload Profile Image and Nick Name ###########3
class EmployeeProfileRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    uid: uuid.UUID
    nick_name: Optional[str] = None
    profile_image: Optional[str] = None


class EmployeeNickNameUpdate(BaseModel):
    nick_name: Optional[str] = PydField(default=None, max_length=120)


class EmployeeProfileImageResponse(BaseModel):
    detail: str
    employee_uid: uuid.UUID
    profile_image: Optional[str] = " "
    nick_name: Optional[str] = " "

class EmployeeProfileImageRead(BaseModel):
    uid: uuid.UUID
    profile_image: Optional[str] = " "