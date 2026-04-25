import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import { getSupermarketView, updateItem } from '../api/lists';
import { pantryFromList } from '../api/pantry';
import { searchProducts } from '../api/products';
import { useAuthStore } from '../store/authStore';
import type { ShoppingListItem, SupermarketView } from '../types';
import { buildInlineFallbackThumbnail, hasRealHttpImage } from '../utils/productThumbnails';

const THUMBNAIL_LOOKUP_LIMIT = 4;
const THUMBNAIL_LOOKUP_DELAY_MS = 250;
const supermarketThumbnailCache = new Map<string, string | null>();

export default function SupermarketModePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const listId = parseInt(id ?? '0', 10);
  const user = useAuthStore((s) => s.user);

  const [view, setView] = useState<SupermarketView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [hideChecked, setHideChecked] = useState(false);
  const [toggling, setToggling] = useState<number | null>(null);
  const [sendingToPantry, setSendingToPantry] = useState(false);
  const [lastPantrySyncKey, setLastPantrySyncKey] = useState('');
  const [thumbnailOverrides, setThumbnailOverrides] = useState<Record<number, string>>({});
  const [thumbnailBatchCursor, setThumbnailBatchCursor] = useState(0);
  const [enrichedViewKey, setEnrichedViewKey] = useState<string | null>(null);

  const fetchView = useCallback(async () => {
    if (!listId) return;
    try {
      const data = await getSupermarketView(listId);
      setView(data);
    } catch {
      setError('Error al cargar la lista');
    } finally {
      setLoading(false);
    }
  }, [listId]);

  useEffect(() => {
    void fetchView();
  }, [fetchView]);

  useEffect(() => {
    setThumbnailOverrides({});
    setThumbnailBatchCursor(0);
    setEnrichedViewKey(null);
  }, [view?.list_name, view?.groups.length]);

  useEffect(() => {
    let cancelled = false;

    const cacheKeyFor = (name: string, postalCode: string) =>
      `${postalCode.toLowerCase()}::${name.trim().toLowerCase()}`;

    const enrichThumbnails = async () => {
      if (!view?.groups.length || !user?.postal_code) return;

      const viewKey = `${listId}:${view.groups.length}:${view.total_items}`;
      if (enrichedViewKey === viewKey) return;

      const allItems = view.groups.flatMap((group) => group.items);
      const pendingItems = allItems.filter(
        (item) => !hasRealHttpImage(thumbnailOverrides[item.id] ?? item.product_thumbnail)
      );

      if (!pendingItems.length) {
        setEnrichedViewKey(viewKey);
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
        const cachedImage = supermarketThumbnailCache.get(cacheKey);
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
              hasRealHttpImage(product.thumbnail) || hasRealHttpImage(product.image)
          );
          const image = realImageProduct?.thumbnail || realImageProduct?.image || null;
          supermarketThumbnailCache.set(cacheKey, image);
          if (image) {
            nextOverrides[item.id] = image;
          }
        } catch {
          supermarketThumbnailCache.set(cacheKey, null);
        }
      }

      if (cancelled) return;

      if (Object.keys(nextOverrides).length > 0) {
        setThumbnailOverrides((current) => ({ ...current, ...nextOverrides }));
      }

      if (thumbnailBatchCursor + THUMBNAIL_LOOKUP_LIMIT >= pendingItems.length) {
        setEnrichedViewKey(viewKey);
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
  }, [enrichedViewKey, listId, thumbnailBatchCursor, thumbnailOverrides, user?.postal_code, view]);

  const handleToggle = async (item: ShoppingListItem) => {
    if (toggling) return;
    setToggling(item.id);
    try {
      await updateItem(listId, item.id, { is_checked: !item.is_checked });
      setLastPantrySyncKey('');
      setView((prev) => {
        if (!prev) return prev;
        const newGroups = prev.groups.map((group) => ({
          ...group,
          items: group.items.map((entry) =>
            entry.id === item.id ? { ...entry, is_checked: !entry.is_checked } : entry
          ),
        }));
        const allItems = newGroups.flatMap((group) => group.items);
        return {
          ...prev,
          groups: newGroups,
          checked_items: allItems.filter((entry) => entry.is_checked).length,
        };
      });
    } catch {
      setError('Error al actualizar el artículo');
    } finally {
      setToggling(null);
    }
  };

  const handleSendToPantry = async () => {
    if (!view) return;
    const syncKey = view.groups
      .flatMap((group) => group.items)
      .filter((item) => item.is_checked)
      .map((item) => `${item.id}:${item.quantity}`)
      .sort()
      .join('|');
    if (syncKey && syncKey === lastPantrySyncKey) {
      setSuccess('Esta compra ya se habia pasado a la despensa');
      setError('');
      return;
    }
    setSendingToPantry(true);
    try {
      const added = await pantryFromList(listId, { checked_only: true });
      if (added.length === 0) {
        setError('Marca primero los artículos comprados para poder pasarlos a la despensa');
        setSuccess('');
      } else {
        setSuccess(`${added.length} producto(s) enviados a la despensa`);
        setLastPantrySyncKey(syncKey);
        setError('');
      }
    } catch {
      setError('No se pudo pasar la compra a la despensa');
      setSuccess('');
    } finally {
      setSendingToPantry(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-overlay">
        <span className="loading-spinner" />
        <span>Cargando lista...</span>
      </div>
    );
  }

  if (!view) {
    return (
      <div className="empty-state">
        <div className="empty-icon">•</div>
        <p>Lista no encontrada</p>
        <button className="btn btn-secondary" onClick={() => navigate('/lists')}>
          Volver a listas
        </button>
      </div>
    );
  }

  const progress = view.total_items > 0
    ? Math.round((view.checked_items / view.total_items) * 100)
    : 0;
  const checkedTotal = view.groups
    .flatMap((group) => group.items)
    .filter((item) => item.is_checked)
    .reduce((sum, item) => sum + ((item.product_price ?? 0) * item.quantity), 0);

  return (
    <div className="supermarket-shell">
      {success && (
        <div className="alert alert-success" style={{ marginBottom: 12 }}>
          {success}
          <button className="btn btn-ghost btn-sm" style={{ marginLeft: 8 }} onClick={() => setSuccess('')}>
            ×
          </button>
        </div>
      )}
      {error && (
        <div className="alert alert-error" style={{ marginBottom: 12 }}>
          {error}
          <button className="btn btn-ghost btn-sm" style={{ marginLeft: 8 }} onClick={() => setError('')}>
            ×
          </button>
        </div>
      )}

      <div className="supermarket-sticky">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => navigate(`/lists/${listId}`)}
            style={{ padding: '4px 8px' }}
          >
            ← Volver
          </button>
          <h2 style={{ margin: 0, fontSize: 18, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {view.list_name}
          </h2>
          <button
            className={`btn btn-sm ${hideChecked ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setHideChecked((value) => !value)}
            style={{ whiteSpace: 'nowrap', fontSize: 12 }}
          >
            {hideChecked ? 'Mostrar todo' : 'Ocultar comprados'}
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => void handleSendToPantry()}
            disabled={sendingToPantry || view.checked_items === 0}
            style={{ whiteSpace: 'nowrap', fontSize: 12 }}
          >
            {sendingToPantry ? 'Pasando...' : 'Pasar a despensa'}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="progress-bar-container" style={{ flex: 1, marginTop: 0 }}>
            <div
              className={`progress-bar${progress === 100 ? '' : ''}`}
              style={{
                width: `${progress}%`,
                background: progress === 100
                  ? 'linear-gradient(90deg, #15803d, #22c55e)'
                  : 'linear-gradient(90deg, var(--color-primary-dark), var(--color-primary), var(--color-primary-soft))',
              }}
            />
          </div>
          <div style={{ display: 'grid', justifyItems: 'end', gap: 2, flexShrink: 0 }}>
            <span style={{ fontSize: 13, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
              {view.checked_items}/{view.total_items}
            </span>
            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-primary-dark)', whiteSpace: 'nowrap' }}>
              {checkedTotal.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
            </span>
          </div>
        </div>
      </div>

      {view.groups.map((group) => {
        const visibleItems = hideChecked
          ? group.items.filter((item) => !item.is_checked)
          : group.items;

        if (visibleItems.length === 0) return null;

        return (
          <div key={group.category} style={{ marginBottom: 8 }}>
            <div className="supermarket-group-header">
              {group.category}
              <span style={{ marginLeft: 6, fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>
                ({group.items.filter((item) => item.is_checked).length}/{group.items.length})
              </span>
            </div>

            {visibleItems.map((item) => (
              <SupermarketItemRow
                key={item.id}
                item={item}
                thumbnail={thumbnailOverrides[item.id] ?? item.product_thumbnail}
                onToggle={() => handleToggle(item)}
                disabled={toggling === item.id}
              />
            ))}
          </div>
        );
      })}

      {progress === 100 && (
        <div className="empty-state" style={{ marginTop: 32 }}>
          <div className="empty-icon">✓</div>
          <p style={{ fontWeight: 700 }}>¡Lista completada!</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary"
              onClick={() => void handleSendToPantry()}
              disabled={sendingToPantry || view.checked_items === 0}
            >
              {sendingToPantry ? 'Pasando...' : 'Guardar compra en despensa'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => navigate(`/lists/${listId}`)}
            >
              Volver a la lista
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SupermarketItemRow({
  item,
  thumbnail,
  onToggle,
  disabled,
}: {
  item: ShoppingListItem;
  thumbnail: string | null;
  onToggle: () => void;
  disabled: boolean;
}) {
  const displayThumbnail =
    hasRealHttpImage(thumbnail)
      ? thumbnail
      : buildInlineFallbackThumbnail(item.product_name, item.product_category);

  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={`supermarket-item-row${item.is_checked ? ' is-checked' : ''}`}
    >
      <div className={`supermarket-checkbox${item.is_checked ? ' is-checked' : ''}`}>
        {item.is_checked && (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 8l3.5 3.5 6.5-7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>

      {displayThumbnail ? (
        <img
          src={displayThumbnail}
          alt={item.product_name}
          className="supermarket-thumb"
          onError={(event) => { (event.target as HTMLImageElement).style.display = 'none'; }}
        />
      ) : (
        <div className="supermarket-thumb-placeholder">•</div>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 16,
            fontWeight: 700,
            textDecoration: item.is_checked ? 'line-through' : 'none',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {item.product_name}
        </div>
        {item.product_unit && (
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{item.product_unit}</div>
        )}
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 800 }}>×{item.quantity}</div>
        {item.product_price != null && (
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
            {(item.product_price * item.quantity).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
          </div>
        )}
      </div>
    </button>
  );
}
