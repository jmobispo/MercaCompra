"""
Recipe service — CRUD, add-to-list, and seed data.
"""
import logging
import math
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.pantry import PantryItem
from app.models.recipe import Recipe, RecipeIngredient
from app.models.shopping_list import ShoppingList, ShoppingListItem
from app.models.user import User
from app.schemas.recipe import (
    RecipeCreate, RecipeUpdate, RecipeRead, RecipeSummary,
    AddToListPayload, AddToListResult, PantryRecipeSuggestion,
)
from app.services.product_service import ProductService

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Seed data — public template recipes shown to all users
# ─────────────────────────────────────────────────────────────────────────────
SEED_RECIPES = [
    {
        "title": "Espaguetis a la Carbonara",
        "description": "Clásica receta italiana con huevo, queso pecorino o parmesano, guanciale o bacon y pimienta negra. Sin nata.",
        "servings": 4,
        "estimated_minutes": 25,
        "estimated_cost": 6.50,
        "tags": ["pasta", "italiana", "rápida"],
        "ingredients": [
            {"name": "Espaguetis", "quantity": 400, "unit": "g", "product_query": "espaguetis"},
            {"name": "Bacon o guanciale", "quantity": 150, "unit": "g", "product_query": "bacon ahumado"},
            {"name": "Huevos", "quantity": 4, "unit": "uds", "product_query": "huevos"},
            {"name": "Queso parmesano rallado", "quantity": 80, "unit": "g", "product_query": "queso parmesano"},
            {"name": "Pimienta negra", "quantity": None, "unit": "al gusto", "product_query": "pimienta negra"},
            {"name": "Sal", "quantity": None, "unit": "al gusto", "product_query": "sal"},
        ],
    },
    {
        "title": "Macarrones con Tomate y Queso",
        "description": "Pasta al horno con salsa de tomate casera, queso rallado y orégano. Un clásico que gusta a todos.",
        "servings": 4,
        "estimated_minutes": 35,
        "estimated_cost": 4.20,
        "tags": ["pasta", "fácil", "horno"],
        "ingredients": [
            {"name": "Macarrones", "quantity": 400, "unit": "g", "product_query": "macarrones"},
            {"name": "Tomate frito", "quantity": 400, "unit": "g", "product_query": "tomate frito"},
            {"name": "Queso mozzarella rallado", "quantity": 150, "unit": "g", "product_query": "queso mozzarella"},
            {"name": "Queso parmesano", "quantity": 50, "unit": "g", "product_query": "queso parmesano"},
            {"name": "Aceite de oliva", "quantity": 2, "unit": "cucharadas", "product_query": "aceite oliva"},
            {"name": "Orégano", "quantity": None, "unit": "al gusto", "product_query": "orégano"},
            {"name": "Sal y pimienta", "quantity": None, "unit": "al gusto", "product_query": "sal"},
        ],
    },
    {
        "title": "Tortilla de Patatas",
        "description": "La receta clásica española con patata y huevo. Jugosa por dentro y dorada por fuera.",
        "servings": 4,
        "estimated_minutes": 40,
        "estimated_cost": 3.80,
        "tags": ["española", "huevos", "clásica"],
        "ingredients": [
            {"name": "Patatas", "quantity": 600, "unit": "g", "product_query": "patatas"},
            {"name": "Huevos", "quantity": 5, "unit": "uds", "product_query": "huevos"},
            {"name": "Cebolla", "quantity": 1, "unit": "ud", "product_query": "cebolla"},
            {"name": "Aceite de oliva", "quantity": 200, "unit": "ml", "product_query": "aceite oliva"},
            {"name": "Sal", "quantity": None, "unit": "al gusto", "product_query": "sal"},
        ],
    },
    {
        "title": "Arroz con Pollo",
        "description": "Arroz meloso con pollo, verduras y caldo. Plato completo y reconfortante.",
        "servings": 4,
        "estimated_minutes": 50,
        "estimated_cost": 8.50,
        "tags": ["arroz", "pollo", "completo"],
        "ingredients": [
            {"name": "Arroz redondo", "quantity": 320, "unit": "g", "product_query": "arroz redondo"},
            {"name": "Muslos de pollo", "quantity": 800, "unit": "g", "product_query": "muslos pollo"},
            {"name": "Pimiento rojo", "quantity": 1, "unit": "ud", "product_query": "pimiento rojo"},
            {"name": "Cebolla", "quantity": 1, "unit": "ud", "product_query": "cebolla"},
            {"name": "Tomate triturado", "quantity": 200, "unit": "g", "product_query": "tomate triturado"},
            {"name": "Caldo de pollo", "quantity": 800, "unit": "ml", "product_query": "caldo pollo"},
            {"name": "Ajo", "quantity": 3, "unit": "dientes", "product_query": "ajo"},
            {"name": "Aceite de oliva", "quantity": 3, "unit": "cucharadas", "product_query": "aceite oliva"},
            {"name": "Pimentón dulce", "quantity": 1, "unit": "cucharadita", "product_query": "pimentón dulce"},
            {"name": "Azafrán", "quantity": None, "unit": "unas hebras", "product_query": "azafrán"},
            {"name": "Sal y pimienta", "quantity": None, "unit": "al gusto", "product_query": "sal"},
        ],
    },
    {
        "title": "Pasta Boloñesa",
        "description": "Ragú de carne con tomate a fuego lento. Mejor si reposa. Acompaña con parmesano.",
        "servings": 4,
        "estimated_minutes": 60,
        "estimated_cost": 9.00,
        "tags": ["pasta", "carne", "italiana"],
        "ingredients": [
            {"name": "Espaguetis o tagliatelle", "quantity": 400, "unit": "g", "product_query": "espaguetis"},
            {"name": "Carne picada mixta", "quantity": 400, "unit": "g", "product_query": "carne picada"},
            {"name": "Tomate triturado", "quantity": 400, "unit": "g", "product_query": "tomate triturado"},
            {"name": "Cebolla", "quantity": 1, "unit": "ud", "product_query": "cebolla"},
            {"name": "Zanahoria", "quantity": 1, "unit": "ud", "product_query": "zanahoria"},
            {"name": "Ajo", "quantity": 2, "unit": "dientes", "product_query": "ajo"},
            {"name": "Vino tinto", "quantity": 100, "unit": "ml", "product_query": "vino tinto"},
            {"name": "Aceite de oliva", "quantity": 2, "unit": "cucharadas", "product_query": "aceite oliva"},
            {"name": "Queso parmesano", "quantity": 60, "unit": "g", "product_query": "queso parmesano"},
            {"name": "Sal y pimienta", "quantity": None, "unit": "al gusto", "product_query": "sal"},
        ],
    },
    {
        "title": "Ensalada Mixta",
        "description": "Ensalada fresca con lechuga, tomate, cebolla, atún y aceitunas. Aliño de aceite y vinagre.",
        "servings": 2,
        "estimated_minutes": 10,
        "estimated_cost": 4.00,
        "tags": ["ensalada", "rápida", "saludable"],
        "ingredients": [
            {"name": "Lechuga iceberg", "quantity": 1, "unit": "ud", "product_query": "lechuga"},
            {"name": "Tomate", "quantity": 2, "unit": "uds", "product_query": "tomate"},
            {"name": "Cebolla", "quantity": 0.5, "unit": "ud", "product_query": "cebolla"},
            {"name": "Atún en aceite", "quantity": 160, "unit": "g", "product_query": "atún aceite"},
            {"name": "Aceitunas", "quantity": 50, "unit": "g", "product_query": "aceitunas"},
            {"name": "Aceite de oliva", "quantity": 3, "unit": "cucharadas", "product_query": "aceite oliva"},
            {"name": "Vinagre de vino", "quantity": 1, "unit": "cucharada", "product_query": "vinagre"},
            {"name": "Sal", "quantity": None, "unit": "al gusto", "product_query": "sal"},
        ],
    },
    {
        "title": "Lasaña de Carne",
        "description": "Lasaña clásica con ragú de carne, bechamel casera y capas de pasta al horno.",
        "servings": 6,
        "estimated_minutes": 90,
        "estimated_cost": 12.00,
        "tags": ["pasta", "horno", "carne"],
        "ingredients": [
            {"name": "Placas de lasaña", "quantity": 250, "unit": "g", "product_query": "pasta lasaña"},
            {"name": "Carne picada mixta", "quantity": 500, "unit": "g", "product_query": "carne picada"},
            {"name": "Bechamel lista", "quantity": 500, "unit": "ml", "product_query": "bechamel"},
            {"name": "Tomate frito", "quantity": 400, "unit": "g", "product_query": "tomate frito"},
            {"name": "Cebolla", "quantity": 1, "unit": "ud", "product_query": "cebolla"},
            {"name": "Queso mozzarella rallado", "quantity": 200, "unit": "g", "product_query": "queso mozzarella"},
            {"name": "Queso parmesano", "quantity": 60, "unit": "g", "product_query": "queso parmesano"},
            {"name": "Aceite de oliva", "quantity": 2, "unit": "cucharadas", "product_query": "aceite oliva"},
            {"name": "Sal y pimienta", "quantity": None, "unit": "al gusto", "product_query": "sal"},
        ],
    },
    {
        "title": "Crema de Verduras",
        "description": "Sopa-crema suave con calabacín, zanahoria y patata. Ligera, saludable y sabrosa.",
        "servings": 4,
        "estimated_minutes": 30,
        "estimated_cost": 4.50,
        "tags": ["sopa", "verduras", "saludable"],
        "ingredients": [
            {"name": "Calabacín", "quantity": 2, "unit": "uds", "product_query": "calabacín"},
            {"name": "Zanahoria", "quantity": 2, "unit": "uds", "product_query": "zanahoria"},
            {"name": "Patata", "quantity": 2, "unit": "uds", "product_query": "patatas"},
            {"name": "Cebolla", "quantity": 1, "unit": "ud", "product_query": "cebolla"},
            {"name": "Caldo de verduras", "quantity": 800, "unit": "ml", "product_query": "caldo verduras"},
            {"name": "Nata para cocinar", "quantity": 100, "unit": "ml", "product_query": "nata cocinar"},
            {"name": "Aceite de oliva", "quantity": 2, "unit": "cucharadas", "product_query": "aceite oliva"},
            {"name": "Sal y pimienta", "quantity": None, "unit": "al gusto", "product_query": "sal"},
        ],
    },
]


