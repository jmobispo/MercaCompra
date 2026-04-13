import apiClient from './client';
import type {
  ShoppingList,
  ShoppingListSummary,
  CreateListPayload,
  UpdateListPayload,
  AddItemPayload,
  UpdateItemPayload,
  SupermarketView,
} from '../types';

export const getLists = async (): Promise<ShoppingListSummary[]> => {
  const response = await apiClient.get<ShoppingListSummary[]>('/lists');
  return response.data;
};

export const createList = async (payload: CreateListPayload): Promise<ShoppingList> => {
  const response = await apiClient.post<ShoppingList>('/lists', payload);
  return response.data;
};

export const getList = async (id: number): Promise<ShoppingList> => {
  const response = await apiClient.get<ShoppingList>(`/lists/${id}`);
  return response.data;
};

export const updateList = async (id: number, payload: UpdateListPayload): Promise<ShoppingList> => {
  const response = await apiClient.put<ShoppingList>(`/lists/${id}`, payload);
  return response.data;
};

export const deleteList = async (id: number): Promise<void> => {
  await apiClient.delete(`/lists/${id}`);
};

export const duplicateList = async (id: number): Promise<ShoppingList> => {
  const response = await apiClient.post<ShoppingList>(`/lists/${id}/duplicate`);
  return response.data;
};

export const addItem = async (listId: number, payload: AddItemPayload): Promise<ShoppingList> => {
  const response = await apiClient.post<ShoppingList>(`/lists/${listId}/items`, payload);
  return response.data;
};

export const updateItem = async (
  listId: number,
  itemId: number,
  payload: UpdateItemPayload
): Promise<ShoppingList> => {
  const response = await apiClient.patch<ShoppingList>(`/lists/${listId}/items/${itemId}`, payload);
  return response.data;
};

export const deleteItem = async (listId: number, itemId: number): Promise<void> => {
  await apiClient.delete(`/lists/${listId}/items/${itemId}`);
};

export const getSupermarketView = async (listId: number): Promise<SupermarketView> => {
  const response = await apiClient.get<SupermarketView>(`/lists/${listId}/supermarket`);
  return response.data;
};
