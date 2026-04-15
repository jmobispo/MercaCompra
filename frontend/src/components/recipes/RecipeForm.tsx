import { useState } from 'react';
import type {
  Recipe,
  RecipeIngredientPayload,
  RecipeStepPayload,
  CreateRecipePayload,
} from '../../types';

interface RecipeFormProps {
  initial?: Recipe;
  onSubmit: (payload: CreateRecipePayload) => Promise<void>;
  onCancel: () => void;
  title?: string;
}

function emptyIngredient(): RecipeIngredientPayload {
  return { name: '', quantity: null, unit: '', notes: '', product_query: '' };
}

function emptyStep(): RecipeStepPayload {
  return { text: '' };
}

export default function RecipeForm({ initial, onSubmit, onCancel, title = 'Receta' }: RecipeFormProps) {
  const [recipeTitle, setRecipeTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [servings, setServings] = useState(initial?.servings ?? 4);
  const [minutes, setMinutes] = useState<string>(initial?.estimated_minutes?.toString() ?? '');
  const [cost, setCost] = useState<string>(initial?.estimated_cost?.toString() ?? '');
  const [tagsRaw, setTagsRaw] = useState((initial?.tags ?? []).join(', '));
  const [ingredients, setIngredients] = useState<RecipeIngredientPayload[]>(
    initial?.ingredients.map((ingredient) => ({
      name: ingredient.name,
      quantity: ingredient.quantity,
      unit: ingredient.unit ?? '',
      notes: ingredient.notes ?? '',
      product_query: ingredient.product_query ?? '',
      position: ingredient.position,
    })) ?? [emptyIngredient()]
  );
  const [steps, setSteps] = useState<RecipeStepPayload[]>(
    (initial?.steps ?? []).map((step) => ({
      text: step.text,
      position: step.position,
    }))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const addIngredient = () => setIngredients((prev) => [...prev, emptyIngredient()]);
  const removeIngredient = (index: number) => setIngredients((prev) => prev.filter((_, idx) => idx !== index));
  const updateIngredient = (index: number, field: keyof RecipeIngredientPayload, value: string | number | null) =>
    setIngredients((prev) => prev.map((ingredient, idx) => (
      idx === index ? { ...ingredient, [field]: value } : ingredient
    )));

  const addStep = () => setSteps((prev) => [...prev, emptyStep()]);
  const removeStep = (index: number) => setSteps((prev) => prev.filter((_, idx) => idx !== index));
  const updateStep = (index: number, value: string) =>
    setSteps((prev) => prev.map((step, idx) => (idx === index ? { ...step, text: value } : step)));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!recipeTitle.trim()) {
      setError('El título es obligatorio');
      return;
    }

    if (ingredients.filter((ingredient) => ingredient.name.trim()).length === 0) {
      setError('Añade al menos un ingrediente');
      return;
    }

    if (steps.some((step) => !step.text.trim())) {
      setError('Completa o elimina los pasos vacíos antes de guardar');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await onSubmit({
        title: recipeTitle.trim(),
        description: description.trim() || null,
        servings,
        estimated_minutes: minutes ? parseInt(minutes, 10) : null,
        estimated_cost: cost ? parseFloat(cost) : null,
        tags: tagsRaw.split(',').map((tag) => tag.trim()).filter(Boolean),
        ingredients: ingredients
          .filter((ingredient) => ingredient.name.trim())
          .map((ingredient, position) => ({
            ...ingredient,
            name: ingredient.name.trim(),
            quantity: ingredient.quantity ?? null,
            unit: ingredient.unit?.trim() || null,
            notes: ingredient.notes?.trim() || null,
            product_query: ingredient.product_query?.trim() || null,
            position,
          })),
        steps: steps.map((step, position) => ({
          text: step.text.trim(),
          position,
        })),
      });
    } catch {
      setError('Error al guardar la receta');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(event) => event.target === event.currentTarget && onCancel()}>
      <div className="modal-content" style={{ maxWidth: 760, maxHeight: '90vh' }}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="btn-icon" onClick={onCancel}>×</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div className="modal-body modal-body-scroll" style={{ display: 'grid', gap: 18 }}>
            {error && <div className="alert alert-error">{error}</div>}

            <div className="form-group">
              <label className="form-label">Título *</label>
              <input
                className="form-input"
                value={recipeTitle}
                onChange={(event) => setRecipeTitle(event.target.value)}
                placeholder="Ej. Tortilla de patatas"
                maxLength={200}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Descripción</label>
              <textarea
                className="form-input"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Breve descripción de la receta..."
                rows={2}
                style={{ resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
              <div className="form-group">
                <label className="form-label">Raciones</label>
                <input
                  type="number"
                  className="form-input"
                  value={servings}
                  onChange={(event) => setServings(Math.max(1, parseInt(event.target.value, 10) || 1))}
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
                  onChange={(event) => setMinutes(event.target.value)}
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
                  onChange={(event) => setCost(event.target.value)}
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
                onChange={(event) => setTagsRaw(event.target.value)}
                placeholder="pasta, rápida, italiana"
              />
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label className="form-label" style={{ margin: 0 }}>Ingredientes *</label>
                <button type="button" className="btn btn-secondary btn-sm" onClick={addIngredient}>
                  + Añadir ingrediente
                </button>
              </div>

              {ingredients.map((ingredient, index) => (
                <div
                  key={`ingredient-${index}`}
                  style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 6, marginBottom: 6, alignItems: 'center' }}
                >
                  <input
                    className="form-input"
                    value={ingredient.name}
                    onChange={(event) => updateIngredient(index, 'name', event.target.value)}
                    placeholder="Nombre *"
                  />
                  <input
                    type="number"
                    className="form-input"
                    value={ingredient.quantity ?? ''}
                    onChange={(event) => updateIngredient(index, 'quantity', event.target.value ? parseFloat(event.target.value) : null)}
                    placeholder="Cant."
                    min={0}
                    step="0.1"
                  />
                  <input
                    className="form-input"
                    value={ingredient.unit ?? ''}
                    onChange={(event) => updateIngredient(index, 'unit', event.target.value)}
                    placeholder="Ud. (g, ml...)"
                  />
                  <button
                    type="button"
                    className="btn-icon danger"
                    onClick={() => removeIngredient(index)}
                    title="Quitar ingrediente"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label className="form-label" style={{ margin: 0 }}>Elaboración</label>
                <button type="button" className="btn btn-secondary btn-sm" onClick={addStep}>
                  + Añadir paso
                </button>
              </div>

              {steps.length === 0 ? (
                <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>Sin pasos definidos todavía.</p>
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {steps.map((step, index) => (
                    <div key={`step-${index}`} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 10, alignItems: 'start' }}>
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          background: 'var(--color-primary-light)',
                          color: 'var(--color-primary-dark)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          marginTop: 6,
                        }}
                      >
                        {index + 1}
                      </div>
                      <textarea
                        className="form-input"
                        value={step.text}
                        onChange={(event) => updateStep(index, event.target.value)}
                        placeholder={`Describe el paso ${index + 1}`}
                        rows={3}
                        maxLength={500}
                        style={{ resize: 'vertical' }}
                      />
                      <button
                        type="button"
                        className="btn-icon danger"
                        onClick={() => removeStep(index)}
                        title="Quitar paso"
                        style={{ marginTop: 6 }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar receta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
