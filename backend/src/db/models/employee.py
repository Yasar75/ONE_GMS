import uuid
from datetime import datetime,date
from typing import Optional
from enum import Enum
from sqlalchemy import Column, ForeignKey, DateTime, Text, Numeric,SmallInteger
from decimal import Decimal
import sqlalchemy.dialects.postgresql as pg
from sqlmodel import Column, Field, SQLModel
import sqlalchemy as sa

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

# class BillingStatus(str, Enum):
#     Billable = "Billable"
#     NonBillable = "NonBillable"

class Employee(SQLModel, table=True):
    __tablename__ = "employees"


    uid: uuid.UUID = Field(sa_column=Column(pg.UUID, primary_key=True, nullable=False, default=uuid.uuid4))
    user_uid: uuid.UUID = Field(foreign_key="users.uid", nullable=False, index=True)
    employee_code: str = Field(sa_column=Column(pg.VARCHAR(20), nullable=False, unique=True))
    first_name: str = Field(sa_column=Column(pg.VARCHAR(120), nullable=False))
    last_name: Optional[str] = Field(default=None, sa_column=Column(pg.VARCHAR(120), nullable=True))
    nick_name: Optional[str] = Field(default=None, sa_column=Column(pg.VARCHAR(120), nullable=True))
    profile_image: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    position: Optional[str] = Field(default=None, sa_column=Column(pg.VARCHAR(120), nullable=True))
    department: Optional[str] = Field(default=None, sa_column=Column(pg.VARCHAR(120), nullable=True))
    email: Optional[str] = Field(default=None, sa_column=Column(pg.VARCHAR(255), unique=True, nullable=True))
    phone: Optional[str] = Field(default=None, sa_column=Column(pg.VARCHAR(50), nullable=True))
    join_date: Optional[date] = Field(default=None)
    status: EmployeeStatus = Field(default=EmployeeStatus.Active,sa_column=Column(pg.ENUM(EmployeeStatus, name="employee_status", create_type=True),nullable=False,server_default="Active",))
    birth_date: Optional[date] = Field(default=None)
    address: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    gender: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    caste:  Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    emergency_contact: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    billing_status: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    blood_group: Optional[str] = Field(default=None, sa_column=Column(pg.VARCHAR(10), nullable=True))
    employee_type: Optional[EmployeeType] = Field(default=None,sa_column=Column(pg.ENUM(EmployeeType, name="employee_type", create_type=True),nullable=True,))
    work_location: Optional[str] = Field(default=None, sa_column=Column(pg.VARCHAR(120), nullable=True))
    manager_employee_uid: Optional[uuid.UUID] = Field(default=None,sa_column=Column(pg.UUID(as_uuid=True),ForeignKey("employees.uid", ondelete="SET NULL"),nullable=True,index=True,))
    hr_employee_uid: Optional[uuid.UUID] = Field(default=None,sa_column=Column(pg.UUID(as_uuid=True),ForeignKey("employees.uid", ondelete="SET NULL"),nullable=True,index=True,))
    team_lead_employee_uid: Optional[uuid.UUID] = Field(default=None,sa_column=Column(pg.UUID(as_uuid=True),ForeignKey("employees.uid", ondelete="SET NULL"),nullable=True,index=True,))
    coordinator_employee_uid: Optional[uuid.UUID] = Field(default=None,sa_column=Column(pg.UUID(as_uuid=True),ForeignKey("employees.uid", ondelete="SET NULL"),nullable=True,index=True,))
    role_type: Optional[uuid.UUID] = Field(default=None, sa_column=Column(pg.UUID(as_uuid=True), ForeignKey("roles.uid", ondelete="SET NULL"), nullable=True, index=True))
    created_at: datetime = Field(default_factory=datetime.utcnow,sa_column=Column(DateTime(timezone=True), nullable=False))
    updated_at: datetime = Field(default_factory=datetime.utcnow,sa_column=Column(DateTime(timezone=True), nullable=False, onupdate=datetime.utcnow))

    def __repr__(self):
        return f"{self.employee_code} - {self.name} {self.created_at} "



