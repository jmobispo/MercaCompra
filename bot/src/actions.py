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
    LOGIN_EMAIL_CONTINUE,
    LOGIN_EMAIL_INPUT,
    LOGIN_ENTRY_LINK,
    LOGIN_ERROR_MESSAGE,
    LOGIN_GUEST_LABEL,
    LOGIN_MENU_BUTTON,
    LOGIN_PASSWORD_INPUT,
    LOGIN_PASSWORD_SUBMIT,
    SEARCH_INPUT,
    PRODUCT_CARD,
    PRODUCT_NAME,
    PRODUCT_PRICE,
    ADD_TO_CART_BUTTON,
    NO_RESULTS_TEXT,
    QUANTITY_INCREASE,
    POSTAL_CODE_INPUT,
    POSTAL_CODE_CONTINUE,
    POSTAL_CODE_OVERLAY,
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
    cards = page.locator(PRODUCT_CARD)
    no_results = page.locator(NO_RESULTS_TEXT).first

    try:
        await cards.first.wait_for(state="visible", timeout=2500)
        if await cards.count() > 0:
            return True
    except Exception:
        pass

    try:
        if await no_results.is_visible(timeout=2000):
            logger.info(f"No results for '{query}'")
            return False
    except Exception:
        pass

    for attempt in range(config.max_retries):
        try:
            # Find search box
            search_box = page.locator(SEARCH_INPUT).first
            await search_box.wait_for(state="visible", timeout=min(config.timeout, 4000))

            # Clear and type
            await search_box.click(click_count=3)
            await search_box.fill("")
            await search_box.type(query, delay=50)

            # Wait for results to load
            await asyncio.sleep(1.0)

            # Check for no-results indicator
            try:
                is_no_results = await no_results.is_visible(timeout=1500)
                if is_no_results:
                    logger.info(f"No results for '{query}'")
                    return False
            except Exception:
                pass

            # Check for product cards
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


async def ensure_postal_code(page: Page, postal_code: str, config: BotConfig) -> None:
    """Fill Mercadona's postal code gate if it is visible."""
    if not postal_code:
        return

    try:
        search_box = page.locator(SEARCH_INPUT).first
        if await search_box.is_visible(timeout=1500):
            return
    except Exception:
        pass

    try:
        postal_input = page.locator(POSTAL_CODE_INPUT).first
        if not await postal_input.is_visible(timeout=2500):
            return

        await postal_input.fill("")
        await postal_input.type(postal_code, delay=20)
        try:
            await postal_input.press("Enter")
        except Exception:
            pass

        continue_button = page.locator(POSTAL_CODE_CONTINUE).first
        if await continue_button.is_visible(timeout=2000):
            try:
                await continue_button.click(timeout=2000)
            except Exception:
                await continue_button.click(force=True, timeout=2000)

        await asyncio.sleep(2.0)
        try:
            await search_box.wait_for(state="visible", timeout=5000)
        except Exception:
            logger.warning("Postal code gate did not expose the search box yet")
        try:
            await page.locator(POSTAL_CODE_OVERLAY).first.click(force=True, timeout=1000)
        except Exception:
            pass
        await page.evaluate(
            """
            (selector) => {
              document.querySelectorAll(selector).forEach((el) => el.remove());
            }
            """,
            POSTAL_CODE_OVERLAY,
        )
        logger.info("Postal code gate resolved with %s", postal_code)
    except Exception as exc:
        logger.warning("Could not resolve postal code gate: %s", exc)


async def login_mercadona(page: Page, config: BotConfig) -> bool:
    """Authenticate with Mercadona if credentials were provided."""
    if not config.mercadona_email or not config.mercadona_password:
        logger.info("Skipping Mercadona login: no credentials provided")
        return False

    try:
        await page.evaluate(
            """
            (selector) => {
              document.querySelectorAll(selector).forEach((el) => el.remove());
            }
            """,
            POSTAL_CODE_OVERLAY,
        )
    except Exception:
        pass

    try:
        menu_button = page.locator(LOGIN_MENU_BUTTON).first
        await menu_button.click(force=True, timeout=3000)
        await asyncio.sleep(0.7)

        entry_link = page.locator(LOGIN_ENTRY_LINK).first
        await entry_link.click(force=True, timeout=3000)
        await asyncio.sleep(1.0)

        email_input = page.locator(LOGIN_EMAIL_INPUT).first
        await email_input.wait_for(state="visible", timeout=5000)
        await email_input.fill("")
        await email_input.type(config.mercadona_email, delay=20)

        continue_button = page.locator(LOGIN_EMAIL_CONTINUE).first
        await continue_button.click(force=True, timeout=3000)
        await asyncio.sleep(1.0)

        password_input = page.locator(LOGIN_PASSWORD_INPUT).first
        await password_input.wait_for(state="visible", timeout=5000)
        await password_input.fill("")
        await password_input.type(config.mercadona_password, delay=20)

        submit_button = page.locator(LOGIN_PASSWORD_SUBMIT).first
        await submit_button.click(force=True, timeout=3000)
        await asyncio.sleep(3.0)

        error_box = page.locator(LOGIN_ERROR_MESSAGE).first
        try:
            if await error_box.is_visible(timeout=1500):
                logger.error("Mercadona login error visible: %s", await error_box.inner_text())
                return False
        except Exception:
            pass

        if await page.locator(LOGIN_GUEST_LABEL).count() > 0:
            guest_label = page.locator(LOGIN_GUEST_LABEL).first
            try:
                if await guest_label.is_visible(timeout=1000):
                    logger.warning("Mercadona login appears to still be in guest mode")
                    return False
            except Exception:
                pass

        logger.info("Mercadona login completed")
        return True
    except Exception as exc:
        logger.error("Mercadona login failed: %s", exc)
        await take_screenshot(page, "login_error", config)
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

            add_buttons = card.locator(ADD_TO_CART_BUTTON)
            add_btn = None
            count = await add_buttons.count()
            for idx in range(count):
                candidate = add_buttons.nth(idx)
                try:
                    if await candidate.is_visible(timeout=1000):
                        add_btn = candidate
                        break
                except Exception:
                    continue

            if add_btn is None:
                logger.error("No visible add-to-cart button found")
                return False

            try:
                await add_btn.click(timeout=min(config.timeout, 3000))
            except Exception:
                await add_btn.click(force=True, timeout=min(config.timeout, 3000))
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
