"""
CSS/XPath selectors for Mercadona's web interface.
IMPORTANT: Mercadona can change its frontend at any time.
These selectors are based on the structure observed in April 2025.
If they break, update them here — the rest of the code should not need changes.

Naming convention:
  - BUTTON_*  : clickable elements
  - INPUT_*   : input fields
  - CONTAINER_*: container divs
  - TEXT_*    : text elements
"""

# ─── Authentication ──────────────────────────────────────────────────────────
LOGIN_EMAIL_INPUT = 'input[type="email"], input[name="email"], #email'
LOGIN_PASSWORD_INPUT = 'input[type="password"], input[name="password"], #password'
LOGIN_SUBMIT_BUTTON = 'button[type="submit"], button:has-text("Acceder"), button:has-text("Iniciar sesión")'
LOGIN_ERROR_MESSAGE = '.error-message, [class*="error"], [class*="alert"]'

# ─── Search ──────────────────────────────────────────────────────────────────
SEARCH_INPUT = 'input[type="search"], input[placeholder*="busca"], #search-input, [data-testid="search-input"]'
SEARCH_CLEAR_BUTTON = '[aria-label*="borrar"], [aria-label*="clear"], .search-clear'

# ─── Product listing ─────────────────────────────────────────────────────────
PRODUCT_CARD = (
    '[data-testid="product-cell"], '
    '.product-cell, '
    '[class*="product-item"], '
    '.product-card'
)
PRODUCT_NAME = (
    '[data-testid="product-cell-name"], '
    '.product-cell__description-name, '
    '[class*="product-name"], '
    'h3, .name'
)
PRODUCT_PRICE = (
    '[data-testid="product-cell-price"], '
    '.product-price__unit-price, '
    '[class*="price"]'
)
ADD_TO_CART_BUTTON = (
    'button[data-testid*="add"], '
    'button[aria-label*="añadir"], '
    'button[aria-label*="agregar"], '
    '.add-to-cart, '
    '[class*="add-button"]'
)

# ─── Cart ─────────────────────────────────────────────────────────────────────
CART_QUANTITY_INPUT = '[data-testid="quantity-input"], input[class*="quantity"]'
CART_ITEM_TOTAL = '[data-testid="cart-total"], .cart-total-price'

# ─── Quantity controls ────────────────────────────────────────────────────────
QUANTITY_INCREASE = (
    'button[data-testid*="increase"], '
    'button[aria-label*="aumentar"], '
    'button[aria-label*="más"], '
    '.quantity-btn--plus'
)
QUANTITY_DECREASE = (
    'button[data-testid*="decrease"], '
    'button[aria-label*="disminuir"], '
    'button[aria-label*="menos"], '
    '.quantity-btn--minus'
)

# ─── No results ───────────────────────────────────────────────────────────────
NO_RESULTS_TEXT = (
    '[data-testid="no-results"], '
    '[class*="no-results"], '
    ':has-text("No hemos encontrado"), '
    ':has-text("Sin resultados")'
)

# ─── Cookie banner ────────────────────────────────────────────────────────────
COOKIE_ACCEPT = (
    'button:has-text("Aceptar"), '
    'button:has-text("Acepto"), '
    '#onetrust-accept-btn-handler, '
    '[aria-label*="aceptar cookies"]'
)
