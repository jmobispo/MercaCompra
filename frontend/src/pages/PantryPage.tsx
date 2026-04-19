import { useEffect, useState } from 'react';

import ProductSearch from '../components/products/ProductSearch';
import { addToPantry, deletePantryItem, getPantry, updatePantryItem } from '../api/pantry';
import { useAuthStore } from '../store/authStore';
import type { CreatePantryItemPayload, PantryItem, Product, UpdatePantryItemPayload } from '../types';

const UNITS = ['ud', 'kg', 'g', 'l', 'ml', 'bolsa', 'caja', 'lata', 'bote'];

function PantryForm({
  initial,
  onSubmit,
  onCancel,
  title,
}: {
  initial?: Partial<PantryItem>;
  onSubmit: (payload: CreatePantryItemPayload) => Promise<void>;
  onCancel: () => void;
  title: string;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [quantity, setQuantity] = useState(String(initial?.quantity ?? '1'));
  const [unit, setUnit] = useState(initial?.unit ?? '');
  const [expiryDate, setExpiryDate] = useState(initial?.expiry_date ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        quantity: parseFloat(quantity) || 1,
        unit: unit || null,
        expiry_date: expiryDate || null,
        notes: notes.trim() || null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={(event) => { if (event.target === event.currentTarget) onCancel(); }}
    >
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onCancel}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Producto *</label>
              <input
                className="form-input"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Nombre del producto"
                autoFocus
                required
              />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Cantidad</label>
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  step="0.1"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Unidad</label>
                <select
                  className="form-input"
                  value={unit}
                  onChange={(event) => setUnit(event.target.value)}
                >
                  <option value="">—</option>
                  {UNITS.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Fecha de caducidad</label>
              <input
                className="form-input"
                type="date"
                value={expiryDate}
                onChange={(event) => setExpiryDate(event.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Notas</label>
              <input
                className="form-input"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Opcional"
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving || !name.trim()}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ExpiryBadge({ date }: { date: string }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(date);
  const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return (
      <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 700, background: 'rgba(239,68,68,0.1)', borderRadius: 999, padding: '3px 8px' }}>
        Caducado
      </span>
    );
  }
  if (diffDays <= 3) {
    return (
      <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700, background: 'rgba(245,158,11,0.1)', borderRadius: 999, padding: '3px 8px' }}>
        Caduca en {diffDays} d
      </span>
    );
  }
  return (
    <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
      Caduca {expiry.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
    </span>
  );
}

