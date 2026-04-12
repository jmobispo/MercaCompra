# MercaCompra

Aplicación full-stack para gestión de listas de la compra con automatización de Mercadona.

## Características

- Autenticación real (registro + login con JWT)
- Múltiples listas de la compra por usuario
- Búsqueda de productos en tiempo real vía API de Mercadona
- Presupuesto por lista con alertas
- Sugerencias inteligentes (heurísticas, sin IA de pago)
- Bot Playwright para automatizar la compra en Mercadona
- Resultados de automatización persistidos y consultables
- Funciona sin ninguna API de pago (IA opcional con Claude)

## Stack

| Capa | Tecnología |
|------|-----------|
| Backend | FastAPI + SQLAlchemy + Alembic |
| Base de datos | SQLite (dev) / PostgreSQL (prod) |
| Frontend | React + Vite + TypeScript |
| Automatización | Playwright |
| Contenedores | Docker + docker-compose |

## Arranque rápido (local)

### Prerrequisitos

- Python 3.11+
- Node.js 18+
- (Opcional) Docker + docker-compose

### Opción A — Script automático

```bash
git clone https://github.com/jmobispo/mercacompra
cd mercacompra
./scripts/start-dev.sh
```

Abre http://localhost:5173

### Opción B — Manual

**Backend:**

```bash
cd backend
cp .env.example .env       # edita si quieres
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head       # crea la base de datos
uvicorn app.main:app --reload
```

**Frontend:**

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

### Opción C — Docker

```bash
cp .env.example .env       # edita SECRET_KEY al menos
docker compose up --build
```

Acceso: http://localhost:5173  
API docs: http://localhost:8000/docs

## Variables de entorno

### Backend (`backend/.env`)

| Variable | Por defecto | Descripción |
|----------|-------------|-------------|
| `SECRET_KEY` | `change-me...` | Clave JWT — **cámbiala** |
| `DATABASE_URL` | `sqlite+aiosqlite:///./mercacompra.db` | URL de base de datos |
| `AI_MODE` | `heuristics` | Modo IA: heuristics / local_free / claude_optional |
| `ANTHROPIC_API_KEY` | vacío | Solo si AI_MODE=claude_optional |
| `CORS_ORIGINS` | localhost | Orígenes permitidos |

Ver `backend/.env.example` para la lista completa.

### Bot (`bot/.env`)

| Variable | Por defecto | Descripción |
|----------|-------------|-------------|
| `MERCADONA_EMAIL` | vacío | Email de tu cuenta Mercadona |
| `MERCADONA_PASSWORD` | vacío | Contraseña |
| `HEADLESS` | `true` | `false` para ver el navegador |

## Modos de IA

La app **nunca requiere IA de pago**. El modo por defecto es `heuristics` (ranking por similitud de texto).

Ver [docs/ai-modes.md](docs/ai-modes.md) para detalles.

## Automatización Mercadona

El bot Playwright busca cada producto de tu lista en la web de Mercadona e intenta añadirlo al carrito.

Limitaciones importantes: ver [docs/automation-limitations.md](docs/automation-limitations.md).

## Estructura del proyecto

Ver [docs/architecture.md](docs/architecture.md).

## Migraciones de base de datos

```bash
cd backend
# Crear nueva migración tras cambiar models/
alembic revision --autogenerate -m "descripcion"
# Aplicar migraciones
alembic upgrade head
# Revertir última migración
alembic downgrade -1
```

## Verificación del sistema

- La app funciona sin Claude: ✅ (modo heuristics por defecto)
- Claude es opcional: ✅ (AI_MODE=claude_optional + ANTHROPIC_API_KEY)
- Sin APIs de pago obligatorias: ✅
- Backend + frontend + bot integrados: ✅
