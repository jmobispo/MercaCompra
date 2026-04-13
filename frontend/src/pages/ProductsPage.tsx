import { useEffect, useMemo, useState } from 'react';

import { addFavorite, deleteFavorite, getFavorites } from '../api/favorites';
import { createList, getLists, addItem } from '../api/lists';
import { getCategories, getProductsByCategory, searchProducts } from '../api/products';
import { useAuthStore } from '../store/authStore';
import type {
  Category,
  CategoryTreeResponse,
  FavoriteProduct,
  Product,
  ShoppingListSummary,
} from '../types';

function categoryHasChildren(category: Category) {
  return !!category.children && category.children.length > 0;
}

export default function ProductsPage() {
  const user = useAuthStore((s) => s.user);
  const postalCode = user?.postal_code ?? '28001';

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedCategoryName, setSelectedCategoryName] = useState<string>('Catálogo');
  const [products, setProducts] = useState<Product[]>([]);
  const [favorites, setFavorites] = useState<FavoriteProduct[]>([]);
  const [lists, setLists] = useState<ShoppingListSummary[]>([]);
  const [selectedListId, setSelectedListId] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [source, setSource] = useState<'mercadona_api' | 'fallback' | 'none'>('none');
  const [error, setError] = useState('');
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(false);

  useEffect(() => {
    void Promise.all([loadCategories(), loadFavorites(), loadLists()]);
  }, [postalCode]);

  async function loadCategories() {
    setLoadingCategories(true);
    try {
      const data: CategoryTreeResponse = await getCategories(postalCode);
      setCategories(data.categories);
      setSource(data.source);
      setError(data.error ?? '');
    } catch {
      setError('No se pudieron cargar las categorías');
    } finally {
      setLoadingCategories(false);
    }
  }

  async function loadFavorites() {
    try {
      setFavorites(await getFavorites());
    } catch {
      // non-blocking
    }
  }

  async function loadLists() {
    try {
      const data = (await getLists()).filter((item) => !item.is_archived);
      setLists(data);
      if (data.length > 0) {
        setSelectedListId(data[0].id);
      }
    } catch {
      // non-blocking
    }
  }

  async function handleCategoryClick(category: Category) {
    setSelectedCategoryId(category.id);
    setSelectedCategoryName(category.name);
    setQuery('');
    setLoadingProducts(true);
    try {
      const data = await getProductsByCategory(category.id, postalCode);
      setProducts(data.products);
      setSource(data.source);
      setError(data.error ?? '');
    } catch {
      setError('No se pudieron cargar los productos de la categoría');
      setProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  }

  async function handleSearch() {
    if (query.trim().length < 2) {
      return;
    }
    setLoadingProducts(true);
    setSelectedCategoryId(null);
    setSelectedCategoryName(`Resultados para "${query.trim()}"`);
    try {
      const data = await searchProducts(query.trim(), postalCode);
      setProducts(data.products);
      setSource(data.source);
      setError(data.error ?? '');
    } catch {
      setError('No se pudo completar la búsqueda');
      setProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  }

  async function handleToggleFavorite(product: Product) {
    const isFavorite = favorites.some((item) => item.product_id === product.id);
    if (isFavorite) {
      await deleteFavorite(product.id);
      setFavorites((prev) => prev.filter((item) => item.product_id !== product.id));
      return;
    }

    const created = await addFavorite(product);
    setFavorites((prev) => [created, ...prev]);
  }

  async function ensureTargetList(): Promise<number> {
    if (selectedListId) return selectedListId;
    const created = await createList({ name: 'Compra rápida' });
    setLists((prev) => [{ id: created.id, name: created.name, budget: created.budget, is_archived: created.is_archived, item_count: created.items.length, total: 0, updated_at: created.updated_at }, ...prev]);
    setSelectedListId(created.id);
    return created.id;
  }

  async function handleAddToList(product: Product) {
    const listId = await ensureTargetList();
    await addItem(listId, {
      product_id: product.id,
      product_name: product.display_name ?? product.name,
      product_price: product.price,
      product_unit: product.unit_size,
      product_thumbnail: product.thumbnail,
      product_category: product.category,
      quantity: 1,
    });
  }

  const favoriteIds = useMemo(() => new Set(favorites.map((item) => item.product_id)), [favorites]);

  return (
    <div className="catalog-layout">
      <section className="catalog-sidebar">
        <div className="card">
          <div className="card-header">
            <h2>Categorías</h2>
          </div>
          <div className="card-body catalog-sidebar-body">
            {loadingCategories ? <p>Cargando categorías…</p> : categories.map((category) => (
              <div key={category.id} className="category-block">
                {categoryHasChildren(category) ? (
                  <div className="category-label">
                    <span>{category.name}</span>
                    {category.product_count ? <small>{category.product_count}</small> : null}
                  </div>
                ) : (
                  <button
                    className={`category-link ${selectedCategoryId === category.id ? 'active' : ''}`}
                    onClick={() => void handleCategoryClick(category)}
                  >
                    <span>{category.name}</span>
                    {category.product_count ? <small>{category.product_count}</small> : null}
                  </button>
                )}
                {categoryHasChildren(category) && (
                  <div className="category-children">
                    {category.children!.map((child) => (
                      <button
                        key={child.id}
                        className={`category-link child ${selectedCategoryId === child.id ? 'active' : ''}`}
                        onClick={() => void handleCategoryClick(child)}
                      >
                        <span>{child.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="catalog-main">
        <div className="page-header">
          <div>
            <h1>{selectedCategoryName}</h1>
            <p>CP {postalCode} · origen {source}</p>
          </div>
          <div className="catalog-toolbar">
            <select
              value={selectedListId ?? ''}
              onChange={(e) => setSelectedListId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Compra rápida</option>
              {lists.map((list) => (
                <option key={list.id} value={list.id}>{list.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-body">
            <div className="catalog-search-row">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar productos reales de Mercadona o fallback"
                onKeyDown={(e) => e.key === 'Enter' && void handleSearch()}
              />
              <button className="btn btn-primary" onClick={() => void handleSearch()}>
                Buscar
              </button>
            </div>
            {source === 'fallback' ? (
              <div className="alert alert-info" style={{ marginTop: 12 }}>
                Mostrando fallback local porque Mercadona no devolvió resultados útiles.
              </div>
            ) : null}
            {error ? (
              <div className="alert alert-error" style={{ marginTop: 12 }}>
                {error}
              </div>
            ) : null}
          </div>
        </div>

        {loadingProducts ? (
          <div className="loading-overlay">
            <span className="loading-spinner" />
            <span>Cargando productos…</span>
          </div>
        ) : (
          <div className="catalog-grid">
            {products.map((product) => (
              <article key={`${product.source}-${product.id}`} className="catalog-card">
                <img
                  src={product.image ?? product.thumbnail ?? ''}
                  alt={product.display_name ?? product.name}
                  className="catalog-card-image"
                />
                <div className="catalog-card-body">
                  <div className="catalog-card-title">{product.display_name ?? product.name}</div>
                  <div className="catalog-card-meta">
                    <span>{product.category ?? 'Sin categoría'}</span>
                    {product.unit_size ? <span>· {product.unit_size}</span> : null}
                  </div>
                  <div className="catalog-card-price">
                    {product.price != null
                      ? product.price.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
                      : 'Precio no disponible'}
                  </div>
                </div>
                <div className="catalog-card-actions">
                  <button className="btn btn-secondary btn-sm" onClick={() => void handleAddToList(product)}>
                    Añadir a lista
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => void handleToggleFavorite(product)}>
                    {favoriteIds.has(product.id) ? 'Quitar favorito' : 'Favorito'}
                  </button>
                </div>
              </article>
            ))}
            {!products.length && !loadingProducts ? (
              <div className="empty-state">
                <div className="empty-icon">🛒</div>
                <p>Selecciona una categoría o busca un producto.</p>
              </div>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
