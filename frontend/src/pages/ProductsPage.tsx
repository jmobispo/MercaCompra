import { FormEvent, useEffect, useMemo, useState } from 'react';

import { isFavorite, toggleFavorite } from '../api/favorites';
import { addItem, createList, getLists } from '../api/lists';
import { getCategories, getProductsByCategory, searchProducts } from '../api/products';
import { useAuth } from '../hooks/useAuth';
import type {
  CategoryNode,
  CategoryProductsResponse,
  CategoryTreeResponse,
  Product,
  ProductSearchResult,
  ShoppingListSummary,
} from '../types';

type CategoryGroup = {
  id: string;
  name: string;
  children: CategoryNode[];
  selectableSelf?: boolean;
};

const formatPrice = (price: number | null) =>
  typeof price === 'number'
    ? price.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
    : 'Precio no disponible';

const getSourceLabel = (source: Product['source'] | 'none') => {
  if (source === 'mercadona_api') return 'Mercadona real';
  if (source === 'fallback') return 'Catalogo local';
  return 'Sin origen';
};

const getImage = (raw: Record<string, unknown>) => {
  const thumbnail = raw.thumbnail;
  if (typeof thumbnail === 'string' && thumbnail) return thumbnail;

  const photos = raw.photos;
  if (Array.isArray(photos)) {
    const first = photos[0];
    if (typeof first === 'string' && first) return first;
    if (first && typeof first === 'object') {
      const candidate = (first as Record<string, unknown>).regular;
      if (typeof candidate === 'string' && candidate) return candidate;
    }
  }

  return null;
};

const normalizePrice = (raw: Record<string, unknown>) => {
  const priceInstructions = raw.price_instructions;
  if (priceInstructions && typeof priceInstructions === 'object') {
    const info = priceInstructions as Record<string, unknown>;
    const value = info.unit_price ?? info.bulk_price;
    if (typeof value === 'number') return value;
  }
  return typeof raw.price === 'number' ? raw.price : null;
};

const normalizeUnitSize = (raw: Record<string, unknown>) => {
  const priceInstructions = raw.price_instructions;
  if (priceInstructions && typeof priceInstructions === 'object') {
    const value = (priceInstructions as Record<string, unknown>).unit_size;
    if (typeof value === 'string' && value) return value;
  }
  return typeof raw.format === 'string' ? raw.format : null;
};

const normalizeCategoryTree = (payload: CategoryTreeResponse | Record<string, unknown>): CategoryGroup[] => {
  const root =
    (Array.isArray((payload as CategoryTreeResponse).results) && (payload as CategoryTreeResponse).results) ||
    (Array.isArray((payload as { categories?: CategoryNode[] }).categories) &&
      (payload as { categories?: CategoryNode[] }).categories) ||
    [];

  return root.map((node) => {
    const children =
      (Array.isArray(node.children) && node.children) ||
      ((node as unknown as { categories?: CategoryNode[] }).categories ?? []);

    return {
      id: String(node.id),
      name: node.name,
      children:
        children.length > 0
          ? children.map((child) => ({
              id: String(child.id),
              name: child.name,
              children: child.children,
            }))
          : [
              {
                id: String(node.id),
                name: node.name,
                children: [],
              },
            ],
      selectableSelf: children.length === 0,
    };
  });
};

