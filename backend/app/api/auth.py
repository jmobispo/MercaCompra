from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.schemas.user import UserCreate, UserLogin, TokenResponse, UserRead, UserUpdate
from app.services.auth_service import AuthService
from app.api.deps import get_current_user
from app.models.user import User
from app.repositories.user_repo import UserRepository
from app.core.security import hash_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(data: UserCreate, db: AsyncSession = Depends(get_db)):
    """Register a new user and return access token."""
    service = AuthService(db)
    return await service.register(data)


@router.post("/login", response_model=TokenResponse)
async def login(data: UserLogin, db: AsyncSession = Depends(get_db)):
    """Login and return access token."""
    service = AuthService(db)
    return await service.login(data.email, data.password)


@router.get("/me", response_model=UserRead)
async def me(current_user: User = Depends(get_current_user)):
    """Get current user profile."""
    return UserRead.model_validate(current_user)


@router.put("/me", response_model=UserRead)
async def update_me(
    data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update current user profile."""
    repo = UserRepository(db)
    updates = {}
    if data.username:
        updates["username"] = data.username
    if data.postal_code:
        updates["postal_code"] = data.postal_code
    if data.password:
        updates["hashed_password"] = hash_password(data.password)
    if data.ui_mode in ("basic", "advanced"):
        updates["ui_mode"] = data.ui_mode

    updated = await repo.update(current_user, **updates)
    return UserRead.model_validate(updated)