## Employees Skill Table
class EmployeeSkill(SQLModel, table=True):
    __tablename__ = "employee_skills"

    uid: uuid.UUID = Field(sa_column=Column(pg.UUID(as_uuid=True), primary_key=True, nullable=False, default=uuid.uuid4))
    user_uid: uuid.UUID = Field(foreign_key="users.uid", nullable=False, index=True)
    employee_uid: uuid.UUID = Field(sa_column=Column(pg.UUID(as_uuid=True),ForeignKey("employees.uid", ondelete="CASCADE"),nullable=False,index=True))
    skill: str = Field(sa_column=Column(pg.VARCHAR(80), nullable=False))
    created_at: datetime = Field(default_factory=datetime.utcnow,sa_column=Column(DateTime(timezone=True), nullable=False))
    updated_at: datetime = Field(default_factory=datetime.utcnow,sa_column=Column(DateTime(timezone=True), nullable=False, onupdate=datetime.utcnow))
   
    # __table_args__ = (
    #     sa.UniqueConstraint("employee_id", "skill", name="uq_employee_skills_employee_id_skill"),
    # )

    def __repr__(self):
        return f"{self.employee_id} - {self.skill} {self.created_at} "


## Employee's Education table
class EmployeeEducation(SQLModel, table=True):
    __tablename__ = "employee_education"

    uid: uuid.UUID = Field(sa_column=Column(pg.UUID(as_uuid=True), primary_key=True, nullable=False, default=uuid.uuid4))
    user_uid: uuid.UUID = Field(foreign_key="users.uid", nullable=False, index=True)
    employee_uid: uuid.UUID = Field(sa_column=Column(pg.UUID(as_uuid=True),ForeignKey("employees.uid", ondelete="CASCADE"),nullable=False,index=True))
    degree: str = Field(sa_column=Column(Text, nullable=False))
    institution: str = Field(sa_column=Column(Text, nullable=False))
    year: Optional[int] = Field(default=None,sa_column=Column(SmallInteger, nullable=True),description="Year of completion (stored as SMALLINT).")
    created_at: datetime = Field(default_factory=datetime.utcnow,sa_column=Column(DateTime(timezone=True), nullable=False))
    updated_at: datetime = Field(default_factory=datetime.utcnow,sa_column=Column(DateTime(timezone=True), nullable=False, onupdate=datetime.utcnow))

    def __repr__(self):
        return f"{self.employee_id} - {self.degree} {self.created_at} "

## Employee Document Table

class EmployeeDocumentType(str, Enum):
    AADHAAR = "AADHAAR"
    PAN = "PAN"
    OTHER = "OTHER"


class EmployeeDocument(SQLModel, table=True):
    __tablename__ = "employee_documents"

    uid: uuid.UUID = Field(sa_column=Column(pg.UUID(as_uuid=True), primary_key=True, nullable=False, default=uuid.uuid4))
    user_uid: uuid.UUID = Field(foreign_key="users.uid", nullable=False, index=True)
    employee_uid: uuid.UUID = Field(sa_column=Column(pg.UUID(as_uuid=True),ForeignKey("employees.uid", ondelete="CASCADE"),nullable=False,index=True))
    document_type: EmployeeDocumentType = Field(sa_column=Column(pg.VARCHAR(20),nullable=False,index=True))
    name: str = Field(sa_column=Column(pg.VARCHAR(255), nullable=False))
    upload_date: Optional[date] = Field(default=None)
    file_url: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    cloudinary_public_id: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    file_format: Optional[str] = Field(default=None, sa_column=Column(pg.VARCHAR(50), nullable=True))
    file_size: Optional[int] = Field(default=None, nullable=True)
    created_at: datetime = Field(default_factory=datetime.utcnow,sa_column=Column(DateTime(timezone=True), nullable=False))
    updated_at: datetime = Field(default_factory=datetime.utcnow,sa_column=Column(DateTime(timezone=True), nullable=False, onupdate=datetime.utcnow))

    def __repr__(self):
        return f"{self.name} - {self.upload_date}"


