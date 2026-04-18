import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import { getSupermarketView, updateItem } from '../api/lists';
import type { ShoppingListItem, SupermarketView } from '../types';

export default function SupermarketModePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const listId = parseInt(id ?? '0', 10);

  const [view, setView] = useState<SupermarketView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hideChecked, setHideChecked] = useState(false);
  const [toggling, setToggling] = useState<number | null>(null);

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

  const handleToggle = async (item: ShoppingListItem) => {
    if (toggling) return;
    setToggling(item.id);
    try {
      await updateItem(listId, item.id, { is_checked: !item.is_checked });
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
          <button
            className="btn btn-primary"
            onClick={() => navigate(`/lists/${listId}`)}
          >
            Volver a la lista
          </button>
        </div>
      )}
    </div>
  );
}

function SupermarketItemRow({
  item,
  onToggle,
  disabled,
}: {
  item: ShoppingListItem;
  onToggle: () => void;
  disabled: boolean;
}) {
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

      {item.product_thumbnail ? (
        <img
          src={item.product_thumbnail}
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
