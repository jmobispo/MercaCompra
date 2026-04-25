import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  getList,
  updateList,
  deleteItem,
  updateItem,
  addItem,
  deleteList,
} from '../api/lists';
import { searchProducts } from '../api/products';
import { useAuthStore } from '../store/authStore';
import ProductSearch from '../components/products/ProductSearch';
import BudgetPanel from '../components/budget/BudgetPanel';
import AutomationPanel from '../components/automation/AutomationPanel';
import ListForm from '../components/lists/ListForm';
import type { ShoppingList, ShoppingListItem, Product, CreateListPayload } from '../types';

const THUMBNAIL_LOOKUP_LIMIT = 4;
const THUMBNAIL_LOOKUP_DELAY_MS = 250;
const thumbnailSearchCache = new Map<string, string | null>();

const FALLBACK_THUMB_THEME: Record<
  string,
  { icon: string; top: string; bottom: string; accent: string }
> = {
  verduras: { icon: '🥬', top: '#eefbf2', bottom: '#d7f5df', accent: '#2e8b57' },
  frutas: { icon: '🍎', top: '#fff4ea', bottom: '#ffe0c9', accent: '#d96b2b' },
  panaderia: { icon: '🥖', top: '#fff6e8', bottom: '#ffe7c2', accent: '#b7791f' },
  aceites: { icon: '🫒', top: '#f5f9e8', bottom: '#e4efbe', accent: '#6b8e23' },
  charcuteria: { icon: '🥓', top: '#fff0f0', bottom: '#ffdada', accent: '#b85c5c' },
  huevos: { icon: '🥚', top: '#fffdf4', bottom: '#f8f0c7', accent: '#9a7d2e' },
  quesos: { icon: '🧀', top: '#fffbe8', bottom: '#fff0a8', accent: '#b8860b' },
  carnes: { icon: '🥩', top: '#fff0f1', bottom: '#ffd8dc', accent: '#b94a62' },
  pescado: { icon: '🐟', top: '#eef7ff', bottom: '#d8ebff', accent: '#357ab8' },
  lacteos: { icon: '🥛', top: '#f4f8ff', bottom: '#dde7ff', accent: '#4c6fbf' },
  bebidas: { icon: '🥤', top: '#eefcff', bottom: '#d6f5fb', accent: '#2d8ca3' },
  congelados: { icon: '❄️', top: '#f1fbff', bottom: '#dbf3ff', accent: '#3e86b3' },
  conservas: { icon: '🥫', top: '#f9f2ff', bottom: '#eadbff', accent: '#7a58b3' },
  default: { icon: '🛒', top: '#f3f7fb', bottom: '#e2ebf5', accent: '#55708f' },
};

