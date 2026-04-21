from fastapi import APIRouter
from src.config import Config
from src.sendgrid_mail import SendGridMail
from .schema import EmailModel

API = Config.APIKEY
from_email = Config.FROM

sendgrid_router = APIRouter()


@sendgrid_router.post("/sendgrid_mail")
async def send_mail(emails: EmailModel):
    to_emails = emails.addresses #"raushanpathak85@gmail.com" #emails.addresses
    html = "<h1>We are pleased to welcome you to GIANTMIND SOLUTIONS PRIVATE LIMITED.</h1>"
    subject = "Welcome To you"

    result = await SendGridMail.sendMailUsingSendGrid(API,from_email,to_emails,subject,html)
    return {"message": "Email sent successfully","result": result}