const normalizeCategoryProducts = (payload: CategoryProductsResponse | Record<string, unknown>): Product[] => {
  const normalizedPayloadProducts = (payload as CategoryProductsResponse).products;
  const normalizedCategoryName =
    typeof (payload as CategoryProductsResponse).category_name === 'string'
      ? (payload as CategoryProductsResponse).category_name
      : null;

  if (Array.isArray(normalizedPayloadProducts) && normalizedPayloadProducts.length > 0) {
    return normalizedPayloadProducts.map((product) => ({
      ...product,
      category: product.category || normalizedCategoryName || null,
      thumbnail: product.thumbnail || product.image || null,
    }));
  }

  const normalized: Product[] = [];
  const source =
    typeof (payload as CategoryProductsResponse).source === 'string'
      ? ((payload as CategoryProductsResponse).source as Product['source'])
      : 'mercadona_api';

  const visitNode = (node: Record<string, unknown>, inheritedCategory?: string | null) => {
    const nodeName = typeof node.name === 'string' ? node.name : inheritedCategory ?? null;

    const directProducts = Array.isArray(node.products) ? node.products : [];
    directProducts.forEach((raw) => {
      const item = raw as Record<string, unknown>;
      normalized.push({
        id: String(item.id ?? ''),
        name:
          (typeof item.display_name === 'string' && item.display_name) ||
          (typeof item.name === 'string' && item.name) ||
          'Producto',
        display_name: typeof item.display_name === 'string' ? item.display_name : null,
        price: normalizePrice(item),
        unit_size: normalizeUnitSize(item),
        category: nodeName,
        thumbnail: getImage(item),
        source,
      });
    });

    const children = Array.isArray(node.categories)
      ? node.categories
      : Array.isArray(node.results)
        ? node.results
        : [];

    children.forEach((child) => {
      if (child && typeof child === 'object') {
        visitNode(child as Record<string, unknown>, nodeName);
      }
    });
  };

  const categoryGroups = (payload as CategoryProductsResponse).categories;
  if (Array.isArray(categoryGroups)) {
    categoryGroups.forEach((group) => visitNode(group as Record<string, unknown>));
  } else if (payload && typeof payload === 'object') {
    visitNode(payload as Record<string, unknown>);
  }

  return normalized;
};

