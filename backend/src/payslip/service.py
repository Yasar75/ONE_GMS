import os
import uuid
from typing import Optional

import cloudinary.uploader
from fastapi import HTTPException, UploadFile, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.config import Config
from src.db.models import Employee, Payslip, Role, User
from src.utils.cloudinary_service import configure_cloudinary


class PayslipService:
    MAX_FILE_SIZE = Config.MAX_FILE_SIZE
    ALLOWED_EXTENSION = ".pdf"
    ALLOWED_MIME_TYPES = ["application/pdf", "application/x-pdf"]

    @staticmethod
    def _validate_month_year(month: int, year: int) -> None:
        if month < 1 or month > 12:
            raise HTTPException(status_code=400, detail="Month must be between 1 and 12.")
        if year < 2000 or year > 2100:
            raise HTTPException(status_code=400, detail="Year must be valid.")

    @staticmethod
    def _validate_pdf_file(file: UploadFile) -> None:
        if not file:
            raise HTTPException(status_code=400, detail="Payslip PDF file is required.")

        ext = os.path.splitext(file.filename or "")[1].lower()

        if ext != PayslipService.ALLOWED_EXTENSION:
            raise HTTPException(status_code=400, detail="Only PDF payslip files are allowed.")

        if file.content_type not in PayslipService.ALLOWED_MIME_TYPES:
            raise HTTPException(status_code=400, detail="Invalid file type. Please upload PDF only.")

    @staticmethod
    async def _read_and_validate_pdf_bytes(file: UploadFile) -> bytes:
        await file.seek(0)
        file_bytes = await file.read()

        if not file_bytes:
            raise HTTPException(status_code=400, detail="Uploaded payslip file is empty.")

        if len(file_bytes) > PayslipService.MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="Payslip file size must not exceed 5 MB.")

        if not file_bytes.startswith(b"%PDF"):
            raise HTTPException(
                status_code=400,
                detail="Invalid PDF file. The uploaded file content is not a valid PDF.",
            )

        await file.seek(0)
        return file_bytes

    @staticmethod
    async def _get_employee(session: AsyncSession, employee_uid: uuid.UUID) -> Employee:
        result = await session.exec(select(Employee).where(Employee.uid == employee_uid))
        employee = result.first()

        if not employee:
            raise HTTPException(status_code=404, detail="Employee not found.")

        return employee

    @staticmethod
    async def _get_current_employee(session: AsyncSession, current_user: User) -> Employee:
        result = await session.exec(select(Employee).where(Employee.user_uid == current_user.uid))
        employee = result.first()

        if not employee:
            raise HTTPException(status_code=404, detail="Employee profile not found for current user.")

        return employee

    @staticmethod
    async def _is_admin_or_dev(session: AsyncSession, current_user: User) -> bool:
        if not getattr(current_user, "role_id", None):
            return False

        role = await session.get(Role, current_user.role_id)

        if not role:
            return False

        return role.role_name.lower() in {"admin", "dev"}

    @staticmethod
    async def _check_duplicate_payslip(
        session: AsyncSession,
        employee_uid: uuid.UUID,
        month: int,
        year: int,
        exclude_uid: Optional[uuid.UUID] = None,
    ) -> None:
        query = select(Payslip).where(
            Payslip.employee_uid == employee_uid,
            Payslip.salary_month == month,
            Payslip.salary_year == year,
        )

        if exclude_uid:
            query = query.where(Payslip.uid != exclude_uid)

        result = await session.exec(query)
        existing = result.first()

        if existing:
            raise HTTPException(
                status_code=409,
                detail="Payslip already uploaded for this employee and month.",
            )

    @staticmethod
    async def upload_to_cloudinary_pdf(
        file_bytes: bytes,
        employee_uid: uuid.UUID,
        salary_month: int,
        salary_year: int,
    ) -> dict:
        public_id = (
            f"payslips/{employee_uid}/{salary_year}/"
            f"{salary_month:02d}/{uuid.uuid4()}" #.pdf
        )

        try:
            configure_cloudinary()

            result = cloudinary.uploader.upload(
                file_bytes,
                resource_type="raw",
                public_id=public_id,
                overwrite=True,
                use_filename=False,
                unique_filename=False,
            )

        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Cloudinary upload failed: {str(e)}",
            )

        file_url = result.get("secure_url")

        if not file_url:
            raise HTTPException(
                status_code=500,
                detail="Cloudinary upload failed. File URL not received.",
            )

        return {
            "file_url": file_url,
            "cloudinary_public_id": result.get("public_id"),
            "file_format": "pdf",
            "file_size": result.get("bytes") or len(file_bytes),
        }

    @staticmethod
    async def upload_payslip(
        session: AsyncSession,
        employee_uid: uuid.UUID,
        salary_month: int,
        salary_year: int,
        file: UploadFile,
        current_user: User,
    ) -> Payslip:
        PayslipService._validate_month_year(salary_month, salary_year)
        PayslipService._validate_pdf_file(file)

        file_bytes = await PayslipService._read_and_validate_pdf_bytes(file)

        await PayslipService._get_employee(session, employee_uid)

        await PayslipService._check_duplicate_payslip(
            session=session,
            employee_uid=employee_uid,
            month=salary_month,
            year=salary_year,
        )

        created_by = getattr(current_user, "uid", None)

        if not created_by:
            raise HTTPException(status_code=401, detail="Invalid logged-in user. User UID missing.")

        uploaded = await PayslipService.upload_to_cloudinary_pdf(
            file_bytes=file_bytes,
            employee_uid=employee_uid,
            salary_month=salary_month,
            salary_year=salary_year,
        )

        payslip = Payslip(
            created_by=created_by,
            employee_uid=employee_uid,
            salary_month=salary_month,
            salary_year=salary_year,
            original_filename=file.filename,
            file_url=uploaded["file_url"],
            cloudinary_public_id=uploaded["cloudinary_public_id"],
            file_format="pdf",
            file_size=uploaded["file_size"],
        )

        try:
            session.add(payslip)
            await session.commit()
            await session.refresh(payslip)
            return payslip

        except Exception as e:
            await session.rollback()

            try:
                if uploaded.get("cloudinary_public_id"):
                    cloudinary.uploader.destroy(
                        uploaded["cloudinary_public_id"],
                        resource_type="raw",
                    )
            except Exception:
                pass

            raise HTTPException(status_code=500, detail=f"Failed to save payslip: {str(e)}")

    @staticmethod
    async def list_all_payslips(
        session: AsyncSession,
        employee_uid: Optional[uuid.UUID] = None,
        month: Optional[int] = None,
        year: Optional[int] = None,
    ) -> list[Payslip]:
        query = select(Payslip)

        if employee_uid:
            query = query.where(Payslip.employee_uid == employee_uid)
        if month:
            query = query.where(Payslip.salary_month == month)
        if year:
            query = query.where(Payslip.salary_year == year)

        query = query.order_by(
            Payslip.salary_year.desc(),
            Payslip.salary_month.desc(),
            Payslip.created_at.desc(),
        )

        result = await session.exec(query)
        return list(result.all())

    @staticmethod
    async def list_my_payslips(
        session: AsyncSession,
        current_user: User,
        month: Optional[int] = None,
        year: Optional[int] = None,
    ) -> list[Payslip]:
        employee = await PayslipService._get_current_employee(session, current_user)

        return await PayslipService.list_all_payslips(
            session=session,
            employee_uid=employee.uid,
            month=month,
            year=year,
        )

    @staticmethod
    async def get_payslip_by_uid(session: AsyncSession, payslip_uid: uuid.UUID) -> Payslip:
        result = await session.exec(select(Payslip).where(Payslip.uid == payslip_uid))
        payslip = result.first()

        if not payslip:
            raise HTTPException(status_code=404, detail="Payslip not found.")

        return payslip

    @staticmethod
    async def get_my_payslip_by_month(
        session: AsyncSession,
        current_user: User,
        month: int,
        year: int,
    ) -> Payslip:
        PayslipService._validate_month_year(month, year)

        employee = await PayslipService._get_current_employee(session, current_user)

        result = await session.exec(
            select(Payslip).where(
                Payslip.employee_uid == employee.uid,
                Payslip.salary_month == month,
                Payslip.salary_year == year,
            )
        )

        payslip = result.first()

        if not payslip:
            raise HTTPException(status_code=404, detail="Payslip not found for this month.")

        return payslip

    @staticmethod
    async def get_authorized_payslip(
        session: AsyncSession,
        current_user: User,
        payslip_uid: uuid.UUID,
    ) -> Payslip:
        payslip = await PayslipService.get_payslip_by_uid(session, payslip_uid)

        if await PayslipService._is_admin_or_dev(session, current_user):
            return payslip

        employee = await PayslipService._get_current_employee(session, current_user)

        if payslip.employee_uid != employee.uid:
            raise HTTPException(
                status_code=403,
                detail="You are not allowed to access another employee's payslip.",
            )

        return payslip

    @staticmethod
    async def delete_payslip(session: AsyncSession, payslip_uid: uuid.UUID) -> dict:
        payslip = await PayslipService.get_payslip_by_uid(session, payslip_uid)

        try:
            configure_cloudinary()

            if payslip.cloudinary_public_id:
                cloudinary.uploader.destroy(
                    payslip.cloudinary_public_id,
                    resource_type="raw",
                )

            await session.delete(payslip)
            await session.commit()

            return {"message": "Payslip deleted successfully."}

        except Exception as e:
            await session.rollback()
            raise HTTPException(status_code=500, detail=f"Failed to delete payslip: {str(e)}")