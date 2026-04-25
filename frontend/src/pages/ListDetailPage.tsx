import { useState, useEffect, useCallback, KeyboardEvent } from 'react';
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
import ListForm from '../components/lists/ListForm';
import type { ShoppingList, ShoppingListItem, Product, CreateListPayload } from '../types';
import { buildInlineFallbackThumbnail, hasRealHttpImage } from '../utils/productThumbnails';

const THUMBNAIL_LOOKUP_LIMIT = 4;
const THUMBNAIL_LOOKUP_DELAY_MS = 250;
const thumbnailSearchCache = new Map<string, string | null>();

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

    const cacheKeyFor = (name: string, postalCode: string) =>
      `${postalCode.toLowerCase()}::${name.trim().toLowerCase()}`;

    const enrichThumbnails = async () => {
      if (!list?.items.length || !user?.postal_code) return;
      if (enrichedListId === list.id) return;

      const pendingItems = list.items
        .filter(
          (item) => !hasRealHttpImage(thumbnailOverrides[item.id] ?? item.product_thumbnail)
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

  const handleQuantitySet = async (item: ShoppingListItem, quantity: number) => {
    if (!list) return;
    const newQty = Math.max(1, Math.round(quantity * 100) / 100);
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
                    onQtySet={(quantity) => handleQuantitySet(item, quantity)}
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
                        onQtySet={(quantity) => handleQuantitySet(item, quantity)}
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
  onQtySet,
  onDelete,
  formatCurrency,
}: {
  item: ShoppingListItem;
  thumbnail: string | null;
  onToggle: () => void;
  onQtyChange: (delta: number) => void;
  onQtySet: (quantity: number) => void;
  onDelete: () => void;
  formatCurrency: (v: number | null) => string;
}) {
  const [quantityInput, setQuantityInput] = useState(String(item.quantity));

  useEffect(() => {
    setQuantityInput(String(item.quantity));
  }, [item.quantity]);

  const lineTotal =
    item.product_price != null ? item.product_price * item.quantity : null;
  const displayThumbnail =
    typeof thumbnail === 'string' && /^https?:\/\//i.test(thumbnail)
      ? thumbnail
      : buildInlineFallbackThumbnail(item.product_name, item.product_category);

  const commitQuantity = () => {
    const parsed = Number(quantityInput);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setQuantityInput(String(item.quantity));
      return;
    }

    const normalized = Math.round(parsed * 100) / 100;
    if (normalized !== item.quantity) {
      onQtySet(normalized);
    } else {
      setQuantityInput(String(item.quantity));
    }
  };

  const handleQuantityKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitQuantity();
    }
    if (event.key === 'Escape') {
      setQuantityInput(String(item.quantity));
    }
  };

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
        <div className="item-thumb-placeholder">??</div>
      )}

      <div className="item-info">
        <div className="item-name">{item.product_name}</div>
        <div className="item-meta">
          {item.product_category && <span>{item.product_category}</span>}
          {item.product_unit && <span> ? {item.product_unit}</span>}
          {item.product_price != null && (
            <span> ? {formatCurrency(item.product_price)}/ud</span>
          )}
        </div>
      </div>

      <div className="item-quantity-controls">
        <button className="qty-btn" onClick={() => onQtyChange(-1)} title="Restar">
          -
        </button>
        <input
          className="qty-input"
          type="number"
          min="1"
          step="0.1"
          value={quantityInput}
          onChange={(event) => setQuantityInput(event.target.value)}
          onBlur={commitQuantity}
          onKeyDown={handleQuantityKeyDown}
          aria-label={`Cantidad de ${item.product_name}`}
        />
        <button className="qty-btn" onClick={() => onQtyChange(1)} title="Sumar">
          +
        </button>
      </div>

      <div className="item-price">
        {lineTotal != null ? formatCurrency(lineTotal) : '?'}
      </div>

      <button
        className="btn-icon danger"
        onClick={onDelete}
        title="Eliminar"
      >
        ?
      </button>
    </div>
  );
}
