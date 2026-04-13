import apiClient from './client';
import type {
  AddFrequentProductsPayload,
  CategoryProductsResponse,
  CategoryTreeResponse,
  FrequentProduct,
  ProductSearchResult,
} from '../types';

export const searchProducts = async (
  q: string,
  postal_code?: string
): Promise<ProductSearchResult> => {
  const params: Record<string, string> = { q };
  if (postal_code) params.postal_code = postal_code;
  const response = await apiClient.get<ProductSearchResult>('/products/search', { params });
  return response.data;
};

export const getCategories = async (postal_code?: string): Promise<CategoryTreeResponse> => {
  const params: Record<string, string> = {};
  if (postal_code) params.postal_code = postal_code;
  const response = await apiClient.get<CategoryTreeResponse>('/products/categories', { params });
  return response.data;
};

export const getProductsByCategory = async (
  categoryId: string | number,
  postal_code?: string
): Promise<CategoryProductsResponse> => {
  const params: Record<string, string> = {};
  if (postal_code) params.postal_code = postal_code;
  const response = await apiClient.get<CategoryProductsResponse>(
    `/products/categories/${categoryId}`,
    { params }
  );
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

export const getFrequentProducts = async (limit = 12): Promise<FrequentProduct[]> => {
  const response = await apiClient.get<FrequentProduct[]>('/products/frequent', {
    params: { limit },
  });
  return response.data;
};

export const addFrequentProductsToList = async (
  payload: AddFrequentProductsPayload
): Promise<{ list_id: number; list_name: string; added: number }> => {
  const response = await apiClient.post<{ list_id: number; list_name: string; added: number }>(
    '/products/frequent/add-to-list',
    payload
  );
  return response.data;
};
