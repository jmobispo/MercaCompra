"""
Recipe service — CRUD, add-to-list, and seed data.
"""
import asyncio
import logging
import math
import re
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
from app.services.habit_service import HabitService
from app.services.recipe_seed_nutrition import SEED_RECIPE_NUTRITION, LEGACY_RECIPE_NUTRITION
from app.services.pantry_support import (
    convert_amount,
    names_match,
    normalize_unit,
    pantry_total_in_unit,
    parse_measurement_text,
    units_compatible,
)
from app.services.product_service import ProductService
from app.utils.recipe_images import (
    build_recipe_image_url,
    delete_recipe_image_file,
    get_recipe_upload_dir,
    is_local_recipe_image_url,
)

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

SEED_RECIPE_STEPS = {
    "Espaguetis a la Carbonara": [
        "Cuece los espaguetis en agua con sal hasta que queden al dente.",
        "Dora el bacon o guanciale en una sartén sin quemarlo.",
        "Bate los huevos con el parmesano y bastante pimienta negra.",
        "Mezcla la pasta caliente con el bacon fuera del fuego.",
        "Añade la mezcla de huevo y queso removiendo rápido para que quede cremosa.",
    ],
    "Macarrones con Tomate y Queso": [
        "Cuece los macarrones y escúrrelos.",
        "Mézclalos con tomate frito, orégano y un poco de aceite.",
        "Pásalos a una fuente apta para horno.",
        "Cubre con mozzarella y parmesano.",
        "Hornea hasta que el queso se funda y gratina ligeramente.",
    ],
    "Tortilla de Patatas": [
        "Pela y corta las patatas y la cebolla.",
        "Fríelas a fuego medio en abundante aceite hasta que estén tiernas.",
        "Escúrrelas y mézclalas con los huevos batidos y sal.",
        "Cuaja la mezcla en una sartén por un lado.",
        "Da la vuelta a la tortilla y termina de cuajar al gusto.",
    ],
    "Arroz con Pollo": [
        "Sofríe ajo, cebolla y pimiento con aceite.",
        "Añade el pollo troceado y dóralo.",
        "Incorpora tomate y pimentón.",
        "Añade el arroz y rehógalo un minuto.",
        "Vierte el caldo, ajusta sal y cocina hasta que el arroz esté hecho.",
    ],
    "Pasta Boloñesa": [
        "Sofríe cebolla, zanahoria y ajo picados.",
        "Añade la carne picada y dóralo bien.",
        "Incorpora tomate triturado y vino tinto.",
        "Cocina la salsa a fuego medio-lento hasta que espese.",
        "Cuece la pasta y sírvela con la boloñesa y parmesano.",
    ],
    "Ensalada Mixta": [
        "Lava y corta la lechuga, el tomate y la cebolla.",
        "Colócalos en una fuente.",
        "Añade el atún escurrido y las aceitunas.",
        "Aliña con aceite, vinagre y sal.",
        "Mezcla justo antes de servir.",
    ],
    "Lasaña de Carne": [
        "Sofríe cebolla y cocina la carne picada.",
        "Añade tomate frito y cocina unos minutos.",
        "Monta capas de pasta, carne y bechamel.",
        "Termina con mozzarella y parmesano.",
        "Hornea hasta que esté caliente y gratinada.",
    ],
    "Crema de Verduras": [
        "Sofríe cebolla con un poco de aceite.",
        "Añade calabacín, zanahoria y patata troceados.",
        "Cubre con caldo y cocina hasta que todo esté tierno.",
        "Tritura hasta obtener una crema fina.",
        "Añade nata, salpimenta y da un hervor final.",
    ],
    "Pollo al Curry con Arroz": [
        "Cuece el arroz y resérvalo.",
        "Sofríe cebolla y añade el pollo troceado.",
        "Incorpora curry y remueve.",
        "Añade la leche de coco y cocina hasta espesar.",
        "Sirve el pollo al curry con el arroz aparte o debajo.",
    ],
    "Fajitas de Pollo": [
        "Corta pollo, cebolla y pimientos en tiras.",
        "Saltea primero el pollo.",
        "Añade las verduras y el sazonador.",
        "Cocina hasta que todo esté bien hecho pero jugoso.",
        "Rellena las tortillas y sírvelas calientes.",
    ],
    "Chili con Carne": [
        "Sofríe la cebolla.",
        "Añade la carne y dóralo.",
        "Incorpora tomate, alubias, maíz y comino.",
        "Cocina a fuego medio hasta que espese.",
        "Sirve caliente solo o con arroz.",
    ],
    "Lentejas Estofadas": [
        "Prepara las verduras troceadas.",
        "Pon lentejas, verduras, chorizo y patata en la olla.",
        "Cubre con agua y añade sal.",
        "Cocina hasta que las lentejas estén tiernas.",
        "Corrige el punto de caldo y sirve caliente.",
    ],
    "Garbanzos con Espinacas": [
        "Sofríe cebolla y ajo.",
        "Añade tomate triturado y comino.",
        "Incorpora las espinacas y deja que bajen.",
        "Añade los garbanzos cocidos.",
        "Cocina unos minutos hasta integrar sabores.",
    ],
    "Merluza al Horno con Patatas": [
        "Corta patatas y cebolla en rodajas finas.",
        "Colócalas en una fuente y hornéalas con aceite.",
        "Añade la merluza, ajo y limón.",
        "Hornea hasta que el pescado esté hecho.",
        "Sirve con el jugo de la bandeja por encima.",
    ],
    "Salmón con Verduras": [
        "Corta las verduras en tiras o rodajas.",
        "Saltéalas hasta que queden tiernas pero enteras.",
        "Cocina el salmón a la plancha o al horno.",
        "Añade limón al final.",
        "Sirve el salmón con las verduras salteadas.",
    ],
    "Hamburguesas Caseras con Patatas": [
        "Forma las hamburguesas con la carne.",
        "Corta y cocina las patatas fritas o al horno.",
        "Cocina las hamburguesas en sartén o plancha.",
        "Monta el pan con lechuga, tomate y queso.",
        "Sirve con las patatas.",
    ],
    "Albóndigas en Salsa": [
        "Doura ligeramente las albóndigas.",
        "Sofríe cebolla y zanahoria.",
        "Añade tomate frito y un poco de agua si hace falta.",
        "Incorpora guisantes y albóndigas.",
        "Cocina hasta que la salsa espese y las albóndigas estén tiernas.",
    ],
    "Pechugas de Pollo al Limón": [
        "Dora el pollo en aceite.",
        "Añade ajo picado.",
        "Incorpora zumo de limón y mantequilla.",
        "Cocina unos minutos para ligar la salsa.",
        "Termina con perejil picado.",
    ],
    "Arroz Tres Delicias": [
        "Cuece el arroz y enfríalo.",
        "Haz una tortilla fina con los huevos y córtala.",
        "Saltea zanahoria y guisantes.",
        "Añade jamón y arroz.",
        "Incorpora huevo y salsa de soja al final.",
    ],
    "Paella de Verduras": [
        "Sofríe pimiento, judías y alcachofas.",
        "Añade tomate triturado.",
        "Incorpora el arroz y rehoga.",
        "Vierte el caldo y cocina sin remover demasiado.",
        "Deja reposar unos minutos antes de servir.",
    ],
    "Risotto de Champiñones": [
        "Sofríe cebolla y champiñones.",
        "Añade el arroz y remueve.",
        "Ve incorporando el caldo caliente poco a poco.",
        "Remueve constantemente hasta que quede meloso.",
        "Termina con mantequilla y parmesano.",
    ],
    "Quiche de Espinacas y Queso": [
        "Forra un molde con la masa quebrada.",
        "Sofríe la cebolla y añade las espinacas.",
        "Mezcla huevos, nata y queso.",
        "Reparte el relleno sobre la masa.",
        "Hornea hasta que cuaje y se dore.",
    ],
    "Pizza Casera de Jamón y Queso": [
        "Extiende la masa.",
        "Cubre con tomate frito.",
        "Añade mozzarella y jamón cocido.",
        "Espolvorea orégano.",
        "Hornea hasta que la base esté hecha y el queso fundido.",
    ],
    "Burritos de Ternera": [
        "Cuece el arroz.",
        "Cocina la carne con el pimiento.",
        "Añade alubias y maíz.",
        "Rellena las tortillas con arroz y mezcla de carne.",
        "Enrolla y sirve.",
    ],
    "Cuscús con Verduras": [
        "Hidrata el cuscús con caldo caliente.",
        "Sofríe cebolla, zanahoria y calabacín.",
        "Añade los garbanzos.",
        "Mezcla todo con el cuscús.",
        "Ajusta sal y sirve.",
    ],
    "Puré de Calabaza": [
        "Sofríe cebolla.",
        "Añade calabaza, patata y zanahoria.",
        "Cubre con caldo y cocina.",
        "Tritura hasta que quede fino.",
        "Añade los quesitos y mezcla.",
    ],
    "Brochetas de Pollo y Verduras": [
        "Corta pollo y verduras en trozos regulares.",
        "Marina con soja y aceite.",
        "Inserta en brochetas alternando ingredientes.",
        "Cocina en plancha, sartén o horno.",
        "Sirve recién hechas.",
    ],
    "Tacos de Pescado": [
        "Cocina la merluza con limón y pimentón.",
        "Corta la col muy fina.",
        "Mezcla yogur con un poco de limón.",
        "Calienta las tortillas.",
        "Monta los tacos con pescado, col y salsa.",
    ],
    "Moussaka Rápida": [
        "Corta y cocina la berenjena a la plancha o al horno.",
        "Sofríe cebolla y cocina la carne.",
        "Añade tomate triturado.",
        "Monta capas de berenjena, carne y bechamel.",
        "Cubre con queso y hornea.",
    ],
    "Bacalao con Tomate": [
        "Sofríe cebolla, ajo y pimiento.",
        "Añade tomate triturado y cocina la salsa.",
        "Incorpora el bacalao.",
        "Cocina unos minutos hasta que el pescado esté en su punto.",
        "Sirve caliente con salsa abundante.",
    ],
    "Ensalada César con Pollo": [
        "Cocina el pollo a la plancha.",
        "Lava y corta la lechuga.",
        "Mezcla lechuga, pollo, picatostes y parmesano.",
        "Añade la salsa César.",
        "Sirve enseguida.",
    ],
    "Tabulé": [
        "Hidrata el cuscús.",
        "Corta tomate, pepino y cebolleta en pequeño.",
        "Pica la hierbabuena.",
        "Mezcla todo con zumo de limón.",
        "Enfría antes de servir.",
    ],
    "Pisto con Huevo": [
        "Corta todas las verduras en dados.",
        "Sofríelas poco a poco hasta que estén tiernas.",
        "Añade tomate triturado y cocina.",
        "Fríe o cuaja los huevos aparte.",
        "Sirve el pisto con huevo encima.",
    ],
    "Berenjenas Rellenas": [
        "Parte las berenjenas y ásalas o cuécelas ligeramente.",
        "Vacía parte de la pulpa.",
        "Sofríe cebolla, carne y pulpa troceada.",
        "Añade tomate y rellena las berenjenas.",
        "Cubre con queso y hornea.",
    ],
    "Croquetas de Jamón": [
        "Derrite mantequilla y añade harina para hacer roux.",
        "Incorpora la leche poco a poco removiendo.",
        "Añade el jamón y cocina hasta espesar.",
        "Enfría la masa por completo.",
        "Forma, empana y fríe las croquetas.",
    ],
    "Empanada de Atún": [
        "Sofríe cebolla y pimiento.",
        "Añade tomate y atún.",
        "Extiende una masa y coloca el relleno.",
        "Cubre con la otra masa y pincela con huevo.",
        "Hornea hasta que esté dorada.",
    ],
    "Sopa de Pollo con Fideos": [
        "Cuece el caldo con pollo y verduras.",
        "Saca y desmenuza el pollo si hace falta.",
        "Vuelve a incorporarlo al caldo.",
        "Añade los fideos.",
        "Cocina hasta que estén tiernos y sirve.",
    ],
    "Tortilla Francesa con Queso": [
        "Bate los huevos con sal.",
        "Funde un poco de mantequilla en la sartén.",
        "Añade el huevo.",
        "Incorpora el queso antes de cerrar.",
        "Dobla la tortilla y sirve.",
    ],
    "Wrap de Pavo y Aguacate": [
        "Unta las tortillas con queso crema.",
        "Coloca lechuga, pavo y aguacate.",
        "Ajusta sal si hace falta.",
        "Enrolla bien el wrap.",
        "Corta y sirve.",
    ],
    "Pollo Asado con Verduras": [
        "Coloca patata y verduras en una bandeja.",
        "Pon el pollo encima.",
        "Aliña con aceite y sal.",
        "Hornea hasta que el pollo esté dorado y hecho.",
        "Riega con sus jugos antes de servir.",
    ],
    "Pasta al Pesto": [
        "Cuece la pasta.",
        "Escúrrela reservando algo de agua de cocción.",
        "Mezcla con la salsa pesto.",
        "Añade parmesano.",
        "Termina con piñones.",
    ],
    "Ñoquis con Salsa de Quesos": [
        "Cuece los ñoquis según el envase.",
        "Calienta la nata.",
        "Añade los quesos y remueve hasta fundir.",
        "Mezcla con los ñoquis.",
        "Ajusta pimienta y sirve.",
    ],
    "Sandwich Club": [
        "Cocina el bacon y el pollo.",
        "Tuesta el pan.",
        "Coloca mayonesa, lechuga, tomate, pollo y bacon en capas.",
        "Cierra el sándwich.",
        "Corta y sirve.",
    ],
    "Gazpacho Andaluz": [
        "Trocea tomate, pepino, pimiento y ajo.",
        "Tritura todo junto.",
        "Añade aceite y vinagre.",
        "Ajusta textura con agua si hace falta.",
        "Enfría antes de servir.",
    ],
    "Salmorejo Cordobés": [
        "Tritura tomate y pan.",
        "Añade aceite poco a poco hasta emulsionar.",
        "Ajusta sal y enfría.",
        "Cuece los huevos.",
        "Sirve con jamón y huevo picado.",
    ],
    "Revuelto de Setas": [
        "Saltea el ajo y los champiñones.",
        "Bate los huevos.",
        "Añade los huevos a la sartén.",
        "Remueve suavemente hasta cuajar.",
        "Sirve de inmediato.",
    ],
    "Wok de Ternera y Verduras": [
        "Corta la ternera en tiras.",
        "Saltea las verduras a fuego fuerte.",
        "Añade la ternera.",
        "Incorpora salsa de soja.",
        "Cocina poco tiempo para que quede jugoso.",
    ],
    "Quesadillas de Jamón y Queso": [
        "Coloca queso y jamón sobre una tortilla.",
        "Cubre con otra tortilla o dóblala.",
        "Cocina en sartén por un lado.",
        "Dale la vuelta hasta que el queso funda.",
        "Corta y sirve.",
    ],
}


