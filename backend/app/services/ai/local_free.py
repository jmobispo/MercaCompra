"""
Local free AI mode — uses a lightweight TF-IDF style ranking.
No external API required. Falls back to heuristics if unavailable.
This is an optional enhancement; heuristics is the fallback.
"""
import logging
import math
import re
from collections import Counter
from typing import List, Optional, Dict, Any

from app.services.ai.base import AIBase
from app.services.ai.heuristics import HeuristicsAI, _tokenize

logger = logging.getLogger(__name__)


def _idf(term: str, docs: List[List[str]]) -> float:
    """Compute inverse document frequency for a term across docs."""
    containing = sum(1 for doc in docs if term in doc)
    if containing == 0:
        return 0.0
    return math.log(len(docs) / containing)


def _tfidf_score(query_tokens: List[str], doc_tokens: List[str], all_docs: List[List[str]]) -> float:
    if not query_tokens or not doc_tokens:
        return 0.0
    doc_counter = Counter(doc_tokens)
    score = 0.0
    for token in query_tokens:
        tf = doc_counter.get(token, 0) / max(len(doc_tokens), 1)
        idf = _idf(token, all_docs)
        score += tf * idf
    return score


class LocalFreeAI(AIBase):
    """
    TF-IDF based ranking. Better than pure heuristics for ambiguous queries.
    Falls back to HeuristicsAI if something goes wrong.
    """

    def __init__(self):
        self._fallback = HeuristicsAI()

    @property
    def mode_name(self) -> str:
        return "local_free"

    async def suggest_products(
        self,
        query: str,
        candidates: List[Dict[str, Any]],
        context: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        try:
            if not candidates:
                return []

            query_tokens = _tokenize(query)
            all_docs = [
                _tokenize(p.get("name") or p.get("display_name") or "")
                for p in candidates
            ]

            scored = []
            for product, doc_tokens in zip(candidates, all_docs):
                score = _tfidf_score(query_tokens, doc_tokens, all_docs)
                scored.append({**product, "confidence": round(min(score, 1.0), 3)})

            scored.sort(key=lambda p: (-p["confidence"], len(p.get("name") or "")))
            return scored

        except Exception as e:
            logger.warning(f"LocalFreeAI error, falling back to heuristics: {e}")
            return await self._fallback.suggest_products(query, candidates, context)

    async def compose_list_suggestions(
        self,
        list_name: str,
        existing_items: List[str],
    ) -> List[str]:
        # Delegate to heuristics for this feature
        return await self._fallback.compose_list_suggestions(list_name, existing_items)
