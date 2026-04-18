from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.recipe import AddToListResult
from app.schemas.weekly_plan import (
    WeeklyPlanCreate,
    WeeklyPlanGeneratePayload,
    WeeklyPlanRead,
    WeeklyPlanSummary,
    WeeklyPlanSummaryRead,
    WeeklyPlanUpdate,
)
from app.services.weekly_plan_service import WeeklyPlanService


router = APIRouter(prefix="/weekly-plans", tags=["weekly-plans"])


@router.get("", response_model=list[WeeklyPlanSummary])
async def list_weekly_plans(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await WeeklyPlanService(db).list_plans(current_user.id)


@router.post("", response_model=WeeklyPlanRead, status_code=201)
async def create_weekly_plan(
    data: WeeklyPlanCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await WeeklyPlanService(db).create_plan(current_user.id, data)


@router.get("/{plan_id}", response_model=WeeklyPlanRead)
async def get_weekly_plan(
    plan_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await WeeklyPlanService(db).get_plan(plan_id, current_user.id)


@router.put("/{plan_id}", response_model=WeeklyPlanRead)
async def update_weekly_plan(
    plan_id: int,
    data: WeeklyPlanUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await WeeklyPlanService(db).update_plan(plan_id, current_user.id, data)


@router.delete("/{plan_id}", status_code=204)
async def delete_weekly_plan(
    plan_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await WeeklyPlanService(db).delete_plan(plan_id, current_user.id)
    return Response(status_code=204)


@router.post("/{plan_id}/generate", response_model=WeeklyPlanRead)
async def generate_weekly_plan(
    plan_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await WeeklyPlanService(db).generate_plan(plan_id, current_user.id)


@router.get("/{plan_id}/summary", response_model=WeeklyPlanSummaryRead)
async def get_weekly_plan_summary(
    plan_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await WeeklyPlanService(db).get_summary(plan_id, current_user.id)


@router.post("/{plan_id}/generate-shopping-list", response_model=AddToListResult)
async def generate_shopping_list_from_plan(
    plan_id: int,
    payload: WeeklyPlanGeneratePayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await WeeklyPlanService(db).generate_shopping_list(plan_id, current_user.id, payload)
