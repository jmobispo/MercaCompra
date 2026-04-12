import apiClient from './client';
import type {
  Recipe,
  RecipeSummary,
  CreateRecipePayload,
  UpdateRecipePayload,
  AddToListPayload,
  AddToListResult,
} from '../types';

export const getRecipes = async (): Promise<RecipeSummary[]> => {
  const r = await apiClient.get<RecipeSummary[]>('/recipes');
  return r.data;
};

export const getRecipe = async (id: number): Promise<Recipe> => {
  const r = await apiClient.get<Recipe>(`/recipes/${id}`);
  return r.data;
};

export const createRecipe = async (payload: CreateRecipePayload): Promise<Recipe> => {
  const r = await apiClient.post<Recipe>('/recipes', payload);
  return r.data;
};

export const updateRecipe = async (id: number, payload: UpdateRecipePayload): Promise<Recipe> => {
  const r = await apiClient.put<Recipe>(`/recipes/${id}`, payload);
  return r.data;
};

export const deleteRecipe = async (id: number): Promise<void> => {
  await apiClient.delete(`/recipes/${id}`);
};

export const duplicateRecipe = async (id: number): Promise<Recipe> => {
  const r = await apiClient.post<Recipe>(`/recipes/${id}/duplicate`);
  return r.data;
};

export const addRecipeToList = async (
  id: number,
  payload: AddToListPayload
): Promise<AddToListResult> => {
  const r = await apiClient.post<AddToListResult>(`/recipes/${id}/add-to-list`, payload);
  return r.data;
};
