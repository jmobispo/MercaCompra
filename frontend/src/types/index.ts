export interface User {
  id: number;
  email: string;
  username: string;
  postal_code: string;
  ui_mode: 'basic' | 'advanced';
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

export interface ListOptimizationSuggestion {
  id: string;
  reason: string;
  item_ids: number[];
  item_names: string[];
  merged_product_name: string;
  combined_quantity: number;
  product_price?: number | null;
  product_unit?: string | null;
  product_thumbnail?: string | null;
  product_category?: string | null;
  merged_note?: string | null;
}

export interface ListOptimizationPreview {
  list_id: number;
  list_name: string;
  total_items: number;
  total_suggestions: number;
  suggestions: ListOptimizationSuggestion[];
}

export interface Product {
  id: string;
  external_id?: string | null;
  name: string;
  display_name: string | null;
  price: number | null;
  unit_size: string | null;
  category: string | null;
  subcategory?: string | null;
  thumbnail: string | null;
  image?: string | null;
  source: string;
  postal_code?: string | null;
  warehouse?: string | null;
}

export interface FrequentProduct {
  product_id: string;
  product_name: string;
  product_price: number | null;
  product_unit: string | null;
  product_thumbnail: string | null;
  product_category: string | null;
  source: string;
  times_added: number;
  last_added_at: string;
  average_quantity: number;
}

export interface ProductSearchResult {
  products: Product[];
  total: number;
  query: string;
  source: 'mercadona_api' | 'fallback' | 'none';
  error: string | null;
  warehouse?: string | null;
  postal_code?: string | null;
}

export interface Category {
  id: string;
  name: string;
  product_count?: number;
  children?: Category[];
}

export interface CategoryNode {
  id: string;
  name: string;
  children?: CategoryNode[];
}

export interface CategoryTreeResponse {
  results?: CategoryNode[];
  categories?: CategoryNode[];
  source?: 'mercadona_api' | 'fallback' | 'none';
  error?: string | null;
  warehouse?: string | null;
  postal_code?: string | null;
}

export interface CategoryProductsResponse {
  categories?: Array<{
    id?: string | number;
    name?: string;
    products?: Record<string, unknown>[];
  }>;
  category_id?: string;
  category_name?: string | null;
  products?: Product[];
  total?: number;
  source?: 'mercadona_api' | 'fallback' | 'none';
  error?: string | null;
  warehouse?: string | null;
  postal_code?: string | null;
}

export interface FavoriteProduct extends Product {
  added_at: string;
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

export interface AddFrequentProductsPayload {
  list_id?: number | null;
  new_list_name?: string | null;
  limit?: number;
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

export interface RecipeStep {
  position: number;
  text: string;
}

export type RecipeMealType = 'desayuno' | 'comida' | 'cena';

export interface Recipe {
  id: number;
  user_id: number | null;
  title: string;
  description: string | null;
  servings: number;
  estimated_minutes: number | null;
  estimated_cost: number | null;
  calories_per_serving: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
  meal_types: RecipeMealType[];
  tags: string[] | null;
  steps: RecipeStep[];
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
  calories_per_serving: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
  meal_types: RecipeMealType[];
  tags: string[] | null;
  steps: RecipeStep[];
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

export interface RecipeStepPayload {
  position?: number;
  text: string;
}

export interface CreateRecipePayload {
  title: string;
  description?: string | null;
  servings?: number;
  estimated_minutes?: number | null;
  estimated_cost?: number | null;
  calories_per_serving?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  fiber_g?: number | null;
  sugar_g?: number | null;
  sodium_mg?: number | null;
  meal_types?: RecipeMealType[];
  tags?: string[] | null;
  ingredients: RecipeIngredientPayload[];
  steps?: RecipeStepPayload[];
}

export interface UpdateRecipePayload {
  title?: string;
  description?: string | null;
  servings?: number;
  estimated_minutes?: number | null;
  estimated_cost?: number | null;
  calories_per_serving?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  fiber_g?: number | null;
  sugar_g?: number | null;
  sodium_mg?: number | null;
  meal_types?: RecipeMealType[];
  tags?: string[] | null;
  ingredients?: RecipeIngredientPayload[];
  steps?: RecipeStepPayload[];
}

export interface AddToListPayload {
  list_id?: number | null;
  new_list_name?: string | null;
  servings_multiplier?: number;
  selected_ingredient_ids?: number[] | null;
}

export interface AddToListResult {
  list_id: number;
  list_name: string;
  added: number;
  skipped: number;
  resolved_real?: number;
  resolved_fallback?: number;
  unresolved?: number;
  pantry_covered?: number;
  pantry_reduced?: number;
  items: { name: string; quantity: number; price?: number | null; source?: string; resolved?: boolean }[];
}

export interface WeeklyPlanDay {
  id: number;
  day_index: number;
  meal_slot: 'desayuno' | 'comida' | 'cena';
  recipe_id: number | null;
  recipe_title?: string | null;
  meal_type: string | null;
}

export interface WeeklyPlanPreferences {
  economico: boolean;
  rapido: boolean;
  saludable: boolean;
  familiar: boolean;
}

export interface WeeklyPlanSummary {
  id: number;
  title: string;
  people_count: number;
  days_count: number;
  budget_target: number | null;
  assigned_days: number;
  created_at: string;
  updated_at: string;
}

// --- Spending / Purchase History ---

export interface PurchaseHistory {
  id: number;
  user_id: number;
  shopping_list_id: number | null;
  list_name: string;
  estimated_total: number;
  item_count: number;
  created_at: string;
}

export interface SpendingMetrics {
  weekly_current: number;
  weekly_previous: number;
  weekly_variation: number;
  monthly_current: number;
  monthly_previous: number;
  monthly_variation: number;
  total_purchases: number;
}

export interface RecordPurchasePayload {
  shopping_list_id?: number | null;
  list_name: string;
  estimated_total: number;
  item_count: number;
}

// --- Pantry ---

export interface PantryItem {
  id: number;
  user_id: number;
  name: string;
  product_id: string | null;
  quantity: number;
  unit: string | null;
  expiry_date: string | null;
  is_consumed: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePantryItemPayload {
  name: string;
  product_id?: string | null;
  quantity?: number;
  unit?: string | null;
  expiry_date?: string | null;
  notes?: string | null;
}

export interface UpdatePantryItemPayload {
  name?: string;
  quantity?: number;
  unit?: string | null;
  expiry_date?: string | null;
  is_consumed?: boolean;
  notes?: string | null;
}

// --- Supermarket mode ---

export interface SupermarketGroup {
  category: string;
  items: ShoppingListItem[];
}

export interface SupermarketView {
  list_id: number;
  list_name: string;
  groups: SupermarketGroup[];
  total_items: number;
  checked_items: number;
}

// --- Recipe pantry suggestions ---

export interface PantryRecipeSuggestion {
  recipe: RecipeSummary;
  match_pct: number;
  matched_count: number;
  missing_count: number;
  missing_ingredients: string[];
}

// --- Dashboard ---

export interface RecentListData {
  id: number;
  name: string;
  item_count: number;
  total: number;
  updated_at: string;
}

export interface SystemStatusData {
  search_mode: string;
  ai_mode: string;
  postal_code: string;
  bot_available: boolean;
  demo_mode: boolean;
}

export interface DashboardData {
  weekly_spending: number;
  weekly_variation: number;
  active_list_count: number;
  total_pantry_items: number;
  recipe_count: number;
  favorite_count: number;
  recent_list: RecentListData | null;
  system_status: SystemStatusData;
}

// --- Demo ---

export interface DemoStatus {
  demo_mode: boolean;
}

export interface DemoSeedResult {
  lists_created: number;
  items_created: number;
  pantry_items_created: number;
  purchase_history_created: number;
  message: string;
}

export interface WeeklyPlan {
  id: number;
  user_id: number;
  title: string;
  people_count: number;
  days_count: number;
  start_date: string;
  budget_target: number | null;
  preferences: WeeklyPlanPreferences;
  created_at: string;
  updated_at: string;
  days: WeeklyPlanDay[];
}

export interface WeeklyPlanDayPayload {
  day_index: number;
  meal_slot: 'desayuno' | 'comida' | 'cena';
  recipe_id?: number | null;
  meal_type?: string | null;
}

export interface CreateWeeklyPlanPayload {
  title: string;
  people_count: number;
  days_count: number;
  start_date?: string;
  budget_target?: number | null;
  preferences?: WeeklyPlanPreferences | null;
  days?: WeeklyPlanDayPayload[];
}

export interface UpdateWeeklyPlanPayload {
  title?: string;
  people_count?: number;
  days_count?: number;
  start_date?: string;
  budget_target?: number | null;
  preferences?: WeeklyPlanPreferences | null;
  days?: WeeklyPlanDayPayload[];
}

export interface GenerateWeeklyPlanListPayload {
  list_id?: number | null;
  new_list_name?: string | null;
}

export interface WeeklyPlanMealSummary {
  meal_slot: 'desayuno' | 'comida' | 'cena';
  recipe_id: number | null;
  recipe_title: string | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  estimated_cost: number;
  meal_types: RecipeMealType[];
}

export interface WeeklyPlanDaySummary {
  day_index: number;
  date: string;
  estimated_day_cost: number;
  estimated_day_calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  meals: WeeklyPlanMealSummary[];
}

export interface WeeklyPlanGeneratedSummary {
  plan_id: number;
  title: string;
  people_count: number;
  days_count: number;
  budget_target: number | null;
  preferences: WeeklyPlanPreferences;
  total_estimated_cost: number;
  total_estimated_calories: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
  average_daily_calories: number;
  average_daily_cost: number;
  budget_remaining: number | null;
  within_budget: boolean | null;
  days: WeeklyPlanDaySummary[];
}
