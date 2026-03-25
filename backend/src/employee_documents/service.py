import os
import uuid
from datetime import date
from typing import Optional
import cloudinary
import cloudinary.uploader
from fastapi import HTTPException, UploadFile, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from src.db.models import Employee
from src.db.models import EmployeeDocument, EmployeeDocumentType
from src.config import Config
from src.utils.cloudinary_service import configure_cloudinary


class EmployeeDocumentService:
    ALLOWED_EXTENSIONS = Config.ALLOWED_EXTENSIONS
    ALLOWED_MIME_TYPES = Config.ALLOWED_MIME_TYPES
    MAX_FILE_SIZE = Config.MAX_FILE_SIZE

    #@staticmethod
    def _validate_upload_file(file: UploadFile) -> None:
        if not file:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,detail="File is required.")

        filename = file.filename or ""
        ext = os.path.splitext(filename)[1].lower()

        if ext not in EmployeeDocumentService.ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,detail="Only PDF, PNG, JPG, and JPEG files are allowed.")

        if file.content_type not in EmployeeDocumentService.ALLOWED_MIME_TYPES:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,detail="Invalid file type.")

    #@staticmethod
    async def _validate_file_size(file: UploadFile) -> int:
        content = await file.read()
        size = len(content)

        if size == 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,detail="Uploaded file is empty.")

        if size > EmployeeDocumentService.MAX_FILE_SIZE:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,detail="File size must not exceed 5 MB.")

        await file.seek(0)
        return size

    #@staticmethod
    def _validate_document_name(document_type: EmployeeDocumentType, name: str) -> str:
        cleaned_name = name.strip()

        if not cleaned_name:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,detail="Document name cannot be empty.")

        if document_type == EmployeeDocumentType.AADHAAR:
            return "Aadhaar Card"
        elif document_type == EmployeeDocumentType.PAN:
            return "PAN Card"
        else:
            return cleaned_name

    #@staticmethod
    async def _check_employee_exists(session: AsyncSession,employee_uid: uuid.UUID) -> Employee:
        result = await session.exec(select(Employee).where(Employee.uid == employee_uid))
        employee = result.first()

        if not employee:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,detail="Employee not found.")
        return employee

    #@staticmethod
    async def _check_duplicate_document(
        session: AsyncSession,
        employee_uid: uuid.UUID,
        document_type: EmployeeDocumentType,
        exclude_document_uid: Optional[uuid.UUID] = None,
    ) -> None:
        if document_type in {EmployeeDocumentType.AADHAAR, EmployeeDocumentType.PAN}:
            query = select(EmployeeDocument).where(
                EmployeeDocument.employee_uid == employee_uid,
                EmployeeDocument.document_type == document_type,
            )

            if exclude_document_uid:
                query = query.where(EmployeeDocument.uid != exclude_document_uid)

            result = await session.exec(query)
            existing_doc = result.first()

            if existing_doc:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"{document_type.value} document already exists for this employee.",
                )

            if existing_doc:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT,detail=f"{document_type.value} document already exists for this employee.")

    #@staticmethod
    async def upload_document(session: AsyncSession,current_user_uid: uuid.UUID, employee_uid: uuid.UUID,document_type: EmployeeDocumentType,name: str,file: UploadFile) -> EmployeeDocument:
        await EmployeeDocumentService._check_employee_exists(session, employee_uid)
        EmployeeDocumentService._validate_upload_file(file)
        file_size = await EmployeeDocumentService._validate_file_size(file)
        await EmployeeDocumentService._check_duplicate_document(session, employee_uid, document_type)

        final_name = EmployeeDocumentService._validate_document_name(document_type, name)

        try:
            configure_cloudinary()   

            ext = os.path.splitext(file.filename or "")[1].lower()
            public_id = f"employee_documents/{employee_uid}/{uuid.uuid4()}"

            upload_result = cloudinary.uploader.upload(
                file.file,
                resource_type="raw" if ext == ".pdf" else "image",
                public_id=public_id,
                overwrite=False,
                use_filename=False,
                unique_filename=True,
            )

            file_url = upload_result.get("secure_url")
            cloudinary_public_id = upload_result.get("public_id")
            file_format = upload_result.get("format")

            if not file_url or not cloudinary_public_id:
                raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,detail="Failed to upload file to Cloudinary.")

            employee_document = EmployeeDocument(
                user_uid=current_user_uid,
                employee_uid=employee_uid,
                document_type=document_type,
                name=final_name,
                upload_date=date.today(),
                file_url=file_url,
                cloudinary_public_id=cloudinary_public_id,
                file_format=file_format,
                file_size=file_size,
            )

            session.add(employee_document)
            await session.commit()
            await session.refresh(employee_document)

            return employee_document

        except HTTPException:
            raise
        except Exception as e:
            await session.rollback()
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,detail=f"Document upload failed: {str(e)}")

    #@staticmethod
    async def list_all_documents(session: AsyncSession,document_type: Optional[EmployeeDocumentType] = None) -> list[EmployeeDocument]:
        query = select(EmployeeDocument)

        if document_type:
            query = query.where(EmployeeDocument.document_type == document_type)

        query = query.order_by(EmployeeDocument.created_at.desc())

        result = await session.exec(query)
        return list(result.all())

    #@staticmethod
    async def get_document_by_uid(session: AsyncSession,document_uid: uuid.UUID) -> EmployeeDocument:
        result = await session.exec(select(EmployeeDocument).where(EmployeeDocument.uid == document_uid))
        document = result.first()

        if not document:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,detail="Employee document not found.")
        return document

    #@staticmethod
    async def list_documents_by_employee(session: AsyncSession,employee_uid: uuid.UUID,document_type: Optional[EmployeeDocumentType] = None) -> list[EmployeeDocument]:
        await EmployeeDocumentService._check_employee_exists(session, employee_uid)

        query = select(EmployeeDocument).where(EmployeeDocument.employee_uid == employee_uid)

        if document_type:
            query = query.where(EmployeeDocument.document_type == document_type)

        query = query.order_by(EmployeeDocument.created_at.desc())

        result = await session.exec(query)
        return list(result.all())

    #@staticmethod
    async def delete_document(session: AsyncSession,document_uid: uuid.UUID) -> dict:
        document = await EmployeeDocumentService.get_document_by_uid(session, document_uid)

        try:
            configure_cloudinary()   # <-- also needed here

            if document.cloudinary_public_id:
                resource_type = ("raw" if (document.file_format or "").lower() == "pdf" else "image")

                cloudinary.uploader.destroy(document.cloudinary_public_id,resource_type=resource_type)

            await session.delete(document)
            await session.commit()

            return {"message": "Employee document deleted successfully."}

        except Exception as e:
            await session.rollback()
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,detail=f"Failed to delete document: {str(e)}")

    #@staticmethod
    async def update_document_metadata(
    session: AsyncSession,
    document_uid: uuid.UUID,
    name: Optional[str] = None,
    document_type: Optional[EmployeeDocumentType] = None,
) -> EmployeeDocument:
        document = await EmployeeDocumentService.get_document_by_uid(session, document_uid)

        if document_type and document_type != document.document_type:
            await EmployeeDocumentService._check_duplicate_document(
                session=session,
                employee_uid=document.employee_uid,
                document_type=document_type,
                exclude_document_uid=document.uid,
            )
            document.document_type = document_type

        if name is not None:
            document.name = EmployeeDocumentService._validate_document_name(
                document.document_type,
                name,
            )

        session.add(document)
        await session.commit()
        await session.refresh(document)

        return document
        
    async def replace_document_file(session: AsyncSession,document_uid: uuid.UUID,current_user_uid: uuid.UUID,file: UploadFile,
        name: Optional[str] = None,document_type: Optional[EmployeeDocumentType] = None) -> EmployeeDocument:
        document = await EmployeeDocumentService.get_document_by_uid(session, document_uid)

        EmployeeDocumentService._validate_upload_file(file)
        file_size = await EmployeeDocumentService._validate_file_size(file)

        final_document_type = document_type or document.document_type
        final_name = (EmployeeDocumentService._validate_document_name(final_document_type, name)
            if name is not None
            else EmployeeDocumentService._validate_document_name(final_document_type, document.name))

        if final_document_type != document.document_type:
            await EmployeeDocumentService._check_duplicate_document(session=session,employee_uid=document.employee_uid,
                document_type=final_document_type,exclude_document_uid=document.uid)

        old_public_id = document.cloudinary_public_id
        old_file_format = document.file_format

        new_public_id = None
        try:
            configure_cloudinary()

            ext = os.path.splitext(file.filename or "")[1].lower()
            public_id = f"employee_documents/{document.employee_uid}/{uuid.uuid4()}"

            upload_result = cloudinary.uploader.upload(
                file.file,
                resource_type="raw" if ext == ".pdf" else "image",
                public_id=public_id,
                overwrite=False,
                use_filename=False,
                unique_filename=True,
            )

            file_url = upload_result.get("secure_url")
            new_public_id = upload_result.get("public_id")
            file_format = upload_result.get("format")

            if not file_url or not new_public_id:
                raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,detail="Failed to upload replacement file to Cloudinary.")

            document.user_uid = current_user_uid
            document.document_type = final_document_type
            document.name = final_name
            document.upload_date = date.today()
            document.file_url = file_url
            document.cloudinary_public_id = new_public_id
            document.file_format = file_format
            document.file_size = file_size

            session.add(document)
            await session.commit()
            await session.refresh(document)

            if old_public_id:
                old_resource_type = (
                    "raw" if (old_file_format or "").lower() == "pdf" else "image"
                )
                try:
                    cloudinary.uploader.destroy(old_public_id,resource_type=old_resource_type)
                except Exception:
                    pass

            return document

        except HTTPException:
            await session.rollback()
            if new_public_id:
                try:
                    new_resource_type = (
                        "raw" if (document.file_format or "").lower() == "pdf" else "image"
                    )
                    cloudinary.uploader.destroy(new_public_id,resource_type=new_resource_type)
                except Exception:
                    pass
            raise

        except Exception as e:
            await session.rollback()
            if new_public_id:
                try:
                    cloudinary.uploader.destroy(new_public_id, resource_type="raw")
                except Exception:
                    try:
                        cloudinary.uploader.destroy(new_public_id, resource_type="image")
                    except Exception:
                        pass
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,detail=f"Failed to replace document file: {str(e)}")