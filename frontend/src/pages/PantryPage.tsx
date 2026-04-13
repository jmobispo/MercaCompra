import { useState, useEffect } from 'react';
import { getPantry, addToPantry, updatePantryItem, deletePantryItem } from '../api/pantry';
import type { PantryItem, CreatePantryItemPayload, UpdatePantryItemPayload } from '../types';

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
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
                onChange={(e) => setName(e.target.value)}
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
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Unidad</label>
                <select
                  className="form-input"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                >
                  <option value="">—</option>
                  {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Fecha de caducidad</label>
              <input
                className="form-input"
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Notas</label>
              <input
                className="form-input"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Opcional"
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving || !name.trim()}>
              {saving ? 'Guardando…' : 'Guardar'}
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
      <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 600, background: 'rgba(239,68,68,0.1)', borderRadius: 4, padding: '1px 6px' }}>
        Caducado
      </span>
    );
  }
  if (diffDays <= 3) {
    return (
      <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600, background: 'rgba(245,158,11,0.1)', borderRadius: 4, padding: '1px 6px' }}>
        Caduca en {diffDays}d
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
  const [items, setItems] = useState<PantryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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
    fetchPantry();
  }, []);

  const handleAdd = async (payload: CreatePantryItemPayload) => {
    const item = await addToPantry(payload);
    setItems((prev) => [item, ...prev]);
    setShowForm(false);
  };

  const handleEdit = async (payload: UpdatePantryItemPayload) => {
    if (!editTarget) return;
    const updated = await updatePantryItem(editTarget.id, payload);
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    setEditTarget(null);
  };

  const handleToggleConsumed = async (item: PantryItem) => {
    try {
      const updated = await updatePantryItem(item.id, { is_consumed: !item.is_consumed });
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
    } catch {
      setError('Error al actualizar el producto');
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await deletePantryItem(deleteConfirm.id);
      setItems((prev) => prev.filter((i) => i.id !== deleteConfirm.id));
      setDeleteConfirm(null);
    } catch {
      setError('Error al eliminar el producto');
    }
  };

  const active = items.filter((i) => !i.is_consumed);
  const consumed = items.filter((i) => i.is_consumed);
  const displayed = showConsumed ? items : active;

  if (loading) {
    return (
      <div className="loading-overlay">
        <span className="loading-spinner" />
        <span>Cargando despensa…</span>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          {error}
          <button className="btn btn-ghost btn-sm" style={{ marginLeft: 8 }} onClick={() => setError('')}>×</button>
        </div>
      )}

      {/* Header */}
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
          onClick={() => setShowConsumed((v) => !v)}
        >
          {showConsumed ? 'Ocultar consumidos' : 'Ver consumidos'}
        </button>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          + Añadir
        </button>
      </div>

      {/* Items list */}
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
          {displayed.map((item, idx) => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '14px 16px',
                borderBottom: idx < displayed.length - 1 ? '1px solid var(--color-border)' : 'none',
                opacity: item.is_consumed ? 0.5 : 1,
              }}
            >
              {/* Consumed checkbox */}
              <button
                onClick={() => handleToggleConsumed(item)}
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

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 500,
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

              {/* Actions */}
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setEditTarget(item)}
                  title="Editar"
                >
                  ✏️
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

      {/* Add form modal */}
      {showForm && (
        <PantryForm
          title="Añadir a despensa"
          onSubmit={handleAdd}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Edit form modal */}
      {editTarget && (
        <PantryForm
          title="Editar producto"
          initial={editTarget}
          onSubmit={handleEdit}
          onCancel={() => setEditTarget(null)}
        />
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div
          className="modal-overlay"
          onClick={(e) => { if (e.target === e.currentTarget) setDeleteConfirm(null); }}
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
              <button className="btn btn-danger" onClick={handleDelete}>
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
