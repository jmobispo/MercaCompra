from fastapi import FastAPI, APIRouter, HTTPException, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Mercadona API base URL
MERCADONA_API = "https://tienda.mercadona.es/api"

# Default warehouses by region
WAREHOUSES = {
    "28": "mad1",  # Madrid
    "08": "bcn1",  # Barcelona
    "41": "svq1",  # Sevilla
    "46": "vlc1",  # Valencia
    "29": "mlg1",  # Málaga
    "48": "bil1",  # Bilbao
    "50": "zar1",  # Zaragoza
    "15": "cor1",  # A Coruña
    "33": "ovi1",  # Oviedo/Asturias
    "03": "alc1",  # Alicante
}

def get_warehouse_from_postal(postal_code: str) -> str:
    """Get warehouse ID from postal code prefix"""
    prefix = postal_code[:2]
    return WAREHOUSES.get(prefix, "mad1")

# ============== Models ==============

class UserSettings(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    device_id: str
    postal_code: str = "28001"
    warehouse: str = "mad1"
    budget: float = 100.0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class UserSettingsUpdate(BaseModel):
    postal_code: Optional[str] = None
    budget: Optional[float] = None

class FavoriteProduct(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    device_id: str
    product_id: str
    product_data: Dict[str, Any]
    added_at: datetime = Field(default_factory=datetime.utcnow)

class FavoriteCreate(BaseModel):
    device_id: str
    product_id: str
    product_data: Dict[str, Any]

class ShoppingListItem(BaseModel):
    product_id: str
    product_data: Dict[str, Any]
    quantity: int = 1
    added_at: datetime = Field(default_factory=datetime.utcnow)

class ShoppingList(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    device_id: str
    name: str = "Mi Lista"
    items: List[ShoppingListItem] = []
    budget: float = 100.0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class AddToListRequest(BaseModel):
    device_id: str
    product_id: str
    product_data: Dict[str, Any]
    quantity: int = 1

class UpdateQuantityRequest(BaseModel):
    device_id: str
    product_id: str
    quantity: int

class RecipeIngredient(BaseModel):
    product_id: Optional[str] = None
    name: str
    quantity: str
    product_data: Optional[Dict[str, Any]] = None

class Recipe(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    device_id: str
    name: str
    description: str = ""
    ingredients: List[RecipeIngredient] = []
    instructions: str = ""
    servings: int = 4
    time: str = "30 min"
    difficulty: str = "Personal"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class RecipeCreate(BaseModel):
    device_id: str
    name: str
    description: str = ""
    ingredients: List[RecipeIngredient] = []
    instructions: str = ""
    servings: int = 4
    time: str = "30 min"
    difficulty: str = "Personal"

class RecipeUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    ingredients: Optional[List[RecipeIngredient]] = None
    instructions: Optional[str] = None
    servings: Optional[int] = None
    time: Optional[str] = None
    difficulty: Optional[str] = None

# ============== Mercadona API Proxy ==============

@api_router.get("/mercadona/categories")
async def get_categories(postal_code: str = Query(default="28001")):
    """Get all categories from Mercadona"""
    warehouse = get_warehouse_from_postal(postal_code)
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{MERCADONA_API}/categories/",
                params={"lang": "es", "wh": warehouse},
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    "Accept": "application/json"
                }
            )
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        logging.error(f"Error fetching categories: {e}")
        raise HTTPException(status_code=502, detail=f"Error connecting to Mercadona: {str(e)}")

@api_router.get("/mercadona/categories/{category_id}")
async def get_category_products(category_id: int, postal_code: str = Query(default="28001")):
    """Get products from a specific category"""
    warehouse = get_warehouse_from_postal(postal_code)
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{MERCADONA_API}/categories/{category_id}/",
                params={"lang": "es", "wh": warehouse},
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    "Accept": "application/json"
                }
            )
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        logging.error(f"Error fetching category {category_id}: {e}")
        raise HTTPException(status_code=502, detail=f"Error connecting to Mercadona: {str(e)}")

