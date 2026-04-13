import { useEffect, useState } from 'react';

import { deleteFavorite, getFavorites } from '../api/favorites';
import { addItem, createList, getLists } from '../api/lists';
import type { FavoriteProduct, ShoppingListSummary } from '../types';

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<FavoriteProduct[]>([]);
  const [lists, setLists] = useState<ShoppingListSummary[]>([]);
  const [selectedListId, setSelectedListId] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    try {
      const [favoriteData, listData] = await Promise.all([getFavorites(), getLists()]);
      setFavorites(favoriteData);
      const activeLists = listData.filter((item) => !item.is_archived);
      setLists(activeLists);
      if (activeLists.length > 0) setSelectedListId(activeLists[0].id);
    } catch {
      setError('No se pudieron cargar los favoritos');
    }
  }

  async function ensureTargetList(): Promise<number> {
    if (selectedListId) return selectedListId;
    const created = await createList({ name: 'Favoritos' });
    setLists((prev) => [{ id: created.id, name: created.name, budget: created.budget, is_archived: created.is_archived, item_count: created.items.length, total: 0, updated_at: created.updated_at }, ...prev]);
    setSelectedListId(created.id);
    return created.id;
  }

  async function handleAddToList(item: FavoriteProduct) {
    const listId = await ensureTargetList();
    await addItem(listId, {
      product_id: item.product_id,
      product_name: item.product_name,
      product_price: item.product_price,
      product_unit: item.product_unit,
      product_thumbnail: item.product_thumbnail,
      product_category: item.product_category,
      quantity: 1,
    });
  }

  async function handleRemove(productId: string) {
    await deleteFavorite(productId);
    setFavorites((prev) => prev.filter((item) => item.product_id !== productId));
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Favoritos</h1>
          <p>Productos guardados para reutilizar rápido</p>
        </div>
        <select
          value={selectedListId ?? ''}
          onChange={(e) => setSelectedListId(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">Lista rápida</option>
          {lists.map((list) => (
            <option key={list.id} value={list.id}>{list.name}</option>
          ))}
        </select>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="catalog-grid">
        {favorites.map((item) => (
          <article key={item.id} className="catalog-card">
            <img
              src={item.product_image ?? item.product_thumbnail ?? ''}
              alt={item.product_name}
              className="catalog-card-image"
            />
            <div className="catalog-card-body">
              <div className="catalog-card-title">{item.product_name}</div>
              <div className="catalog-card-meta">
                <span>{item.product_category ?? 'Sin categoría'}</span>
                {item.product_unit ? <span>· {item.product_unit}</span> : null}
              </div>
              <div className="catalog-card-price">
                {item.product_price != null
                  ? item.product_price.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
                  : 'Precio no disponible'}
              </div>
            </div>
            <div className="catalog-card-actions">
              <button className="btn btn-secondary btn-sm" onClick={() => void handleAddToList(item)}>
                Añadir a lista
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => void handleRemove(item.product_id)}>
                Quitar
              </button>
            </div>
          </article>
        ))}
        {!favorites.length ? (
          <div className="empty-state">
            <div className="empty-icon">⭐</div>
            <p>Aún no tienes favoritos guardados.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