class EmployeeAchievement(SQLModel, table=True):
    __tablename__ = "employee_achievements"

    uid: uuid.UUID = Field(sa_column=Column(pg.UUID(as_uuid=True),primary_key=True,nullable=False,default=uuid.uuid4))
    user_uid: uuid.UUID = Field(foreign_key="users.uid", nullable=False, index=True)
    employee_uid: uuid.UUID = Field(sa_column=Column(pg.UUID(as_uuid=True),ForeignKey("employees.uid", ondelete="CASCADE"),nullable=False,index=True))
    title: str = Field(sa_column=Column(pg.VARCHAR(200), nullable=False))
    description: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    achievement_date: Optional[date] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow,sa_column=Column(DateTime(timezone=True), nullable=False))
    updated_at: datetime = Field(default_factory=datetime.utcnow,sa_column=Column(DateTime(timezone=True), nullable=False, onupdate=datetime.utcnow))

    def __repr__(self):
        return f"{self.title}"


## Family Details (Spouse and Child,Parents)


class EmployeeFamilyDetail(SQLModel, table=True):
    __tablename__ = "employee_family_details"

    uid: uuid.UUID = Field(sa_column=Column(pg.UUID(as_uuid=True), primary_key=True, nullable=False, default=uuid.uuid4))
    user_uid: uuid.UUID = Field(foreign_key="users.uid", nullable=False, index=True)
    employee_uid: uuid.UUID = Field(sa_column=Column(pg.UUID(as_uuid=True),ForeignKey("employees.uid", ondelete="CASCADE"),nullable=False,index=True))
    relation: str = Field(sa_column=Column(pg.VARCHAR(100), nullable=False, index=True))
    full_name: str = Field(sa_column=Column(pg.VARCHAR(150), nullable=False))
    date_of_birth: Optional[date] = Field(default=None)
    phone: Optional[str] = Field(default=None, sa_column=Column(pg.VARCHAR(20), nullable=True))
    occupation: Optional[str] = Field(default=None, sa_column=Column(pg.VARCHAR(120), nullable=True))
    is_dependent: bool = Field(default=False, nullable=False)
    address: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    remarks: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))

    created_at: datetime = Field(default_factory=datetime.utcnow,sa_column=Column(DateTime(timezone=True), nullable=False))
    updated_at: datetime = Field(default_factory=datetime.utcnow,sa_column=Column(DateTime(timezone=True), nullable=False, onupdate=datetime.utcnow))

    def __repr__(self):
        return f"{self.employee_uid} - {self.relation} - {self.full_name}"


class EmployeeWorkExperience(SQLModel, table=True):
    __tablename__ = "employee_work_experiences"

    uid: uuid.UUID = Field(sa_column=Column(pg.UUID(as_uuid=True), primary_key=True, nullable=False, default=uuid.uuid4))
    user_uid: uuid.UUID = Field(foreign_key="users.uid", nullable=False, index=True)
    employee_uid: uuid.UUID = Field(sa_column=Column(pg.UUID(as_uuid=True),ForeignKey("employees.uid", ondelete="CASCADE"),nullable=False,index=True))
    company_name: str = Field(sa_column=Column(pg.VARCHAR(150), nullable=False, index=True))
    job_title: str = Field(sa_column=Column(pg.VARCHAR(120), nullable=False))
    employment_type: Optional[str] = Field(default=None, sa_column=Column(pg.VARCHAR(50), nullable=True))
    location: Optional[str] = Field(default=None, sa_column=Column(pg.VARCHAR(120), nullable=True))
    start_date: date = Field(nullable=False)
    end_date: Optional[date] = Field(default=None)
    is_current: bool = Field(default=False, nullable=False)
    year_of_exp: Optional[Decimal] = Field(default=None,sa_column=Column(Numeric(5, 2), nullable=True))
    responsibilities: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    last_salary: Optional[Decimal] = Field(default=None,sa_column=Column(Numeric(12, 2), nullable=True))
    reason_for_leaving: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    remarks: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    created_at: datetime = Field(default_factory=datetime.utcnow,sa_column=Column(DateTime(timezone=True), nullable=False))
    updated_at: datetime = Field(default_factory=datetime.utcnow,sa_column=Column(DateTime(timezone=True), nullable=False, onupdate=datetime.utcnow))

    def __repr__(self):
        return f"{self.employee_uid} - {self.year_of_exp}"