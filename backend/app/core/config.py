from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional
import os


class Settings(BaseSettings):
    # App
    APP_NAME: str = "MercaCompra"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # Security
    SECRET_KEY: str = "change-me-in-production-use-openssl-rand-hex-32"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./mercacompra.db"

    # CORS — set to "*" (or comma-separated URLs) to allow all origins (useful for local network / iPad)
    CORS_ORIGINS: str = "*"

    # Mercadona API
    MERCADONA_API: str = "https://tienda.mercadona.es/api"
    MERCADONA_DEFAULT_POSTAL: str = "28001"
    MERCADONA_ALGOLIA_APP_ID: str = "7UZJKL1DJ0"
    MERCADONA_ALGOLIA_API_KEY: str = "9d8f2e39e90df472b4f2e559a116fe17"

    # Product search mode: mercadona | fallback | hybrid
    # hybrid = tries Mercadona first; falls back to local catalog if API returns nothing
    PRODUCT_SEARCH_MODE: str = "hybrid"

    # AI mode: heuristics | local_free | claude_optional
    AI_MODE: str = "heuristics"

    # Claude (optional, only used if AI_MODE=claude_optional)
    ANTHROPIC_API_KEY: Optional[str] = None
    CLAUDE_MODEL: str = "claude-opus-4-6"

    # Bot
    BOT_API_URL: str = "http://localhost:8001"
    BOT_TIMEOUT: int = 300  # seconds

    # Logging
    LOG_LEVEL: str = "INFO"

    class Config:
        env_file = ".env"
        extra = "ignore"

    @property
    def cors_origins_list(self) -> list[str]:
        origins = [o.strip() for o in self.CORS_ORIGINS.split(",")]
        return origins

    @property
    def cors_allow_credentials(self) -> bool:
        # Wildcard origins cannot be combined with credentials=True
        origins = self.cors_origins_list
        return not ("*" in origins)


@lru_cache()
def get_settings() -> Settings:
    return Settings()