# ─────────────────────────────────────────────────────────────────────────────
# Service
# ─────────────────────────────────────────────────────────────────────────────

ADDITIONAL_SEED_RECIPES = [
    {"title": "Pollo al Curry con Arroz", "description": "Pollo cremoso con curry suave y arroz blanco.", "servings": 4, "estimated_minutes": 35, "estimated_cost": 7.8, "tags": ["pollo", "arroz", "asiática"], "ingredients": [{"name": "Pechuga de pollo", "quantity": 500, "unit": "g", "product_query": "pechuga pollo"}, {"name": "Arroz largo", "quantity": 300, "unit": "g", "product_query": "arroz largo"}, {"name": "Leche de coco", "quantity": 400, "unit": "ml", "product_query": "leche coco"}, {"name": "Cebolla", "quantity": 1, "unit": "ud", "product_query": "cebolla"}, {"name": "Curry en polvo", "quantity": 2, "unit": "cucharaditas", "product_query": "curry"}, {"name": "Aceite de oliva", "quantity": 2, "unit": "cucharadas", "product_query": "aceite oliva"}]},
    {"title": "Fajitas de Pollo", "description": "Tortillas rellenas de pollo salteado con pimientos.", "servings": 4, "estimated_minutes": 25, "estimated_cost": 8.2, "tags": ["mexicana", "pollo", "rápida"], "ingredients": [{"name": "Tortillas de trigo", "quantity": 8, "unit": "uds", "product_query": "tortillas trigo"}, {"name": "Pechuga de pollo", "quantity": 500, "unit": "g", "product_query": "pechuga pollo"}, {"name": "Pimiento rojo", "quantity": 1, "unit": "ud", "product_query": "pimiento rojo"}, {"name": "Pimiento verde", "quantity": 1, "unit": "ud", "product_query": "pimiento verde"}, {"name": "Cebolla", "quantity": 1, "unit": "ud", "product_query": "cebolla"}, {"name": "Sazonador fajitas", "quantity": 1, "unit": "sobre", "product_query": "sazonador fajitas"}]},
    {"title": "Chili con Carne", "description": "Guiso tex-mex con carne picada, alubias y tomate.", "servings": 4, "estimated_minutes": 45, "estimated_cost": 7.9, "tags": ["carne", "legumbres", "picante"], "ingredients": [{"name": "Carne picada mixta", "quantity": 400, "unit": "g", "product_query": "carne picada"}, {"name": "Alubias rojas cocidas", "quantity": 400, "unit": "g", "product_query": "alubias rojas"}, {"name": "Tomate triturado", "quantity": 400, "unit": "g", "product_query": "tomate triturado"}, {"name": "Cebolla", "quantity": 1, "unit": "ud", "product_query": "cebolla"}, {"name": "Maíz dulce", "quantity": 150, "unit": "g", "product_query": "maíz dulce"}, {"name": "Comino molido", "quantity": 1, "unit": "cucharadita", "product_query": "comino"}]},
    {"title": "Lentejas Estofadas", "description": "Lentejas caseras con verduras y chorizo.", "servings": 4, "estimated_minutes": 50, "estimated_cost": 5.9, "tags": ["legumbres", "cuchara", "tradicional"], "ingredients": [{"name": "Lentejas pardinas", "quantity": 350, "unit": "g", "product_query": "lentejas pardinas"}, {"name": "Chorizo", "quantity": 150, "unit": "g", "product_query": "chorizo"}, {"name": "Patatas", "quantity": 2, "unit": "uds", "product_query": "patatas"}, {"name": "Zanahoria", "quantity": 2, "unit": "uds", "product_query": "zanahoria"}, {"name": "Cebolla", "quantity": 1, "unit": "ud", "product_query": "cebolla"}, {"name": "Pimiento verde", "quantity": 1, "unit": "ud", "product_query": "pimiento verde"}]},
    {"title": "Garbanzos con Espinacas", "description": "Plato de cuchara con garbanzos y espinacas.", "servings": 4, "estimated_minutes": 30, "estimated_cost": 4.8, "tags": ["legumbres", "verduras", "económica"], "ingredients": [{"name": "Garbanzos cocidos", "quantity": 400, "unit": "g", "product_query": "garbanzos cocidos"}, {"name": "Espinacas", "quantity": 400, "unit": "g", "product_query": "espinacas"}, {"name": "Cebolla", "quantity": 1, "unit": "ud", "product_query": "cebolla"}, {"name": "Ajo", "quantity": 2, "unit": "dientes", "product_query": "ajo"}, {"name": "Tomate triturado", "quantity": 200, "unit": "g", "product_query": "tomate triturado"}, {"name": "Comino molido", "quantity": 1, "unit": "cucharadita", "product_query": "comino"}]},
    {"title": "Merluza al Horno con Patatas", "description": "Pescado al horno con patata, cebolla y limón.", "servings": 4, "estimated_minutes": 40, "estimated_cost": 10.5, "tags": ["pescado", "horno", "saludable"], "ingredients": [{"name": "Filetes de merluza", "quantity": 600, "unit": "g", "product_query": "merluza filetes"}, {"name": "Patatas", "quantity": 500, "unit": "g", "product_query": "patatas"}, {"name": "Cebolla", "quantity": 1, "unit": "ud", "product_query": "cebolla"}, {"name": "Limón", "quantity": 1, "unit": "ud", "product_query": "limón"}, {"name": "Aceite de oliva", "quantity": 3, "unit": "cucharadas", "product_query": "aceite oliva"}, {"name": "Ajo", "quantity": 2, "unit": "dientes", "product_query": "ajo"}]},
    {"title": "Salmón con Verduras", "description": "Lomos de salmón con salteado de verduras.", "servings": 2, "estimated_minutes": 20, "estimated_cost": 9.8, "tags": ["pescado", "rápida", "saludable"], "ingredients": [{"name": "Lomos de salmón", "quantity": 2, "unit": "uds", "product_query": "salmón lomos"}, {"name": "Calabacín", "quantity": 1, "unit": "ud", "product_query": "calabacín"}, {"name": "Zanahoria", "quantity": 2, "unit": "uds", "product_query": "zanahoria"}, {"name": "Brócoli", "quantity": 250, "unit": "g", "product_query": "brócoli"}, {"name": "Aceite de oliva", "quantity": 2, "unit": "cucharadas", "product_query": "aceite oliva"}, {"name": "Limón", "quantity": 1, "unit": "ud", "product_query": "limón"}]},
    {"title": "Hamburguesas Caseras con Patatas", "description": "Hamburguesa de ternera con pan, queso y patatas.", "servings": 4, "estimated_minutes": 35, "estimated_cost": 11.0, "tags": ["carne", "rápida", "familiar"], "ingredients": [{"name": "Carne picada de ternera", "quantity": 600, "unit": "g", "product_query": "carne picada ternera"}, {"name": "Pan de hamburguesa", "quantity": 4, "unit": "uds", "product_query": "pan hamburguesa"}, {"name": "Queso cheddar", "quantity": 4, "unit": "lonchas", "product_query": "queso cheddar"}, {"name": "Lechuga", "quantity": 1, "unit": "ud", "product_query": "lechuga"}, {"name": "Tomate", "quantity": 2, "unit": "uds", "product_query": "tomate"}, {"name": "Patatas", "quantity": 600, "unit": "g", "product_query": "patatas"}]},
    {"title": "Albóndigas en Salsa", "description": "Albóndigas tiernas con salsa de tomate.", "servings": 4, "estimated_minutes": 45, "estimated_cost": 8.6, "tags": ["carne", "tradicional", "salsa"], "ingredients": [{"name": "Albóndigas de carne", "quantity": 600, "unit": "g", "product_query": "albóndigas"}, {"name": "Tomate frito", "quantity": 400, "unit": "g", "product_query": "tomate frito"}, {"name": "Cebolla", "quantity": 1, "unit": "ud", "product_query": "cebolla"}, {"name": "Zanahoria", "quantity": 2, "unit": "uds", "product_query": "zanahoria"}, {"name": "Guisantes", "quantity": 150, "unit": "g", "product_query": "guisantes"}, {"name": "Aceite de oliva", "quantity": 3, "unit": "cucharadas", "product_query": "aceite oliva"}]},
    {"title": "Pechugas de Pollo al Limón", "description": "Pollo jugoso con salsa ligera de limón y ajo.", "servings": 4, "estimated_minutes": 25, "estimated_cost": 6.7, "tags": ["pollo", "rápida", "plancha"], "ingredients": [{"name": "Pechuga de pollo", "quantity": 600, "unit": "g", "product_query": "pechuga pollo"}, {"name": "Limón", "quantity": 2, "unit": "uds", "product_query": "limón"}, {"name": "Ajo", "quantity": 3, "unit": "dientes", "product_query": "ajo"}, {"name": "Mantequilla", "quantity": 30, "unit": "g", "product_query": "mantequilla"}, {"name": "Aceite de oliva", "quantity": 2, "unit": "cucharadas", "product_query": "aceite oliva"}, {"name": "Perejil", "quantity": 1, "unit": "manojo", "product_query": "perejil"}]},
    {"title": "Arroz Tres Delicias", "description": "Arroz salteado con huevo, jamón, guisantes y zanahoria.", "servings": 4, "estimated_minutes": 25, "estimated_cost": 5.6, "tags": ["arroz", "rápida", "asiática"], "ingredients": [{"name": "Arroz largo", "quantity": 300, "unit": "g", "product_query": "arroz largo"}, {"name": "Huevos", "quantity": 2, "unit": "uds", "product_query": "huevos"}, {"name": "Jamón cocido", "quantity": 150, "unit": "g", "product_query": "jamón cocido"}, {"name": "Guisantes", "quantity": 100, "unit": "g", "product_query": "guisantes"}, {"name": "Zanahoria", "quantity": 2, "unit": "uds", "product_query": "zanahoria"}, {"name": "Salsa soja", "quantity": 2, "unit": "cucharadas", "product_query": "salsa soja"}]},
    {"title": "Paella de Verduras", "description": "Paella sencilla con verduras y caldo sabroso.", "servings": 4, "estimated_minutes": 40, "estimated_cost": 6.2, "tags": ["arroz", "verduras", "mediterránea"], "ingredients": [{"name": "Arroz redondo", "quantity": 320, "unit": "g", "product_query": "arroz redondo"}, {"name": "Judías verdes", "quantity": 200, "unit": "g", "product_query": "judías verdes"}, {"name": "Alcachofas", "quantity": 200, "unit": "g", "product_query": "alcachofas"}, {"name": "Pimiento rojo", "quantity": 1, "unit": "ud", "product_query": "pimiento rojo"}, {"name": "Tomate triturado", "quantity": 150, "unit": "g", "product_query": "tomate triturado"}, {"name": "Caldo de verduras", "quantity": 800, "unit": "ml", "product_query": "caldo verduras"}]},
    {"title": "Risotto de Champiñones", "description": "Arroz cremoso con champiñones y parmesano.", "servings": 4, "estimated_minutes": 35, "estimated_cost": 7.3, "tags": ["arroz", "italiana", "setas"], "ingredients": [{"name": "Arroz risotto", "quantity": 320, "unit": "g", "product_query": "arroz risotto"}, {"name": "Champiñones", "quantity": 300, "unit": "g", "product_query": "champiñones"}, {"name": "Cebolla", "quantity": 1, "unit": "ud", "product_query": "cebolla"}, {"name": "Caldo de verduras", "quantity": 900, "unit": "ml", "product_query": "caldo verduras"}, {"name": "Queso parmesano", "quantity": 80, "unit": "g", "product_query": "queso parmesano"}, {"name": "Mantequilla", "quantity": 40, "unit": "g", "product_query": "mantequilla"}]},
    {"title": "Quiche de Espinacas y Queso", "description": "Tarta salada con espinacas y queso.", "servings": 6, "estimated_minutes": 45, "estimated_cost": 7.5, "tags": ["horno", "verduras", "vegetariana"], "ingredients": [{"name": "Masa quebrada", "quantity": 1, "unit": "ud", "product_query": "masa quebrada"}, {"name": "Espinacas", "quantity": 300, "unit": "g", "product_query": "espinacas"}, {"name": "Huevos", "quantity": 3, "unit": "uds", "product_query": "huevos"}, {"name": "Nata para cocinar", "quantity": 200, "unit": "ml", "product_query": "nata cocinar"}, {"name": "Queso de cabra", "quantity": 100, "unit": "g", "product_query": "queso cabra"}, {"name": "Cebolla", "quantity": 1, "unit": "ud", "product_query": "cebolla"}]},
    {"title": "Pizza Casera de Jamón y Queso", "description": "Pizza fácil con tomate, mozzarella y jamón cocido.", "servings": 4, "estimated_minutes": 30, "estimated_cost": 6.8, "tags": ["pizza", "horno", "familiar"], "ingredients": [{"name": "Masa pizza", "quantity": 1, "unit": "ud", "product_query": "masa pizza"}, {"name": "Tomate frito", "quantity": 120, "unit": "g", "product_query": "tomate frito"}, {"name": "Queso mozzarella rallado", "quantity": 180, "unit": "g", "product_query": "queso mozzarella"}, {"name": "Jamón cocido", "quantity": 120, "unit": "g", "product_query": "jamón cocido"}, {"name": "Orégano", "quantity": None, "unit": "al gusto", "product_query": "orégano"}]},
    {"title": "Burritos de Ternera", "description": "Burritos rellenos de ternera, arroz y verduras.", "servings": 4, "estimated_minutes": 30, "estimated_cost": 8.9, "tags": ["mexicana", "carne", "wrap"], "ingredients": [{"name": "Tortillas de trigo", "quantity": 8, "unit": "uds", "product_query": "tortillas trigo"}, {"name": "Carne picada de ternera", "quantity": 400, "unit": "g", "product_query": "carne picada ternera"}, {"name": "Arroz largo", "quantity": 200, "unit": "g", "product_query": "arroz largo"}, {"name": "Alubias cocidas", "quantity": 250, "unit": "g", "product_query": "alubias cocidas"}, {"name": "Pimiento rojo", "quantity": 1, "unit": "ud", "product_query": "pimiento rojo"}, {"name": "Maíz dulce", "quantity": 100, "unit": "g", "product_query": "maíz dulce"}]},
    {"title": "Cuscús con Verduras", "description": "Cuscús ligero con verduras y garbanzos.", "servings": 4, "estimated_minutes": 20, "estimated_cost": 4.9, "tags": ["verduras", "rápida", "vegana"], "ingredients": [{"name": "Cuscús", "quantity": 250, "unit": "g", "product_query": "cuscús"}, {"name": "Calabacín", "quantity": 1, "unit": "ud", "product_query": "calabacín"}, {"name": "Zanahoria", "quantity": 2, "unit": "uds", "product_query": "zanahoria"}, {"name": "Cebolla", "quantity": 1, "unit": "ud", "product_query": "cebolla"}, {"name": "Garbanzos cocidos", "quantity": 200, "unit": "g", "product_query": "garbanzos cocidos"}, {"name": "Caldo de verduras", "quantity": 250, "unit": "ml", "product_query": "caldo verduras"}]},
    {"title": "Puré de Calabaza", "description": "Crema suave de calabaza con cebolla y zanahoria.", "servings": 4, "estimated_minutes": 30, "estimated_cost": 4.2, "tags": ["crema", "verduras", "otoño"], "ingredients": [{"name": "Calabaza", "quantity": 700, "unit": "g", "product_query": "calabaza"}, {"name": "Zanahoria", "quantity": 2, "unit": "uds", "product_query": "zanahoria"}, {"name": "Cebolla", "quantity": 1, "unit": "ud", "product_query": "cebolla"}, {"name": "Patata", "quantity": 1, "unit": "ud", "product_query": "patatas"}, {"name": "Caldo de verduras", "quantity": 700, "unit": "ml", "product_query": "caldo verduras"}, {"name": "Quesitos", "quantity": 2, "unit": "uds", "product_query": "quesitos"}]},
    {"title": "Brochetas de Pollo y Verduras", "description": "Brochetas marinadas con pollo, pimiento y cebolla.", "servings": 4, "estimated_minutes": 25, "estimated_cost": 7.1, "tags": ["pollo", "plancha", "verano"], "ingredients": [{"name": "Pechuga de pollo", "quantity": 500, "unit": "g", "product_query": "pechuga pollo"}, {"name": "Pimiento rojo", "quantity": 1, "unit": "ud", "product_query": "pimiento rojo"}, {"name": "Pimiento verde", "quantity": 1, "unit": "ud", "product_query": "pimiento verde"}, {"name": "Cebolla", "quantity": 1, "unit": "ud", "product_query": "cebolla"}, {"name": "Salsa soja", "quantity": 2, "unit": "cucharadas", "product_query": "salsa soja"}, {"name": "Aceite de oliva", "quantity": 1, "unit": "cucharada", "product_query": "aceite oliva"}]},
    {"title": "Tacos de Pescado", "description": "Tacos suaves de pescado con col y yogur.", "servings": 4, "estimated_minutes": 25, "estimated_cost": 8.4, "tags": ["mexicana", "pescado", "rápida"], "ingredients": [{"name": "Tortillas de maíz", "quantity": 8, "unit": "uds", "product_query": "tortillas maíz"}, {"name": "Filetes de merluza", "quantity": 500, "unit": "g", "product_query": "merluza filetes"}, {"name": "Col", "quantity": 200, "unit": "g", "product_query": "col"}, {"name": "Yogur natural", "quantity": 2, "unit": "uds", "product_query": "yogur natural"}, {"name": "Limón", "quantity": 1, "unit": "ud", "product_query": "limón"}, {"name": "Pimentón dulce", "quantity": 1, "unit": "cucharadita", "product_query": "pimentón dulce"}]},
    {"title": "Moussaka Rápida", "description": "Versión sencilla de moussaka con berenjena y carne.", "servings": 4, "estimated_minutes": 50, "estimated_cost": 9.4, "tags": ["horno", "carne", "berenjena"], "ingredients": [{"name": "Berenjena", "quantity": 2, "unit": "uds", "product_query": "berenjena"}, {"name": "Carne picada mixta", "quantity": 400, "unit": "g", "product_query": "carne picada"}, {"name": "Tomate triturado", "quantity": 300, "unit": "g", "product_query": "tomate triturado"}, {"name": "Bechamel lista", "quantity": 400, "unit": "ml", "product_query": "bechamel"}, {"name": "Cebolla", "quantity": 1, "unit": "ud", "product_query": "cebolla"}, {"name": "Queso rallado", "quantity": 120, "unit": "g", "product_query": "queso rallado"}]},
    {"title": "Bacalao con Tomate", "description": "Lomos de bacalao en salsa de tomate y pimiento.", "servings": 4, "estimated_minutes": 35, "estimated_cost": 11.2, "tags": ["pescado", "tradicional", "salsa"], "ingredients": [{"name": "Lomos de bacalao", "quantity": 600, "unit": "g", "product_query": "bacalao lomos"}, {"name": "Tomate triturado", "quantity": 400, "unit": "g", "product_query": "tomate triturado"}, {"name": "Pimiento rojo", "quantity": 1, "unit": "ud", "product_query": "pimiento rojo"}, {"name": "Cebolla", "quantity": 1, "unit": "ud", "product_query": "cebolla"}, {"name": "Ajo", "quantity": 2, "unit": "dientes", "product_query": "ajo"}, {"name": "Aceite de oliva", "quantity": 3, "unit": "cucharadas", "product_query": "aceite oliva"}]},
    {"title": "Ensalada César con Pollo", "description": "Ensalada completa con pollo, lechuga y parmesano.", "servings": 2, "estimated_minutes": 20, "estimated_cost": 6.2, "tags": ["ensalada", "pollo", "rápida"], "ingredients": [{"name": "Lechuga romana", "quantity": 1, "unit": "ud", "product_query": "lechuga romana"}, {"name": "Pechuga de pollo", "quantity": 250, "unit": "g", "product_query": "pechuga pollo"}, {"name": "Queso parmesano", "quantity": 40, "unit": "g", "product_query": "queso parmesano"}, {"name": "Picatostes", "quantity": 80, "unit": "g", "product_query": "picatostes"}, {"name": "Salsa césar", "quantity": 1, "unit": "ud", "product_query": "salsa césar"}]},
    {"title": "Tabulé", "description": "Ensalada fresca de cuscús con tomate y pepino.", "servings": 4, "estimated_minutes": 15, "estimated_cost": 4.6, "tags": ["ensalada", "verano", "ligera"], "ingredients": [{"name": "Cuscús", "quantity": 250, "unit": "g", "product_query": "cuscús"}, {"name": "Tomate", "quantity": 2, "unit": "uds", "product_query": "tomate"}, {"name": "Pepino", "quantity": 1, "unit": "ud", "product_query": "pepino"}, {"name": "Cebolleta", "quantity": 1, "unit": "ud", "product_query": "cebolleta"}, {"name": "Limón", "quantity": 1, "unit": "ud", "product_query": "limón"}, {"name": "Hierbabuena", "quantity": 1, "unit": "manojo", "product_query": "hierbabuena"}]},
    {"title": "Pisto con Huevo", "description": "Verduras pochadas con tomate y huevo.", "servings": 4, "estimated_minutes": 35, "estimated_cost": 5.3, "tags": ["verduras", "huevos", "tradicional"], "ingredients": [{"name": "Calabacín", "quantity": 1, "unit": "ud", "product_query": "calabacín"}, {"name": "Berenjena", "quantity": 1, "unit": "ud", "product_query": "berenjena"}, {"name": "Pimiento rojo", "quantity": 1, "unit": "ud", "product_query": "pimiento rojo"}, {"name": "Pimiento verde", "quantity": 1, "unit": "ud", "product_query": "pimiento verde"}, {"name": "Tomate triturado", "quantity": 400, "unit": "g", "product_query": "tomate triturado"}, {"name": "Huevos", "quantity": 4, "unit": "uds", "product_query": "huevos"}]},
    {"title": "Berenjenas Rellenas", "description": "Berenjenas al horno rellenas de carne y queso.", "servings": 4, "estimated_minutes": 50, "estimated_cost": 7.6, "tags": ["horno", "berenjena", "carne"], "ingredients": [{"name": "Berenjena", "quantity": 2, "unit": "uds", "product_query": "berenjena"}, {"name": "Carne picada mixta", "quantity": 300, "unit": "g", "product_query": "carne picada"}, {"name": "Cebolla", "quantity": 1, "unit": "ud", "product_query": "cebolla"}, {"name": "Tomate frito", "quantity": 200, "unit": "g", "product_query": "tomate frito"}, {"name": "Queso rallado", "quantity": 120, "unit": "g", "product_query": "queso rallado"}]},
    {"title": "Croquetas de Jamón", "description": "Croquetas cremosas de jamón.", "servings": 6, "estimated_minutes": 60, "estimated_cost": 5.8, "tags": ["aperitivo", "jamón", "tradicional"], "ingredients": [{"name": "Jamón serrano", "quantity": 150, "unit": "g", "product_query": "jamón serrano"}, {"name": "Harina", "quantity": 100, "unit": "g", "product_query": "harina trigo"}, {"name": "Leche", "quantity": 800, "unit": "ml", "product_query": "leche entera"}, {"name": "Mantequilla", "quantity": 80, "unit": "g", "product_query": "mantequilla"}, {"name": "Pan rallado", "quantity": 200, "unit": "g", "product_query": "pan rallado"}, {"name": "Huevos", "quantity": 2, "unit": "uds", "product_query": "huevos"}]},
    {"title": "Empanada de Atún", "description": "Empanada salada con atún, tomate y pimiento.", "servings": 6, "estimated_minutes": 40, "estimated_cost": 7.2, "tags": ["horno", "atún", "familiar"], "ingredients": [{"name": "Masa empanada", "quantity": 2, "unit": "uds", "product_query": "masa empanada"}, {"name": "Atún en aceite", "quantity": 240, "unit": "g", "product_query": "atún aceite"}, {"name": "Tomate frito", "quantity": 200, "unit": "g", "product_query": "tomate frito"}, {"name": "Pimiento rojo", "quantity": 1, "unit": "ud", "product_query": "pimiento rojo"}, {"name": "Cebolla", "quantity": 1, "unit": "ud", "product_query": "cebolla"}, {"name": "Huevos", "quantity": 1, "unit": "ud", "product_query": "huevos"}]},
    {"title": "Sopa de Pollo con Fideos", "description": "Sopa reconfortante con pollo y fideos finos.", "servings": 4, "estimated_minutes": 30, "estimated_cost": 4.9, "tags": ["sopa", "pollo", "invierno"], "ingredients": [{"name": "Caldo de pollo", "quantity": 1200, "unit": "ml", "product_query": "caldo pollo"}, {"name": "Fideos finos", "quantity": 120, "unit": "g", "product_query": "fideos sopa"}, {"name": "Pechuga de pollo", "quantity": 250, "unit": "g", "product_query": "pechuga pollo"}, {"name": "Zanahoria", "quantity": 1, "unit": "ud", "product_query": "zanahoria"}, {"name": "Apio", "quantity": 1, "unit": "rama", "product_query": "apio"}]},
    {"title": "Tortilla Francesa con Queso", "description": "Cena rápida con tortilla jugosa y queso fundido.", "servings": 2, "estimated_minutes": 10, "estimated_cost": 2.9, "tags": ["huevos", "rápida", "cena"], "ingredients": [{"name": "Huevos", "quantity": 4, "unit": "uds", "product_query": "huevos"}, {"name": "Queso rallado", "quantity": 80, "unit": "g", "product_query": "queso rallado"}, {"name": "Mantequilla", "quantity": 10, "unit": "g", "product_query": "mantequilla"}, {"name": "Sal", "quantity": None, "unit": "al gusto", "product_query": "sal"}]},
    {"title": "Wrap de Pavo y Aguacate", "description": "Wrap fresco con pavo, aguacate y queso crema.", "servings": 2, "estimated_minutes": 10, "estimated_cost": 4.7, "tags": ["wrap", "rápida", "fría"], "ingredients": [{"name": "Tortillas de trigo", "quantity": 4, "unit": "uds", "product_query": "tortillas trigo"}, {"name": "Fiambre de pavo", "quantity": 150, "unit": "g", "product_query": "fiambre pavo"}, {"name": "Aguacate", "quantity": 1, "unit": "ud", "product_query": "aguacate"}, {"name": "Queso crema", "quantity": 80, "unit": "g", "product_query": "queso crema"}, {"name": "Lechuga", "quantity": 1, "unit": "ud", "product_query": "lechuga"}]},
    {"title": "Pollo Asado con Verduras", "description": "Bandeja al horno con pollo, patatas y verduras.", "servings": 4, "estimated_minutes": 70, "estimated_cost": 9.5, "tags": ["horno", "pollo", "familiar"], "ingredients": [{"name": "Muslos de pollo", "quantity": 1000, "unit": "g", "product_query": "muslos pollo"}, {"name": "Patatas", "quantity": 700, "unit": "g", "product_query": "patatas"}, {"name": "Zanahoria", "quantity": 2, "unit": "uds", "product_query": "zanahoria"}, {"name": "Cebolla", "quantity": 1, "unit": "ud", "product_query": "cebolla"}, {"name": "Pimiento rojo", "quantity": 1, "unit": "ud", "product_query": "pimiento rojo"}, {"name": "Aceite de oliva", "quantity": 3, "unit": "cucharadas", "product_query": "aceite oliva"}]},
    {"title": "Pasta al Pesto", "description": "Pasta rápida con salsa pesto y parmesano.", "servings": 4, "estimated_minutes": 15, "estimated_cost": 5.4, "tags": ["pasta", "rápida", "italiana"], "ingredients": [{"name": "Fusilli", "quantity": 400, "unit": "g", "product_query": "fusilli"}, {"name": "Salsa pesto", "quantity": 1, "unit": "ud", "product_query": "salsa pesto"}, {"name": "Queso parmesano", "quantity": 50, "unit": "g", "product_query": "queso parmesano"}, {"name": "Piñones", "quantity": 30, "unit": "g", "product_query": "piñones"}]},
    {"title": "Ñoquis con Salsa de Quesos", "description": "Ñoquis con salsa cremosa de quesos.", "servings": 4, "estimated_minutes": 20, "estimated_cost": 6.1, "tags": ["pasta", "queso", "rápida"], "ingredients": [{"name": "Ñoquis", "quantity": 500, "unit": "g", "product_query": "ñoquis"}, {"name": "Nata para cocinar", "quantity": 200, "unit": "ml", "product_query": "nata cocinar"}, {"name": "Queso azul", "quantity": 80, "unit": "g", "product_query": "queso azul"}, {"name": "Queso rallado", "quantity": 80, "unit": "g", "product_query": "queso rallado"}, {"name": "Pimienta negra", "quantity": None, "unit": "al gusto", "product_query": "pimienta negra"}]},
    {"title": "Sandwich Club", "description": "Sándwich completo de pollo, bacon y tomate.", "servings": 2, "estimated_minutes": 15, "estimated_cost": 5.3, "tags": ["sandwich", "rápida", "cena"], "ingredients": [{"name": "Pan de molde", "quantity": 6, "unit": "rebanadas", "product_query": "pan molde"}, {"name": "Pechuga de pollo", "quantity": 150, "unit": "g", "product_query": "pechuga pollo"}, {"name": "Bacon", "quantity": 80, "unit": "g", "product_query": "bacon"}, {"name": "Lechuga", "quantity": 1, "unit": "ud", "product_query": "lechuga"}, {"name": "Tomate", "quantity": 1, "unit": "ud", "product_query": "tomate"}, {"name": "Mayonesa", "quantity": 2, "unit": "cucharadas", "product_query": "mayonesa"}]},
    {"title": "Gazpacho Andaluz", "description": "Gazpacho fresco con tomate, pepino y pimiento.", "servings": 4, "estimated_minutes": 15, "estimated_cost": 3.9, "tags": ["verano", "fría", "verduras"], "ingredients": [{"name": "Tomate pera", "quantity": 1000, "unit": "g", "product_query": "tomate pera"}, {"name": "Pepino", "quantity": 1, "unit": "ud", "product_query": "pepino"}, {"name": "Pimiento verde", "quantity": 1, "unit": "ud", "product_query": "pimiento verde"}, {"name": "Ajo", "quantity": 1, "unit": "diente", "product_query": "ajo"}, {"name": "Aceite de oliva", "quantity": 60, "unit": "ml", "product_query": "aceite oliva"}, {"name": "Vinagre", "quantity": 1, "unit": "cucharada", "product_query": "vinagre"}]},
    {"title": "Salmorejo Cordobés", "description": "Crema fría espesa de tomate con jamón y huevo.", "servings": 4, "estimated_minutes": 15, "estimated_cost": 4.6, "tags": ["verano", "fría", "tradicional"], "ingredients": [{"name": "Tomate pera", "quantity": 1000, "unit": "g", "product_query": "tomate pera"}, {"name": "Pan", "quantity": 200, "unit": "g", "product_query": "pan"}, {"name": "Aceite de oliva", "quantity": 100, "unit": "ml", "product_query": "aceite oliva"}, {"name": "Jamón serrano", "quantity": 80, "unit": "g", "product_query": "jamón serrano"}, {"name": "Huevos", "quantity": 2, "unit": "uds", "product_query": "huevos"}]},
    {"title": "Revuelto de Setas", "description": "Huevos revueltos con champiñones y ajo.", "servings": 2, "estimated_minutes": 12, "estimated_cost": 3.8, "tags": ["huevos", "setas", "rápida"], "ingredients": [{"name": "Huevos", "quantity": 4, "unit": "uds", "product_query": "huevos"}, {"name": "Champiñones", "quantity": 250, "unit": "g", "product_query": "champiñones"}, {"name": "Ajo", "quantity": 2, "unit": "dientes", "product_query": "ajo"}, {"name": "Aceite de oliva", "quantity": 1, "unit": "cucharada", "product_query": "aceite oliva"}]},
    {"title": "Wok de Ternera y Verduras", "description": "Salteado rápido con tiras de ternera y verduras.", "servings": 4, "estimated_minutes": 20, "estimated_cost": 8.7, "tags": ["wok", "ternera", "rápida"], "ingredients": [{"name": "Filetes de ternera", "quantity": 400, "unit": "g", "product_query": "filetes ternera"}, {"name": "Pimiento rojo", "quantity": 1, "unit": "ud", "product_query": "pimiento rojo"}, {"name": "Pimiento verde", "quantity": 1, "unit": "ud", "product_query": "pimiento verde"}, {"name": "Cebolla", "quantity": 1, "unit": "ud", "product_query": "cebolla"}, {"name": "Zanahoria", "quantity": 2, "unit": "uds", "product_query": "zanahoria"}, {"name": "Salsa soja", "quantity": 3, "unit": "cucharadas", "product_query": "salsa soja"}]},
    {"title": "Quesadillas de Jamón y Queso", "description": "Quesadillas rápidas a la sartén con jamón cocido y queso fundido.", "servings": 4, "estimated_minutes": 15, "estimated_cost": 4.9, "tags": ["mexicana", "rápida", "queso"], "ingredients": [{"name": "Tortillas de trigo", "quantity": 8, "unit": "uds", "product_query": "tortillas trigo"}, {"name": "Jamón cocido", "quantity": 150, "unit": "g", "product_query": "jamón cocido"}, {"name": "Queso rallado", "quantity": 180, "unit": "g", "product_query": "queso rallado"}, {"name": "Tomate", "quantity": 1, "unit": "ud", "product_query": "tomate"}]},
]

