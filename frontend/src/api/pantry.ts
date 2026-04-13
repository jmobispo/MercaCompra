import apiClient from './client';
import type { PantryItem, CreatePantryItemPayload, UpdatePantryItemPayload } from '../types';

export const getPantry = async (): Promise<PantryItem[]> => {
  const response = await apiClient.get<PantryItem[]>('/pantry');
  return response.data;
};

export const addToPantry = async (payload: CreatePantryItemPayload): Promise<PantryItem> => {
  const response = await apiClient.post<PantryItem>('/pantry', payload);
  return response.data;
};

export const updatePantryItem = async (id: number, payload: UpdatePantryItemPayload): Promise<PantryItem> => {
  const response = await apiClient.put<PantryItem>(`/pantry/${id}`, payload);
  return response.data;
};

export const deletePantryItem = async (id: number): Promise<void> => {
  await apiClient.delete(`/pantry/${id}`);
};

export const pantryFromList = async (listId: number): Promise<PantryItem[]> => {
  const response = await apiClient.post<PantryItem[]>(`/pantry/from-list/${listId}`);
  return response.data;
};
