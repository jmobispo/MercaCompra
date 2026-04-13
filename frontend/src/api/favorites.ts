import type { FavoriteProduct, Product } from '../types';

const STORAGE_KEY = 'mercacompra_favorites';

const readFavorites = (): FavoriteProduct[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as FavoriteProduct[]) : [];
  } catch {
    return [];
  }
};

const writeFavorites = (items: FavoriteProduct[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
};

export const getFavorites = async (): Promise<FavoriteProduct[]> => {
  return readFavorites();
};

export const isFavorite = async (productId: string): Promise<boolean> => {
  return readFavorites().some((item) => item.id === productId);
};

export const toggleFavorite = async (product: Product): Promise<FavoriteProduct[]> => {
  const current = readFavorites();
  const exists = current.some((item) => item.id === product.id);

  if (exists) {
    const next = current.filter((item) => item.id !== product.id);
    writeFavorites(next);
    return next;
  }

  const next = [
    {
      ...product,
      added_at: new Date().toISOString(),
    },
    ...current,
  ];
  writeFavorites(next);
  return next;
};

export const removeFavorite = async (productId: string): Promise<FavoriteProduct[]> => {
  const next = readFavorites().filter((item) => item.id !== productId);
  writeFavorites(next);
  return next;
};