SEED_RECIPES.extend(ADDITIONAL_SEED_RECIPES)


class RecipeService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── Seed ──────────────────────────────────────────────────────────────────

    async def ensure_seeds(self) -> None:
        """Insert missing public seed/template recipes without duplicating existing titles."""
        result = await self.db.execute(
            select(Recipe.title).where(Recipe.is_public == True)
        )
        existing_titles = {title for title in result.scalars().all()}
        missing_seeds = [seed for seed in SEED_RECIPES if seed["title"] not in existing_titles]
        if not missing_seeds:
            return

        logger.info("Inserting missing seed recipes...")
        for seed in missing_seeds:
            recipe = Recipe(
                user_id=None,
                title=seed["title"],
                description=seed.get("description"),
                servings=seed.get("servings", 4),
                estimated_minutes=seed.get("estimated_minutes"),
                estimated_cost=seed.get("estimated_cost"),
                tags=seed.get("tags"),
                is_public=True,
            )
            self.db.add(recipe)
            await self.db.flush()

            for pos, ing_data in enumerate(seed.get("ingredients", [])):
                ing = RecipeIngredient(
                    recipe_id=recipe.id,
                    name=ing_data["name"],
                    quantity=ing_data.get("quantity"),
                    unit=ing_data.get("unit"),
                    notes=ing_data.get("notes"),
                    product_query=ing_data.get("product_query"),
                    position=pos,
                )
                self.db.add(ing)

        await self.db.commit()
        logger.info(f"Seeded {len(missing_seeds)} public recipes")

    # ── Helpers ───────────────────────────────────────────────────────────────

    async def _get_recipe_or_404(self, recipe_id: int, user_id: int) -> Recipe:
        result = await self.db.execute(
            select(Recipe)
            .where(
                Recipe.id == recipe_id,
                (Recipe.user_id == user_id) | (Recipe.is_public == True),
            )
            .options(selectinload(Recipe.ingredients))
        )
        recipe = result.scalar_one_or_none()
        if not recipe:
            raise HTTPException(status_code=404, detail="Receta no encontrada")
        return recipe

    async def _get_own_recipe_or_404(self, recipe_id: int, user_id: int) -> Recipe:
        """Get recipe that belongs to this user (for mutations)."""
        result = await self.db.execute(
            select(Recipe)
            .where(Recipe.id == recipe_id, Recipe.user_id == user_id)
            .options(selectinload(Recipe.ingredients))
        )
        recipe = result.scalar_one_or_none()
        if not recipe:
            raise HTTPException(status_code=404, detail="Receta no encontrada o sin permiso")
        return recipe

    def _to_summary(self, recipe: Recipe) -> RecipeSummary:
        return RecipeSummary(
            id=recipe.id,
            user_id=recipe.user_id,
            title=recipe.title,
            description=recipe.description,
            servings=recipe.servings,
            estimated_minutes=recipe.estimated_minutes,
            estimated_cost=recipe.estimated_cost,
            tags=recipe.tags,
            image_url=recipe.image_url,
            is_public=recipe.is_public,
            ingredient_count=len(recipe.ingredients),
            created_at=recipe.created_at,
            updated_at=recipe.updated_at,
        )

    async def _get_user_postal_code(self, user_id: int) -> str:
        result = await self.db.execute(
            select(User.postal_code).where(User.id == user_id)
        )
        postal_code = result.scalar_one_or_none()
        return postal_code or "28001"

    async def _resolve_product_for_ingredient(
        self,
        ingredient: RecipeIngredient,
        postal_code: str,
    ):
        query = (ingredient.product_query or ingredient.name or "").strip()
        if not query:
            return None

        result = await ProductService(self.db).search(
            query=query,
            postal_code=postal_code,
            limit=5,
        )
        if not result.products:
            return None

        return result.products[0]

    # ── CRUD ──────────────────────────────────────────────────────────────────

    async def get_recipes(self, user_id: int) -> List[RecipeSummary]:
        """Return user's own recipes + public seeds."""
        await self.ensure_seeds()
        result = await self.db.execute(
            select(Recipe)
            .where((Recipe.user_id == user_id) | (Recipe.is_public == True))
            .options(selectinload(Recipe.ingredients))
            .order_by(Recipe.is_public.asc(), Recipe.updated_at.desc())
        )
        recipes = result.scalars().all()
        return [self._to_summary(r) for r in recipes]

    async def get_recipe(self, recipe_id: int, user_id: int) -> RecipeRead:
        recipe = await self._get_recipe_or_404(recipe_id, user_id)
        return RecipeRead.model_validate(recipe)

    async def create_recipe(self, user_id: int, data: RecipeCreate) -> RecipeRead:
        recipe = Recipe(
            user_id=user_id,
            title=data.title,
            description=data.description,
            servings=data.servings,
            estimated_minutes=data.estimated_minutes,
            estimated_cost=data.estimated_cost,
            tags=data.tags,
            image_url=data.image_url,
            is_public=False,
        )
        self.db.add(recipe)
        await self.db.flush()

        for pos, ing_data in enumerate(data.ingredients):
            self.db.add(RecipeIngredient(
                recipe_id=recipe.id,
                name=ing_data.name,
                quantity=ing_data.quantity,
                unit=ing_data.unit,
                notes=ing_data.notes,
                product_query=ing_data.product_query,
                position=pos,
            ))

        await self.db.commit()
        await self.db.refresh(recipe)

        # Reload with ingredients
        result = await self.db.execute(
            select(Recipe).where(Recipe.id == recipe.id).options(selectinload(Recipe.ingredients))
        )
        return RecipeRead.model_validate(result.scalar_one())

    async def update_recipe(self, recipe_id: int, user_id: int, data: RecipeUpdate) -> RecipeRead:
        recipe = await self._get_own_recipe_or_404(recipe_id, user_id)

        if data.title is not None:
            recipe.title = data.title
        if data.description is not None:
            recipe.description = data.description
        if data.servings is not None:
            recipe.servings = data.servings
        if data.estimated_minutes is not None:
            recipe.estimated_minutes = data.estimated_minutes
        if data.estimated_cost is not None:
            recipe.estimated_cost = data.estimated_cost
        if data.tags is not None:
            recipe.tags = data.tags
        if data.image_url is not None:
            recipe.image_url = data.image_url

        if data.ingredients is not None:
            # Replace all ingredients
            for ing in list(recipe.ingredients):
                await self.db.delete(ing)
            await self.db.flush()

            for pos, ing_data in enumerate(data.ingredients):
                self.db.add(RecipeIngredient(
                    recipe_id=recipe.id,
                    name=ing_data.name,
                    quantity=ing_data.quantity,
                    unit=ing_data.unit,
                    notes=ing_data.notes,
                    product_query=ing_data.product_query,
                    position=pos,
                ))

        recipe.updated_at = datetime.now(timezone.utc)
        await self.db.commit()

        result = await self.db.execute(
            select(Recipe).where(Recipe.id == recipe.id).options(selectinload(Recipe.ingredients))
        )
        return RecipeRead.model_validate(result.scalar_one())

    async def delete_recipe(self, recipe_id: int, user_id: int) -> None:
        recipe = await self._get_own_recipe_or_404(recipe_id, user_id)
        await self.db.delete(recipe)
        await self.db.commit()

    async def duplicate_recipe(self, recipe_id: int, user_id: int) -> RecipeRead:
        """Copy a recipe (own or public) to the user's collection."""
        source = await self._get_recipe_or_404(recipe_id, user_id)
        data = RecipeCreate(
            title=f"{source.title} (copia)",
            description=source.description,
            servings=source.servings,
            estimated_minutes=source.estimated_minutes,
            estimated_cost=source.estimated_cost,
            tags=source.tags,
            ingredients=[
                type("IngCreate", (), {
                    "name": i.name, "quantity": i.quantity, "unit": i.unit,
                    "notes": i.notes, "product_query": i.product_query, "position": i.position,
                })()
                for i in source.ingredients
            ],
        )
        return await self.create_recipe(user_id, data)

    # ── Add to list ───────────────────────────────────────────────────────────

    async def add_to_list(
        self,
        recipe_id: int,
        user_id: int,
        payload: AddToListPayload,
    ) -> AddToListResult:
        """
        Add recipe ingredients to a shopping list.
        Creates the list if list_id is None.
        Each ingredient becomes a ShoppingListItem (no Mercadona search needed —
        user can search/replace later from ListDetailPage).
        """
        recipe = await self._get_recipe_or_404(recipe_id, user_id)
        postal_code = await self._get_user_postal_code(user_id)

        # Resolve or create target list
        if payload.list_id is not None:
            list_result = await self.db.execute(
                select(ShoppingList).where(
                    ShoppingList.id == payload.list_id,
                    ShoppingList.user_id == user_id,
                )
            )
            target_list = list_result.scalar_one_or_none()
            if not target_list:
                raise HTTPException(status_code=404, detail="Lista no encontrada")
        else:
            name = payload.new_list_name or f"Lista: {recipe.title}"
            target_list = ShoppingList(user_id=user_id, name=name)
            self.db.add(target_list)
            await self.db.flush()

        added_items = []
        skipped = 0
        resolved_real = 0
        resolved_fallback = 0
        unresolved = 0

        # Filter ingredients if caller specified a selection
        ingredients_to_add = recipe.ingredients
        if payload.selected_ingredient_ids is not None:
            id_set = set(payload.selected_ingredient_ids)
            ingredients_to_add = [i for i in recipe.ingredients if i.id in id_set]

        for ing in ingredients_to_add:
            try:
                product = await self._resolve_product_for_ingredient(ing, postal_code)
                product_id = product.id if product else f"recipe_{recipe.id}_ing_{ing.id}"
                adjusted_qty = _infer_cart_quantity(ing, payload.servings_multiplier)
                note = _build_ingredient_note(ing, payload.servings_multiplier)

                existing_result = await self.db.execute(
                    select(ShoppingListItem).where(
                        ShoppingListItem.shopping_list_id == target_list.id,
                        ShoppingListItem.product_id == product_id,
                    )
                )
                item = existing_result.scalar_one_or_none()

                if item:
                    item.quantity += adjusted_qty
                    item.note = _merge_notes(item.note, note)
                    if item.product_price is None and product:
                        item.product_price = product.price
                    if not item.product_unit and product:
                        item.product_unit = product.unit_size
                    if not item.product_thumbnail and product:
                        item.product_thumbnail = product.thumbnail
                    if not item.product_category and product:
                        item.product_category = product.category
                else:
                    item = ShoppingListItem(
                        shopping_list_id=target_list.id,
                        product_id=product_id,
                        product_name=(product.name if product else ing.name),
                        product_price=(product.price if product else None),
                        product_unit=(product.unit_size if product else ing.unit),
                        product_thumbnail=(product.thumbnail if product else None),
                        product_category=(product.category if product else None),
                        quantity=adjusted_qty,
                        is_checked=False,
                        note=note,
                    )
                    self.db.add(item)

                added_items.append(
                    {
                        "name": item.product_name,
                        "quantity": adjusted_qty,
                        "price": item.product_price,
                        "source": getattr(product, "source", "manual") if product else "manual",
                        "resolved": bool(product),
                    }
                )
                if product:
                    if product.source == "fallback":
                        resolved_fallback += 1
                    else:
                        resolved_real += 1
                else:
                    unresolved += 1
            except Exception as e:
                logger.warning(f"Could not add ingredient '{ing.name}': {e}")
                skipped += 1
                unresolved += 1

        await self.db.commit()

        return AddToListResult(
            list_id=target_list.id,
            list_name=target_list.name,
            added=len(added_items),
            skipped=skipped,
            items=added_items,
            resolved_real=resolved_real,
            resolved_fallback=resolved_fallback,
            unresolved=unresolved,
        )

    # ── Pantry suggestions ────────────────────────────────────────────────────

    async def from_pantry_suggestions(self, user_id: int) -> list[PantryRecipeSuggestion]:
        """Return recipes the user can cook based on their pantry items."""
        pantry_result = await self.db.execute(
            select(PantryItem).where(
                PantryItem.user_id == user_id,
                PantryItem.is_consumed == False,
            )
        )
        pantry_items = pantry_result.scalars().all()
        if not pantry_items:
            return []

        pantry_names = [item.name.lower().strip() for item in pantry_items]

        await self.ensure_seeds()
        recipe_result = await self.db.execute(
            select(Recipe)
            .where((Recipe.user_id == user_id) | (Recipe.is_public == True))
            .options(selectinload(Recipe.ingredients))
        )
        recipes = recipe_result.scalars().all()

        suggestions: list[PantryRecipeSuggestion] = []
        for recipe in recipes:
            if not recipe.ingredients:
                continue

            matched: list[str] = []
            missing: list[str] = []
            for ing in recipe.ingredients:
                if _ingredient_in_pantry(ing.name, pantry_names):
                    matched.append(ing.name)
                else:
                    missing.append(ing.name)

            match_pct = len(matched) / len(recipe.ingredients) * 100
            if match_pct > 0:
                suggestions.append(
                    PantryRecipeSuggestion(
                        recipe=self._to_summary(recipe),
                        match_pct=round(match_pct, 1),
                        matched_count=len(matched),
                        missing_count=len(missing),
                        missing_ingredients=missing[:5],
                    )
                )

        suggestions.sort(key=lambda s: (-s.match_pct, s.missing_count))
        return suggestions[:12]


