from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.db.session import get_db
from app.models.user import User
from app.schemas.demo import DemoStatus, DemoSeedResult
from app.services.demo_service import DemoService

router = APIRouter(prefix="/demo", tags=["demo"])


@router.get("/status", response_model=DemoStatus)
async def demo_status():
    """Public endpoint — returns whether demo mode is active."""
    settings = get_settings()
    return DemoStatus(demo_mode=settings.DEMO_MODE)


@router.post("/seed", response_model=DemoSeedResult, status_code=201)
async def seed_demo(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Seed demo data (lists, pantry, purchase history) for the current user."""
    return await DemoService(db).seed(current_user.id)
