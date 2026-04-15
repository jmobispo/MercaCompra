import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSupermarketView } from '../api/lists';
import { updateItem } from '../api/lists';
import type { SupermarketView, ShoppingListItem } from '../types';

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
    fetchView();
  }, [fetchView]);

  const handleToggle = async (item: ShoppingListItem) => {
    if (toggling) return;
    setToggling(item.id);
    try {
      await updateItem(listId, item.id, { is_checked: !item.is_checked });
      setView((prev) => {
        if (!prev) return prev;
        const newGroups = prev.groups.map((g) => ({
          ...g,
          items: g.items.map((i) =>
            i.id === item.id ? { ...i, is_checked: !i.is_checked } : i
          ),
        }));
        const allItems = newGroups.flatMap((g) => g.items);
        return {
          ...prev,
          groups: newGroups,
          checked_items: allItems.filter((i) => i.is_checked).length,
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
        <span>Cargando lista…</span>
      </div>
    );
  }

  if (!view) {
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

  const progress = view.total_items > 0
    ? Math.round((view.checked_items / view.total_items) * 100)
    : 0;
  const checkedTotal = view.groups
    .flatMap((group) => group.items)
    .filter((item) => item.is_checked)
    .reduce((sum, item) => sum + ((item.product_price ?? 0) * item.quantity), 0);

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '0 0 80px' }}>
      {error && (
        <div className="alert alert-error" style={{ marginBottom: 12 }}>
          {error}
          <button className="btn btn-ghost btn-sm" style={{ marginLeft: 8 }} onClick={() => setError('')}>
            ×
          </button>
        </div>
      )}

      {/* Header sticky */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: 'var(--color-white)',
          borderBottom: '1px solid var(--color-border)',
          padding: '12px 16px',
          marginBottom: 12,
          boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
        }}
      >
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
            onClick={() => setHideChecked((h) => !h)}
            style={{ whiteSpace: 'nowrap', fontSize: 12 }}
          >
            {hideChecked ? 'Mostrar todo' : 'Ocultar comprados'}
          </button>
        </div>

        {/* Progress bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              flex: 1,
              height: 8,
              borderRadius: 4,
              background: 'var(--color-border)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progress}%`,
                borderRadius: 4,
                background: progress === 100 ? 'var(--color-success, #22c55e)' : 'var(--color-primary)',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
          <div style={{ display: 'grid', justifyItems: 'end', gap: 2, flexShrink: 0 }}>
            <span style={{ fontSize: 13, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
              {view.checked_items}/{view.total_items}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-primary-dark)', whiteSpace: 'nowrap' }}>
              {checkedTotal.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
            </span>
          </div>
        </div>
      </div>

      {/* Groups */}
      {view.groups.map((group) => {
        const visibleItems = hideChecked
          ? group.items.filter((i) => !i.is_checked)
          : group.items;

        if (visibleItems.length === 0) return null;

        return (
          <div key={group.category} style={{ marginBottom: 8 }}>
            <div
              style={{
                padding: '6px 16px',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--color-text-muted)',
                background: 'var(--color-bg)',
                borderTop: '1px solid var(--color-border)',
                borderBottom: '1px solid var(--color-border)',
              }}
            >
              {group.category}
              <span style={{ marginLeft: 6, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                ({group.items.filter((i) => i.is_checked).length}/{group.items.length})
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

      {/* All done state */}
      {progress === 100 && (
        <div className="empty-state" style={{ marginTop: 32 }}>
          <div className="empty-icon">🎉</div>
          <p style={{ fontWeight: 600 }}>¡Lista completada!</p>
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
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        width: '100%',
        padding: '14px 16px',
        background: item.is_checked ? 'var(--color-bg)' : 'var(--color-white)',
        border: 'none',
        borderBottom: '1px solid var(--color-border)',
        cursor: 'pointer',
        textAlign: 'left',
        opacity: item.is_checked ? 0.5 : 1,
        transition: 'opacity 0.2s',
      }}
    >
      {/* Big checkbox */}
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 6,
          border: `2px solid ${item.is_checked ? 'var(--color-primary)' : 'var(--color-border)'}`,
          background: item.is_checked ? 'var(--color-primary)' : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'all 0.15s',
        }}
      >
        {item.is_checked && (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 8l3.5 3.5 6.5-7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>

      {/* Thumbnail */}
      {item.product_thumbnail ? (
        <img
          src={item.product_thumbnail}
          alt={item.product_name}
          style={{ width: 44, height: 44, objectFit: 'contain', borderRadius: 6, flexShrink: 0 }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      ) : (
        <div style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
          🛒
        </div>
      )}

      {/* Name + meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 16,
            fontWeight: 500,
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

      {/* Quantity + price */}
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>×{item.quantity}</div>
        {item.product_price != null && (
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
            {(item.product_price * item.quantity).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
          </div>
        )}
      </div>
    </button>
  );
}
