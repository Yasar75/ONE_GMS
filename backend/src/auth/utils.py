from passlib.context import CryptContext
from src.errors import InvalidToken
import bcrypt
from datetime import timedelta,datetime
from itsdangerous import URLSafeTimedSerializer
from src.config import Config
import jwt
import uuid
import logging

passwd_context = CryptContext(schemes=["bcrypt"])

ACCESS_TOKEN_EXPIRY = 3600

def generate_password_hash(password: str) -> str:
    # hash = passwd_context.hash(password)
    # return hash
    salt= bcrypt.gensalt()
    hash = bcrypt.hashpw(password.encode('utf-8'),salt)
    return hash.decode('utf-8')

def verify_password(password: str, hash: str) -> bool:
    #return passwd_context.verify(password, hash)
    return bcrypt.checkpw(password.encode('utf-8'), hash.encode('utf-8'))

def create_access_token(user_data: dict, expiry: timedelta = None,refresh: bool= False):

    payload = {}
    payload['user'] = user_data
    payload['exp'] = datetime.now() + (expiry if expiry is not None else timedelta(seconds= ACCESS_TOKEN_EXPIRY))
    payload['jti'] = str(uuid.uuid4())
    payload['refresh']= refresh

    token = jwt.encode(
        payload= payload,
        key= Config.JWT_SECRET,
        algorithm= Config.JWT_ALGORITHM
    )

    return token 

def decode_token(token: str) -> dict:
    try:
        token_data = jwt.decode(
            jwt=token,
            key=Config.JWT_SECRET,
            algorithms=[Config.JWT_ALGORITHM],
        )
        return token_data

    except jwt.ExpiredSignatureError as e:
        logging.exception(e)
        # If you have a separate exception, use it; else InvalidToken is fine
        raise InvalidToken()

    except jwt.PyJWTError as e:
        logging.exception(e)
        raise InvalidToken()

#### For Account Verification after user's account creation
serializer= URLSafeTimedSerializer(secret_key= Config.JWT_SECRET, salt = "email-configuration")

def create_url_safe_token(data: dict):
    token = serializer.dumps(data)
    return token

def decode_url_safe_token(token: str):
    try:
        token_data = serializer.loads(token)
        return token_data
    except Exception as e:
        logging.error(str(e))



