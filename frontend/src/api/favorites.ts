import apiClient from './client';
import type { FavoriteProduct, Product } from '../types';

type FavoriteApiItem = {
  id: number;
  user_id: number;
  product_id: string;
  external_id?: string | null;
  product_name: string;
  product_price?: number | null;
  product_unit?: string | null;
  product_thumbnail?: string | null;
  product_image?: string | null;
  product_category?: string | null;
  product_subcategory?: string | null;
  source: string;
  created_at: string;
};

let favoritesCache: FavoriteProduct[] | null = null;
let favoritesPromise: Promise<FavoriteProduct[]> | null = null;

const mapFavorite = (item: FavoriteApiItem): FavoriteProduct => ({
  id: item.product_id,
  external_id: item.external_id ?? null,
  name: item.product_name,
  display_name: item.product_name,
  price: item.product_price ?? null,
  unit_size: item.product_unit ?? null,
  category: item.product_category ?? null,
  subcategory: item.product_subcategory ?? null,
  thumbnail: item.product_thumbnail ?? null,
  image: item.product_image ?? null,
  source: item.source,
  added_at: item.created_at,
});

const buildFavoriteCreatePayload = (product: Product) => ({
  product_id: product.id,
  external_id: product.external_id ?? null,
  product_name: product.display_name || product.name,
  product_price: product.price ?? null,
  product_unit: product.unit_size ?? null,
  product_thumbnail: product.thumbnail ?? null,
  product_image: product.image ?? null,
  product_category: product.category ?? null,
  product_subcategory: product.subcategory ?? null,
  source: product.source,
});

const fetchFavorites = async (): Promise<FavoriteProduct[]> => {
  const response = await apiClient.get<FavoriteApiItem[]>('/favorites');
  const favorites = response.data.map(mapFavorite);
  favoritesCache = favorites;
  return favorites;
};

const ensureFavoritesLoaded = async (force = false): Promise<FavoriteProduct[]> => {
  if (!force && favoritesCache) return favoritesCache;
  if (!force && favoritesPromise) return favoritesPromise;

  favoritesPromise = fetchFavorites().finally(() => {
    favoritesPromise = null;
  });

  return favoritesPromise;
};

export const getFavorites = async (): Promise<FavoriteProduct[]> => {
  return ensureFavoritesLoaded();
};

export const isFavorite = async (productId: string): Promise<boolean> => {
  const favorites = await ensureFavoritesLoaded();
  return favorites.some((item) => item.id === productId);
};

export const toggleFavorite = async (product: Product): Promise<FavoriteProduct[]> => {
  const favorites = await ensureFavoritesLoaded();
  const exists = favorites.some((item) => item.id === product.id);

  if (exists) {
    await apiClient.delete(`/favorites/${encodeURIComponent(product.id)}`);
    favoritesCache = favorites.filter((item) => item.id !== product.id);
    return favoritesCache;
  }

  const response = await apiClient.post<FavoriteApiItem>(
    '/favorites',
    buildFavoriteCreatePayload(product)
  );
  const created = mapFavorite(response.data);
  favoritesCache = [created, ...favorites.filter((item) => item.id !== created.id)];
  return favoritesCache;
};

export const removeFavorite = async (productId: string): Promise<FavoriteProduct[]> => {
  await apiClient.delete(`/favorites/${encodeURIComponent(productId)}`);
  const favorites = await ensureFavoritesLoaded();
  favoritesCache = favorites.filter((item) => item.id !== productId);
  return favoritesCache;
};

