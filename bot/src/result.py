"""
Result types for automation runs.
These are pure data classes — no Playwright dependency.
"""
from dataclasses import dataclass, field, asdict
from typing import Optional, List
from enum import Enum


class ItemStatus(str, Enum):
    OK = "ok"               # Product found and added
    NOT_FOUND = "not_found" # No results for this product
    DUBIOUS = "dubious"     # Added but match confidence is low
    SUBSTITUTED = "substituted"  # Different product added (closest match)
    ERROR = "error"         # Technical error during processing


@dataclass
class ItemResult:
    product_id: str
    product_name: str
    quantity: int
    status: ItemStatus
    matched_name: Optional[str] = None
    matched_price: Optional[float] = None
    substitution_name: Optional[str] = None
    error_detail: Optional[str] = None
    confidence: Optional[float] = None

    def to_dict(self) -> dict:
        d = asdict(self)
        d["status"] = self.status.value
        return d


@dataclass
class RunResult:
    item_results: List[ItemResult] = field(default_factory=list)
    estimated_cost: Optional[float] = None
    duration_seconds: Optional[float] = None
    error_message: Optional[str] = None

    @property
    def added_ok(self) -> int:
        return sum(1 for r in self.item_results if r.status == ItemStatus.OK)

    @property
    def not_found(self) -> int:
        return sum(1 for r in self.item_results if r.status == ItemStatus.NOT_FOUND)

    @property
    def dubious(self) -> int:
        return sum(1 for r in self.item_results if r.status == ItemStatus.DUBIOUS)

    @property
    def substituted(self) -> int:
        return sum(1 for r in self.item_results if r.status == ItemStatus.SUBSTITUTED)

    @property
    def errors(self) -> int:
        return sum(1 for r in self.item_results if r.status == ItemStatus.ERROR)

    def to_dict(self) -> dict:
        return {
            "item_results": [r.to_dict() for r in self.item_results],
            "estimated_cost": self.estimated_cost,
            "duration_seconds": self.duration_seconds,
            "error_message": self.error_message,
            "summary": {
                "total": len(self.item_results),
                "added_ok": self.added_ok,
                "not_found": self.not_found,
                "dubious": self.dubious,
                "substituted": self.substituted,
                "errors": self.errors,
            },
        }
