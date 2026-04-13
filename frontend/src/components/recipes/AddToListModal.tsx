import { useState, useEffect } from 'react';
import { getLists } from '../../api/lists';
import type { ShoppingListSummary, AddToListPayload, RecipeIngredient } from '../../types';

interface AddToListModalProps {
  recipeTitle: string;
  defaultServings: number;
  ingredients?: RecipeIngredient[];
  onConfirm: (payload: AddToListPayload) => Promise<void>;
  onCancel: () => void;
}

export default function AddToListModal({
  recipeTitle,
  defaultServings,
  ingredients,
  onConfirm,
  onCancel,
}: AddToListModalProps) {
  const [lists, setLists] = useState<ShoppingListSummary[]>([]);
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [selectedListId, setSelectedListId] = useState<number | null>(null);
  const [newListName, setNewListName] = useState(`Lista: ${recipeTitle}`);
  const [multiplier, setMultiplier] = useState(1.0);
  const [selectedIds, setSelectedIds] = useState<Set<number> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getLists()
      .then((data) => {
        const active = data.filter((l) => !l.is_archived);
        setLists(active);
        if (active.length === 0) setMode('new');
        else setSelectedListId(active[0].id);
      })
      .catch(() => setMode('new'));
  }, []);

  useEffect(() => {
    if (ingredients && ingredients.length > 0) {
      setSelectedIds(new Set(ingredients.map((i) => i.id)));
    }
  }, [ingredients]);

  const toggleIngredient = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev ?? []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (!ingredients) return;
    if (selectedIds && selectedIds.size === ingredients.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(ingredients.map((i) => i.id)));
    }
  };

  const allSelected = ingredients ? (selectedIds?.size ?? 0) === ingredients.length : true;
  const noneSelected = ingredients ? (selectedIds?.size ?? 0) === 0 : false;

  const handleConfirm = async () => {
    setLoading(true);
    setError('');
    try {
      const payload: AddToListPayload = {
        list_id: mode === 'existing' ? selectedListId : null,
        new_list_name: mode === 'new' ? newListName.trim() : null,
        servings_multiplier: multiplier,
        selected_ingredient_ids: selectedIds !== null ? Array.from(selectedIds) : null,
      };
      await onConfirm(payload);
    } catch {
      setError('Error al añadir a la lista');
    } finally {
      setLoading(false);
    }
  };

  const selectedCount = selectedIds?.size ?? ingredients?.length ?? 0;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal-content" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <h2>Añadir a lista de compra</h2>
          <button className="btn-icon" onClick={onCancel}>×</button>
        </div>

        <div style={{ padding: '0 4px 16px' }}>
          {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}

          {/* Servings multiplier */}
          <div className="form-group">
            <label className="form-label">
              Raciones (base: {defaultServings})
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="range"
                min={0.5}
                max={4}
                step={0.5}
                value={multiplier}
                onChange={(e) => setMultiplier(parseFloat(e.target.value))}
                style={{ flex: 1 }}
              />
              <span style={{ minWidth: 60, textAlign: 'right' }}>
                ×{multiplier} = {Math.round(defaultServings * multiplier)} raciones
              </span>
            </div>
          </div>

          {/* Ingredient checklist */}
          {ingredients && ingredients.length > 0 && (
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label className="form-label" style={{ margin: 0 }}>
                  Ingredientes ({selectedCount}/{ingredients.length})
                </label>
                <button type="button" className="btn btn-ghost btn-sm" onClick={toggleAll}>
                  {allSelected ? 'Deseleccionar todo' : 'Seleccionar todo'}
                </button>
              </div>
              <div style={{
                maxHeight: 200,
                overflowY: 'auto',
                border: '1px solid var(--border-color, #e2e8f0)',
                borderRadius: 6,
                padding: '4px 0',
              }}>
                {ingredients.map((ing) => {
                  const checked = selectedIds?.has(ing.id) ?? true;
                  const scaledQty = ing.quantity !== null
                    ? Math.round(ing.quantity * multiplier * 100) / 100
                    : null;
                  return (
                    <label
                      key={ing.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '6px 12px',
                        cursor: 'pointer',
                        opacity: checked ? 1 : 0.45,
                        transition: 'opacity 0.15s',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleIngredient(ing.id)}
                        style={{ flexShrink: 0 }}
                      />
                      <span style={{ flex: 1, fontSize: 14 }}>{ing.name}</span>
                      {scaledQty !== null && (
                        <span style={{ fontSize: 13, color: 'var(--text-secondary, #64748b)', whiteSpace: 'nowrap' }}>
                          {scaledQty} {ing.unit ?? ''}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Destination list */}
          <div className="form-group">
            <label className="form-label">Destino</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              {lists.length > 0 && (
                <button
                  type="button"
                  className={`btn btn-sm ${mode === 'existing' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setMode('existing')}
                >
                  Lista existente
                </button>
              )}
              <button
                type="button"
                className={`btn btn-sm ${mode === 'new' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setMode('new')}
              >
                Nueva lista
              </button>
            </div>

            {mode === 'existing' && lists.length > 0 && (
              <select
                className="form-input"
                value={selectedListId ?? ''}
                onChange={(e) => setSelectedListId(parseInt(e.target.value))}
              >
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.item_count} artículos)
                  </option>
                ))}
              </select>
            )}

            {mode === 'new' && (
              <input
                className="form-input"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="Nombre de la nueva lista"
              />
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onCancel} disabled={loading}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={handleConfirm} disabled={loading || noneSelected}>
            {loading ? 'Añadiendo…' : ingredients
              ? `Añadir (${selectedCount}) ingredientes`
              : 'Añadir ingredientes'}
          </button>
        </div>
      </div>
    </div>
  );
}
