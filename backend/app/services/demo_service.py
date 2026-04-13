"""Demo service — seeds demo data for a user."""
import logging
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.pantry import PantryItem
from app.models.purchase_history import PurchaseHistory
from app.models.shopping_list import ShoppingList, ShoppingListItem
from app.schemas.demo import DemoSeedResult

logger = logging.getLogger(__name__)

_DEMO_LIST_ITEMS = [
    ("leche_entera", "Leche entera 1L", 0.99, "Lácteos y huevos"),
    ("pan_molde", "Pan de molde integral", 1.29, "Panadería"),
    ("huevos_12", "Huevos camperos 12ud", 2.49, "Lácteos y huevos"),
    ("tomates", "Tomates rama 1kg", 1.99, "Frutas y verduras"),
    ("pechuga", "Pechuga de pollo", 4.50, "Carnicería"),
    ("aceite", "Aceite de oliva virgen extra", 3.89, "Aceites y vinagres"),
    ("pasta", "Espaguetis 500g", 0.89, "Pasta y arroz"),
    ("yogur", "Yogur natural pack 8ud", 1.49, "Lácteos y huevos"),
]

_DEMO_PANTRY_ITEMS = [
    ("Aceite de oliva", 1.0, "l"),
    ("Sal", 500.0, "g"),
    ("Harina", 1.0, "kg"),
    ("Azúcar", 500.0, "g"),
    ("Arroz redondo", 1.0, "kg"),
]


class DemoService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def seed(self, user_id: int) -> DemoSeedResult:
        # Demo shopping list
        demo_list = ShoppingList(
            user_id=user_id,
            name="Lista demo — Compra semanal",
            budget=60.0,
        )
        self.db.add(demo_list)
        await self.db.flush()

        for prod_id, name, price, cat in _DEMO_LIST_ITEMS:
            self.db.add(ShoppingListItem(
                shopping_list_id=demo_list.id,
                product_id=f"demo_{prod_id}",
                product_name=name,
                product_price=price,
                product_category=cat,
                quantity=1,
                is_checked=False,
            ))

        # Pantry items
        for name, qty, unit in _DEMO_PANTRY_ITEMS:
            self.db.add(PantryItem(
                user_id=user_id,
                name=name,
                quantity=qty,
                unit=unit,
            ))

        # Purchase history — 3 past entries
        history_entries = [
            ("Lista demo — Semana pasada", 24.50, 6),
            ("Lista demo — Hace dos semanas", 31.20, 9),
            ("Lista demo — Hace un mes", 27.80, 7),
        ]
        for list_name, total, count in history_entries:
            self.db.add(PurchaseHistory(
                user_id=user_id,
                list_name=list_name,
                estimated_total=total,
                item_count=count,
            ))

        await self.db.commit()
        logger.info(f"Demo data seeded for user {user_id}")

        return DemoSeedResult(
            lists_created=1,
            items_created=len(_DEMO_LIST_ITEMS),
            pantry_items_created=len(_DEMO_PANTRY_ITEMS),
            purchase_history_created=len(history_entries),
            message="Datos demo creados correctamente. Navega a Mis listas, Despensa y Gasto para explorarlos.",
        )
