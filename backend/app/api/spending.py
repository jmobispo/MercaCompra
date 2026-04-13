from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.spending import PurchaseHistoryCreate, PurchaseHistoryRead, SpendingMetrics
from app.services.spending_service import SpendingService

router = APIRouter(prefix="/spending", tags=["spending"])


@router.get("/history", response_model=list[PurchaseHistoryRead])
async def get_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await SpendingService(db).list_for_user(current_user.id)


@router.post("/record", response_model=PurchaseHistoryRead, status_code=201)
async def record_purchase(
    data: PurchaseHistoryCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await SpendingService(db).record(current_user.id, data)


@router.get("/metrics", response_model=SpendingMetrics)
async def get_metrics(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await SpendingService(db).get_metrics(current_user.id)
