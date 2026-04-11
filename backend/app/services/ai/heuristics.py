"""
Heuristic AI mode — always available, zero external cost.
Uses string similarity, keyword matching and category ranking.
"""
import re
import logging
from difflib import SequenceMatcher
from typing import List, Optional, Dict, Any

from app.services.ai.base import AIBase

logger = logging.getLogger(__name__)

# Common Spanish grocery stop-words to strip before matching
STOP_WORDS = {
    "de", "del", "la", "el", "en", "con", "sin", "para", "al", "a", "y",
    "o", "los", "las", "un", "una", "unos", "unas", "es", "son",
}

# Simple category-based complementary items
CATEGORY_COMPLEMENTS: Dict[str, List[str]] = {
    "pasta": ["salsa de tomate", "queso rallado", "aceite de oliva"],
    "arroz": ["caldo de pollo", "verduras", "azafrán"],
    "pollo": ["limón", "ajo", "aceite de oliva", "patatas"],
    "pescado": ["limón", "perejil", "aceite de oliva"],
    "ensalada": ["aceite de oliva", "vinagre", "sal", "tomate"],
    "fruta": ["yogur", "cereales"],
    "café": ["leche", "azúcar"],
    "pan": ["mantequilla", "jamón"],
}


def _tokenize(text: str) -> List[str]:
    tokens = re.findall(r"[a-záéíóúñü]+", text.lower())
    return [t for t in tokens if t not in STOP_WORDS and len(t) > 2]


def _similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()


def _score_product(query: str, product: Dict[str, Any]) -> float:
    """Score a product against a query. Returns 0.0–1.0."""
    q_tokens = set(_tokenize(query))
    name = product.get("name") or product.get("display_name") or ""
    p_tokens = set(_tokenize(name))

    if not q_tokens or not p_tokens:
        return 0.0

    # Token overlap ratio
    overlap = len(q_tokens & p_tokens) / max(len(q_tokens), 1)

    # Sequence similarity on full string
    seq_sim = _similarity(query, name)

    # Exact prefix bonus
    prefix_bonus = 0.1 if name.lower().startswith(query.lower()[:5]) else 0.0

    return min(1.0, overlap * 0.5 + seq_sim * 0.4 + prefix_bonus)


class HeuristicsAI(AIBase):
    @property
    def mode_name(self) -> str:
        return "heuristics"

    async def suggest_products(
        self,
        query: str,
        candidates: List[Dict[str, Any]],
        context: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        if not candidates:
            return []

        scored = []
        for product in candidates:
            confidence = _score_product(query, product)
            scored.append({**product, "confidence": round(confidence, 3)})

        # Sort descending by confidence, then by name length (shorter = more specific)
        scored.sort(key=lambda p: (-p["confidence"], len(p.get("name") or "")))
        return scored

    async def compose_list_suggestions(
        self,
        list_name: str,
        existing_items: List[str],
    ) -> List[str]:
        """Suggest complementary items based on what's already in the list."""
        suggestions: List[str] = []
        seen = {item.lower() for item in existing_items}

        for item in existing_items:
            item_tokens = _tokenize(item)
            for keyword, complements in CATEGORY_COMPLEMENTS.items():
                if keyword in item_tokens:
                    for complement in complements:
                        if complement.lower() not in seen:
                            suggestions.append(complement)
                            seen.add(complement.lower())

        # Limit to 5 suggestions
        return suggestions[:5]
