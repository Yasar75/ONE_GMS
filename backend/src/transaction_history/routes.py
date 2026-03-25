from typing import Optional
from fastapi import APIRouter, Depends, status
from sqlmodel.ext.asyncio.session import AsyncSession
from src.auth.dependencies import AccessTokenBearer
from src.db.main import get_session
from .schema import TransactionHistoryListRead
from .service import transaction_history_service

transaction_history_router = APIRouter()
access_token_bearer = AccessTokenBearer()


@transaction_history_router.get("/my-history",response_model=TransactionHistoryListRead,status_code=status.HTTP_200_OK)
async def get_my_transaction_history(status_filter: Optional[str] = None,request_type: Optional[str] = None,
    search: Optional[str] = None,session: AsyncSession = Depends(get_session),token_details: dict = Depends(access_token_bearer)):
    email = token_details.get("user", {}).get("email")
    return await transaction_history_service.list_my_transaction_history(session=session,email=email,status_filter=status_filter,
        request_type=request_type,search=search)