import cloudinary
from src.config import Config

def configure_cloudinary():
    cloudinary.config(
        cloud_name=Config.CLOUDINARY_CLOUD_NAME,
        api_key=Config.CLOUDINARY_API_KEY,
        api_secret=Config.CLOUDINARY_API_KEY,
        secure=True
    )