from typing import List
import uuid

import cloudinary
import cloudinary.uploader
from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile, status
from sqlmodel.ext.asyncio.session import AsyncSession

from src.auth.dependencies import AccessTokenBearer, PermissionChecker, get_current_user
from src.config import Config
from src.db.main import get_session
from src.db.models import Role, User
from src.employee_documents.schema import EmployeeDocumentType
from src.employee_documents.service import EmployeeDocumentService
from src.errors import EmployeeNotFound
from src.employee.service import EmployeeService
from .schema import (
    EmployeeBase,
    EmployeeCreate,
    EmployeeProfileEditLockRequest,
    EmployeeProfileRead,
    EmployeeProfileRequestRead,
    EmployeeSelfProfileUpdate,
    EmployeeUpdate,
)

employee_router = APIRouter()
employee_service = EmployeeService()
access_token_bearer = AccessTokenBearer()
module = "Employee"
profile_requests_module = "Employee Requests"
PROFILE_IMAGE_MAX_BYTES = 5 * 1024 * 1024


def _configure_cloudinary() -> None:
    cloudinary.config(
        cloud_name=Config.CLOUDINARY_CLOUD_NAME,
        api_key=Config.CLOUDINARY_API_KEY,
        api_secret=Config.CLOUDINARY_API_SECRET,
        secure=True,
    )


async def _validate_profile_image(file: UploadFile) -> None:
    if not file:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Profile image file is required.")
    if not str(file.content_type or "").startswith("image/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only image files are allowed for profile photo.")

    file_data = await file.read()
    file_size = len(file_data)
    if file_size == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded profile image is empty.")
    if file_size > PROFILE_IMAGE_MAX_BYTES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Profile image must not exceed 5 MB.")
    await file.seek(0)


@employee_router.get("/profile/me", response_model=EmployeeProfileRead, status_code=status.HTTP_200_OK)
async def get_my_profile(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return await employee_service.get_employee_profile_by_user_uid(session, current_user.uid)


@employee_router.put("/profile/me", response_model=EmployeeProfileRead, status_code=status.HTTP_200_OK)
async def update_my_profile(
    payload: EmployeeSelfProfileUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    return await employee_service.update_self_profile(session, current_user, payload)


@employee_router.post("/profile/me/photo", response_model=EmployeeProfileRead, status_code=status.HTTP_200_OK)
async def upload_my_profile_photo(
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    await _validate_profile_image(file)
    _configure_cloudinary()

    try:
        upload_result = cloudinary.uploader.upload(
            file.file,
            resource_type="image",
            folder=f"profile_images/{current_user.uid}",
            public_id=f"profile_images/{current_user.uid}/avatar",
            overwrite=True,
            use_filename=False,
            unique_filename=False,
        )
    except Exception as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Profile image upload failed: {str(error)}",
        ) from error

    image_url = upload_result.get("secure_url")
    public_id = upload_result.get("public_id")
    if not image_url:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Cloudinary did not return a profile image URL.")

    return await employee_service.update_self_profile_photo(
        session=session,
        current_user=current_user,
        image_url=image_url,
        public_id=public_id,
    )


@employee_router.post("/profile/me/documents", response_model=EmployeeProfileRead, status_code=status.HTTP_200_OK)
async def upload_my_profile_document(
    document_type: EmployeeDocumentType = Form(...),
    name: str = Form(...),
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    employee = await employee_service.get_employee_by_user_uid(session, current_user.uid)
    await EmployeeDocumentService.upload_document(
        session=session,
        current_user_uid=current_user.uid,
        employee_uid=employee.uid,
        document_type=document_type,
        name=name,
        file=file,
    )
    return await employee_service.get_employee_profile_by_user_uid(session, current_user.uid)


@employee_router.get(
    "/profile-requests",
    response_model=List[EmployeeProfileRequestRead],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(PermissionChecker(profile_requests_module, "r"))],
)
async def list_profile_requests(session: AsyncSession = Depends(get_session)):
    return await employee_service.list_profile_requests(session)


@employee_router.put(
    "/profile-requests/{employee_uid}/edit-lock",
    response_model=EmployeeProfileRequestRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(PermissionChecker(profile_requests_module, "u"))],
)
async def update_profile_edit_lock(
    employee_uid: uuid.UUID,
    payload: EmployeeProfileEditLockRequest,
    session: AsyncSession = Depends(get_session),
):
    return await employee_service.update_profile_edit_lock(
        session=session,
        employee_uid=employee_uid,
        can_edit_profile_details=payload.can_edit_profile_details,
    )


@employee_router.get(
    "/{employee_uid}/profile",
    response_model=EmployeeProfileRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(PermissionChecker(module, "r"))],
)
async def get_employee_profile(employee_uid: uuid.UUID, session: AsyncSession = Depends(get_session)):
    return await employee_service.get_employee_profile_by_employee_uid(session, employee_uid)


@employee_router.get("/", response_model=List[EmployeeBase], status_code=status.HTTP_200_OK, dependencies=[Depends(PermissionChecker(module, "r"))])
async def get_all_employee(session: AsyncSession = Depends(get_session)):
    return await employee_service.get_all_employee(session)


@employee_router.get("/{employee_uid}", response_model=EmployeeBase, status_code=status.HTTP_200_OK, dependencies=[Depends(PermissionChecker(module, "r"))])
async def get_employee_by_uid(employee_uid: uuid.UUID, session: AsyncSession = Depends(get_session)):
    return await employee_service.get_employee_by_uid(session, employee_uid)


@employee_router.post("", status_code=status.HTTP_201_CREATED, response_model=EmployeeBase, dependencies=[Depends(PermissionChecker(module, "c"))])
async def create_a_employee(
    employee_data: EmployeeCreate,
    bg_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_session),
    token_details: dict = Depends(access_token_bearer),
):
    user_id = token_details.get("user", {}).get("user_uid")
    new_employee = await employee_service.create_Employees(
        employees_data=employee_data,
        user_uid=user_id,
        session=session,
        bg_tasks=bg_tasks,
    )
    return new_employee


@employee_router.put("/{employee_uid}", response_model=EmployeeBase, dependencies=[Depends(PermissionChecker(module, "u"))])
async def update_employee(
    employee_uid: uuid.UUID,
    employee_data: EmployeeUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    current_role = await session.get(Role, current_user.role_id)
    if current_role and str(current_role.role_name or "").strip().lower() == "employee":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Employee users cannot update records through this endpoint. Use /employee/profile/me.",
        )

    return await employee_service.update_employee(session, employee_uid, employee_data)


@employee_router.delete("/{employee_uid}", status_code=status.HTTP_200_OK, dependencies=[Depends(PermissionChecker(module, "d"))])
async def delete_employee(
    employee_uid: str,
    session: AsyncSession = Depends(get_session),
    _: dict = Depends(access_token_bearer),
):
    ok = await employee_service.delete_employee(employee_uid, session)
    if not ok:
        raise EmployeeNotFound()

    return {"detail": "Deleted successfully"}
