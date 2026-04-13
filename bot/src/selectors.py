"""
CSS selectors for Mercadona's current web interface.
Keep this file focused so the rest of the bot stays stable when HTML changes.
"""

LOGIN_EMAIL_INPUT = 'input[type="email"], input[name="email"], #email'
LOGIN_PASSWORD_INPUT = 'input[type="password"], input[name="password"], #password'
LOGIN_SUBMIT_BUTTON = 'button[type="submit"], button:has-text("Acceder"), button:has-text("Iniciar sesión")'
LOGIN_ERROR_MESSAGE = '.error-message, [class*="error"], [class*="alert"]'
LOGIN_MENU_BUTTON = 'button[data-testid="dropdown-button"], .drop-down__trigger'
LOGIN_ENTRY_LINK = 'a[href="/?authenticate-user="], .btn.btn--primary.btn--default'
LOGIN_EMAIL_CONTINUE = 'button:has-text("Continuar"), button[aria-label="Continuar"]'
LOGIN_PASSWORD_SUBMIT = 'button:has-text("Entrar"), button[aria-label="Entrar"]'
LOGIN_GUEST_LABEL = 'text=Invitado'

SEARCH_INPUT = (
    'input[name="search"], '
    'input[aria-label*="Buscar productos"], '
    'input[type="search"], '
    '[data-testid="search-input"]'
)
SEARCH_CLEAR_BUTTON = '[aria-label*="borrar"], [aria-label*="clear"], .search-clear'

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
    'button[data-testid="product-quantity-button"], '
    '.product-quantity-button__add, '
    'button[aria-label="Añadir al carro"], '
    'button[aria-label*="Añadir"], '
    'button[aria-label*="agregar"], '
    '.add-to-cart, '
    '[class*="add-button"]'
)

CART_QUANTITY_INPUT = '[data-testid="quantity-input"], input[class*="quantity"]'
CART_ITEM_TOTAL = '[data-testid="cart-total"], .cart-total-price'

QUANTITY_INCREASE = (
    'button[data-testid="button-picker-increase"], '
    'button[data-testid*="increase"], '
    'button[aria-label*="aumentar"], '
    'button[aria-label*="más"], '
    '.quantity-btn--plus'
)
QUANTITY_DECREASE = (
    'button[data-testid="button-picker-decrease"], '
    'button[data-testid*="decrease"], '
    'button[aria-label*="disminuir"], '
    'button[aria-label*="menos"], '
    '.quantity-btn--minus'
)

NO_RESULTS_TEXT = (
    '[data-testid="no-results"], '
    '[class*="no-results"], '
    ':has-text("No hemos encontrado"), '
    ':has-text("Sin resultados")'
)

COOKIE_ACCEPT = (
    'button:has-text("Aceptar"), '
    'button:has-text("Acepto"), '
    '#onetrust-accept-btn-handler, '
    '[aria-label*="aceptar cookies"]'
)

POSTAL_CODE_INPUT = (
    'input[data-testid="postal-code-checker-input"], '
    'input[name="postalCode"], '
    'input[aria-label*="Código postal"]'
)

POSTAL_CODE_CONTINUE = (
    'button:has-text("CONTINUAR"), '
    'button:has-text("Continuar"), '
    'button:has-text("Ver productos")'
)
POSTAL_CODE_OVERLAY = (
    '[data-testid="mask"], '
    '.modal__click-outside, '
    '.ui-focus-trap, '
    'form.postal-code-checker, '
    '[data-testid="postal-code-checker"]'
)
