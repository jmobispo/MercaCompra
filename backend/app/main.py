from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import get_settings
from app.core.logging import setup_logging
from app.db.session import engine

# Import all models so Alembic sees them
import app.models  # noqa: F401

from app.api import auth, lists, products, automation, recipes, favorites, mercadona, spending, pantry, dashboard, demo

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    # Schema is managed exclusively by Alembic — run `alembic upgrade head` before starting.
    yield
    await engine.dispose()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="API de gestión de listas de compra y automatización de Mercadona",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=settings.cors_allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
API_PREFIX = "/api/v1"
app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(lists.router, prefix=API_PREFIX)
app.include_router(products.router, prefix=API_PREFIX)
app.include_router(mercadona.router, prefix=API_PREFIX)
app.include_router(favorites.router, prefix=API_PREFIX)
app.include_router(automation.router, prefix=API_PREFIX)
app.include_router(recipes.router, prefix=API_PREFIX)
app.include_router(spending.router, prefix=API_PREFIX)
app.include_router(pantry.router, prefix=API_PREFIX)
app.include_router(dashboard.router, prefix=API_PREFIX)
app.include_router(demo.router, prefix=API_PREFIX)


@app.get("/")
async def root():
    return {"app": settings.APP_NAME, "version": settings.APP_VERSION, "status": "ok"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
