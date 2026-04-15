import apiClient from './client';
import type {
  Recipe,
  RecipeSummary,
  CreateRecipePayload,
  UpdateRecipePayload,
  AddToListPayload,
  AddToListResult,
  PantryRecipeSuggestion,
  RecipeIngredient,
  RecipeStep,
} from '../types';

function normalizeSteps(value: unknown): RecipeStep[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((step, index) => {
      if (!step || typeof step !== 'object') return null;
      const record = step as Record<string, unknown>;
      const text = typeof record.text === 'string' ? record.text.trim() : '';
      if (!text) return null;
      const rawPosition = typeof record.position === 'number' ? record.position : index;
      return {
        position: Number.isFinite(rawPosition) ? rawPosition : index,
        text,
      };
    })
    .filter((step): step is RecipeStep => step !== null)
    .sort((left, right) => left.position - right.position)
    .map((step, index) => ({ ...step, position: index }));
}

function normalizeIngredients(value: unknown): RecipeIngredient[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((ingredient) => {
      if (!ingredient || typeof ingredient !== 'object') return null;
      const record = ingredient as Record<string, unknown>;
      if (typeof record.id !== 'number' || typeof record.recipe_id !== 'number' || typeof record.name !== 'string') {
        return null;
      }
      return {
        id: record.id,
        recipe_id: record.recipe_id,
        name: record.name,
        quantity: typeof record.quantity === 'number' ? record.quantity : null,
        unit: typeof record.unit === 'string' ? record.unit : null,
        notes: typeof record.notes === 'string' ? record.notes : null,
        product_query: typeof record.product_query === 'string' ? record.product_query : null,
        position: typeof record.position === 'number' ? record.position : 0,
      };
    })
    .filter((ingredient): ingredient is RecipeIngredient => ingredient !== null);
}

function normalizeRecipeSummary(recipe: RecipeSummary): RecipeSummary {
  return {
    ...recipe,
    tags: Array.isArray(recipe.tags) ? recipe.tags : [],
    steps: normalizeSteps(recipe.steps),
    description: recipe.description ?? null,
    estimated_minutes: recipe.estimated_minutes ?? null,
    estimated_cost: recipe.estimated_cost ?? null,
    image_url: recipe.image_url ?? null,
    ingredient_count: typeof recipe.ingredient_count === 'number' ? recipe.ingredient_count : 0,
  };
}

function normalizeRecipe(recipe: Recipe): Recipe {
  return {
    ...recipe,
    tags: Array.isArray(recipe.tags) ? recipe.tags : [],
    steps: normalizeSteps(recipe.steps),
    ingredients: normalizeIngredients(recipe.ingredients),
    description: recipe.description ?? null,
    estimated_minutes: recipe.estimated_minutes ?? null,
    estimated_cost: recipe.estimated_cost ?? null,
    image_url: recipe.image_url ?? null,
  };
}

function normalizePantrySuggestion(suggestion: PantryRecipeSuggestion): PantryRecipeSuggestion {
  return {
    ...suggestion,
    recipe: normalizeRecipeSummary(suggestion.recipe),
    missing_ingredients: Array.isArray(suggestion.missing_ingredients) ? suggestion.missing_ingredients : [],
    match_pct: typeof suggestion.match_pct === 'number' ? suggestion.match_pct : 0,
    matched_count: typeof suggestion.matched_count === 'number' ? suggestion.matched_count : 0,
    missing_count: typeof suggestion.missing_count === 'number' ? suggestion.missing_count : 0,
  };
}

export const getRecipes = async (): Promise<RecipeSummary[]> => {
  const r = await apiClient.get<RecipeSummary[]>('/recipes');
  return Array.isArray(r.data) ? r.data.map(normalizeRecipeSummary) : [];
};

export const getRecipe = async (id: number): Promise<Recipe> => {
  const r = await apiClient.get<Recipe>(`/recipes/${id}`);
  return normalizeRecipe(r.data);
};

export const createRecipe = async (payload: CreateRecipePayload): Promise<Recipe> => {
  const r = await apiClient.post<Recipe>('/recipes', payload);
  return normalizeRecipe(r.data);
};

export const updateRecipe = async (id: number, payload: UpdateRecipePayload): Promise<Recipe> => {
  const r = await apiClient.put<Recipe>(`/recipes/${id}`, payload);
  return normalizeRecipe(r.data);
};

export const deleteRecipe = async (id: number): Promise<void> => {
  await apiClient.delete(`/recipes/${id}`);
};

export const duplicateRecipe = async (id: number): Promise<Recipe> => {
  const r = await apiClient.post<Recipe>(`/recipes/${id}/duplicate`);
  return normalizeRecipe(r.data);
};

export const addRecipeToList = async (
  id: number,
  payload: AddToListPayload
): Promise<AddToListResult> => {
  const r = await apiClient.post<AddToListResult>(`/recipes/${id}/add-to-list`, payload);
  return r.data;
};

export const getPantryRecipeSuggestions = async (): Promise<PantryRecipeSuggestion[]> => {
  const r = await apiClient.get<PantryRecipeSuggestion[]>('/recipes/suggestions/from-pantry');
  return Array.isArray(r.data) ? r.data.map(normalizePantrySuggestion) : [];
};
