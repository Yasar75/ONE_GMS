from datetime import datetime
from typing import Optional
from fastapi import HTTPException
from src.mail import mail, create_message
from src.config import Config
from src.sendgrid_mail import SendGridMail


API = Config.APIKEY
from_email = Config.FROM


def _safe_str(value) -> str:
    return "" if value is None else str(value)


def _format_datetime(value: Optional[datetime]) -> str:
    if not value:
        return "-"
    return value.strftime("%d-%m-%Y %I:%M %p")


class EmployeeNotificationService:
    async def send_leave_status_email(self,employee_email: str,employee_name: str,status_value: str,start_date,end_date,
        applied_days,reviewer_note: Optional[str] = None) -> None:
        if not employee_email:
            return

        status_upper = str(status_value).strip().upper()
        subject = f"Your Leave Request has been {status_upper}"

        body = f"""
        <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6;">
                <h3>Leave Request Update</h3>
                <p>Dear {_safe_str(employee_name)},</p>

                <p>Your leave request has been <b>{status_upper}</b>.</p>

                <table style="border-collapse: collapse; width: 100%; max-width: 600px;">
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd;"><b>Status</b></td>
                        <td style="padding: 8px; border: 1px solid #ddd;">{status_upper}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd;"><b>Start Date</b></td>
                        <td style="padding: 8px; border: 1px solid #ddd;">{start_date}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd;"><b>End Date</b></td>
                        <td style="padding: 8px; border: 1px solid #ddd;">{end_date}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd;"><b>Applied Days</b></td>
                        <td style="padding: 8px; border: 1px solid #ddd;">{applied_days}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd;"><b>Reviewer Note</b></td>
                        <td style="padding: 8px; border: 1px solid #ddd;">{_safe_str(reviewer_note) or "-"}</td>
                    </tr>
                </table>

                <p style="margin-top: 20px;">Regards,<br/>HR / Admin Team</p>
            </body>
        </html>
        """
        await SendGridMail.sendMailUsingSendGrid(API,from_email,employee_email,subject=subject,html_content=body)

    async def send_regularization_status_email(self,employee_email: str,employee_name: str,status_value: str,regularization_date,
        requested_punch_in: Optional[datetime],requested_punch_out: Optional[datetime],requested_worked_hours,
        reviewer_note: Optional[str] = None) -> None:
        if not employee_email:
            return

        status_upper = str(status_value).strip().upper()
        subject = f"Your Attendance Regularization Request has been {status_upper}"

        body = f"""
        <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6;">
                <h3>Attendance Regularization Update</h3>
                <p>Dear {_safe_str(employee_name)},</p>

                <p>Your attendance regularization request has been <b>{status_upper}</b>.</p>

                <table style="border-collapse: collapse; width: 100%; max-width: 700px;">
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd;"><b>Status</b></td>
                        <td style="padding: 8px; border: 1px solid #ddd;">{status_upper}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd;"><b>Regularization Date</b></td>
                        <td style="padding: 8px; border: 1px solid #ddd;">{regularization_date}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd;"><b>Requested Punch In</b></td>
                        <td style="padding: 8px; border: 1px solid #ddd;">{_format_datetime(requested_punch_in)}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd;"><b>Requested Punch Out</b></td>
                        <td style="padding: 8px; border: 1px solid #ddd;">{_format_datetime(requested_punch_out)}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd;"><b>Requested Worked Hours</b></td>
                        <td style="padding: 8px; border: 1px solid #ddd;">{_safe_str(requested_worked_hours) or "-"}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd;"><b>Reviewer Note</b></td>
                        <td style="padding: 8px; border: 1px solid #ddd;">{_safe_str(reviewer_note) or "-"}</td>
                    </tr>
                </table>

                <p style="margin-top: 20px;">Regards,<br/>HR / Admin Team</p>
            </body>
        </html>
        """

        await SendGridMail.sendMailUsingSendGrid(API,from_email,employee_email,subject=subject,html_content=body)


employee_notification_service = EmployeeNotificationService()