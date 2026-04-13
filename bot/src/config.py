"""
Bot configuration — read from environment variables.
Never hardcode credentials here.
"""
import os
from dataclasses import dataclass, field


@dataclass
class BotConfig:
    # Mercadona login (optional — required only for adding to cart)
    mercadona_email: str = field(default_factory=lambda: os.getenv("MERCADONA_EMAIL", ""))
    mercadona_password: str = field(default_factory=lambda: os.getenv("MERCADONA_PASSWORD", ""))
    postal_code: str = field(default_factory=lambda: os.getenv("MERCADONA_POSTAL_CODE", ""))

    # Browser settings
    headless: bool = field(default_factory=lambda: os.getenv("HEADLESS", "true").lower() == "true")
    slow_mo: int = field(default_factory=lambda: int(os.getenv("SLOW_MO", "0")))  # ms between actions
    timeout: int = field(default_factory=lambda: int(os.getenv("BOT_TIMEOUT", "15000")))  # ms per action
    max_run_seconds: int = field(default_factory=lambda: int(os.getenv("BOT_MAX_RUN_SECONDS", "180")))
    max_item_seconds: int = field(default_factory=lambda: int(os.getenv("BOT_MAX_ITEM_SECONDS", "20")))
    viewport_width: int = 1280
    viewport_height: int = 900

    # Retry settings
    max_retries: int = 3
    retry_delay: float = 2.0  # seconds

    # Screenshot on error
    screenshot_on_error: bool = field(
        default_factory=lambda: os.getenv("SCREENSHOT_ON_ERROR", "true").lower() == "true"
    )
    screenshots_dir: str = field(
        default_factory=lambda: os.getenv("SCREENSHOTS_DIR", "/tmp/mercacompra_bot")
    )

    # Mercadona URLs
    base_url: str = "https://tienda.mercadona.es"
    login_url: str = "https://tienda.mercadona.es/auth"
    search_url: str = "https://tienda.mercadona.es/search-results"


def get_config() -> BotConfig:
    return BotConfig()
