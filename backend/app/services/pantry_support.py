import re
import unicodedata
from difflib import SequenceMatcher
from typing import Iterable, Optional


def normalize_text(value: str | None) -> str:
    normalized = unicodedata.normalize("NFKD", value or "")
    plain = "".join(char for char in normalized if not unicodedata.combining(char))
    return " ".join(plain.lower().strip().split())


def normalize_unit(value: str | None) -> str:
    unit = normalize_text(value)
    aliases = {
        "uds": "uds",
        "ud": "uds",
        "unidad": "uds",
        "unidades": "uds",
        "huevo": "uds",
        "huevos": "uds",
        "kg": "kg",
        "g": "g",
        "l": "l",
        "ml": "ml",
    }
    return aliases.get(unit, unit)


def parse_measurement_text(value: str | None) -> tuple[float, str] | None:
    text = normalize_text(value)
    if not text:
        return None

    if "docena" in text:
        return 12.0, "uds"

    match = re.search(r"(\d+(?:[.,]\d+)?)\s*(kg|g|l|ml|ud|uds|unidad|unidades|huevos?)\b", text)
    if match:
        amount = float(match.group(1).replace(",", "."))
        unit = normalize_unit(match.group(2))
        return amount, unit

    unit = normalize_unit(text)
    if unit in {"uds", "kg", "g", "l", "ml"}:
        return 1.0, unit

    return None


def total_amount(quantity: float, unit_text: str | None) -> tuple[float, str] | None:
    parsed = parse_measurement_text(unit_text)
    if parsed:
        amount, unit = parsed
        return quantity * amount, unit
    return None


def units_compatible(left: str, right: str) -> bool:
    families = [
        {"kg", "g"},
        {"l", "ml"},
        {"uds"},
    ]
    return any(left in family and right in family for family in families)


def convert_amount(amount: float, from_unit: str, to_unit: str) -> float | None:
    from_unit = normalize_unit(from_unit)
    to_unit = normalize_unit(to_unit)

    if from_unit == to_unit:
        return amount

    conversions = {
        ("g", "kg"): amount / 1000,
        ("kg", "g"): amount * 1000,
        ("ml", "l"): amount / 1000,
        ("l", "ml"): amount * 1000,
    }
    return conversions.get((from_unit, to_unit))


def name_tokens(value: str | None) -> set[str]:
    raw_tokens = re.findall(r"[a-z0-9]+", normalize_text(value))
    stopwords = {
        "de", "del", "la", "el", "los", "las", "y", "con", "sin", "para",
        "al", "a", "en", "tipo", "extra", "mini", "pack", "hacienda", "hacendado",
    }
    tokens: set[str] = set()
    for token in raw_tokens:
        if token in stopwords:
            continue
        if len(token) > 3 and token.endswith("es"):
            token = token[:-2]
        elif len(token) > 2 and token.endswith("s"):
            token = token[:-1]
        tokens.add(token)
    return tokens


def names_match(left: str | None, right: str | None) -> bool:
    left_norm = normalize_text(left)
    right_norm = normalize_text(right)
    if not left_norm or not right_norm:
        return False
    if left_norm == right_norm:
        return True

    left_tokens = name_tokens(left)
    right_tokens = name_tokens(right)
    if not left_tokens or not right_tokens:
        return False

    overlap = len(left_tokens & right_tokens) / max(min(len(left_tokens), len(right_tokens)), 1)
    similarity = SequenceMatcher(None, left_norm, right_norm).ratio()
    return overlap >= 0.75 or similarity >= 0.84


def pantry_matches_item(
    pantry_item,
    product_id: str | None,
    product_name: str | None,
    ingredient_name: str | None = None,
) -> bool:
    if product_id and getattr(pantry_item, "product_id", None) == product_id:
        return True

    pantry_name = getattr(pantry_item, "name", None)
    return names_match(pantry_name, product_name) or names_match(pantry_name, ingredient_name)


def pantry_total_in_unit(
    pantry_items: Iterable,
    *,
    product_id: str | None,
    product_name: str | None,
    ingredient_name: str | None,
    target_unit: str,
) -> float:
    total = 0.0
    for pantry_item in pantry_items:
        if getattr(pantry_item, "is_consumed", False):
            continue
        if not pantry_matches_item(pantry_item, product_id, product_name, ingredient_name):
            continue

        parsed = total_amount(float(getattr(pantry_item, "quantity", 0.0) or 0.0), getattr(pantry_item, "unit", None))
        if not parsed:
            continue
        amount, unit = parsed
        if not units_compatible(unit, target_unit):
            continue
        converted = convert_amount(amount, unit, target_unit)
        if converted is not None:
            total += converted
    return total
