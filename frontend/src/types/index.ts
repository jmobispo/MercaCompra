export interface User {
  id: number;
  email: string;
  username: string;
  postal_code: string;
  is_active: boolean;
  created_at: string;
}

export interface ShoppingListSummary {
  id: number;
  name: string;
  budget: number | null;
  is_archived: boolean;
  item_count: number;
  total: number;
  updated_at: string;
}

export interface ShoppingListItem {
  id: number;
  product_id: string;
  product_name: string;
  product_price: number | null;
  product_unit: string | null;
  product_thumbnail: string | null;
  product_category: string | null;
  quantity: number;
  is_checked: boolean;
  note: string | null;
  added_at: string;
}

export interface ShoppingList {
  id: number;
  user_id: number;
  name: string;
  budget: number | null;
  is_archived: boolean;
  items: ShoppingListItem[];
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  name: string;
  display_name: string | null;
  price: number | null;
  unit_size: string | null;
  category: string | null;
  thumbnail: string | null;
  source: string;
}

export interface ProductSearchResult {
  products: Product[];
  total: number;
  query: string;
  source: 'mercadona_api' | 'fallback' | 'none';
  error: string | null;
}

export interface AutomationRun {
  id: number;
  user_id: number;
  shopping_list_id: number | null;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'partial';
  total_items: number;
  added_ok: number;
  not_found: number;
  dubious_match: number;
  substituted: number;
  errors: number;
  estimated_cost: number | null;
  duration_seconds: number | null;
  error_message: string | null;
  item_results: ItemResult[] | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

export interface ItemResult {
  product_name: string;
  status: 'ok' | 'not_found' | 'dubious' | 'substituted' | 'error';
  matched_name?: string;
  matched_price?: number;
  quantity?: number;
  note?: string;
}

export interface AuthResponse {
  access_token: string;
  user: User;
}

export interface CreateListPayload {
  name: string;
  budget?: number | null;
}

export interface UpdateListPayload {
  name?: string;
  budget?: number | null;
  is_archived?: boolean;
}

export interface AddItemPayload {
  product_id: string;
  product_name: string;
  product_price?: number | null;
  product_unit?: string | null;
  product_thumbnail?: string | null;
  product_category?: string | null;
  quantity?: number;
  note?: string | null;
}

export interface UpdateItemPayload {
  quantity?: number;
  is_checked?: boolean;
  note?: string | null;
}

export interface LaunchAutomationPayload {
  shopping_list_id: number;
  headless?: boolean;
  mercadona_email?: string;
  mercadona_password?: string;
}

export interface Category {
  id: string;
  name: string;
  children?: Category[];
}

// ── Recipes ──────────────────────────────────────────────────────────────────

export interface RecipeIngredient {
  id: number;
  recipe_id: number;
  name: string;
  quantity: number | null;
  unit: string | null;
  notes: string | null;
  product_query: string | null;
  position: number;
}

export interface Recipe {
  id: number;
  user_id: number | null;
  title: string;
  description: string | null;
  servings: number;
  estimated_minutes: number | null;
  estimated_cost: number | null;
  tags: string[] | null;
  image_url: string | null;
  is_public: boolean;
  ingredients: RecipeIngredient[];
  created_at: string;
  updated_at: string;
}

export interface RecipeSummary {
  id: number;
  user_id: number | null;
  title: string;
  description: string | null;
  servings: number;
  estimated_minutes: number | null;
  estimated_cost: number | null;
  tags: string[] | null;
  image_url: string | null;
  is_public: boolean;
  ingredient_count: number;
  created_at: string;
  updated_at: string;
}

export interface RecipeIngredientPayload {
  name: string;
  quantity?: number | null;
  unit?: string | null;
  notes?: string | null;
  product_query?: string | null;
  position?: number;
}

export interface CreateRecipePayload {
  title: string;
  description?: string | null;
  servings?: number;
  estimated_minutes?: number | null;
  estimated_cost?: number | null;
  tags?: string[] | null;
  ingredients: RecipeIngredientPayload[];
}

export interface UpdateRecipePayload {
  title?: string;
  description?: string | null;
  servings?: number;
  estimated_minutes?: number | null;
  estimated_cost?: number | null;
  tags?: string[] | null;
  ingredients?: RecipeIngredientPayload[];
}

export interface AddToListPayload {
  list_id?: number | null;
  new_list_name?: string | null;
  servings_multiplier?: number;
}

export interface AddToListResult {
  list_id: number;
  list_name: string;
  added: number;
  skipped: number;
  items: { name: string; quantity: number }[];
}
