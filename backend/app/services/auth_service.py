from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.user_repo import UserRepository
from app.core.security import hash_password, verify_password, create_access_token
from app.schemas.user import UserCreate, TokenResponse, UserRead
from app.models.user import User


class AuthService:
    def __init__(self, db: AsyncSession):
        self.repo = UserRepository(db)

    async def register(self, data: UserCreate) -> TokenResponse:
        if await self.repo.get_by_email(data.email):
            raise HTTPException(status_code=409, detail="Email ya registrado")
        if await self.repo.get_by_username(data.username):
            raise HTTPException(status_code=409, detail="Nombre de usuario ya en uso")

        user = await self.repo.create(
            email=data.email,
            username=data.username,
            hashed_password=hash_password(data.password),
        )
        token = create_access_token(str(user.id))
        return TokenResponse(access_token=token, user=UserRead.model_validate(user))

    async def login(self, email: str, password: str) -> TokenResponse:
        user = await self.repo.get_by_email(email)
        if not user or not verify_password(password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Credenciales incorrectas",
            )
        if not user.is_active:
            raise HTTPException(status_code=403, detail="Cuenta desactivada")

        token = create_access_token(str(user.id))
        return TokenResponse(access_token=token, user=UserRead.model_validate(user))

    async def get_user_by_id(self, user_id: int) -> User:
        user = await self.repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        return user
