import uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from sqlmodel.ext.asyncio.session import AsyncSession

from src.db.main import get_session
from .schema import (
    EmployeeDocumentRead,
    EmployeeDocumentListResponse,
    EmployeeDocumentUploadResponse,
    EmployeeDocumentType,
)
from .service import EmployeeDocumentService
from src.auth.dependencies import get_current_user, PermissionChecker


employee_document_router = APIRouter()
module = "Employee Documents"


@employee_document_router.post("/upload",response_model=EmployeeDocumentUploadResponse,status_code=status.HTTP_201_CREATED,dependencies=[Depends(PermissionChecker(module, "c"))])
async def upload_employee_document(
    employee_uid: uuid.UUID = Form(...),
    document_type: EmployeeDocumentType = Form(...),
    name: str = Form(...),
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    document = await EmployeeDocumentService.upload_document(
        session=session,
        current_user_uid=current_user.uid,
        employee_uid=employee_uid,
        document_type=document_type,
        name=name,
        file=file,
    )
    return {"message": "Employee document uploaded successfully.","data": document}


@employee_document_router.get("/employee/{employee_uid}",response_model=EmployeeDocumentListResponse,status_code=status.HTTP_200_OK,dependencies=[Depends(PermissionChecker(module, "r"))])
async def list_employee_documents(
    employee_uid: uuid.UUID,
    document_type: Optional[EmployeeDocumentType] = None,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    documents = await EmployeeDocumentService.list_documents_by_employee(
        session=session,
        employee_uid=employee_uid,
        document_type=document_type,
    )
    return {"total": len(documents),"items": documents}

@employee_document_router.get("/all",response_model=EmployeeDocumentListResponse,status_code=status.HTTP_200_OK,
dependencies=[Depends(PermissionChecker(module, "r"))])
async def list_all_employee_documents(
    document_type: Optional[EmployeeDocumentType] = None,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    documents = await EmployeeDocumentService.list_all_documents(session=session,document_type=document_type)
    return {"total": len(documents),"items": documents}

@employee_document_router.put("/{document_uid}/replace-file",response_model=EmployeeDocumentUploadResponse,status_code=status.HTTP_200_OK,dependencies=[Depends(PermissionChecker(module, "u"))])
async def replace_employee_document_file(document_uid: uuid.UUID,file: UploadFile = File(...),
    name: Optional[str] = Form(default=None),document_type: Optional[EmployeeDocumentType] = Form(default=None),
    session: AsyncSession = Depends(get_session),current_user=Depends(get_current_user)):
    document = await EmployeeDocumentService.replace_document_file(session=session,document_uid=document_uid,
        current_user_uid=current_user.uid,file=file,name=name,document_type=document_type)
    return {"message": "Employee document file replaced successfully.", "data": document}

@employee_document_router.get("/{document_uid}",response_model=EmployeeDocumentRead,status_code=status.HTTP_200_OK,dependencies=[Depends(PermissionChecker(module, "r"))])
async def get_employee_document(
    document_uid: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    return await EmployeeDocumentService.get_document_by_uid(session, document_uid)


@employee_document_router.put("/{document_uid}",response_model=EmployeeDocumentUploadResponse,status_code=status.HTTP_200_OK,dependencies=[Depends(PermissionChecker(module, "u"))])
async def update_employee_document_metadata(
    document_uid: uuid.UUID,
    name: Optional[str] = Form(default=None),
    document_type: Optional[EmployeeDocumentType] = Form(default=None),
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    document = await EmployeeDocumentService.update_document_metadata(
        session=session,
        document_uid=document_uid,
        name=name,
        document_type=document_type,
    )
    return {"message": "Employee document updated successfully.","data": document}


@employee_document_router.delete("/{document_uid}",status_code=status.HTTP_200_OK,dependencies=[Depends(PermissionChecker(module, "d"))])
async def delete_employee_document(
    document_uid: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_user),
):
    return await EmployeeDocumentService.delete_document(session, document_uid)

