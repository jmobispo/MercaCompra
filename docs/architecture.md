# Arquitectura de MercaCompra

## Visión general

```
┌──────────────────────────────────────────────────────────────────┐
│                        Cliente (navegador)                        │
│   PC · iPad · iPhone · Android — cualquier dispositivo en la red  │
└───────────────────────────────┬──────────────────────────────────┘
                                │ HTTP (mismo host / IP)
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│                     Frontend — React + Vite                       │
│   Puerto :5173 (dev) / :80 (Docker)                               │
│                                                                    │
│  - URLs relativas /api/v1/*  → proxy a backend                    │
│  - React Router (SPA)                                             │
│  - Zustand auth store → localStorage                              │
│  - PWA manifest + service worker (Workbox)                        │
└───────────────────────────────┬──────────────────────────────────┘
        Vite proxy (dev)        │        nginx proxy (Docker)
        /api → :8000            │        /api → backend:8000
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│                     Backend — FastAPI                             │
│   Puerto :8000                                                    │
│                                                                    │
│  /api/v1/auth/*          AuthService   → JWT (stdlib HS256)       │
│  /api/v1/lists/*         ListService   → ShoppingList + Items     │
│  /api/v1/products/*      ProductService → Mercadona API + AI      │
│  /api/v1/automation/*    AutomationService → HTTP call to bot     │
│                                                                    │
│  DB: SQLite (async SQLAlchemy) · Alembic migrations               │
└───────────────────────────────┬──────────────────────────────────┘
                                │ POST /run (httpx)
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│                  Bot — Playwright HTTP Service                    │
│   Puerto :8001                                                    │
│                                                                    │
│  POST /run   → lanza sesión Playwright (Chromium headless)        │
│  GET  /health → {"status":"healthy","busy":bool}                  │
│                                                                    │
│  Procesamiento por item:                                          │
│    1. Buscar en tienda.mercadona.es                               │
│    2. Encontrar mejor match (SequenceMatcher)                     │
│    3. Añadir al carrito con cantidad                              │
│    4. Devolver resultado (ok/dubious/not_found/error)             │
│                                                                    │
│  Semáforo: una sesión de navegador a la vez                       │
└──────────────────────────────────────────────────────────────────┘
```

## Capa de IA (backend)

```
AI_MODE=heuristics      (default)   — difflib.SequenceMatcher, sin dependencias
AI_MODE=local_free                  — TF-IDF (scikit-learn, si instalado)
AI_MODE=claude_optional             — Claude API (fallback a heuristics si no hay clave)
```

No hay API de pago obligatoria. La app funciona completamente con `heuristics`.

## Flujo de automatización

```
Usuario lanza run → POST /api/v1/automation/runs
    → AutomationService crea AutomationRun (status=pending)
    → asyncio.create_task lanza _call_bot en background
    → respuesta HTTP 202 inmediata

Background task:
    → marca run como running
    → POST http://bot:8001/run con items + credenciales
    → bot ejecuta Playwright (puede tardar 1-5 min)
    → persiste resultados en AutomationRun
    → marca run como completed/failed

Frontend:
    → polling GET /api/v1/automation/runs/{id} cada 3s
    → muestra progreso y resultado final
```

## Red local / dispositivos móviles

El diseño con **URLs relativas** es la clave:

```
iPad abre http://192.168.1.35:5173
  → carga la app React desde Vite/nginx
  → app hace fetch /api/v1/lists
  → navegador llama http://192.168.1.35:5173/api/v1/lists
  → Vite proxy / nginx reenvía a http://backend:8000/api/v1/lists
  → respuesta vuelve al iPad
```

Nunca aparece `localhost` en ninguna URL del cliente. Funciona desde cualquier IP.

## Docker Compose

```
Internet / LAN
    │
    ├── :5173 → frontend (nginx)
    │               │ /api/ proxy
    │               ▼
    ├── :8000 → backend (FastAPI)
    │               │ POST /run
    │               ▼
    └── :8001 → bot (FastAPI + Playwright)
```

Las tres apps se comunican por la red interna de Docker (`bridge`).
Solo los puertos mapeados son accesibles desde el exterior.

## Seguridad

- **JWT**: HS256 con stdlib `hmac` + `hashlib` (sin dependencias externas)
- **Passwords**: `hashlib.scrypt` (sin passlib/bcrypt)
- **CORS**: `*` por defecto en dev; restringir a dominio en producción
- **SECRET_KEY**: obligatorio cambiar en producción
- **Credenciales Mercadona**: nunca se persisten en DB, se pasan directamente al bot

## Stack de tecnologías

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Frontend | React + TypeScript | 18.2 + 5.2 |
| Bundler | Vite + vite-plugin-pwa | 5.0 + 0.20 |
| State | Zustand | 4.4 |
| HTTP client | Axios | 1.6 |
| Backend | FastAPI + Uvicorn | 0.110 + 0.25 |
| ORM | SQLAlchemy async | 2.0 |
| DB | SQLite (dev) / PostgreSQL (prod) | — |
| Migrations | Alembic | 1.13 |
| Bot | Playwright (Chromium) | 1.44 |
| Bot service | FastAPI | 0.110 |
| Contenedores | Docker Compose | 3.9 |