async function ensureQuickList(): Promise<ShoppingListSummary> {
  const lists = await getLists();
  const active = lists.find((list) => !list.is_archived);
  if (active) return active;
  const created = await createList({ name: 'Compra rapida' });
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

export default function ProductsPage() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState('');
  const [title, setTitle] = useState('Selecciona una categoria o busca');
  const [source, setSource] = useState<'mercadona_api' | 'fallback' | 'none'>('none');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Record<string, boolean>>({});
  const postalCode = user?.postal_code;

  useEffect(() => {
    const loadCategories = async () => {
      setLoadingCategories(true);
      setError('');
      try {
        const response = await getCategories(postalCode);
        setGroups(normalizeCategoryTree(response));
      } catch {
        setError('No se pudo cargar el catalogo');
      } finally {
        setLoadingCategories(false);
      }
    };

    void loadCategories();
  }, [postalCode]);

  const allChildren = useMemo(
    () => groups.flatMap((group) => group.children.map((child) => ({ ...child, parentName: group.name }))),
    [groups]
  );

  useEffect(() => {
    const loadFavoriteState = async () => {
      const state: Record<string, boolean> = {};
      await Promise.all(
        products.map(async (product) => {
          state[product.id] = await isFavorite(product.id);
        })
      );
      setFavoriteIds(state);
    };

    void loadFavoriteState();
  }, [products]);

  const runSearch = async (nextQuery: string) => {
    setLoadingProducts(true);
    setError('');
    setSuccess('');
    setActiveCategoryId(null);
    try {
      const result: ProductSearchResult = await searchProducts(nextQuery, postalCode);
      setProducts(result.products);
      setTitle(`Resultados para "${nextQuery}"`);
      setSource(result.source);
      setError(result.error && result.products.length === 0 ? 'No se pudo completar la busqueda' : '');
    } catch {
      setProducts([]);
      setSource('none');
      setError('No se pudo completar la busqueda');
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleSearch = async (event: FormEvent) => {
    event.preventDefault();
    const next = query.trim();
    if (!next) return;
    await runSearch(next);
  };

  const handleCategoryClick = async (categoryId: string, categoryName: string) => {
    setLoadingProducts(true);
    setError('');
    setSuccess('');
    setActiveCategoryId(categoryId);
    try {
      const response = await getProductsByCategory(categoryId, postalCode);
      const normalizedProducts = normalizeCategoryProducts(response);
      setProducts(normalizedProducts);
      setTitle(categoryName);
      setSource(typeof response.source === 'string' ? response.source : 'mercadona_api');
      setError(response.error && normalizedProducts.length === 0 ? 'No se pudo cargar esa categoria' : '');
    } catch {
      setProducts([]);
      setSource('none');
      setError('No se pudo cargar esa categoria');
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleAddToList = async (product: Product) => {
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
    setSuccess(`${product.display_name || product.name} anadido a ${list.name}`);
    setTimeout(() => setSuccess(''), 2800);
  };

  const handleToggleFavorite = async (product: Product) => {
    const wasFavorite = Boolean(favoriteIds[product.id]);
    const items = await toggleFavorite(product);
    setFavoriteIds(
      items.reduce<Record<string, boolean>>((acc, item) => {
        acc[item.id] = true;
        return acc;
      }, {})
    );
    setSuccess(
      wasFavorite
        ? `${product.display_name || product.name} quitado de favoritos`
        : `${product.display_name || product.name} anadido a favoritos`
    );
    setTimeout(() => setSuccess(''), 2400);
  };

  return (
    <div className="catalog-page">
      <aside className="catalog-sidebar card">
        <div className="card-header">
          <h2>Categorias</h2>
        </div>
        <div className="catalog-tree">
          {loadingCategories ? (
            <div className="loading-overlay">
              <span className="loading-spinner" />
              <span>Cargando catalogo...</span>
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.id} className="catalog-group">
                {!group.selectableSelf && <div className="catalog-group-title">{group.name}</div>}
                {group.children.map((child) => (
                  <button
                    key={child.id}
                    type="button"
                    className={`catalog-link ${activeCategoryId === child.id ? 'active' : ''}`}
                    onClick={() => void handleCategoryClick(child.id, child.name)}
                  >
                    {child.name}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </aside>

      <section className="catalog-main">
        <div className="page-header">
          <div>
            <h1>{title}</h1>
            <p>CP {postalCode || 'sin definir'} · {products.length} producto(s)</p>
          </div>
          <span className={`catalog-source-badge catalog-source-${source}`}>
            {getSourceLabel(source)}
          </span>
        </div>

        <div className="card catalog-search-card">
          <div className="card-body">
            <form className="catalog-search-form" onSubmit={(event) => void handleSearch(event)}>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar productos reales o catalogo local"
              />
              <button type="submit" className="btn btn-primary" disabled={loadingProducts}>
                Buscar
              </button>
            </form>
            {error && <div className="alert alert-error">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}
            {source === 'fallback' && !error && (
              <div className="alert alert-info">
                Mostrando catalogo local porque Mercadona no devolvio resultados utiles.
              </div>
            )}
          </div>
        </div>

        {loadingProducts ? (
          <div className="loading-overlay">
            <span className="loading-spinner" />
            <span>Cargando productos...</span>
          </div>
        ) : products.length > 0 ? (
          <div className="catalog-grid">
            {products.map((product) => (
              <article key={product.id} className="product-card">
                <div className="product-card-media">
                  {product.thumbnail ? (
                    <img src={product.thumbnail} alt={product.name} />
                  ) : (
                    <div className="product-card-placeholder">Producto</div>
                  )}
                </div>
                <div className="product-card-body">
                  <h3>{product.display_name || product.name}</h3>
                  <div className="product-card-meta">
                    <span>{product.category || 'Sin categoria'}</span>
                    {product.unit_size ? <span>{product.unit_size}</span> : null}
                  </div>
                  <div className="product-card-price">{formatPrice(product.price)}</div>
                </div>
                <div className="product-card-actions">
                  <button
                    type="button"
                    className={`btn btn-secondary btn-sm ${favoriteIds[product.id] ? 'is-active' : ''}`}
                    onClick={() => void handleToggleFavorite(product)}
                  >
                    {favoriteIds[product.id] ? 'Quitar' : 'Favorito'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => void handleAddToList(product)}
                  >
                    Anadir
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state catalog-empty">
            <div className="empty-icon">•</div>
            <p>
              {allChildren.length === 0
                ? 'No hay categorias disponibles.'
                : 'Selecciona una categoria o busca un producto.'}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
