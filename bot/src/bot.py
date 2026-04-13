#!/usr/bin/env python3
"""
MercaCompra Playwright bot.

Reads a JSON payload from stdin:
  {"items": [{"product_id": "...", "product_name": "...", "quantity": 1}, ...]}

Writes a JSON result to stdout on completion.
Logs to stderr.

LIMITACIONES CONOCIDAS:
- Mercadona puede cambiar su web en cualquier momento, invalidando selectores.
- El matching de productos es heurístico; revisa los resultados "dubious".
- Sin login: el bot puede buscar productos pero no añadir al carrito de forma persistente.
- Con login: requiere credenciales válidas de Mercadona.
"""
import asyncio
import json
import logging
import sys
import time
from typing import List, Dict, Any

from playwright.async_api import async_playwright, Browser, BrowserContext, Page

from bot.src.config import get_config, BotConfig
from bot.src.result import ItemResult, RunResult, ItemStatus
from bot.src.actions import (
    dismiss_cookies,
    search_product,
    find_best_match,
    add_product_to_cart,
    take_screenshot,
)

# Confidence thresholds
HIGH_CONFIDENCE = 0.75   # Good match
LOW_CONFIDENCE = 0.40    # Dubious match (will warn but add)
MIN_CONFIDENCE = 0.25    # Below this: mark as not found

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    stream=sys.stderr,
)
logger = logging.getLogger("mercacompra.bot")


async def process_item(
    page: Page,
    item: Dict[str, Any],
    config: BotConfig,
) -> ItemResult:
    """Process a single shopping list item."""
    product_name = item["product_name"]
    product_id = item.get("product_id", "")
    quantity = max(1, int(item.get("quantity", 1)))

    logger.info(f"Processing: {product_name} (qty={quantity})")

    try:
        # Navigate to search
        await page.goto(f"{config.base_url}/search-results?query={product_name}", wait_until="domcontentloaded")
        await dismiss_cookies(page)

        found = await search_product(page, product_name, config)

        if not found:
            logger.info(f"Not found: {product_name}")
            return ItemResult(
                product_id=product_id,
                product_name=product_name,
                quantity=quantity,
                status=ItemStatus.NOT_FOUND,
            )

        matched_name, matched_price, confidence, card_idx = await find_best_match(page, product_name, config)

        if matched_name is None or confidence < MIN_CONFIDENCE:
            logger.info(f"No suitable match for: {product_name} (best confidence={confidence:.2f})")
            return ItemResult(
                product_id=product_id,
                product_name=product_name,
                quantity=quantity,
                status=ItemStatus.NOT_FOUND,
                confidence=confidence,
            )

        # Determine status based on confidence
        if confidence >= HIGH_CONFIDENCE:
            status = ItemStatus.OK
        elif confidence >= LOW_CONFIDENCE:
            status = ItemStatus.DUBIOUS
        else:
            # Very low confidence — mark as substituted
            status = ItemStatus.SUBSTITUTED

        # Attempt to add to cart
        added = await add_product_to_cart(page, card_idx, quantity, config)
        if not added:
            logger.warning(f"Could not add to cart: {product_name}")
            status = ItemStatus.ERROR if status == ItemStatus.OK else status

        logger.info(f"Result: {product_name} → {matched_name} ({status.value}, conf={confidence:.2f})")

        return ItemResult(
            product_id=product_id,
            product_name=product_name,
            quantity=quantity,
            status=status,
            matched_name=matched_name,
            matched_price=matched_price,
            confidence=round(confidence, 3),
        )

    except Exception as e:
        logger.error(f"Error processing {product_name}: {e}", exc_info=True)
        await take_screenshot(page, f"error_{product_id}", config)
        return ItemResult(
            product_id=product_id,
            product_name=product_name,
            quantity=quantity,
            status=ItemStatus.ERROR,
            error_detail=str(e)[:200],
        )


async def run_bot(items: List[Dict[str, Any]], config: BotConfig) -> RunResult:
    """Run the full automation for all items."""
    result = RunResult()
    start_time = time.time()

    browser: Browser | None = None
    context: BrowserContext | None = None
    page: Page | None = None

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=config.headless,
                slow_mo=config.slow_mo,
                args=["--no-sandbox", "--disable-setuid-sandbox"],
            )
            context = await browser.new_context(
                viewport={"width": config.viewport_width, "height": config.viewport_height},
                locale="es-ES",
            )
            page = await context.new_page()
            page.set_default_timeout(config.timeout)

            # Navigate to Mercadona
            logger.info("Navigating to Mercadona...")
            await page.goto(config.base_url, wait_until="domcontentloaded")
            await dismiss_cookies(page)

            # Process each item
            for item in items:
                item_result = await process_item(page, item, config)
                result.item_results.append(item_result)

            # Calculate estimated cost
            result.estimated_cost = sum(
                (r.matched_price or 0) * r.quantity
                for r in result.item_results
                if r.matched_price is not None
            )

    except Exception as e:
        logger.error(f"Bot fatal error: {e}", exc_info=True)
        message = str(e)
        if "Executable doesn't exist" in message:
            result.error_message = (
                "Playwright no tiene Chromium instalado. Ejecuta "
                "'bot\\.venv\\Scripts\\python -m playwright install chromium'."
            )
        else:
            result.error_message = message[:500]
        if page is not None:
            await take_screenshot(page, "fatal_error", config)
    finally:
        if context is not None:
            try:
                await context.close()
            except Exception:
                pass
        if browser is not None:
            try:
                await browser.close()
            except Exception:
                pass

    result.duration_seconds = round(time.time() - start_time, 2)
    return result


async def main() -> None:
    """Entry point: read items from stdin, write result to stdout."""
    try:
        raw = sys.stdin.read()
        payload = json.loads(raw)
        items = payload.get("items", [])
    except Exception as e:
        error_result = RunResult(error_message=f"Invalid input: {e}")
        print(json.dumps(error_result.to_dict()), flush=True)
        sys.exit(1)

    if not items:
        error_result = RunResult(error_message="No items provided")
        print(json.dumps(error_result.to_dict()), flush=True)
        sys.exit(1)

    config = get_config()
    logger.info(f"Starting bot: {len(items)} items, headless={config.headless}")

    result = await run_bot(items, config)

    # Write JSON result to stdout
    print(json.dumps(result.to_dict()), flush=True)


if __name__ == "__main__":
    asyncio.run(main())
