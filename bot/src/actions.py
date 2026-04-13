"""
Playwright browser actions for Mercadona.
Each action is a focused, retried, logged function.
AVISO: Los selectores dependen de la estructura HTML actual de Mercadona.
       Si la web cambia, actualiza selectors.py.
"""
import asyncio
import logging
import os
from difflib import SequenceMatcher
from pathlib import Path
from typing import Optional, Tuple

from playwright.async_api import Page, TimeoutError as PlaywrightTimeout

from bot.src.config import BotConfig
from bot.src.selectors import (
    COOKIE_ACCEPT,
    SEARCH_INPUT,
    PRODUCT_CARD,
    PRODUCT_NAME,
    PRODUCT_PRICE,
    ADD_TO_CART_BUTTON,
    NO_RESULTS_TEXT,
    QUANTITY_INCREASE,
)

logger = logging.getLogger(__name__)


async def dismiss_cookies(page: Page) -> None:
    """Accept cookie banner if present (best-effort)."""
    try:
        btn = page.locator(COOKIE_ACCEPT).first
        if await btn.is_visible(timeout=3000):
            await btn.click()
            await asyncio.sleep(0.5)
    except Exception:
        pass


async def take_screenshot(page: Page, name: str, config: BotConfig) -> Optional[str]:
    """Save a screenshot for debugging. Returns path or None."""
    if not config.screenshot_on_error:
        return None
    try:
        screenshots_dir = Path(config.screenshots_dir)
        screenshots_dir.mkdir(parents=True, exist_ok=True)
        path = str(screenshots_dir / f"{name}.png")
        await page.screenshot(path=path, full_page=True)
        logger.info(f"Screenshot saved: {path}")
        return path
    except Exception as e:
        logger.debug(f"Could not save screenshot: {e}")
        return None


async def search_product(page: Page, query: str, config: BotConfig) -> bool:
    """
    Type a product name in the search box and wait for results.
    Returns True if at least one product was found.
    """
    for attempt in range(config.max_retries):
        try:
            # Find search box
            search_box = page.locator(SEARCH_INPUT).first
            await search_box.wait_for(state="visible", timeout=config.timeout)

            # Clear and type
            await search_box.click(click_count=3)
            await search_box.fill("")
            await search_box.type(query, delay=50)

            # Wait for results to load
            await asyncio.sleep(1.5)

            # Check for no-results indicator
            no_results = page.locator(NO_RESULTS_TEXT).first
            try:
                is_no_results = await no_results.is_visible(timeout=2000)
                if is_no_results:
                    logger.info(f"No results for '{query}'")
                    return False
            except Exception:
                pass

            # Check for product cards
            cards = page.locator(PRODUCT_CARD)
            count = await cards.count()
            return count > 0

        except PlaywrightTimeout:
            logger.warning(f"Search timeout for '{query}' (attempt {attempt + 1}/{config.max_retries})")
            if attempt < config.max_retries - 1:
                await asyncio.sleep(config.retry_delay)
        except Exception as e:
            logger.error(f"Search error for '{query}': {e}")
            if attempt < config.max_retries - 1:
                await asyncio.sleep(config.retry_delay)

    return False


def _text_similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()


async def find_best_match(
    page: Page, query: str, config: BotConfig
) -> Tuple[Optional[str], Optional[float], float, int]:
    """
    Find the best matching product card for a query.
    Returns (product_name, product_price, confidence, card_index).
    """
    cards = page.locator(PRODUCT_CARD)
    count = await cards.count()

    if count == 0:
        return None, None, 0.0, -1

    best_idx = 0
    best_confidence = 0.0
    best_name = None
    best_price = None

    for i in range(min(count, 8)):  # Check first 8 results
        try:
            card = cards.nth(i)
            name_el = card.locator(PRODUCT_NAME).first
            name = (await name_el.inner_text(timeout=2000)).strip()
            confidence = _text_similarity(query, name)

            if confidence > best_confidence:
                best_confidence = confidence
                best_idx = i
                best_name = name

                # Try to get price
                try:
                    price_el = card.locator(PRODUCT_PRICE).first
                    price_text = (await price_el.inner_text(timeout=1000)).strip()
                    # Parse price: "1,23 €" or "1.23"
                    price_text = price_text.replace("€", "").replace(",", ".").strip()
                    best_price = float(price_text.split()[0])
                except Exception:
                    pass

        except Exception:
            continue

    return best_name, best_price, best_confidence, best_idx


async def add_product_to_cart(
    page: Page, card_index: int, quantity: int, config: BotConfig
) -> bool:
    """
    Click the add-to-cart button on the card at card_index,
    then increase quantity as needed.
    Returns True if successful.
    """
    for attempt in range(config.max_retries):
        try:
            cards = page.locator(PRODUCT_CARD)
            card = cards.nth(card_index)

            # Click the add button
            add_btn = card.locator(ADD_TO_CART_BUTTON).first
            await add_btn.wait_for(state="visible", timeout=config.timeout)
            await add_btn.click()
            await asyncio.sleep(0.8)

            # Increase quantity if > 1
            if quantity > 1:
                increase_btn = card.locator(QUANTITY_INCREASE).first
                for _ in range(quantity - 1):
                    try:
                        await increase_btn.click()
                        await asyncio.sleep(0.3)
                    except Exception:
                        break

            return True

        except PlaywrightTimeout:
            logger.warning(f"Add-to-cart timeout (attempt {attempt + 1}/{config.max_retries})")
            if attempt < config.max_retries - 1:
                await asyncio.sleep(config.retry_delay)
        except Exception as e:
            logger.error(f"Add-to-cart error: {e}")
            return False

    return False
