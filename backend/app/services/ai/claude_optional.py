"""
Claude optional AI mode.
NEVER required for the app to function.
Only activated when AI_MODE=claude_optional AND ANTHROPIC_API_KEY is set.
Falls back to heuristics silently if unavailable or on any error.
"""
import logging
from typing import List, Optional, Dict, Any

from app.services.ai.base import AIBase
from app.services.ai.heuristics import HeuristicsAI

logger = logging.getLogger(__name__)


class ClaudeOptionalAI(AIBase):
    """
    Optional integration with Claude API.
    Requirements:
      - AI_MODE=claude_optional in .env
      - ANTHROPIC_API_KEY=<your key> in .env
    If either is missing or the API call fails, falls back to HeuristicsAI.
    """

    def __init__(self):
        self._fallback = HeuristicsAI()
        self._client = None
        self._model = None
        self._available = False
        self._try_init()

    def _try_init(self) -> None:
        try:
            from app.core.config import get_settings
            settings = get_settings()
            if not settings.ANTHROPIC_API_KEY:
                logger.info("ClaudeOptionalAI: ANTHROPIC_API_KEY not set — falling back to heuristics")
                return

            import anthropic
            self._client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
            self._model = settings.CLAUDE_MODEL
            self._available = True
            logger.info(f"ClaudeOptionalAI: initialized with model {self._model}")
        except ImportError:
            logger.info("ClaudeOptionalAI: anthropic package not installed — falling back to heuristics")
        except Exception as e:
            logger.warning(f"ClaudeOptionalAI init error: {e} — falling back to heuristics")

    @property
    def mode_name(self) -> str:
        return "claude_optional"

    async def suggest_products(
        self,
        query: str,
        candidates: List[Dict[str, Any]],
        context: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        if not self._available or not candidates:
            return await self._fallback.suggest_products(query, candidates, context)

        try:
            candidate_names = [
                f"{i+1}. {p.get('name') or p.get('display_name')} (€{p.get('price', '?')})"
                for i, p in enumerate(candidates[:15])
            ]
            context_str = ", ".join(context[:5]) if context else "ninguno"

            prompt = (
                f"El usuario busca: '{query}'\n"
                f"Contexto de la lista: {context_str}\n"
                f"Candidatos disponibles en Mercadona:\n"
                + "\n".join(candidate_names)
                + "\n\nResponde SOLO con una lista de números (los índices) separados por coma, "
                "ordenados por relevancia del mejor al peor. Máximo 5. Ejemplo: 2,1,5"
            )

            message = self._client.messages.create(
                model=self._model,
                max_tokens=50,
                messages=[{"role": "user", "content": prompt}],
            )

            response_text = message.content[0].text.strip()
            indices = [int(x.strip()) - 1 for x in response_text.split(",") if x.strip().isdigit()]

            result = []
            for idx in indices:
                if 0 <= idx < len(candidates):
                    product = dict(candidates[idx])
                    # Confidence based on position
                    confidence = max(0.0, 1.0 - idx * 0.15)
                    product["confidence"] = round(confidence, 3)
                    result.append(product)

            # Add remaining candidates not selected
            selected_ids = {p.get("id") for p in result}
            for p in candidates:
                if p.get("id") not in selected_ids and len(result) < len(candidates):
                    result.append({**p, "confidence": 0.1})

            return result

        except Exception as e:
            logger.warning(f"ClaudeOptionalAI suggest error: {e} — falling back to heuristics")
            return await self._fallback.suggest_products(query, candidates, context)

    async def compose_list_suggestions(
        self,
        list_name: str,
        existing_items: List[str],
    ) -> List[str]:
        if not self._available:
            return await self._fallback.compose_list_suggestions(list_name, existing_items)

        try:
            items_str = ", ".join(existing_items[:10])
            prompt = (
                f"Lista de la compra llamada '{list_name}' que ya contiene: {items_str}.\n"
                "Sugiere 5 productos complementarios típicos de Mercadona que faltan. "
                "Responde SOLO con los nombres separados por comas, en español. Sé conciso."
            )

            message = self._client.messages.create(
                model=self._model,
                max_tokens=100,
                messages=[{"role": "user", "content": prompt}],
            )

            response = message.content[0].text.strip()
            suggestions = [s.strip() for s in response.split(",") if s.strip()]
            return suggestions[:5]

        except Exception as e:
            logger.warning(f"ClaudeOptionalAI compose error: {e} — falling back to heuristics")
            return await self._fallback.compose_list_suggestions(list_name, existing_items)
