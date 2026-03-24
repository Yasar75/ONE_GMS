import os
import uuid
from datetime import date
from typing import Optional
import cloudinary
import cloudinary.uploader
from fastapi import HTTPException, UploadFile, status
from sqlmodel import Session, select
from src.db.models import Employee
from src.db.models import EmployeeDocument, EmployeeDocumentType
from src.config import Config

class EmployeeDocumentService:
    ALLOWED_EXTENSIONS = Config.ALLOWED_EXTENSIONS
    ALLOWED_MIME_TYPES = Config.ALLOWED_MIME_TYPES
    MAX_FILE_SIZE = Config.MAX_FILE_SIZE

    @staticmethod
    def _validate_upload_file(file: UploadFile) -> None:
        if not file:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File is required."
            )

        filename = file.filename or ""
        ext = os.path.splitext(filename)[1].lower()

        if ext not in EmployeeDocumentService.ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only PDF, PNG, JPG, and JPEG files are allowed."
            )

        if file.content_type not in EmployeeDocumentService.ALLOWED_MIME_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid file type."
            )

    @staticmethod
    async def _validate_file_size(file: UploadFile) -> int:
        content = await file.read()
        size = len(content)

        if size == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is empty."
            )

        if size > EmployeeDocumentService.MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File size must not exceed 5 MB."
            )

        await file.seek(0)
        return size

    @staticmethod
    def _validate_document_name(document_type: EmployeeDocumentType, name: str) -> str:
        cleaned_name = name.strip()

        if not cleaned_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Document name cannot be empty."
            )

        if document_type == EmployeeDocumentType.AADHAAR:
            return "Aadhaar Card"
        elif document_type == EmployeeDocumentType.PAN:
            return "PAN Card"
        else:
            return cleaned_name

    @staticmethod
    def _check_employee_exists(session: Session, employee_uid: uuid.UUID) -> Employee:
        employee = session.exec(
            select(Employee).where(Employee.uid == employee_uid)
        ).first()

        if not employee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Employee not found."
            )
        return employee

    @staticmethod
    def _check_duplicate_document(
        session: Session,
        employee_uid: uuid.UUID,
        document_type: EmployeeDocumentType,
    ) -> None:
        if document_type in {EmployeeDocumentType.AADHAAR, EmployeeDocumentType.PAN}:
            existing_doc = session.exec(
                select(EmployeeDocument).where(
                    EmployeeDocument.employee_uid == employee_uid,
                    EmployeeDocument.document_type == document_type
                )
            ).first()

            if existing_doc:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"{document_type.value} document already exists for this employee."
                )

    @staticmethod
    async def upload_document(
        session: Session,
        current_user_uid: uuid.UUID,
        employee_uid: uuid.UUID,
        document_type: EmployeeDocumentType,
        name: str,
        file: UploadFile,
    ) -> EmployeeDocument:
        EmployeeDocumentService._check_employee_exists(session, employee_uid)
        EmployeeDocumentService._validate_upload_file(file)
        file_size = await EmployeeDocumentService._validate_file_size(file)
        EmployeeDocumentService._check_duplicate_document(session, employee_uid, document_type)

        final_name = EmployeeDocumentService._validate_document_name(document_type, name)

        try:
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
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to upload file to Cloudinary."
                )

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
            session.commit()
            session.refresh(employee_document)

            return employee_document

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Document upload failed: {str(e)}"
            )

    @staticmethod
    def get_document_by_uid(session: Session, document_uid: uuid.UUID) -> EmployeeDocument:
        document = session.exec(
            select(EmployeeDocument).where(EmployeeDocument.uid == document_uid)
        ).first()

        if not document:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Employee document not found."
            )
        return document

    @staticmethod
    def list_documents_by_employee(
        session: Session,
        employee_uid: uuid.UUID,
        document_type: Optional[EmployeeDocumentType] = None,
    ) -> list[EmployeeDocument]:
        EmployeeDocumentService._check_employee_exists(session, employee_uid)

        query = select(EmployeeDocument).where(EmployeeDocument.employee_uid == employee_uid)

        if document_type:
            query = query.where(EmployeeDocument.document_type == document_type)

        query = query.order_by(EmployeeDocument.created_at.desc())

        return list(session.exec(query).all())

    @staticmethod
    def delete_document(session: Session, document_uid: uuid.UUID) -> dict:
        document = EmployeeDocumentService.get_document_by_uid(session, document_uid)

        try:
            if document.cloudinary_public_id:
                resource_type = "raw" if (document.file_format or "").lower() == "pdf" else "image"

                cloudinary.uploader.destroy(
                    document.cloudinary_public_id,
                    resource_type=resource_type
                )

            session.delete(document)
            session.commit()

            return {"message": "Employee document deleted successfully."}

        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to delete document: {str(e)}"
            )

    @staticmethod
    def update_document_metadata(
        session: Session,
        document_uid: uuid.UUID,
        name: Optional[str] = None,
        document_type: Optional[EmployeeDocumentType] = None,
    ) -> EmployeeDocument:
        document = EmployeeDocumentService.get_document_by_uid(session, document_uid)

        if document_type and document_type != document.document_type:
            if document_type in {EmployeeDocumentType.AADHAAR, EmployeeDocumentType.PAN}:
                existing_doc = session.exec(
                    select(EmployeeDocument).where(
                        EmployeeDocument.employee_uid == document.employee_uid,
                        EmployeeDocument.document_type == document_type,
                        EmployeeDocument.uid != document.uid
                    )
                ).first()

                if existing_doc:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"{document_type.value} document already exists for this employee."
                    )
            document.document_type = document_type

        if name is not None:
            document.name = EmployeeDocumentService._validate_document_name(
                document.document_type,
                name
            )

        session.add(document)
        session.commit()
        session.refresh(document)

        return document