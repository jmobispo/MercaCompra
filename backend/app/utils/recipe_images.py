from pathlib import Path
from uuid import uuid4


ALLOWED_RECIPE_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}

MAX_RECIPE_IMAGE_BYTES = 5 * 1024 * 1024


def get_backend_root() -> Path:
    return Path(__file__).resolve().parents[2]


def get_upload_root() -> Path:
    path = get_backend_root() / "uploads"
    path.mkdir(parents=True, exist_ok=True)
    return path


def get_recipe_upload_dir() -> Path:
    path = get_upload_root() / "recipes"
    path.mkdir(parents=True, exist_ok=True)
    return path


def build_recipe_image_url(filename: str) -> str:
    return f"/uploads/recipes/{filename}"


def generate_recipe_image_filename(content_type: str) -> str:
    extension = ALLOWED_RECIPE_IMAGE_TYPES[content_type]
    return f"{uuid4().hex}{extension}"


def save_recipe_image_bytes(filename: str, content: bytes) -> str:
    path = get_recipe_upload_dir() / filename
    path.write_bytes(content)
    return build_recipe_image_url(filename)


def is_local_recipe_image_url(image_url: str | None) -> bool:
    return bool(image_url and image_url.startswith("/uploads/recipes/"))


def recipe_image_path_from_url(image_url: str | None) -> Path | None:
    if not is_local_recipe_image_url(image_url):
        return None
    return get_backend_root() / image_url.lstrip("/").replace("/", "\\")


def delete_recipe_image_file(image_url: str | None) -> None:
    path = recipe_image_path_from_url(image_url)
    if path and path.exists():
        path.unlink(missing_ok=True)
