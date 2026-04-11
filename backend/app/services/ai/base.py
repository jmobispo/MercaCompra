"""
Base interface for AI/suggestion services.
All concrete implementations must inherit from AIBase.
"""
from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any


class AIBase(ABC):
    @abstractmethod
    async def suggest_products(
        self,
        query: str,
        candidates: List[Dict[str, Any]],
        context: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Given a product name query and a list of candidate products from Mercadona,
        return a ranked/filtered list of suggestions.

        Args:
            query: product name the user is looking for
            candidates: raw products from Mercadona API (already filtered by keyword)
            context: optional list of other product names in the same shopping list

        Returns:
            Ordered list of candidate dicts with added 'confidence' key (0.0–1.0)
        """

    @abstractmethod
    async def compose_list_suggestions(
        self,
        list_name: str,
        existing_items: List[str],
    ) -> List[str]:
        """
        Given a list name and existing items, suggest additional products to add.
        Returns a list of product name strings.
        """

    @property
    @abstractmethod
    def mode_name(self) -> str:
        """Return the mode name (heuristics | local_free | claude_optional)."""