def _seed_title_key(value: str) -> str:
    normalized = value.lower()
    replacements = {
        "ã¡": "a", "ã ": "a", "ã¤": "a", "ã£": "a",
        "ã©": "e", "ã¨": "e", "ã«": "e",
        "ã­": "i", "ã¬": "i", "ã¯": "i",
        "ã³": "o", "ã²": "o", "ã¶": "o", "ãµ": "o",
        "ãº": "u", "ã¹": "u", "ã¼": "u",
        "ã±": "n",
        "á": "a", "à": "a", "ä": "a", "ã": "a",
        "é": "e", "è": "e", "ë": "e",
        "í": "i", "ì": "i", "ï": "i",
        "ó": "o", "ò": "o", "ö": "o", "õ": "o",
        "ú": "u", "ù": "u", "ü": "u",
        "ñ": "n",
    }
    for source, target in replacements.items():
        normalized = normalized.replace(source, target)
    return normalized


def _placeholder_recipe_image_url(title: str) -> str:
    slug = _seed_title_key(title)
    slug = re.sub(r"[^a-z0-9]+", "-", slug).strip("-")
    slug = slug or "recipe"
    return f"/uploads/recipes/seed-{slug}.svg"


def _default_seed_image_url(title: str) -> str:
    slug = _seed_title_key(title)
    slug = re.sub(r"[^a-z0-9]+", "-", slug).strip("-")
    slug = slug or "recipe"
    jpg_name = f"seed-{slug}.jpg"
    jpg_path = get_recipe_upload_dir() / jpg_name
    if jpg_path.exists():
        return build_recipe_image_url(jpg_name)
    return _placeholder_recipe_image_url(title)


