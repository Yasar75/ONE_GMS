import cloudinary
import cloudinary.uploader
from src.config import Config

def configure_cloudinary():
    cloudinary.config(
        cloud_name=Config.CLOUDINARY_CLOUD_NAME,
        api_key=Config.CLOUDINARY_API_KEY,
        api_secret=Config.CLOUDINARY_API_SECRET,
        secure=True
    )

def upload_employee_profile_image(file, employee_uid: str):
    configure_cloudinary()
    return cloudinary.uploader.upload(
        file,
        folder="employees/profile_images",
        public_id=f"{employee_uid}_profile",
        overwrite=True,
        resource_type="image",
    )


def delete_employee_profile_image(public_id: str):
    configure_cloudinary()
    return cloudinary.uploader.destroy(public_id, resource_type="image")