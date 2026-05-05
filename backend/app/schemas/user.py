from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
from app.core.secrets import decrypt_secret


class UserCreate(BaseModel):
    email: str = Field(..., pattern=r"^[^@]+@[^@]+\.[^@]+$")
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6)
    postal_code: str = Field(default="28001", pattern=r"^\d{5}$")


class UserLogin(BaseModel):
    email: str
    password: str


class UserRead(BaseModel):
    id: int
    email: str
    username: str
    is_active: bool
    postal_code: str
    ui_mode: str = "advanced"
    theme_mode: str = "light"
    accent_color: str = "green"
    ai_enabled: bool = False
    ai_provider: str = "openai"
    ai_model: str = "gpt-4.1-mini"
    ai_recipe_autofill: bool = True
    ai_list_assist: bool = True
    ai_plan_assist: bool = True
    has_ai_api_key: bool = False
    ai_api_key_preview: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

    @classmethod
    def from_user(cls, user) -> "UserRead":
        preview = None
        if getattr(user, "ai_api_key", None):
            try:
                plain_secret = decrypt_secret(user.ai_api_key)
            except ValueError:
                plain_secret = None

            if plain_secret:
                preview = f"••••{plain_secret[-4:]}"
            else:
                preview = "••••guardada"
        return cls(
            id=user.id,
            email=user.email,
            username=user.username,
            is_active=user.is_active,
            postal_code=user.postal_code,
            ui_mode=user.ui_mode,
            theme_mode=getattr(user, "theme_mode", "light") or "light",
            accent_color=getattr(user, "accent_color", "green") or "green",
            ai_enabled=bool(getattr(user, "ai_enabled", False)),
            ai_provider=getattr(user, "ai_provider", "openai") or "openai",
            ai_model=getattr(user, "ai_model", "gpt-4.1-mini") or "gpt-4.1-mini",
            ai_recipe_autofill=bool(getattr(user, "ai_recipe_autofill", True)),
            ai_list_assist=bool(getattr(user, "ai_list_assist", True)),
            ai_plan_assist=bool(getattr(user, "ai_plan_assist", True)),
            has_ai_api_key=bool(getattr(user, "ai_api_key", None)),
            ai_api_key_preview=preview,
            created_at=user.created_at,
        )


class UserUpdate(BaseModel):
    username: Optional[str] = Field(None, min_length=3, max_length=50)
    postal_code: Optional[str] = Field(None, max_length=10)
    password: Optional[str] = Field(None, min_length=6)
    ui_mode: Optional[str] = None  # 'basic' | 'advanced'
    theme_mode: Optional[str] = Field(None, pattern="^(light|dark)$")
    accent_color: Optional[str] = Field(None, min_length=3, max_length=30)
    ai_enabled: Optional[bool] = None
    ai_provider: Optional[str] = Field(None, min_length=2, max_length=30)
    ai_model: Optional[str] = Field(None, min_length=2, max_length=100)
    ai_api_key: Optional[str] = Field(None, min_length=10, max_length=2000)
    clear_ai_api_key: Optional[bool] = None
    ai_recipe_autofill: Optional[bool] = None
    ai_list_assist: Optional[bool] = None
    ai_plan_assist: Optional[bool] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead
