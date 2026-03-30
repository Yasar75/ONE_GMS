from typing import List
import uuid
from fastapi import APIRouter, Depends, status,BackgroundTasks,HTTPException
from sqlmodel.ext.asyncio.session import AsyncSession
from fastapi import UploadFile, File
from src.auth.dependencies import AccessTokenBearer, RoleChecker,AdminOnly,PermissionChecker
from src.db.main import get_session
from src.errors import EmployeeNotFound
from src.employee.service import EmployeeService
from .schema import EmployeeBase, EmployeeCreate, EmployeeUpdate,EmployeeNickNameUpdate,EmployeeProfileImageResponse,EmployeeProfileRead, EmployeeProfileImageRead

employee_router = APIRouter()
employee_service = EmployeeService()
access_token_bearer = AccessTokenBearer()
role_checker = Depends(RoleChecker(["admin", "HR"]))
adminonly= Depends(AdminOnly)

admin_module = "Employee Management"
profile_update_module= "Profile Update"

## Helper Function
def _is_admin_from_token(token_details: dict) -> bool:
    user_data = token_details.get("user", {}) if token_details else {}

    possible_values = [user_data.get("role"),user_data.get("role_name"),user_data.get("user_role")]

    for value in possible_values:
        if isinstance(value, str) and value.strip().lower() == "admin":
            return True

    roles = user_data.get("roles")
    if isinstance(roles, list):
        for role in roles:
            if isinstance(role, str) and role.strip().lower() == "admin":
                return True

    return False

async def _ensure_self_or_admin(employee_uid: uuid.UUID,session: AsyncSession,token_details: dict) -> None:
    employee = await employee_service.get_employee_by_uid(session, employee_uid)
    current_user_uid = token_details.get("user", {}).get("user_uid")

    if current_user_uid is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,detail="Invalid token payload.")

    is_admin = _is_admin_from_token(token_details)

    if str(employee.user_uid) != str(current_user_uid) and not is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,detail="You are allowed to access/update only your own profile unless you are an admin.")


@employee_router.get("/", response_model=List[EmployeeBase], status_code=status.HTTP_200_OK,dependencies=[Depends(PermissionChecker(admin_module, "r"))])
async def get_all_employee(session: AsyncSession = Depends(get_session)):
    return await employee_service.get_all_employee(session)


@employee_router.get("/{employee_uid}", response_model=EmployeeBase, status_code=status.HTTP_200_OK)
async def get_employee_by_uid(employee_uid: uuid.UUID,session: AsyncSession = Depends(get_session)):
    return await employee_service.get_employee_by_uid(session, employee_uid)

    
@employee_router.post("", status_code=status.HTTP_201_CREATED, response_model=EmployeeBase,dependencies=[Depends(PermissionChecker(admin_module, "c"))]) 
async def create_a_employee(
    employee_data: EmployeeCreate,
    bg_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_session),
    token_details: dict = Depends(access_token_bearer),
):
    user_id = token_details.get("user", {}).get("user_uid")
    new_employee = await employee_service.create_Employees(employees_data=employee_data,
        user_uid=user_id,
        session=session,
        bg_tasks=bg_tasks,)
    return new_employee





@employee_router.put("/{employee_uid}", response_model=EmployeeBase, dependencies=[Depends(PermissionChecker(admin_module, "u"))])
async def update_employee(employee_uid: uuid.UUID,employee_data: EmployeeUpdate,
session: AsyncSession = Depends(get_session),_: dict = Depends(access_token_bearer),):
    return await employee_service.update_employee(session, employee_uid, employee_data)


@employee_router.delete("/{employee_uid}",status_code=status.HTTP_200_OK,dependencies=[Depends(PermissionChecker(admin_module, "d"))])
async def delete_employee(employee_uid: uuid.UUID,session: AsyncSession = Depends(get_session),_: dict = Depends(access_token_bearer)):
    ok = await employee_service.delete_employee(employee_uid, session)
    if not ok:
        raise EmployeeNotFound()

    return {"detail": "Employee and linked user deleted successfully"}


## Profile Picture related routes. #####

# ----------------------------
# Self or Admin only endpoints
# ----------------------------

@employee_router.get("/{employee_uid}/profile",response_model=EmployeeProfileRead,status_code=status.HTTP_200_OK,dependencies=[Depends(PermissionChecker(profile_update_module, "r"))])
async def get_employee_profile(employee_uid: uuid.UUID,session: AsyncSession = Depends(get_session),token_details: dict = Depends(access_token_bearer)):
    await _ensure_self_or_admin(employee_uid, session, token_details)
    return await employee_service.get_profile_details(session, employee_uid)


@employee_router.patch("/{employee_uid}/nick-name",response_model=EmployeeProfileRead,status_code=status.HTTP_200_OK,dependencies=[Depends(PermissionChecker(profile_update_module, "u"))])
async def update_employee_nick_name(employee_uid: uuid.UUID,payload: EmployeeNickNameUpdate,session: AsyncSession = Depends(get_session),token_details: dict = Depends(access_token_bearer)):
    await _ensure_self_or_admin(employee_uid, session, token_details)
    return await employee_service.update_nick_name(session=session,employee_uid=employee_uid,nick_name=payload.nick_name)


@employee_router.post("/{employee_uid}/profile-image",response_model=EmployeeProfileRead,status_code=status.HTTP_200_OK,dependencies=[Depends(PermissionChecker(profile_update_module, "u"))])
async def upload_employee_profile_image_route(employee_uid: uuid.UUID,file: UploadFile = File(...),session: AsyncSession = Depends(get_session),token_details: dict = Depends(access_token_bearer)):
    await _ensure_self_or_admin(employee_uid, session, token_details)
    return await employee_service.upload_profile_image(session=session,employee_uid=employee_uid,file=file)


@employee_router.delete("/{employee_uid}/profile-image",response_model=EmployeeProfileRead,status_code=status.HTTP_200_OK,dependencies=[Depends(PermissionChecker(profile_update_module, "u"))])
async def delete_employee_profile_image_route(employee_uid: uuid.UUID,session: AsyncSession = Depends(get_session),token_details: dict = Depends(access_token_bearer)):
    await _ensure_self_or_admin(employee_uid, session, token_details)
    return await employee_service.delete_profile_image(session=session,employee_uid=employee_uid)


@employee_router.get("/{employee_uid}/profile-image",response_model=EmployeeProfileImageRead,status_code=status.HTTP_200_OK,dependencies=[Depends(PermissionChecker(profile_update_module, "r"))])
async def get_employee_profile_image(employee_uid: uuid.UUID,session: AsyncSession = Depends(get_session),token_details: dict = Depends(access_token_bearer)):
    await _ensure_self_or_admin(employee_uid, session, token_details)
    return await employee_service.get_profile_image(session, employee_uid)