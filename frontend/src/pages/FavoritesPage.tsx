import { useEffect, useState } from 'react';
import { getFavorites, removeFavorite } from '../api/favorites';
import { addItem, createList, getLists } from '../api/lists';
import type { FavoriteProduct, ShoppingListSummary } from '../types';

async function ensureQuickList(): Promise<ShoppingListSummary> {
  const lists = await getLists();
  const active = lists.find((list) => !list.is_archived);
  if (active) return active;
  const created = await createList({ name: 'Compra rápida' });
  return {
    id: created.id,
    name: created.name,
    budget: created.budget,
    is_archived: created.is_archived,
    item_count: created.items.length,
    total: created.items.reduce(
      (sum, item) => sum + (item.product_price ?? 0) * item.quantity,
      0
    ),
    updated_at: created.updated_at,
  };
}

const formatPrice = (price: number | null) =>
  typeof price === 'number' ? `${price.toFixed(2)} EUR` : 'Precio no disponible';

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<FavoriteProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadFavorites = async () => {
    setLoading(true);
    try {
      const items = await getFavorites();
      setFavorites(items);
    } catch {
      setError('No se pudieron cargar los favoritos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadFavorites();
  }, []);

  const handleAddToList = async (product: FavoriteProduct) => {
    const list = await ensureQuickList();
    await addItem(list.id, {
      product_id: product.id,
      product_name: product.display_name || product.name,
      product_price: product.price,
      product_unit: product.unit_size,
      product_thumbnail: product.thumbnail,
      product_category: product.category,
      quantity: 1,
    });
  };

  const handleRemove = async (productId: string) => {
    const next = await removeFavorite(productId);
    setFavorites(next);
  };

  if (loading) {
    return (
      <div className="loading-overlay">
        <span className="loading-spinner" />
        <span>Cargando favoritos...</span>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Favoritos</h1>
          <p>{favorites.length} producto(s) guardado(s)</p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {favorites.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">*</div>
          <p>Todavía no tienes productos favoritos.</p>
        </div>
      ) : (
        <div className="catalog-grid">
          {favorites.map((product) => (
            <article key={product.id} className="product-card">
              <div className="product-card-media">
                {product.thumbnail ? (
                  <img src={product.thumbnail} alt={product.name} />
                ) : (
                  <div className="product-card-placeholder">IMG</div>
                )}
              </div>
              <div className="product-card-body">
                <h3>{product.display_name || product.name}</h3>
                <p className="product-card-meta">
                  {product.category || 'Sin categoría'}
                  {product.unit_size ? ` · ${product.unit_size}` : ''}
                </p>
                <div className="product-card-price">{formatPrice(product.price)}</div>
              </div>
              <div className="product-card-actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => void handleRemove(product.id)}
                >
                  Quitar
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => void handleAddToList(product)}
                >
                  Añadir a lista
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
