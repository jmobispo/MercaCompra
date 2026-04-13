import apiClient from './client';
import type { FavoriteProduct, Product } from '../types';

export const getFavorites = async (): Promise<FavoriteProduct[]> => {
  const response = await apiClient.get<FavoriteProduct[]>('/favorites');
  return response.data;
};

export const addFavorite = async (product: Product): Promise<FavoriteProduct> => {
  const response = await apiClient.post<FavoriteProduct>('/favorites', {
    product_id: product.id,
    external_id: product.external_id ?? product.id,
    product_name: product.display_name ?? product.name,
    product_price: product.price,
    product_unit: product.unit_size,
    product_thumbnail: product.thumbnail,
    product_image: product.image ?? product.thumbnail,
    product_category: product.category,
    product_subcategory: product.subcategory,
    source: product.source,
  });
  return response.data;
};

export const deleteFavorite = async (productId: string): Promise<void> => {
  await apiClient.delete(`/favorites/${productId}`);
};
