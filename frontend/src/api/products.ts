import apiClient from './client';
import type { ProductSearchResult, CategoryTreeResponse, CategoryProductsResponse } from '../types';

export const searchProducts = async (
  q: string,
  postal_code?: string
): Promise<ProductSearchResult> => {
  const params: Record<string, string> = { q };
  if (postal_code) params.postal_code = postal_code;
  const response = await apiClient.get<ProductSearchResult>('/products/search', { params });
  return response.data;
};

export const getCategories = async (
  postal_code?: string
): Promise<CategoryTreeResponse> => {
  const response = await apiClient.get<CategoryTreeResponse>('/products/categories', {
    params: postal_code ? { postal_code } : undefined,
  });
  return response.data;
};

export const getProductsByCategory = async (
  categoryId: string,
  postal_code?: string
): Promise<CategoryProductsResponse> => {
  const response = await apiClient.get<CategoryProductsResponse>(`/products/by-category/${categoryId}`, {
    params: postal_code ? { postal_code } : undefined,
  });
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
