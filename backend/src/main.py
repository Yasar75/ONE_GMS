import asyncio
import logging
import os
from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import FastAPI
from sqlalchemy.orm import sessionmaker
from sqlmodel.ext.asyncio.session import AsyncSession

from src.auth.routes import auth_router
from src.config import Config
from src.db.main import init_db, get_async_engine
from src.errors import register_all_errors
from src.roles.routes import role_router
from src.employee.routes import employee_router
from src.employee_documents.routes import employee_document_router
from src.employee_skill.routes import employee_skill_router
from src.employees_family_details.routes import employee_family_detail_router
from src.shift_roster.routes import shift_router
from src.employee_shift.routes import employee_shift_router
from src.employee_metadata.routes import employee_metadata_router
from src.employees_work_experience.routes import employee_work_experience_router

from src.leave_management.holiday_calender.routes import holiday_calender_router
from src.leave_management.leave_types.routes import leave_type_router
from src.leave_management.employee_leave_balances.routes import employee_leave_balance_router
from src.leave_management.leave_requests.routes import leave_request_router

from src.attendance_management.attendance.routes import attendance_router
from src.attendance_management.attendance.service import attendance_service
from src.attendance_management.attendance.daily_scheduler import attendance_scheduler_loop
from src.attendance_management.attendance_punch_logs.routes import attendance_punch_log_router
from src.attendance_management.attendance_regularizations.routes import attendance_regularization_router
from src.attendance_management.attendance_regularization_logs.routes import attendance_regularization_log_router
from src.transaction_history.routes import transaction_history_router

from src.project_management.project.routes import project_router
from src.project_management.project_assignment.routes import project_assignment_router
from src.project_management.project_task.routes import project_task_router

from src.sendgrid_mail.routes import sendgrid_router
from src.middleware import register_middleware

logger = logging.getLogger(__name__)

version = "v1"

app = FastAPI(
    title="One GMS",
    description="A REST API for a One GMS web service",
    version=version,
)

attendance_scheduler_task = None


def running_on_vercel() -> bool:
    return os.getenv("VERCEL") == "1"


@app.on_event("startup")
async def startup_event() -> None:
    global attendance_scheduler_task

    if running_on_vercel():
        logger.info("Running on Vercel. Skipping startup database sync and background scheduler.")
        return

    try:
        await init_db()
        logger.info("Database initialized successfully.")
    except Exception:
        logger.exception("init_db failed during startup.")

    try:
        session_local = sessionmaker(
            bind=get_async_engine(),
            class_=AsyncSession,
            expire_on_commit=False,
        )
        async with session_local() as session:
            await attendance_service.sync_daily_attendance(
                session=session,
                target_date=datetime.now(ZoneInfo(Config.TIME_ZONE)).date(),
            )
        logger.info("Daily attendance sync completed.")
    except Exception:
        logger.exception("Daily attendance sync failed during startup.")

    try:
        attendance_scheduler_task = asyncio.create_task(attendance_scheduler_loop())
        logger.info("Attendance scheduler started.")
    except Exception:
        logger.exception("Failed to start attendance scheduler.")


@app.on_event("shutdown")
async def shutdown_event() -> None:
    global attendance_scheduler_task

    if attendance_scheduler_task:
        attendance_scheduler_task.cancel()
        try:
            await attendance_scheduler_task
        except asyncio.CancelledError:
            pass


register_all_errors(app)
register_middleware(app)

app.include_router(auth_router, prefix=f"/api/{version}/auth", tags=["Auth"])
app.include_router(role_router, prefix=f"/api/{version}/roles", tags=["Roles"])

app.include_router(employee_router, prefix=f"/api/{version}/employee", tags=["Employees"])
app.include_router(employee_skill_router, prefix=f"/api/{version}/employee_skill", tags=["EmployeeSkill"])
app.include_router(employee_document_router, prefix=f"/api/{version}/employee_documents-upload", tags=["EmployeeDocuments"])
app.include_router(employee_family_detail_router, prefix=f"/api/{version}/employee_documents", tags=["Employee Family Details"])
app.include_router(employee_work_experience_router, prefix=f"/api/{version}/employee_work_experience", tags=["Employee Work Experience Details"])
app.include_router(employee_metadata_router, prefix=f"/api/{version}/employee-metadata", tags=["EmployeeMetadata"])

app.include_router(shift_router, prefix=f"/api/{version}/shift_roster", tags=["Shift Roster"])
app.include_router(employee_shift_router, prefix=f"/api/{version}/employee_shift_roster", tags=["Assign Employee Roster"])

app.include_router(attendance_router, prefix=f"/api/{version}/attendance", tags=["Attendance"])
app.include_router(attendance_punch_log_router, prefix=f"/api/{version}/punch_log", tags=["Attendance-Punch-Logs"])
app.include_router(attendance_regularization_router, prefix=f"/api/{version}/attendance-regularization", tags=["Attendance-Regularization"])
app.include_router(attendance_regularization_log_router, prefix=f"/api/{version}/attendance-regularization-log", tags=["Attendance-Regularization-Logs"])

app.include_router(holiday_calender_router, prefix=f"/api/{version}/holiday-calender", tags=["Holiday Calender"])
app.include_router(leave_type_router, prefix=f"/api/{version}/leave-types", tags=["Leave Types"])
app.include_router(employee_leave_balance_router, prefix=f"/api/{version}/employee-leave-balances", tags=["Employee Leave Balances"])
app.include_router(leave_request_router, prefix=f"/api/{version}/leave-requests", tags=["Leave Requests"])

app.include_router(project_router, prefix=f"/api/{version}/Project", tags=["Project"])
app.include_router(project_assignment_router, prefix=f"/api/{version}/Project-Assignment", tags=["Project Assignment"])
app.include_router(project_task_router, prefix=f"/api/{version}/Project-Task", tags=["Project Task"])

app.include_router(sendgrid_router, prefix=f"/api/{version}/sendgrid-mail", tags=["SendGridMail"])
app.include_router(transaction_history_router, prefix=f"/api/{version}/transaction-history", tags=["Transaction History"])
