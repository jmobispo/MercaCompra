import base64
import hashlib
from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import get_settings


ENCRYPTED_PREFIX = "enc:v1:"


@lru_cache()
def _get_fernet() -> Fernet:
    settings = get_settings()
    source = (settings.AI_ENCRYPTION_KEY or settings.SECRET_KEY).encode("utf-8")
    digest = hashlib.sha256(source).digest()
    key = base64.urlsafe_b64encode(digest)
    return Fernet(key)


def is_encrypted_secret(value: str | None) -> bool:
    return bool(value and value.startswith(ENCRYPTED_PREFIX))


def encrypt_secret(value: str) -> str:
    token = _get_fernet().encrypt(value.encode("utf-8")).decode("utf-8")
    return f"{ENCRYPTED_PREFIX}{token}"


def decrypt_secret(value: str | None) -> str | None:
    if not value:
        return None
    if not is_encrypted_secret(value):
        return value
    token = value[len(ENCRYPTED_PREFIX):]
    try:
        return _get_fernet().decrypt(token.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        raise ValueError("No se pudo descifrar el secreto almacenado") from exc