@api_router.get("/mercadona/products/{product_id}")
async def get_product_details(product_id: str, postal_code: str = Query(default="28001")):
    """Get detailed product information"""
    warehouse = get_warehouse_from_postal(postal_code)
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{MERCADONA_API}/products/{product_id}/",
                params={"lang": "es", "wh": warehouse},
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    "Accept": "application/json"
                }
            )
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        logging.error(f"Error fetching product {product_id}: {e}")
        raise HTTPException(status_code=502, detail=f"Error connecting to Mercadona: {str(e)}")

@api_router.get("/mercadona/search")
async def search_products(query: str = Query(..., min_length=2), postal_code: str = Query(default="28001")):
    """Search products across ALL categories"""
    warehouse = get_warehouse_from_postal(postal_code)
    all_products = []
    
    # TODAS las categorías válidas de Mercadona organizadas por prioridad
    # Prioridad 1: Categorías más comunes
    priority_1 = [72, 53, 54, 37, 38, 40, 120, 121, 122, 98, 132, 78, 77, 59, 112, 115]
    # Prioridad 2: Más categorías de alimentos
    priority_2 = [31, 32, 34, 36, 42, 47, 51, 56, 58, 60, 64, 65, 66, 68, 69, 79, 81, 88, 90, 92]
    # Prioridad 3: Resto de categorías
    priority_3 = [95, 97, 99, 100, 103, 104, 105, 106, 107, 108, 109, 110, 111, 116, 117, 118, 123, 126, 127, 129, 130, 133, 135, 138, 140, 142, 143, 145, 147, 148, 149, 150]
    
    all_categories = priority_1 + priority_2 + priority_3
    
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            query_lower = query.lower()
            
            for cat_id in all_categories:
                if len(all_products) >= 30:
                    break
                    
                try:
                    cat_detail = await client.get(
                        f"{MERCADONA_API}/categories/{cat_id}/",
                        params={"lang": "es", "wh": warehouse},
                        headers={
                            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                            "Accept": "application/json"
                        }
                    )
                    if cat_detail.status_code == 200:
                        cat_data = cat_detail.json()
                        subcats = cat_data.get("categories", [])
                        
                        for subcat in subcats:
                            products = subcat.get("products", [])
                            for product in products:
                                name = (product.get("display_name") or product.get("name") or "").lower()
                                # Buscar de forma más flexible:
                                # - Si el query tiene múltiples palabras, buscar todas (AND)
                                # - Si no encuentra, buscar cualquier palabra (OR)
                                query_words = query_lower.split()
                                
                                # Primero intentar match exacto de todas las palabras
                                if all(word in name for word in query_words):
                                    all_products.append(product)
                                    if len(all_products) >= 30:
                                        return {"products": all_products}
                                # Si solo hay una palabra o si alguna palabra coincide parcialmente
                                elif len(query_words) == 1 and query_lower in name:
                                    all_products.append(product)
                                    if len(all_products) >= 30:
                                        return {"products": all_products}
                except Exception as e:
                    continue
                    
        return {"products": all_products}
    except httpx.HTTPError as e:
        logging.error(f"Error searching products: {e}")
        raise HTTPException(status_code=502, detail=f"Error connecting to Mercadona: {str(e)}")

# ============== User Settings ==============

@api_router.get("/settings/{device_id}", response_model=UserSettings)
async def get_user_settings(device_id: str):
    """Get or create user settings"""
    settings = await db.user_settings.find_one({"device_id": device_id})
    if not settings:
        new_settings = UserSettings(device_id=device_id)
        await db.user_settings.insert_one(new_settings.dict())
        return new_settings
    return UserSettings(**settings)

@api_router.put("/settings/{device_id}", response_model=UserSettings)
async def update_user_settings(device_id: str, update: UserSettingsUpdate):
    """Update user settings"""
    settings = await db.user_settings.find_one({"device_id": device_id})
    if not settings:
        new_settings = UserSettings(device_id=device_id)
        settings = new_settings.dict()
    
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    if "postal_code" in update_data:
        update_data["warehouse"] = get_warehouse_from_postal(update_data["postal_code"])
    update_data["updated_at"] = datetime.utcnow()
    
    await db.user_settings.update_one(
        {"device_id": device_id},
        {"$set": update_data},
        upsert=True
    )
    
    updated = await db.user_settings.find_one({"device_id": device_id})
    return UserSettings(**updated)

# ============== Favorites ==============

