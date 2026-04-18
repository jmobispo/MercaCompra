# MercaCompra

Aplicacion full-stack para listas de la compra, recetas, despensa y planificacion semanal de comidas.

## Caracteristicas

- Autenticacion real con JWT
- Listas de la compra por usuario
- Catalogo de productos con integracion Mercadona y fallback local
- Favoritos y recetas editables
- Recetas con ingredientes, pasos, imagen y nutricion por racion
- Selector `ideal para`: desayuno, comida y cena
- Planificacion semanal con calendario visual y selector de recetas por tarjeta
- Planificador semanal por reglas, sin IA ni Ollama
- Resumen nutricional y de coste dentro del calendario semanal
- Despensa conectada con recetas, planes y optimizacion de listas
- Bot Playwright para automatizar la compra en Mercadona
- Compatible con movil y PWA
- Funciona sin APIs de pago obligatorias

## Stack

| Capa | Tecnologia |
|------|------------|
| Backend | FastAPI + SQLAlchemy + Alembic |
| Base de datos | SQLite (dev) / PostgreSQL (prod) |
| Frontend | React + Vite + TypeScript |
| Automatizacion | Playwright |
| Contenedores | Docker + docker-compose |

## Arranque rapido

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

En Windows:

```powershell
cd backend
.venv\Scripts\activate
alembic upgrade head
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Recetas con nutricion

Cada receta puede incluir:

- calorias por racion
- proteina, carbohidratos y grasas
- fibra, azucares y sodio
- imagen
- pasos de elaboracion
- uno o varios tipos de comida en `ideal para`

Estos datos se muestran en:

- cards de recetas
- detalle de receta
- selector de recetas del calendario
- slots del plan semanal

## Planificacion semanal

El calendario semanal reutiliza la informacion nutricional de las recetas y un motor de reglas determinista para:

- generar menus automaticamente sin IA externa
- priorizar recetas segun desayuno, comida o cena
- aplicar preferencias: economico, rapido, saludable y familiar
- penalizar repeticiones y mejorar variedad
- aprovechar despensa y habitos si existen
- mostrar calorias y tipo de comida dentro de cada slot
- mostrar un resumen diario de calorias, macros y coste
- generar listas de compra a partir del plan

## Migraciones

```bash
cd backend
alembic upgrade head
```

## Verificacion rapida

- Backend saludable en `http://localhost:8000/health`
- Frontend en `http://localhost:5173`
- API docs en `http://localhost:8000/docs`
