from pydantic import BaseModel


class DemoStatus(BaseModel):
    demo_mode: bool


class DemoSeedResult(BaseModel):
    lists_created: int
    items_created: int
    pantry_items_created: int
    purchase_history_created: int
    message: str