@api_router.get("/favorites/{device_id}", response_model=List[FavoriteProduct])
async def get_favorites(device_id: str):
    """Get all favorites for a device"""
    favorites = await db.favorites.find({"device_id": device_id}).to_list(1000)
    return [FavoriteProduct(**f) for f in favorites]

@api_router.post("/favorites", response_model=FavoriteProduct)
async def add_favorite(favorite: FavoriteCreate):
    """Add a product to favorites"""
    # Check if already exists
    existing = await db.favorites.find_one({
        "device_id": favorite.device_id,
        "product_id": favorite.product_id
    })
    if existing:
        return FavoriteProduct(**existing)
    
    new_favorite = FavoriteProduct(**favorite.dict())
    await db.favorites.insert_one(new_favorite.dict())
    return new_favorite

@api_router.delete("/favorites/{device_id}/{product_id}")
async def remove_favorite(device_id: str, product_id: str):
    """Remove a product from favorites"""
    result = await db.favorites.delete_one({
        "device_id": device_id,
        "product_id": product_id
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Favorite not found")
    return {"message": "Favorite removed"}

# ============== Shopping List ==============

@api_router.get("/shopping-list/{device_id}", response_model=ShoppingList)
async def get_shopping_list(device_id: str):
    """Get the shopping list for a device"""
    shopping_list = await db.shopping_lists.find_one({"device_id": device_id})
    if not shopping_list:
        new_list = ShoppingList(device_id=device_id)
        await db.shopping_lists.insert_one(new_list.dict())
        return new_list
    return ShoppingList(**shopping_list)

@api_router.post("/shopping-list/add", response_model=ShoppingList)
async def add_to_shopping_list(request: AddToListRequest):
    """Add a product to the shopping list"""
    shopping_list = await db.shopping_lists.find_one({"device_id": request.device_id})
    
    if not shopping_list:
        new_list = ShoppingList(device_id=request.device_id)
        shopping_list = new_list.dict()
    
    items = shopping_list.get("items", [])
    
    # Check if product already in list
    existing_idx = None
    for idx, item in enumerate(items):
        if item["product_id"] == request.product_id:
            existing_idx = idx
            break
    
    if existing_idx is not None:
        items[existing_idx]["quantity"] += request.quantity
    else:
        new_item = ShoppingListItem(
            product_id=request.product_id,
            product_data=request.product_data,
            quantity=request.quantity
        )
        items.append(new_item.dict())
    
    await db.shopping_lists.update_one(
        {"device_id": request.device_id},
        {"$set": {"items": items, "updated_at": datetime.utcnow()}},
        upsert=True
    )
    
    updated = await db.shopping_lists.find_one({"device_id": request.device_id})
    return ShoppingList(**updated)

@api_router.put("/shopping-list/quantity", response_model=ShoppingList)
async def update_item_quantity(request: UpdateQuantityRequest):
    """Update quantity of an item in the shopping list"""
    shopping_list = await db.shopping_lists.find_one({"device_id": request.device_id})
    
    if not shopping_list:
        raise HTTPException(status_code=404, detail="Shopping list not found")
    
    items = shopping_list.get("items", [])
    
    if request.quantity <= 0:
        # Remove item
        items = [item for item in items if item["product_id"] != request.product_id]
    else:
        # Update quantity
        for item in items:
            if item["product_id"] == request.product_id:
                item["quantity"] = request.quantity
                break
    
    await db.shopping_lists.update_one(
        {"device_id": request.device_id},
        {"$set": {"items": items, "updated_at": datetime.utcnow()}}
    )
    
    updated = await db.shopping_lists.find_one({"device_id": request.device_id})
    return ShoppingList(**updated)

@api_router.delete("/shopping-list/{device_id}/clear")
async def clear_shopping_list(device_id: str):
    """Clear all items from shopping list"""
    await db.shopping_lists.update_one(
        {"device_id": device_id},
        {"$set": {"items": [], "updated_at": datetime.utcnow()}}
    )
    return {"message": "Shopping list cleared"}

@api_router.put("/shopping-list/{device_id}/budget")
async def update_budget(device_id: str, budget: float = Query(...)):
    """Update budget for shopping list"""
    await db.shopping_lists.update_one(
        {"device_id": device_id},
        {"$set": {"budget": budget, "updated_at": datetime.utcnow()}},
        upsert=True
    )
    updated = await db.shopping_lists.find_one({"device_id": device_id})
    return ShoppingList(**updated)

# ============== Recipes ==============

@api_router.get("/recipes/{device_id}", response_model=List[Recipe])
async def get_recipes(device_id: str):
    """Get all recipes for a device"""
    recipes = await db.recipes.find({"device_id": device_id}).to_list(1000)
    return [Recipe(**r) for r in recipes]

@api_router.post("/recipes", response_model=Recipe)
async def create_recipe(recipe: RecipeCreate):
    """Create a new recipe"""
    new_recipe = Recipe(**recipe.dict())
    await db.recipes.insert_one(new_recipe.dict())
    return new_recipe

@api_router.get("/recipes/{device_id}/{recipe_id}", response_model=Recipe)
async def get_recipe(device_id: str, recipe_id: str):
    """Get a specific recipe"""
    recipe = await db.recipes.find_one({"device_id": device_id, "id": recipe_id})
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return Recipe(**recipe)

@api_router.delete("/recipes/{device_id}/{recipe_id}")
async def delete_recipe(device_id: str, recipe_id: str):
    """Delete a recipe"""
    result = await db.recipes.delete_one({"device_id": device_id, "id": recipe_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return {"message": "Recipe deleted"}

@api_router.put("/recipes/{device_id}/{recipe_id}", response_model=Recipe)
async def update_recipe(device_id: str, recipe_id: str, recipe_update: RecipeUpdate):
    """Update an existing recipe"""
    # Find existing recipe
    existing = await db.recipes.find_one({"device_id": device_id, "id": recipe_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Recipe not found")
    
    # Build update dict with only provided fields
    update_data = {}
    if recipe_update.name is not None:
        update_data["name"] = recipe_update.name
    if recipe_update.description is not None:
        update_data["description"] = recipe_update.description
    if recipe_update.ingredients is not None:
        update_data["ingredients"] = [ing.dict() for ing in recipe_update.ingredients]
    if recipe_update.instructions is not None:
        update_data["instructions"] = recipe_update.instructions
    if recipe_update.servings is not None:
        update_data["servings"] = recipe_update.servings
    if recipe_update.time is not None:
        update_data["time"] = recipe_update.time
    if recipe_update.difficulty is not None:
        update_data["difficulty"] = recipe_update.difficulty
    
    update_data["updated_at"] = datetime.utcnow()
    
    # Update in database
    await db.recipes.update_one(
        {"device_id": device_id, "id": recipe_id},
        {"$set": update_data}
    )
    
    # Return updated recipe
    updated = await db.recipes.find_one({"device_id": device_id, "id": recipe_id})
    return Recipe(**updated)

@api_router.post("/recipes/{device_id}/{recipe_id}/add-to-list")
async def add_recipe_to_list(device_id: str, recipe_id: str):
    """Add all ingredients from a recipe to the shopping list"""
    recipe = await db.recipes.find_one({"device_id": device_id, "id": recipe_id})
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    
    shopping_list = await db.shopping_lists.find_one({"device_id": device_id})
    if not shopping_list:
        new_list = ShoppingList(device_id=device_id)
        shopping_list = new_list.dict()
        await db.shopping_lists.insert_one(shopping_list)
    
    items = shopping_list.get("items", [])
    
    for ingredient in recipe.get("ingredients", []):
        if ingredient.get("product_id") and ingredient.get("product_data"):
            # Check if already in list
            existing = False
            for item in items:
                if item["product_id"] == ingredient["product_id"]:
                    item["quantity"] += 1
                    existing = True
                    break
            
            if not existing:
                new_item = ShoppingListItem(
                    product_id=ingredient["product_id"],
                    product_data=ingredient["product_data"],
                    quantity=1
                )
                items.append(new_item.dict())
    
    await db.shopping_lists.update_one(
        {"device_id": device_id},
        {"$set": {"items": items, "updated_at": datetime.utcnow()}}
    )
    
    return {"message": "Recipe ingredients added to shopping list"}

# ============== Health Check ==============

@api_router.get("/")
async def root():
    return {"message": "Mercadona Shopping List API", "status": "running"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
