from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from app.db.session import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.services.automation_service import AutomationService
from app.schemas.automation import AutomationRunCreate, AutomationRunRead

router = APIRouter(prefix="/automation", tags=["automation"])


@router.post("/runs", response_model=AutomationRunRead, status_code=202)
async def launch_automation(
    data: AutomationRunCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Launch an automation run for a shopping list.
    Returns immediately with status=pending; poll GET /runs/{id} for updates.
    """
    svc = AutomationService(db)
    return await svc.create_run(current_user.id, data, postal_code=current_user.postal_code)


@router.get("/runs", response_model=List[AutomationRunRead])
async def list_runs(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List recent automation runs for the current user."""
    svc = AutomationService(db)
    return await svc.get_runs_for_user(current_user.id)


@router.get("/runs/{run_id}", response_model=AutomationRunRead)
async def get_run(
    run_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get status and result of a specific automation run."""
    svc = AutomationService(db)
    return await svc.get_run(run_id, current_user.id)