function normalizeCategoryKey(value: string | null | undefined) {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function buildInlineFallbackThumbnail(name: string, category: string | null | undefined) {
  const normalizedCategory = normalizeCategoryKey(category);
  const theme =
    FALLBACK_THUMB_THEME[normalizedCategory] ||
    (normalizedCategory.includes('verdur') ? FALLBACK_THUMB_THEME.verduras : null) ||
    (normalizedCategory.includes('frut') ? FALLBACK_THUMB_THEME.frutas : null) ||
    (normalizedCategory.includes('pan') ? FALLBACK_THUMB_THEME.panaderia : null) ||
    (normalizedCategory.includes('aceite') ? FALLBACK_THUMB_THEME.aceites : null) ||
    (normalizedCategory.includes('charcut') ? FALLBACK_THUMB_THEME.charcuteria : null) ||
    (normalizedCategory.includes('huevo') ? FALLBACK_THUMB_THEME.huevos : null) ||
    (normalizedCategory.includes('ques') ? FALLBACK_THUMB_THEME.quesos : null) ||
    (normalizedCategory.includes('carne') ? FALLBACK_THUMB_THEME.carnes : null) ||
    (normalizedCategory.includes('pesc') ? FALLBACK_THUMB_THEME.pescado : null) ||
    (normalizedCategory.includes('lact') ? FALLBACK_THUMB_THEME.lacteos : null) ||
    (normalizedCategory.includes('bebid') ? FALLBACK_THUMB_THEME.bebidas : null) ||
    (normalizedCategory.includes('congel') ? FALLBACK_THUMB_THEME.congelados : null) ||
    (normalizedCategory.includes('conserv') ? FALLBACK_THUMB_THEME.conservas : null) ||
    FALLBACK_THUMB_THEME.default;

  const shortName = (name || 'Producto').trim().split(/\s+/).slice(0, 2).join(' ').slice(0, 22);
  const safeName = shortName
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${theme.top}"/>
      <stop offset="100%" stop-color="${theme.bottom}"/>
    </linearGradient>
  </defs>
  <rect x="3" y="3" width="90" height="90" rx="18" fill="url(#g)"/>
  <rect x="10" y="10" width="76" height="76" rx="14" fill="rgba(255,255,255,0.52)"/>
  <circle cx="48" cy="34" r="18" fill="${theme.accent}" opacity="0.14"/>
  <text x="48" y="42" text-anchor="middle" font-family="Segoe UI Emoji, Apple Color Emoji, Segoe UI, Arial, sans-serif" font-size="22">${theme.icon}</text>
  <text x="48" y="68" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="9" font-weight="700" fill="${theme.accent}">${safeName}</text>
</svg>`.trim();

  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

export default function ListDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const [list, setList] = useState<ShoppingList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [addingItem, setAddingItem] = useState(false);
  const [thumbnailOverrides, setThumbnailOverrides] = useState<Record<number, string>>({});
  const [enrichedListId, setEnrichedListId] = useState<number | null>(null);
  const [thumbnailBatchCursor, setThumbnailBatchCursor] = useState(0);

  const listId = parseInt(id ?? '0', 10);

  const fetchList = useCallback(async () => {
    if (!listId) return;
    try {
      const data = await getList(listId);
      setList(data);
    } catch {
      setError('Error al cargar la lista');
    } finally {
      setLoading(false);
    }
  }, [listId]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  useEffect(() => {
    setThumbnailBatchCursor(0);
    setEnrichedListId(null);
  }, [list?.id]);

  useEffect(() => {
    let cancelled = false;

    const hasRealImage = (value: string | null | undefined) =>
      typeof value === 'string' && /^https?:\/\//i.test(value);

    const cacheKeyFor = (name: string, postalCode: string) =>
      `${postalCode.toLowerCase()}::${name.trim().toLowerCase()}`;

    const enrichThumbnails = async () => {
      if (!list?.items.length || !user?.postal_code) return;
      if (enrichedListId === list.id) return;

      const pendingItems = list.items
        .filter(
          (item) => !hasRealImage(thumbnailOverrides[item.id] ?? item.product_thumbnail)
        );
      if (!pendingItems.length) {
        setEnrichedListId(list.id);
        return;
      }

      const candidates = pendingItems.slice(
        thumbnailBatchCursor,
        thumbnailBatchCursor + THUMBNAIL_LOOKUP_LIMIT
      );
      if (!candidates.length) return;

      const nextOverrides: Record<number, string> = {};

      for (const item of candidates) {
        if (cancelled) return;

        const cacheKey = cacheKeyFor(item.product_name, user.postal_code);
        const cachedImage = thumbnailSearchCache.get(cacheKey);
        if (typeof cachedImage === 'string' && cachedImage.length > 0) {
          nextOverrides[item.id] = cachedImage;
          continue;
        }
        if (cachedImage === null) {
          continue;
        }

        try {
          const result = await searchProducts(item.product_name, user.postal_code);
          const realImageProduct = result.products.find(
            (product) =>
              (typeof product.thumbnail === 'string' && /^https?:\/\//i.test(product.thumbnail)) ||
              (typeof product.image === 'string' && /^https?:\/\//i.test(product.image))
          );

          const image =
            realImageProduct?.thumbnail ||
            realImageProduct?.image ||
            null;

          thumbnailSearchCache.set(cacheKey, image);
          if (image) {
            nextOverrides[item.id] = image;
          }
        } catch {
          thumbnailSearchCache.set(cacheKey, null);
        }
      }

      if (cancelled) return;

      if (Object.keys(nextOverrides).length > 0) {
        setThumbnailOverrides((current) => ({ ...current, ...nextOverrides }));
      }

      if (thumbnailBatchCursor + THUMBNAIL_LOOKUP_LIMIT >= pendingItems.length) {
        setEnrichedListId(list.id);
        return;
      }

      window.setTimeout(() => {
        if (!cancelled) {
          setThumbnailBatchCursor((current) => current + THUMBNAIL_LOOKUP_LIMIT);
        }
      }, THUMBNAIL_LOOKUP_DELAY_MS);
    };

    void enrichThumbnails();

    return () => {
      cancelled = true;
    };
  }, [enrichedListId, list, thumbnailBatchCursor, thumbnailOverrides, user?.postal_code]);

  // Compute real-time total
  const total =
    list?.items.reduce(
      (sum, item) =>
        sum + (item.product_price ?? 0) * item.quantity,
      0
    ) ?? 0;

  const handleAddProduct = async (product: Product) => {
    if (!list) return;
    setAddingItem(true);
    try {
      const updatedList = await addItem(list.id, {
        product_id: product.id,
        product_name: product.display_name ?? product.name,
        product_price: product.price,
        product_unit: product.unit_size,
        product_thumbnail: product.thumbnail,
        product_category: product.category,
        quantity: 1,
      });
      setList(updatedList);
    } catch {
      setError('Error al añadir el producto');
    } finally {
      setAddingItem(false);
    }
  };

  const handleToggleCheck = async (item: ShoppingListItem) => {
    if (!list) return;
    try {
      const updatedList = await updateItem(list.id, item.id, {
        is_checked: !item.is_checked,
      });
      setList(updatedList);
    } catch {
      setError('Error al actualizar el artículo');
    }
  };

  const handleQuantityChange = async (item: ShoppingListItem, delta: number) => {
    if (!list) return;
    const newQty = Math.max(1, item.quantity + delta);
    if (newQty === item.quantity) return;
    try {
      const updatedList = await updateItem(list.id, item.id, { quantity: newQty });
      setList(updatedList);
    } catch {
      setError('Error al actualizar la cantidad');
    }
  };

  const handleDeleteItem = async (item: ShoppingListItem) => {
    if (!list) return;
    try {
      await deleteItem(list.id, item.id);
      setList((prev) =>
        prev ? { ...prev, items: prev.items.filter((i) => i.id !== item.id) } : prev
      );
    } catch {
      setError('Error al eliminar el artículo');
    }
  };

  const handleUpdateList = async (payload: CreateListPayload) => {
    if (!list) return;
    const updated = await updateList(list.id, payload);
    setList(updated);
    setShowEditModal(false);
  };

  const handleInlineTitleSave = async () => {
    if (!list || !titleInput.trim()) {
      setEditingTitle(false);
      return;
    }
    try {
      const updated = await updateList(list.id, { name: titleInput.trim() });
      setList(updated);
    } catch {
      setError('Error al cambiar el nombre');
    }
    setEditingTitle(false);
  };

  const handleDeleteList = async () => {
    if (!list) return;
    if (!window.confirm(`¿Eliminar la lista "${list.name}"?`)) return;
    try {
      await deleteList(list.id);
      navigate('/lists');
    } catch {
      setError('Error al eliminar la lista');
    }
  };

  const formatCurrency = (val: number | null) =>
    val != null
      ? val.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
      : '—';

  if (loading) {
    return (
      <div className="loading-overlay">
        <span className="loading-spinner" />
        <span>Cargando lista…</span>
      </div>
    );
  }

  if (!list) {
    return (
      <div className="empty-state">
        <div className="empty-icon">❌</div>
        <p>Lista no encontrada</p>
        <button className="btn btn-secondary" onClick={() => navigate('/lists')}>
          Volver a listas
        </button>
      </div>
    );
  }

  const uncheckedItems = list.items.filter((i) => !i.is_checked);
  const checkedItems = list.items.filter((i) => i.is_checked);

  return (
    <div>
      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          {error}
          <button className="btn btn-ghost btn-sm" style={{ marginLeft: 8 }} onClick={() => setError('')}>
            ×
          </button>
        </div>
      )}

      {/* Title row */}
      <div className="list-title-row" style={{ marginBottom: 20 }}>
        {editingTitle ? (
          <input
            className="inline-edit-input"
            value={titleInput}
            autoFocus
            onChange={(e) => setTitleInput(e.target.value)}
            onBlur={handleInlineTitleSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleInlineTitleSave();
              if (e.key === 'Escape') setEditingTitle(false);
            }}
          />
        ) : (
          <h1
            style={{ cursor: 'pointer' }}
            title="Clic para editar"
            onClick={() => {
              setTitleInput(list.name);
              setEditingTitle(true);
            }}
          >
            {list.name}
          </h1>
        )}

        {list.is_archived && (
          <span className="badge archived">Archivada</span>
        )}

        <div className="actions-row" style={{ marginLeft: 'auto' }}>
          <Link
            to={`/lists/${listId}/supermarket`}
            className="btn btn-primary btn-sm"
            title="Vista optimizada para tienda"
          >
            🛒 Supermercado
          </Link>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowEditModal(true)}
          >
            ✏️ Editar
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => navigate('/lists')}
          >
            ← Volver
          </button>
          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }} onClick={handleDeleteList}>
            🗑
          </button>
        </div>
      </div>

      <div className="list-detail-layout">
        {/* Main area */}
        <div className="list-detail-main">
          {/* Product search */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <h2>Añadir productos</h2>
              {addingItem && <span className="loading-spinner" style={{ width: 16, height: 16 }} />}
            </div>
            <div className="card-body">
              <ProductSearch
                onAddProduct={handleAddProduct}
                postalCode={user?.postal_code}
                disabled={addingItem}
              />
            </div>
          </div>

          {/* Items list */}
          <div className="list-items-section">
            <div className="list-items-header">
              <span>Artículos ({list.items.length})</span>
              <span style={{ fontWeight: 400, fontSize: 12 }}>
                {uncheckedItems.length} pendientes · {checkedItems.length} marcados
              </span>
            </div>

            {list.items.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🛒</div>
                <p>La lista está vacía. Busca productos para añadir.</p>
              </div>
            ) : (
              <>
                {/* Unchecked items */}
                {uncheckedItems.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    thumbnail={thumbnailOverrides[item.id] ?? item.product_thumbnail}
                    onToggle={() => handleToggleCheck(item)}
                    onQtyChange={(delta) => handleQuantityChange(item, delta)}
                    onDelete={() => handleDeleteItem(item)}
                    formatCurrency={formatCurrency}
                  />
                ))}

                {/* Checked items */}
                {checkedItems.length > 0 && (
                  <>
                    <div
                      style={{
                        padding: '8px 16px',
                        fontSize: 12,
                        color: 'var(--color-text-muted)',
                        background: 'var(--color-bg)',
                        borderBottom: '1px solid var(--color-border)',
                      }}
                    >
                      En el carrito ({checkedItems.length})
                    </div>
                    {checkedItems.map((item) => (
                      <ItemRow
                        key={item.id}
                        item={item}
                        thumbnail={thumbnailOverrides[item.id] ?? item.product_thumbnail}
                        onToggle={() => handleToggleCheck(item)}
                        onQtyChange={(delta) => handleQuantityChange(item, delta)}
                        onDelete={() => handleDeleteItem(item)}
                        formatCurrency={formatCurrency}
                      />
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="list-detail-sidebar">
          <BudgetPanel
            total={total}
            budget={list.budget}
            onEditBudget={() => setShowEditModal(true)}
          />
          <AutomationPanel listId={list.id} />
        </div>
      </div>

      {/* Edit modal */}
      {showEditModal && (
        <ListForm
          onSubmit={handleUpdateList}
          onCancel={() => setShowEditModal(false)}
          initial={{
            id: list.id,
            name: list.name,
            budget: list.budget,
            is_archived: list.is_archived,
            item_count: list.items.length,
            total,
            updated_at: list.updated_at,
          }}
          title="Editar lista"
        />
      )}

    </div>
  );
}

// Sub-component for a single item row
function ItemRow({
  item,
  thumbnail,
  onToggle,
  onQtyChange,
  onDelete,
  formatCurrency,
}: {
  item: ShoppingListItem;
  thumbnail: string | null;
  onToggle: () => void;
  onQtyChange: (delta: number) => void;
  onDelete: () => void;
  formatCurrency: (v: number | null) => string;
}) {
  const lineTotal =
    item.product_price != null ? item.product_price * item.quantity : null;
  const displayThumbnail =
    typeof thumbnail === 'string' && /^https?:\/\//i.test(thumbnail)
      ? thumbnail
      : buildInlineFallbackThumbnail(item.product_name, item.product_category);

  return (
    <div className={`item-row ${item.is_checked ? 'checked' : ''}`}>
      <input
        type="checkbox"
        className="item-checkbox"
        checked={item.is_checked}
        onChange={onToggle}
      />

      {displayThumbnail ? (
        <img
          src={displayThumbnail}
          alt={item.product_name}
          className="item-thumb"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : (
        <div className="item-thumb-placeholder">🛒</div>
      )}

      <div className="item-info">
        <div className="item-name">{item.product_name}</div>
        <div className="item-meta">
          {item.product_category && <span>{item.product_category}</span>}
          {item.product_unit && <span> · {item.product_unit}</span>}
          {item.product_price != null && (
            <span> · {formatCurrency(item.product_price)}/ud</span>
          )}
        </div>
      </div>

      <div className="item-quantity-controls">
        <button className="qty-btn" onClick={() => onQtyChange(-1)} title="Restar">
          −
        </button>
        <span className="qty-value">{item.quantity}</span>
        <button className="qty-btn" onClick={() => onQtyChange(1)} title="Sumar">
          +
        </button>
      </div>

      <div className="item-price">
        {lineTotal != null ? formatCurrency(lineTotal) : '—'}
      </div>

      <button
        className="btn-icon danger"
        onClick={onDelete}
        title="Eliminar"
      >
        ×
      </button>
    </div>
  );
}
