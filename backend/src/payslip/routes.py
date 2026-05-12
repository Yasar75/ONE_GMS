import uuid
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import Response
from sqlmodel.ext.asyncio.session import AsyncSession

from src.auth.dependencies import PermissionChecker, get_current_user
from src.db.main import get_session
from src.db.models import Role
from src.payslip.schema import (
    PayslipDownloadResponse,
    PayslipListResponse,
    PayslipRead,
    PayslipUploadResponse,
)
from src.payslip.service import PayslipService


payslip_router = APIRouter()

admin_module = "Payslip"
employee_module = "My Payslip"


async def require_payslip_download_permission(
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    if not current_user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is not verified.",
        )

    role = await session.get(Role, current_user.role_id)

    if not role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have enough permissions to perform this action.",
        )

    if role.role_name.lower() in {"admin", "dev"}:
        return True

    permissions = role.permissions or {}
    allowed_actions = set(permissions.get(admin_module, [])) | set(
        permissions.get(employee_module, [])
    )

    if "r" in allowed_actions or "*" in allowed_actions:
        return True

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You do not have enough permissions to perform this action.",
    )


@payslip_router.post(
    "/upload",
    response_model=PayslipUploadResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(PermissionChecker(admin_module, "c"))],
)
async def upload_employee_payslip(
    employee_uid: uuid.UUID = Form(...),
    month: int = Form(..., ge=1, le=12),
    year: int = Form(..., ge=2000, le=2100),
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    payslip = await PayslipService.upload_payslip(
        session=session,
        current_user=current_user,
        employee_uid=employee_uid,
        salary_month=month,
        salary_year=year,
        file=file,
    )

    return {
        "message": "Payslip uploaded successfully.",
        "data": payslip,
    }


@payslip_router.get(
    "/all",
    response_model=PayslipListResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(PermissionChecker(admin_module, "r"))],
)
async def list_all_payslips(
    employee_uid: Optional[uuid.UUID] = None,
    month: Optional[int] = None,
    year: Optional[int] = None,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    items = await PayslipService.list_all_payslips(
        session=session,
        employee_uid=employee_uid,
        month=month,
        year=year,
    )

    return {
        "total": len(items),
        "items": items,
    }


@payslip_router.delete(
    "/{payslip_uid}",
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(PermissionChecker(admin_module, "d"))],
)
async def delete_payslip(
    payslip_uid: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    return await PayslipService.delete_payslip(
        session=session,
        payslip_uid=payslip_uid,
    )


@payslip_router.get(
    "/my",
    response_model=PayslipListResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(PermissionChecker(employee_module, "r"))],
)
async def list_my_payslips(
    month: Optional[int] = None,
    year: Optional[int] = None,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    items = await PayslipService.list_my_payslips(
        session=session,
        current_user=current_user,
        month=month,
        year=year,
    )

    return {
        "total": len(items),
        "items": items,
    }


@payslip_router.get(
    "/my/download",
    response_model=PayslipDownloadResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(PermissionChecker(employee_module, "r"))],
)
async def get_my_payslip_download_url(
    month: int,
    year: int,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    payslip = await PayslipService.get_my_payslip_by_month(
        session=session,
        current_user=current_user,
        month=month,
        year=year,
    )

    return {
        "message": "Payslip download URL generated successfully.",
        "download_url": f"/api/v1/employee-payslip/{payslip.uid}/download",
        "data": payslip,
    }


@payslip_router.get(
    "/{payslip_uid}",
    response_model=PayslipRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(PermissionChecker(employee_module, "r"))],
)
async def get_payslip(
    payslip_uid: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    return await PayslipService.get_authorized_payslip(
        session=session,
        current_user=current_user,
        payslip_uid=payslip_uid,
    )


@payslip_router.get(
    "/{payslip_uid}/download",
    dependencies=[Depends(require_payslip_download_permission)],
)
async def download_payslip(
    payslip_uid: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    payslip = await PayslipService.get_authorized_payslip(
        session=session,
        current_user=current_user,
        payslip_uid=payslip_uid,
    )

    storage_download_url = PayslipService.build_payslip_storage_download_url(payslip)

    async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
        storage_response = await client.get(storage_download_url)

    if storage_response.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to fetch payslip PDF from storage.",
        )

    if not storage_response.content.startswith(b"%PDF"):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Stored payslip is not a valid PDF. Please re-upload it.",
        )

    filename = PayslipService.build_payslip_filename(
        payslip.salary_month,
        payslip.salary_year,
    )

    return Response(
        content=storage_response.content,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Content-Type-Options": "nosniff",
        },
    )