export default function PantryPage() {
  const user = useAuthStore((state) => state.user);
  const [items, setItems] = useState<PantryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<PantryItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<PantryItem | null>(null);
  const [showConsumed, setShowConsumed] = useState(false);

  const fetchPantry = async () => {
    try {
      const data = await getPantry();
      setItems(data);
    } catch {
      setError('Error al cargar la despensa');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchPantry();
  }, []);

  const upsertItem = (item: PantryItem) => {
    setItems((prev) => {
      const filtered = prev.filter((entry) => entry.id !== item.id);
      return [item, ...filtered];
    });
  };

  const handleAdd = async (payload: CreatePantryItemPayload) => {
    const item = await addToPantry(payload);
    upsertItem(item);
    setShowForm(false);
    setSuccess(`"${item.name}" añadido a la despensa`);
  };

  const handleAddFromCatalog = async (product: Product) => {
    try {
      const item = await addToPantry({
        name: product.display_name ?? product.name,
        product_id: product.id,
        quantity: 1,
        unit: product.unit_size ?? null,
      });
      upsertItem(item);
      setSuccess(`"${item.name}" añadido desde catálogo`);
      setError('');
    } catch {
      setError('No se pudo añadir el producto desde el catálogo');
    }
  };

  const handleEdit = async (payload: UpdatePantryItemPayload) => {
    if (!editTarget) return;
    const updated = await updatePantryItem(editTarget.id, payload);
    setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    setEditTarget(null);
    setSuccess(`"${updated.name}" actualizado`);
  };

  const handleToggleConsumed = async (item: PantryItem) => {
    try {
      const updated = await updatePantryItem(item.id, { is_consumed: !item.is_consumed });
      setItems((prev) => prev.map((entry) => (entry.id === updated.id ? updated : entry)));
    } catch {
      setError('Error al actualizar el producto');
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await deletePantryItem(deleteConfirm.id);
      setItems((prev) => prev.filter((item) => item.id !== deleteConfirm.id));
      setDeleteConfirm(null);
    } catch {
      setError('Error al eliminar el producto');
    }
  };

  const active = items.filter((item) => !item.is_consumed);
  const consumed = items.filter((item) => item.is_consumed);
  const displayed = showConsumed ? items : active;

  if (loading) {
    return (
      <div className="loading-overlay">
        <span className="loading-spinner" />
        <span>Cargando despensa...</span>
      </div>
    );
  }

  return (
    <div>
      {success && (
        <div className="alert alert-success" style={{ marginBottom: 16 }}>
          {success}
          <button className="btn btn-ghost btn-sm" style={{ marginLeft: 8 }} onClick={() => setSuccess('')}>×</button>
        </div>
      )}
      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          {error}
          <button className="btn btn-ghost btn-sm" style={{ marginLeft: 8 }} onClick={() => setError('')}>×</button>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ marginBottom: 2 }}>Despensa</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 14, margin: 0 }}>
            {active.length} producto{active.length !== 1 ? 's' : ''} disponible{active.length !== 1 ? 's' : ''}
            {consumed.length > 0 && ` · ${consumed.length} consumido${consumed.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          className={`btn btn-sm ${showConsumed ? 'btn-secondary' : 'btn-ghost'}`}
          onClick={() => setShowConsumed((value) => !value)}
        >
          {showConsumed ? 'Ocultar consumidos' : 'Ver consumidos'}
        </button>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          + Añadir manual
        </button>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <h2>Añadir desde catálogo</h2>
        </div>
        <div className="card-body">
          <p style={{ color: 'var(--color-text-muted)', marginBottom: 12 }}>
            Busca un producto real y añádelo directamente a la despensa con un toque.
          </p>
          <ProductSearch onAddProduct={handleAddFromCatalog} postalCode={user?.postal_code} />
        </div>
      </div>

      {displayed.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🥫</div>
          <p>{items.length === 0 ? 'Tu despensa está vacía.' : 'No hay productos disponibles.'}</p>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            Añadir primer producto
          </button>
        </div>
      ) : (
        <div className="card">
          {displayed.map((item, index) => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '14px 16px',
                borderBottom: index < displayed.length - 1 ? '1px solid var(--color-border)' : 'none',
                opacity: item.is_consumed ? 0.5 : 1,
              }}
            >
              <button
                onClick={() => void handleToggleConsumed(item)}
                title={item.is_consumed ? 'Marcar disponible' : 'Marcar consumido'}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 5,
                  border: `2px solid ${item.is_consumed ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  background: item.is_consumed ? 'var(--color-primary)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                  padding: 0,
                }}
              >
                {item.is_consumed && (
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8l3.5 3.5 6.5-7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    textDecoration: item.is_consumed ? 'line-through' : 'none',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.name}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                    {item.quantity}{item.unit ? ` ${item.unit}` : ''}
                  </span>
                  {item.expiry_date && <ExpiryBadge date={item.expiry_date} />}
                  {item.notes && (
                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                      {item.notes}
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditTarget(item)} title="Editar">
                  ✎
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setDeleteConfirm(item)}
                  title="Eliminar"
                  style={{ color: 'var(--color-danger)' }}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <PantryForm
          title="Añadir a despensa"
          onSubmit={handleAdd}
          onCancel={() => setShowForm(false)}
        />
      )}

      {editTarget && (
        <PantryForm
          title="Editar producto"
          initial={editTarget}
          onSubmit={handleEdit}
          onCancel={() => setEditTarget(null)}
        />
      )}

      {deleteConfirm && (
        <div
          className="modal-overlay"
          onClick={(event) => { if (event.target === event.currentTarget) setDeleteConfirm(null); }}
        >
          <div className="modal" style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <h2>Eliminar producto</h2>
            </div>
            <div className="modal-body">
              <p>¿Eliminar <strong>{deleteConfirm.name}</strong> de la despensa?</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>
                Cancelar
              </button>
              <button className="btn btn-danger" onClick={() => void handleDelete()}>
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
