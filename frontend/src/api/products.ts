import apiClient from './client';
import type { ProductSearchResult, Category } from '../types';

export const searchProducts = async (
  q: string,
  postal_code?: string
): Promise<ProductSearchResult> => {
  const params: Record<string, string> = { q };
  if (postal_code) params.postal_code = postal_code;
  const response = await apiClient.get<ProductSearchResult>('/products/search', { params });
  return response.data;
};

export const getCategories = async (): Promise<Category[]> => {
  const response = await apiClient.get<Category[]>('/products/categories');
  return response.data;
};

export const suggestProducts = async (
  product_name: string,
  list_context?: string
): Promise<string[]> => {
  const response = await apiClient.post<string[]>('/products/suggest', {
    product_name,
    list_context,
  });
  return response.data;
};
