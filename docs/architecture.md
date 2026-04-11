# MercaCompra — Arquitectura

## Visión general

```
┌──────────────────────────────────────────────────────────────┐
│                        CLIENTE                               │
│  React + Vite + TypeScript  (puerto 5173 en dev)            │
└──────────────┬───────────────────────────────────────────────┘
               │ HTTP / JSON (Bearer token)
┌──────────────▼───────────────────────────────────────────────┐
│                     BACKEND (FastAPI)                         │
│  Puerto 8000 — API REST en /api/v1                           │
│                                                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │   Auth   │  │  Lists   │  │ Products │  │ Automation │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────────┘  │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │               Servicios internos                        │  │
│  │  AuthService  ListService  ProductService               │  │
│  │  AutomationService  AI layer (heuristics/optional)     │  │
│  └───────────────────────────┬────────────────────────────┘  │
│                               │                               │
│  ┌────────────────────────────▼────────────────────────────┐ │
│  │            SQLAlchemy (async) + SQLite / PG              │ │
│  └──────────────────────────────────────────────────────────┘ │
└──────────────┬───────────────────────────────────────────────┘
               │ subprocess (stdin/stdout JSON)
┌──────────────▼───────────────────────────────────────────────┐
│                       BOT (Playwright)                        │
│  Recibe lista de productos → busca en Mercadona web          │
│  → devuelve resultado JSON estructurado                       │
└──────────────────────────────────────────────────────────────┘
               │ HTTP proxy
┌──────────────▼───────────────────────────────────────────────┐
│              Mercadona API / Web (externa)                    │
│  tienda.mercadona.es/api  (no oficial)                       │
└──────────────────────────────────────────────────────────────┘
```

## Estructura de carpetas

```
MercaCompra/
├── backend/                    # FastAPI
│   ├── app/
│   │   ├── api/                # Routes (auth, lists, products, automation)
│   │   ├── core/               # Config, security, logging
│   │   ├── db/                 # SQLAlchemy engine, session, base
│   │   ├── models/             # ORM models
│   │   ├── schemas/            # Pydantic schemas
│   │   ├── services/           # Business logic
│   │   │   └── ai/             # AI layer (heuristics, local_free, claude_optional)
│   │   ├── repositories/       # DB access layer
│   │   └── utils/              # Mercadona proxy, catalog loader
│   ├── alembic/                # DB migrations
│   ├── requirements.txt
│   └── .env.example
├── frontend/                   # React + Vite + TypeScript
│   ├── src/
│   │   ├── api/                # API client modules
│   │   ├── components/         # Reusable UI components
│   │   ├── pages/              # Page-level components
│   │   ├── hooks/              # Custom React hooks
│   │   ├── store/              # Zustand state stores
│   │   └── types/              # TypeScript type definitions
│   ├── package.json
│   └── .env.example
├── bot/                        # Playwright automation
│   └── src/
│       ├── bot.py              # Entry point (reads stdin, writes stdout)
│       ├── config.py           # BotConfig from env vars
│       ├── selectors.py        # CSS selectors (update here if Mercadona changes)
│       ├── actions.py          # Playwright actions (search, add to cart)
│       └── result.py           # Result data types
├── data/
│   └── catalog/                # Local product catalog JSON files
├── docs/                       # Documentation
├── scripts/                    # Dev scripts
└── docker-compose.yml
```

## Base de datos

Schema SQLite (compatible con PostgreSQL):

- **users**: id, email, username, hashed_password, postal_code, is_active
- **shopping_lists**: id, user_id, name, budget, is_archived
- **shopping_list_items**: id, shopping_list_id, product_id, product_name, price, quantity, is_checked
- **catalog_products**: id, external_id, name, price, category, thumbnail, source
- **automation_runs**: id, user_id, shopping_list_id, status, item_results (JSON)

Migración: `cd backend && alembic upgrade head`

## Autenticación

JWT tokens (HS256) con expiración configurable.
- Header: `Authorization: Bearer <token>`
- Generación: en login/register
- Validación: middleware en todas las rutas protegidas

## Integración bot-backend

El `AutomationService` lanza el bot como subprocess:
1. Serializa los items de la lista a JSON
2. Los envía por stdin al bot
3. El bot retorna resultados por stdout
4. El backend persiste el resultado en `automation_runs`
5. El frontend hace polling al endpoint `/automation/runs/{id}` hasta que status != pending/running

## Fuentes de catálogo

| Fuente | Descripción | Cuándo usar |
|--------|-------------|-------------|
| `mercadona_api` | Proxy a API no oficial de Mercadona | Búsqueda en tiempo real |
| `local_json` | JSONs en `data/catalog/` | Catálogo offline, demo |
| `import` | Importación externa | Futuro: scraping, CSV |

El sistema es extensible — añadir una fuente nueva requiere solo un nuevo loader en `utils/catalog.py`.