def _step_objects(step_texts: list[str]) -> list[dict]:
    return [{"position": index, "text": text} for index, text in enumerate(step_texts)]


_SEED_STEP_MAP = {
    _seed_title_key(title): _step_objects(steps)
    for title, steps in SEED_RECIPE_STEPS.items()
}

_SEED_NUTRITION_MAP = {
    _seed_title_key(title): data
    for title, data in SEED_RECIPE_NUTRITION.items()
}

_LEGACY_NUTRITION_MAP = {
    _seed_title_key(title): data
    for title, data in LEGACY_RECIPE_NUTRITION.items()
}

SEED_RECIPE_IMAGES = {
    _seed_title_key("Tortilla de Patatas"): build_recipe_image_url("seed-tortilla-patatas.jpg"),
    _seed_title_key("Pasta Boloñesa"): build_recipe_image_url("seed-pasta-bolonesa.jpg"),
    _seed_title_key("Pollo al Curry con Arroz"): build_recipe_image_url("seed-pollo-curry-arroz.jpg"),
    _seed_title_key("Fajitas de Pollo"): build_recipe_image_url("seed-fajitas-pollo.jpg"),
    _seed_title_key("Chili con Carne"): build_recipe_image_url("seed-chili-con-carne.jpg"),
    _seed_title_key("Macarrones con Tomate y Queso"): build_recipe_image_url("seed-macarrones-tomate-queso.jpg"),
}

