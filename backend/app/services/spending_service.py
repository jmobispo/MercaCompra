from datetime import datetime, timezone, timedelta

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.purchase_history import PurchaseHistory
from app.schemas.spending import PurchaseHistoryCreate, PurchaseHistoryRead, SpendingMetrics


class SpendingService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def record(self, user_id: int, data: PurchaseHistoryCreate) -> PurchaseHistoryRead:
        record = PurchaseHistory(
            user_id=user_id,
            shopping_list_id=data.shopping_list_id,
            list_name=data.list_name,
            estimated_total=data.estimated_total,
            item_count=data.item_count,
        )
        self.db.add(record)
        await self.db.commit()
        await self.db.refresh(record)
        return PurchaseHistoryRead.model_validate(record)

    async def list_for_user(self, user_id: int, limit: int = 50) -> list[PurchaseHistoryRead]:
        result = await self.db.execute(
            select(PurchaseHistory)
            .where(PurchaseHistory.user_id == user_id)
            .order_by(PurchaseHistory.created_at.desc())
            .limit(limit)
        )
        return [PurchaseHistoryRead.model_validate(r) for r in result.scalars().all()]

    async def get_metrics(self, user_id: int) -> SpendingMetrics:
        now = datetime.now(timezone.utc)
        week_ago = now - timedelta(days=7)
        two_weeks_ago = now - timedelta(days=14)
        month_ago = now - timedelta(days=30)
        two_months_ago = now - timedelta(days=60)

        async def _sum_between(start: datetime, end: datetime) -> float:
            result = await self.db.execute(
                select(func.coalesce(func.sum(PurchaseHistory.estimated_total), 0.0)).where(
                    PurchaseHistory.user_id == user_id,
                    PurchaseHistory.created_at >= start,
                    PurchaseHistory.created_at < end,
                )
            )
            return float(result.scalar())

        weekly_current = await _sum_between(week_ago, now)
        weekly_previous = await _sum_between(two_weeks_ago, week_ago)
        monthly_current = await _sum_between(month_ago, now)
        monthly_previous = await _sum_between(two_months_ago, month_ago)

        def _variation(current: float, previous: float) -> float:
            if previous == 0:
                return 0.0
            return round((current - previous) / previous * 100, 1)

        count_result = await self.db.execute(
            select(func.count()).where(PurchaseHistory.user_id == user_id)
        )
        total_purchases = count_result.scalar() or 0

        return SpendingMetrics(
            weekly_current=round(weekly_current, 2),
            weekly_previous=round(weekly_previous, 2),
            weekly_variation=_variation(weekly_current, weekly_previous),
            monthly_current=round(monthly_current, 2),
            monthly_previous=round(monthly_previous, 2),
            monthly_variation=_variation(monthly_current, monthly_previous),
            total_purchases=total_purchases,
        )
