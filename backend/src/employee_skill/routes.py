
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from src.db.main import get_session
from src.employee_skill.schema import EmployeeSkillCreate,EmployeeSkillUpdate,EmployeeSkillRead,EmployeeSkillList
from src.employee_skill.service import EmployeeSkillService
from src.auth.dependencies import AccessTokenBearer, RoleChecker,PermissionChecker
from typing import List
from fastapi import HTTPException, status

employee_skill_router = APIRouter()
skill_service = EmployeeSkillService()
#role_checker_admin = Depends(RoleChecker(["admin", "HR"]))
#role_checker_employee = Depends(RoleChecker(["admin", "HR","Employee"]))
access_token_bearer = AccessTokenBearer()
module= "Employee Skills"
##Get All skill
@employee_skill_router.get("/", response_model=List[EmployeeSkillRead], status_code=status.HTTP_200_OK,dependencies=[Depends(PermissionChecker(module, "r"))])
async def get_all_employee_skill(session: AsyncSession = Depends(get_session)):
    return await skill_service.get_all_employee_skill(session)

## Get skill by UID
@employee_skill_router.get("/{skill_uid}", response_model=EmployeeSkillRead, status_code=status.HTTP_200_OK,dependencies=[Depends(PermissionChecker(module, "r"))])
async def get_skill_by_uid(skill_uid: uuid.UUID,session: AsyncSession = Depends(get_session)):
    return await skill_service.get_employee_skill_by_uid(session, skill_uid)


##Create employees Skill
@employee_skill_router.post("", status_code=status.HTTP_201_CREATED, response_model=EmployeeSkillRead, dependencies=[Depends(PermissionChecker(module, "c"))])
async def create_a_employee_skill(employee_data: EmployeeSkillCreate,session: AsyncSession = Depends(get_session),token_details: dict = Depends(access_token_bearer)):
    user_id = token_details.get("user", {}).get("user_uid")
    new_employee = await skill_service.create_Employee_skill(employee_data, user_id, session)
    return new_employee


##Update Employees skill
@employee_skill_router.put("/{skill_uid}", response_model=EmployeeSkillRead, dependencies=[Depends(PermissionChecker(module, "u"))])
async def update_employee(skill_uid: uuid.UUID,employee_data: EmployeeSkillUpdate,session: AsyncSession = Depends(get_session),_: dict = Depends(access_token_bearer)):
    return await skill_service.update(session, skill_uid, employee_data)


##Delete employee skill
@employee_skill_router.delete("/{skill_uid}", status_code=status.HTTP_200_OK, dependencies=[Depends(PermissionChecker(module, "d"))])
async def delete_employee_skill(skill_uid: uuid.UUID,session: AsyncSession = Depends(get_session),_: dict = Depends(access_token_bearer)):
    await skill_service.delete(session, skill_uid)
    return {"detail": "Deleted successfully"}