PROTECTED_SEED_IMAGE_URLS = set(SEED_RECIPE_IMAGES.values())


for seed in SEED_RECIPES + ADDITIONAL_SEED_RECIPES:
    key = _seed_title_key(seed["title"])
    seed["steps"] = list(_SEED_STEP_MAP.get(key, []))
    if key in SEED_RECIPE_IMAGES:
        seed["image_url"] = SEED_RECIPE_IMAGES[key]
    elif not seed.get("image_url"):
        seed["image_url"] = _default_seed_image_url(seed["title"])
    if key in _SEED_NUTRITION_MAP:
        seed.update(_SEED_NUTRITION_MAP[key])

SEED_RECIPES.extend(ADDITIONAL_SEED_RECIPES)


class RecipeService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── Seed ──────────────────────────────────────────────────────────────────

    async def ensure_seeds(self) -> None:
        """Insert public seed/template recipes once on first bootstrap."""
        result = await self.db.execute(
            select(Recipe).where(Recipe.is_public == True).options(selectinload(Recipe.ingredients))
        )
        existing_recipes = list(result.scalars().all())
        existing_by_key = {_seed_title_key(recipe.title): recipe for recipe in existing_recipes}
        created = 0

        for seed in SEED_RECIPES:
            key = _seed_title_key(seed["title"])
            seed_steps = list(seed.get("steps", []))
            seed_image_url = seed.get("image_url")
            recipe = existing_by_key.get(key)
            if recipe is None:
                recipe = Recipe(
                    user_id=None,
                    title=seed["title"],
                    description=seed.get("description"),
                    servings=seed.get("servings", 4),
                    estimated_minutes=seed.get("estimated_minutes"),
                    estimated_cost=seed.get("estimated_cost"),
                    calories_per_serving=seed.get("calories_per_serving"),
                    protein_g=seed.get("protein_g"),
                    carbs_g=seed.get("carbs_g"),
                    fat_g=seed.get("fat_g"),
                    fiber_g=seed.get("fiber_g"),
                    sugar_g=seed.get("sugar_g"),
                    sodium_mg=seed.get("sodium_mg"),
                    meal_types=_normalize_meal_types(seed.get("meal_types")),
                    tags=seed.get("tags"),
                    steps=seed_steps,
                    image_url=seed_image_url,
                    is_public=True,
                )
                self.db.add(recipe)
                await self.db.flush()

                for pos, ing_data in enumerate(seed.get("ingredients", [])):
                    self.db.add(RecipeIngredient(
                        recipe_id=recipe.id,
                        name=ing_data["name"],
                        quantity=ing_data.get("quantity"),
                        unit=ing_data.get("unit"),
                        notes=ing_data.get("notes"),
                        product_query=ing_data.get("product_query"),
                        position=pos,
                    ))
                created += 1
                continue

            changed = False
            nutrition_fields = (
                "calories_per_serving",
                "protein_g",
                "carbs_g",
                "fat_g",
                "fiber_g",
                "sugar_g",
                "sodium_mg",
            )
            for field_name in nutrition_fields:
                if getattr(recipe, field_name) is None and seed.get(field_name) is not None:
                    setattr(recipe, field_name, seed.get(field_name))
                    changed = True

            if not recipe.meal_types and seed.get("meal_types"):
                recipe.meal_types = _normalize_meal_types(seed.get("meal_types"))
                changed = True
            if not recipe.steps and seed_steps:
                recipe.steps = seed_steps
                changed = True
            if not recipe.image_url and seed_image_url:
                recipe.image_url = seed_image_url
                changed = True
            elif (
                recipe.image_url
                and recipe.image_url.endswith(".svg")
                and seed_image_url
                and seed_image_url.endswith(".jpg")
            ):
                recipe.image_url = seed_image_url
                changed = True
            if changed:
                recipe.updated_at = datetime.now(timezone.utc)

        legacy_titles = list(LEGACY_RECIPE_NUTRITION.keys())
        if legacy_titles:
            legacy_result = await self.db.execute(
                select(Recipe).where(Recipe.title.in_(legacy_titles))
            )
            for recipe in legacy_result.scalars().all():
                legacy_data = _LEGACY_NUTRITION_MAP.get(_seed_title_key(recipe.title))
                if not legacy_data:
                    continue
                changed = False
                for field_name in (
                    "calories_per_serving",
                    "protein_g",
                    "carbs_g",
                    "fat_g",
                    "fiber_g",
                    "sugar_g",
                    "sodium_mg",
                ):
                    if getattr(recipe, field_name) is None and legacy_data.get(field_name) is not None:
                        setattr(recipe, field_name, legacy_data.get(field_name))
                        changed = True
                if not recipe.meal_types and legacy_data.get("meal_types"):
                    recipe.meal_types = _normalize_meal_types(legacy_data.get("meal_types"))
                    changed = True
                desired_image_url = _default_seed_image_url(recipe.title)
                if not recipe.image_url:
                    recipe.image_url = desired_image_url
                    changed = True
                elif recipe.image_url.endswith(".svg") and desired_image_url.endswith(".jpg"):
                    recipe.image_url = desired_image_url
                    changed = True
                if changed:
                    recipe.updated_at = datetime.now(timezone.utc)

        await self.db.commit()
        logger.info(f"Seed bootstrap complete. Created {created} public recipes and backfilled nutrition.")

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

    async def _get_mutable_recipe_or_404(self, recipe_id: int, user_id: int) -> Recipe:
        """Get any visible recipe for mutations."""
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
            calories_per_serving=recipe.calories_per_serving,
            protein_g=recipe.protein_g,
            carbs_g=recipe.carbs_g,
            fat_g=recipe.fat_g,
            fiber_g=recipe.fiber_g,
            sugar_g=recipe.sugar_g,
            sodium_mg=recipe.sodium_mg,
            meal_types=_normalize_meal_types(recipe.meal_types),
            tags=recipe.tags,
            steps=_normalize_steps(recipe.steps),
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
        allow_remote: bool = True,
    ):
        query = (ingredient.product_query or ingredient.name or "").strip()
        if not query:
            return None

        try:
            product_service = ProductService(self.db)

            fallback_result = await product_service.search(
                query=query,
                postal_code=postal_code,
                limit=8,
                mode="fallback",
                rank_with_ai=False,
            )
            fallback_best = product_service.pick_best_match(query, fallback_result.products)
            if fallback_best:
                return fallback_best

            if not allow_remote:
                return None

            result = await asyncio.wait_for(
                product_service.search(
                    query=query,
                    postal_code=postal_code,
                    limit=5,
                    mode="hybrid",
                    rank_with_ai=False,
                ),
                timeout=2.2,
            )
        except TimeoutError:
            logger.warning("Timeout resolviendo ingrediente '%s' para CP %s", query, postal_code)
            return None
        if not result.products:
            return None

        return product_service.pick_best_match(query, result.products)

    async def _get_active_pantry_items(self, user_id: int) -> list[PantryItem]:
        result = await self.db.execute(
            select(PantryItem).where(
                PantryItem.user_id == user_id,
                PantryItem.is_consumed == False,
            )
        )
        return list(result.scalars().all())

    def _apply_pantry_coverage(
        self,
        pantry_items: list[PantryItem],
        ingredient: RecipeIngredient,
        product,
        servings_multiplier: float,
        purchase_quantity: int,
    ) -> tuple[int, bool, bool]:
        if purchase_quantity <= 0 or not pantry_items:
            return purchase_quantity, False, False

        required = _ingredient_required_amount(ingredient, servings_multiplier, product)
        if not required:
            return purchase_quantity, False, False

        required_amount, required_unit = required
        pantry_available = pantry_total_in_unit(
            pantry_items,
            product_id=getattr(product, "id", None),
            product_name=getattr(product, "name", None) if product else ingredient.name,
            ingredient_name=ingredient.name,
            target_unit=required_unit,
        )

        remaining = max(0.0, required_amount - pantry_available)
        if remaining <= 0:
            return 0, True, False

        pack = parse_measurement_text(getattr(product, "unit_size", None)) if product else None
        if pack and units_compatible(pack[1], required_unit):
            converted = convert_amount(remaining, required_unit, pack[1])
            if converted is not None:
                adjusted = max(1, math.ceil(converted / pack[0]))
                return adjusted, False, adjusted < purchase_quantity

        if required_unit == "uds":
            adjusted = max(1, math.ceil(remaining))
            return adjusted, False, adjusted < purchase_quantity

        return purchase_quantity, False, False

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
        return _to_recipe_read(recipe)

    async def create_recipe(self, user_id: int, data: RecipeCreate) -> RecipeRead:
        recipe = Recipe(
            user_id=user_id,
            title=data.title,
            description=data.description,
            servings=data.servings,
            estimated_minutes=data.estimated_minutes,
            estimated_cost=data.estimated_cost,
            calories_per_serving=data.calories_per_serving,
            protein_g=data.protein_g,
            carbs_g=data.carbs_g,
            fat_g=data.fat_g,
            fiber_g=data.fiber_g,
            sugar_g=data.sugar_g,
            sodium_mg=data.sodium_mg,
            meal_types=_normalize_meal_types(data.meal_types),
            tags=data.tags,
            steps=_normalize_steps(data.steps),
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
            select(Recipe)
            .where(Recipe.id == recipe.id)
            .options(selectinload(Recipe.ingredients))
            .execution_options(populate_existing=True)
        )
        return _to_recipe_read(result.scalar_one())

    async def update_recipe(self, recipe_id: int, user_id: int, data: RecipeUpdate) -> RecipeRead:
        recipe = await self._get_mutable_recipe_or_404(recipe_id, user_id)
        provided = data.model_fields_set

        if data.title is not None:
            recipe.title = data.title
        if "description" in provided:
            recipe.description = data.description
        if "servings" in provided and data.servings is not None:
            recipe.servings = data.servings
        if "estimated_minutes" in provided:
            recipe.estimated_minutes = data.estimated_minutes
        if "estimated_cost" in provided:
            recipe.estimated_cost = data.estimated_cost
        if "calories_per_serving" in provided:
            recipe.calories_per_serving = data.calories_per_serving
        if "protein_g" in provided:
            recipe.protein_g = data.protein_g
        if "carbs_g" in provided:
            recipe.carbs_g = data.carbs_g
        if "fat_g" in provided:
            recipe.fat_g = data.fat_g
        if "fiber_g" in provided:
            recipe.fiber_g = data.fiber_g
        if "sugar_g" in provided:
            recipe.sugar_g = data.sugar_g
        if "sodium_mg" in provided:
            recipe.sodium_mg = data.sodium_mg
        if "meal_types" in provided:
            recipe.meal_types = _normalize_meal_types(data.meal_types)
        if "tags" in provided:
            recipe.tags = data.tags
        if data.steps is not None:
            recipe.steps = _normalize_steps(data.steps)
        if "image_url" in provided:
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
            select(Recipe)
            .where(Recipe.id == recipe.id)
            .options(selectinload(Recipe.ingredients))
            .execution_options(populate_existing=True)
        )
        return _to_recipe_read(result.scalar_one())

    async def delete_recipe(self, recipe_id: int, user_id: int) -> None:
        recipe = await self._get_mutable_recipe_or_404(recipe_id, user_id)
        previous_image_url = recipe.image_url
        await self.db.delete(recipe)
        await self.db.commit()
        if is_local_recipe_image_url(previous_image_url) and previous_image_url not in PROTECTED_SEED_IMAGE_URLS:
            delete_recipe_image_file(previous_image_url)

    async def set_recipe_image(self, recipe_id: int, user_id: int, image_url: str) -> RecipeRead:
        recipe = await self._get_mutable_recipe_or_404(recipe_id, user_id)
        previous_image_url = recipe.image_url
        recipe.image_url = image_url
        recipe.updated_at = datetime.now(timezone.utc)
        await self.db.commit()

        result = await self.db.execute(
            select(Recipe)
            .where(Recipe.id == recipe.id)
            .options(selectinload(Recipe.ingredients))
            .execution_options(populate_existing=True)
        )
        if (
            previous_image_url
            and previous_image_url != image_url
            and is_local_recipe_image_url(previous_image_url)
            and previous_image_url not in PROTECTED_SEED_IMAGE_URLS
        ):
            delete_recipe_image_file(previous_image_url)
        return _to_recipe_read(result.scalar_one())

    async def delete_recipe_image(self, recipe_id: int, user_id: int) -> RecipeRead:
        recipe = await self._get_mutable_recipe_or_404(recipe_id, user_id)
        previous_image_url = recipe.image_url
        recipe.image_url = None
        recipe.updated_at = datetime.now(timezone.utc)
        await self.db.commit()

        result = await self.db.execute(
            select(Recipe)
            .where(Recipe.id == recipe.id)
            .options(selectinload(Recipe.ingredients))
            .execution_options(populate_existing=True)
        )
        if is_local_recipe_image_url(previous_image_url) and previous_image_url not in PROTECTED_SEED_IMAGE_URLS:
            delete_recipe_image_file(previous_image_url)
        return _to_recipe_read(result.scalar_one())

    async def duplicate_recipe(self, recipe_id: int, user_id: int) -> RecipeRead:
        """Copy a recipe (own or public) to the user's collection."""
        source = await self._get_recipe_or_404(recipe_id, user_id)
        data = RecipeCreate(
            title=f"{source.title} (copia)",
            description=source.description,
            servings=source.servings,
            estimated_minutes=source.estimated_minutes,
            estimated_cost=source.estimated_cost,
            calories_per_serving=source.calories_per_serving,
            protein_g=source.protein_g,
            carbs_g=source.carbs_g,
            fat_g=source.fat_g,
            fiber_g=source.fiber_g,
            sugar_g=source.sugar_g,
            sodium_mg=source.sodium_mg,
            meal_types=_normalize_meal_types(source.meal_types),
            tags=source.tags,
            steps=_normalize_steps(source.steps),
            image_url=source.image_url,
            ingredients=[
                {
                    "name": i.name,
                    "quantity": i.quantity,
                    "unit": i.unit,
                    "notes": i.notes,
                    "product_query": i.product_query,
                    "position": i.position,
                }
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
        pantry_items = await self._get_active_pantry_items(user_id)

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
        habit_entries = []
        skipped = 0
        resolved_real = 0
        resolved_fallback = 0
        unresolved = 0
        pantry_covered = 0
        pantry_reduced = 0

        # Filter ingredients if caller specified a selection
        ingredients_to_add = recipe.ingredients
        if payload.selected_ingredient_ids is not None:
            id_set = set(payload.selected_ingredient_ids)
            ingredients_to_add = [i for i in recipe.ingredients if i.id in id_set]

        for ing in ingredients_to_add:
            try:
                product = await self._resolve_product_for_ingredient(ing, postal_code)
                product_id = product.id if product else f"recipe_{recipe.id}_ing_{ing.id}"
                adjusted_qty = _infer_cart_quantity(ing, payload.servings_multiplier, product)
                note = _build_ingredient_note(ing, payload.servings_multiplier)
                adjusted_qty, covered_by_pantry, reduced_by_pantry = self._apply_pantry_coverage(
                    pantry_items,
                    ing,
                    product,
                    payload.servings_multiplier,
                    adjusted_qty,
                )
                if covered_by_pantry:
                    skipped += 1
                    pantry_covered += 1
                    continue
                if reduced_by_pantry:
                    pantry_reduced += 1

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
                habit_entries.append(
                    {
                        "product_id": item.product_id,
                        "product_name": item.product_name,
                        "product_price": item.product_price,
                        "product_unit": item.product_unit,
                        "product_thumbnail": item.product_thumbnail,
                        "product_category": item.product_category,
                        "quantity": adjusted_qty,
                        "source": getattr(product, "source", "manual") if product else "manual",
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

        await HabitService(self.db).record_additions(user_id, habit_entries)
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
            pantry_covered=pantry_covered,
            pantry_reduced=pantry_reduced,
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
    """Check if an ingredient is covered by pantry using stricter fuzzy matching."""
    for pname in pantry_names:
        if names_match(ingredient_name, pname):
            return True
    return False



def _infer_cart_quantity(ing: RecipeIngredient, servings_multiplier: float, product=None) -> int:
    """
    Convert recipe amounts into purchase units.
    Weighted or volume ingredients default to one pack. Discrete units scale up.
    """
    scaled_quantity = (ing.quantity or 1.0) * servings_multiplier
    unit = (ing.unit or "").strip().lower()
    discrete_units = {"ud", "uds", "unidad", "unidades", "huevo", "huevos"}
    cooking_measure_units = {
        "cucharada", "cucharadas", "cucharadita", "cucharaditas",
        "diente", "dientes", "pizca", "pizcas",
    }

    if _looks_like_eggs(ing, product):
        pack_size = _infer_pack_size(product) or 12
        return max(1, math.ceil(scaled_quantity / pack_size))

    if unit in cooking_measure_units and _is_staple_or_packaged_product(ing, product):
        return 1

    if unit in discrete_units and ing.quantity is not None:
        if _has_weight_pack(product) and _is_packaged_or_processed_product(ing, product):
            guessed_pack_units = _guess_units_per_pack(product, ing)
            if guessed_pack_units:
                return max(1, math.ceil(scaled_quantity / guessed_pack_units))
            return 1
        return max(1, math.ceil(scaled_quantity))

    return 1


def _ingredient_required_amount(
    ing: RecipeIngredient,
    servings_multiplier: float,
    product=None,
) -> tuple[float, str] | None:
    if ing.quantity is None:
        return None

    scaled_quantity = max((ing.quantity or 0.0) * servings_multiplier, 0.0)
    if scaled_quantity <= 0:
        return None

    raw_unit = (ing.unit or "").strip().lower()
    unit = normalize_unit(ing.unit or "")
    if _looks_like_eggs(ing, product):
        return scaled_quantity, "uds"

    if unit in {"kg", "g", "l", "ml"}:
        return scaled_quantity, unit

    if raw_unit in {"ud", "uds", "unidad", "unidades"}:
        pack = parse_measurement_text(getattr(product, "unit_size", None)) if product else None
        if pack and pack[1] in {"kg", "g", "l", "ml"}:
            return scaled_quantity * pack[0], pack[1]
        return scaled_quantity, "uds"

    return None


def _looks_like_eggs(ing: RecipeIngredient, product) -> bool:
    haystack = " ".join(
        part.lower()
        for part in [
            ing.name or "",
            ing.product_query or "",
            getattr(product, "name", "") or "",
            getattr(product, "display_name", "") or "",
            getattr(product, "unit_size", "") or "",
        ]
        if part
    )
    return "huevo" in haystack


def _infer_pack_size(product) -> Optional[int]:
    if not product:
        return None

    candidates = [
        getattr(product, "unit_size", None),
        getattr(product, "display_name", None),
        getattr(product, "name", None),
    ]
    for value in candidates:
        parsed = _parse_pack_units(value)
        if parsed:
            return parsed
    return None


def _parse_pack_units(value: Optional[str]) -> Optional[int]:
    if not value:
        return None

    text = value.lower()

    dozen_markers = ("docena", "docenas", "12 ud", "12 uds", "12 huevos", "x12")
    if any(marker in text for marker in dozen_markers):
        return 12

    match = re.search(r"(\d+)\s*(ud|uds|unidades|huevos?)\b", text)
    if match:
        return int(match.group(1))

    match = re.search(r"x\s*(\d+)\b", text)
    if match:
        return int(match.group(1))

    return None


def _has_weight_pack(product) -> bool:
    pack = parse_measurement_text(getattr(product, "unit_size", None)) if product else None
    return bool(pack and pack[1] in {"kg", "g", "l", "ml"})


def _is_staple_or_packaged_product(ing: RecipeIngredient, product) -> bool:
    haystack = " ".join(
        part.lower()
        for part in [
            ing.name or "",
            ing.product_query or "",
            getattr(product, "name", "") or "",
            getattr(product, "display_name", "") or "",
            getattr(product, "category", "") or "",
        ]
        if part
    )
    keywords = (
        "aceite", "sal", "pimienta", "especia", "oregano", "comino", "curry",
        "pimenton", "ajo granulado", "salsa soja", "vinagre", "pan rallado",
        "tortilla", "wrap", "rallad", "lavad",
    )
    return any(keyword in haystack for keyword in keywords)


def _is_packaged_or_processed_product(ing: RecipeIngredient, product) -> bool:
    haystack = " ".join(
        part.lower()
        for part in [
            ing.name or "",
            ing.product_query or "",
            getattr(product, "name", "") or "",
            getattr(product, "display_name", "") or "",
            getattr(product, "category", "") or "",
        ]
        if part
    )
    keywords = (
        "tortilla", "wrap", "rallad", "lavad", "mezcla", "brotes", "bolsa",
        "granulado", "lomos de salmon", "salmon", "lonchas",
    )
    return any(keyword in haystack for keyword in keywords)


def _guess_units_per_pack(product, ing: RecipeIngredient) -> Optional[int]:
    haystack = " ".join(
        part.lower()
        for part in [
            ing.name or "",
            ing.product_query or "",
            getattr(product, "name", "") or "",
            getattr(product, "display_name", "") or "",
        ]
        if part
    )
    if "tortilla" in haystack or "wrap" in haystack:
        return 8
    if "lomos de salmon" in haystack or "salmon" in haystack:
        return 2
    return None


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


def _normalize_steps(steps) -> list[dict]:
    if not steps:
        return []

    normalized_steps: list[dict] = []
    for index, step in enumerate(steps):
        text = getattr(step, "text", None) if not isinstance(step, dict) else step.get("text")
        position = getattr(step, "position", index) if not isinstance(step, dict) else step.get("position", index)
        normalized_steps.append({
            "position": int(position),
            "text": str(text).strip(),
        })

    normalized_steps.sort(key=lambda item: item["position"])
    return [
        {"position": index, "text": step["text"]}
        for index, step in enumerate(normalized_steps)
    ]


def _normalize_meal_types(meal_types) -> list[str]:
    if not meal_types:
        return []
    seen: set[str] = set()
    normalized: list[str] = []
    for meal_type in meal_types:
        value = str(meal_type).strip().lower()
        if value in {"desayuno", "comida", "cena", "merienda", "postre"} and value not in seen:
            seen.add(value)
            normalized.append(value)
    return normalized


def _to_recipe_read(recipe: Recipe) -> RecipeRead:
    return RecipeRead(
        id=recipe.id,
        user_id=recipe.user_id,
        title=recipe.title,
        description=recipe.description,
        servings=recipe.servings,
        estimated_minutes=recipe.estimated_minutes,
        estimated_cost=recipe.estimated_cost,
        calories_per_serving=recipe.calories_per_serving,
        protein_g=recipe.protein_g,
        carbs_g=recipe.carbs_g,
        fat_g=recipe.fat_g,
        fiber_g=recipe.fiber_g,
        sugar_g=recipe.sugar_g,
        sodium_mg=recipe.sodium_mg,
        meal_types=_normalize_meal_types(recipe.meal_types),
        tags=recipe.tags,
        steps=_normalize_steps(recipe.steps),
        image_url=recipe.image_url,
        is_public=recipe.is_public,
        ingredients=[
            {
                "id": ingredient.id,
                "recipe_id": ingredient.recipe_id,
                "name": ingredient.name,
                "quantity": ingredient.quantity,
                "unit": ingredient.unit,
                "notes": ingredient.notes,
                "product_query": ingredient.product_query,
                "position": ingredient.position,
            }
            for ingredient in recipe.ingredients
        ],
        created_at=recipe.created_at,
        updated_at=recipe.updated_at,
    )
