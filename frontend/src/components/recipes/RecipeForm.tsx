import { useState } from 'react';
import type { Recipe, RecipeIngredientPayload, CreateRecipePayload } from '../../types';

interface RecipeFormProps {
  initial?: Recipe;
  onSubmit: (payload: CreateRecipePayload) => Promise<void>;
  onCancel: () => void;
  title?: string;
}

function emptyIngredient(): RecipeIngredientPayload {
  return { name: '', quantity: null, unit: '', notes: '', product_query: '' };
}

export default function RecipeForm({ initial, onSubmit, onCancel, title = 'Receta' }: RecipeFormProps) {
  const [recipeTitle, setRecipeTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [servings, setServings] = useState(initial?.servings ?? 4);
  const [minutes, setMinutes] = useState<string>(initial?.estimated_minutes?.toString() ?? '');
  const [cost, setCost] = useState<string>(initial?.estimated_cost?.toString() ?? '');
  const [tagsRaw, setTagsRaw] = useState((initial?.tags ?? []).join(', '));
  const [ingredients, setIngredients] = useState<RecipeIngredientPayload[]>(
    initial?.ingredients.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      unit: i.unit ?? '',
      notes: i.notes ?? '',
      product_query: i.product_query ?? '',
      position: i.position,
    })) ?? [emptyIngredient()]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const addIngredient = () =>
    setIngredients((prev) => [...prev, emptyIngredient()]);

  const removeIngredient = (idx: number) =>
    setIngredients((prev) => prev.filter((_, i) => i !== idx));

  const updateIngredient = (idx: number, field: keyof RecipeIngredientPayload, value: string | number | null) =>
    setIngredients((prev) =>
      prev.map((ing, i) => (i === idx ? { ...ing, [field]: value } : ing))
    );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipeTitle.trim()) { setError('El título es obligatorio'); return; }
    if (ingredients.filter((i) => i.name.trim()).length === 0) {
      setError('Añade al menos un ingrediente');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await onSubmit({
        title: recipeTitle.trim(),
        description: description.trim() || null,
        servings,
        estimated_minutes: minutes ? parseInt(minutes) : null,
        estimated_cost: cost ? parseFloat(cost) : null,
        tags: tagsRaw.split(',').map((t) => t.trim()).filter(Boolean),
        ingredients: ingredients
          .filter((i) => i.name.trim())
          .map((i, pos) => ({
            ...i,
            name: i.name.trim(),
            quantity: i.quantity ?? null,
            unit: i.unit?.trim() || null,
            notes: i.notes?.trim() || null,
            product_query: i.product_query?.trim() || null,
            position: pos,
          })),
      });
    } catch {
      setError('Error al guardar la receta');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal-content" style={{ maxWidth: 600, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="btn-icon" onClick={onCancel}>×</button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '0 4px' }}>
          {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}

          {/* Basic info */}
          <div className="form-group">
            <label className="form-label">Título *</label>
            <input
              className="form-input"
              value={recipeTitle}
              onChange={(e) => setRecipeTitle(e.target.value)}
              placeholder="Ej. Tortilla de patatas"
              maxLength={200}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Descripción</label>
            <textarea
              className="form-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Breve descripción de la receta…"
              rows={2}
              style={{ resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div className="form-group">
              <label className="form-label">Raciones</label>
              <input
                type="number"
                className="form-input"
                value={servings}
                onChange={(e) => setServings(Math.max(1, parseInt(e.target.value) || 1))}
                min={1}
                max={100}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Tiempo (min)</label>
              <input
                type="number"
                className="form-input"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                placeholder="30"
                min={1}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Coste (€)</label>
              <input
                type="number"
                className="form-input"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="8.50"
                min={0}
                step="0.1"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Etiquetas (separadas por coma)</label>
            <input
              className="form-input"
              value={tagsRaw}
              onChange={(e) => setTagsRaw(e.target.value)}
              placeholder="pasta, rápida, italiana"
            />
          </div>

          {/* Ingredients */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label className="form-label" style={{ margin: 0 }}>Ingredientes *</label>
              <button type="button" className="btn btn-secondary btn-sm" onClick={addIngredient}>
                + Añadir
              </button>
            </div>

            {ingredients.map((ing, idx) => (
              <div
                key={idx}
                style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 6, marginBottom: 6, alignItems: 'center' }}
              >
                <input
                  className="form-input"
                  value={ing.name}
                  onChange={(e) => updateIngredient(idx, 'name', e.target.value)}
                  placeholder="Nombre *"
                />
                <input
                  type="number"
                  className="form-input"
                  value={ing.quantity ?? ''}
                  onChange={(e) => updateIngredient(idx, 'quantity', e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder="Cant."
                  min={0}
                  step="0.1"
                />
                <input
                  className="form-input"
                  value={ing.unit ?? ''}
                  onChange={(e) => updateIngredient(idx, 'unit', e.target.value)}
                  placeholder="Ud. (g, ml…)"
                />
                <button
                  type="button"
                  className="btn-icon danger"
                  onClick={() => removeIngredient(idx)}
                  title="Quitar"
                  style={{ flexShrink: 0 }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <div className="modal-footer" style={{ paddingTop: 16 }}>
            <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar receta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
