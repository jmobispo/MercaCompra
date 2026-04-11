"""
AI service factory — selects implementation based on AI_MODE env var.
Guarantees heuristics always works; optional modes degrade gracefully.
"""
import logging
from functools import lru_cache
from app.services.ai.base import AIBase

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def get_ai_service() -> AIBase:
    from app.core.config import get_settings
    settings = get_settings()
    mode = settings.AI_MODE.lower()

    if mode == "claude_optional":
        from app.services.ai.claude_optional import ClaudeOptionalAI
        logger.info("AI mode: claude_optional (falls back to heuristics if unavailable)")
        return ClaudeOptionalAI()

    if mode == "local_free":
        from app.services.ai.local_free import LocalFreeAI
        logger.info("AI mode: local_free (TF-IDF ranking)")
        return LocalFreeAI()

    # Default: heuristics
    from app.services.ai.heuristics import HeuristicsAI
    logger.info("AI mode: heuristics (default)")
    return HeuristicsAI()
