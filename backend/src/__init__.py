from fastapi import FastAPI
from src.auth.routes import auth_router
from src.config import Config  # to control env
from src.db.main import init_db  # add this
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
from src.attendance_management.attendance_punch_logs.routes import attendance_punch_log_router
from src.attendance_management.attendance_regularizations.routes import attendance_regularization_router
from src.attendance_management.attendance_regularization_logs.routes import attendance_regularization_log_router
from src.transaction_history.routes import transaction_history_router

from src.project_management.project.routes import project_router

from src.sendgrid_mail.routes import sendgrid_router

from src.middleware import register_middleware


version = "v1"

app = FastAPI(
    title="One GMS",
    description="A REST API for a One GMS web service",
    version=version,
)


@app.on_event("startup")
async def startup_event() -> None:
    """One-time application startup hook.

    Currently used to configure Cloudinary.
    """


    # ✅ Auto-create tables ONLY in local/dev
    # (Do NOT do this on Render/Prod; use Alembic there)
    # if getattr(Config, "ENV", "prod") in ("local", "dev"):
    await init_db()


# Cross-cutting concerns
register_all_errors(app)
register_middleware(app)

# Auth router
app.include_router(auth_router, prefix=f"/api/{version}/auth", tags=["Auth"])
app.include_router(role_router, prefix=f"/api/{version}/roles", tags=["Roles"])

##Employees management router
app.include_router(employee_router, prefix=f"/api/{version}/employee", tags=["Employees"])
app.include_router(employee_skill_router, prefix=f"/api/{version}/employee_skill", tags=["EmployeeSkill"])
app.include_router(employee_document_router, prefix=f"/api/{version}/employee_documents-upload", tags=["EmployeeDocuments"])
app.include_router(employee_family_detail_router, prefix=f"/api/{version}/employee_documents", tags=["Employee Family Details"])
app.include_router(employee_work_experience_router, prefix=f"/api/{version}/employee_work_experience", tags=["Employee Work Experience Details"])
app.include_router(employee_metadata_router, prefix=f"/api/{version}/employee-metadata", tags=["EmployeeMetadata"])

##Shift Roster router
app.include_router(shift_router, prefix=f"/api/{version}/shift_roster", tags=["Shift Roster"])
app.include_router(employee_shift_router, prefix=f"/api/{version}/employee_shift_roster", tags=["Assign Employee Roster"])

##Attendance Management Router
app.include_router(attendance_router, prefix=f"/api/{version}/attendance", tags=["Attendance"])
app.include_router(attendance_punch_log_router, prefix=f"/api/{version}/punch_log", tags=["Attendance-Punch-Logs"])
app.include_router(attendance_regularization_router, prefix=f"/api/{version}/attendance-regularization", tags=["Attendance-Regularization"])
app.include_router(attendance_regularization_log_router, prefix=f"/api/{version}/attendance-regularization-log", tags=["Attendance-Regularization-Logs"])

## Leave Management Router
app.include_router(holiday_calender_router, prefix=f"/api/{version}/holiday-calender", tags=["Holiday Calender"])
app.include_router(leave_type_router, prefix=f"/api/{version}/leave-types", tags=["Leave Types"])
app.include_router(employee_leave_balance_router, prefix=f"/api/{version}/employee-leave-balances", tags=["Employee Leave Balances"])
app.include_router(leave_request_router, prefix=f"/api/{version}/leave-requests", tags=["Leave Requests"])

## Project Management
app.include_router(project_router, prefix=f"/api/{version}/Project", tags=["Project"])

##Send mail through SendGridMail api
app.include_router(sendgrid_router, prefix=f"/api/{version}/sendgrid-mail", tags=["SendGridMail"])
app.include_router(transaction_history_router, prefix=f"/api/{version}/transaction-history", tags=["Transaction History"])
