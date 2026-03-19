import ssl
from fastapi import HTTPException
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

ssl._create_default_https_context = ssl._create_unverified_context


class SendGridMail:
    @staticmethod
    async def sendMailUsingSendGrid(api_key, from_email, to_emails, subject, html_content):
        if not api_key:
            raise HTTPException(status_code=500, detail="SendGrid API key is missing.")

        if not from_email:
            raise HTTPException(status_code=500, detail="SendGrid sender email is missing.")

        if not to_emails:
            raise HTTPException(status_code=400, detail="Recipient email is required.")

        # if isinstance(to_emails, str):
        #     to_emails = [to_emails]

        message = Mail(from_email=from_email,to_emails=to_emails,subject=subject,html_content=html_content)

        try:
            sg = SendGridAPIClient(api_key)
            response = sg.send(message)

            return {
                "status_code": response.status_code,
                "body": response.body.decode() if isinstance(response.body, bytes) else str(response.body),
                "headers": dict(response.headers),
            }

        except Exception as e:
            raise HTTPException(status_code=500,detail=f"Failed to send email via SendGrid: {str(e)}")