def _ingredient_in_pantry(ingredient_name: str, pantry_names: list[str]) -> bool:
    """Check if an ingredient is covered by any pantry item via substring or token overlap."""
    ing_lower = ingredient_name.lower().strip()
    ing_tokens = set(ing_lower.split())
    for pname in pantry_names:
        if ing_lower in pname or pname in ing_lower:
            return True
        pan_tokens = set(pname.split())
        if ing_tokens & pan_tokens:
            return True
    return False


def _infer_cart_quantity(ing: RecipeIngredient, servings_multiplier: float) -> int:
    """
    Convert recipe amounts into purchase units.
    Weighted or volume ingredients default to one pack. Discrete units scale up.
    """
    scaled_quantity = (ing.quantity or 1.0) * servings_multiplier
    unit = (ing.unit or "").strip().lower()
    discrete_units = {"ud", "uds", "unidad", "unidades", "huevo", "huevos"}

    if unit in discrete_units and ing.quantity is not None:
        return max(1, math.ceil(scaled_quantity))

    return 1


def _build_ingredient_note(ing: RecipeIngredient, servings_multiplier: float) -> Optional[str]:
    details: List[str] = []

    if ing.quantity is not None:
        scaled_quantity = ing.quantity * servings_multiplier
        quantity_text = f"{scaled_quantity:g}"
        if ing.unit:
            quantity_text = f"{quantity_text} {ing.unit}"
        details.append(f"Cantidad receta: {quantity_text}")
    elif ing.unit:
        details.append(f"Unidad receta: {ing.unit}")

    if ing.product_query and ing.product_query.strip().lower() != ing.name.strip().lower():
        details.append(f"Búsqueda: {ing.product_query}")

    if ing.notes:
        details.append(ing.notes)

    return " | ".join(details) if details else None


def _merge_notes(current: Optional[str], incoming: Optional[str]) -> Optional[str]:
    if not incoming:
        return current
    if not current:
        return incoming
    if incoming in current:
        return current
    return f"{current} | {incoming}"
