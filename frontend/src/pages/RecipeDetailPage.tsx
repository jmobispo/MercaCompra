import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getRecipe,
  updateRecipe,
  deleteRecipe,
  duplicateRecipe,
  addRecipeToList,
} from '../api/recipes';
import RecipeForm from '../components/recipes/RecipeForm';
import AddToListModal from '../components/recipes/AddToListModal';
import type { Recipe, UpdateRecipePayload, AddToListPayload } from '../types';
import { resolveBackendUrl } from '../api/client';

export default function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const recipeId = parseInt(id ?? '0', 10);

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showEditForm, setShowEditForm] = useState(false);
  const [showAddToList, setShowAddToList] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchRecipe = useCallback(async () => {
    if (!recipeId) return;
    try {
      const data = await getRecipe(recipeId);
      setRecipe(data);
    } catch {
      setError('Error al cargar la receta');
    } finally {
      setLoading(false);
    }
  }, [recipeId]);

  useEffect(() => {
    fetchRecipe();
  }, [fetchRecipe]);

  const handleUpdate = async (payload: UpdateRecipePayload) => {
    if (!recipe) {
      throw new Error('Receta no disponible');
    }
    return await updateRecipe(recipe.id, payload);
  };

  const handleDelete = async () => {
    if (!recipe) return;
    if (!window.confirm(`¿Eliminar la receta "${recipe.title}"?`)) return;
    setActionLoading(true);
    try {
      await deleteRecipe(recipe.id);
      navigate('/recipes');
    } catch {
      setError('Error al eliminar la receta');
      setActionLoading(false);
    }
  };

  const handleDuplicate = async () => {
    if (!recipe) return;
    setActionLoading(true);
    try {
      const copy = await duplicateRecipe(recipe.id);
      navigate(`/recipes/${copy.id}`);
    } catch {
      setError('Error al duplicar la receta');
      setActionLoading(false);
    }
  };

  const handleAddToList = async (payload: AddToListPayload) => {
    if (!recipe) return;
    const result = await addRecipeToList(recipe.id, payload);
    setShowAddToList(false);
    setSuccessMsg(
      `${result.added} ingrediente(s) anadido(s) a "${result.list_name}"` +
        (result.skipped > 0 ? ` (${result.skipped} ya existian)` : '')
    );
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const formatCost = (cost: number | null) =>
    cost != null ? cost.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }) : null;

  if (loading) {
    return (
      <div className="loading-overlay">
        <span className="loading-spinner" />
        <span>Cargando receta...</span>
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="empty-state">
        <div className="empty-icon">X</div>
        <p>Receta no encontrada</p>
        <button className="btn btn-secondary" onClick={() => navigate('/recipes')}>
          Volver a recetas
        </button>
      </div>
    );
  }

  const steps = Array.isArray(recipe.steps) ? recipe.steps : [];
  const imageUrl = resolveBackendUrl(recipe.image_url);
  const mealTypes = recipe.meal_types ?? [];

  return (
    <div>
      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          {error}
          <button className="btn btn-ghost btn-sm" style={{ marginLeft: 8 }} onClick={() => setError('')}>
            x
          </button>
        </div>
      )}
      {successMsg && (
        <div className="alert alert-success" style={{ marginBottom: 16 }}>
          {successMsg}
        </div>
      )}

      {imageUrl && (
        <div className="recipe-detail-hero">
          <img src={imageUrl} alt={recipe.title} className="recipe-detail-image" />
        </div>
      )}

      <div className="page-header" style={{ alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h1 style={{ marginBottom: 4 }}>{recipe.title}</h1>
            {recipe.is_public && (
              <span className="badge" style={{ background: 'var(--color-success)', color: '#fff', fontSize: 11 }}>
                Sugerida
              </span>
            )}
          </div>
          {recipe.description && (
            <p style={{ color: 'var(--color-text-muted)', marginBottom: 8, marginTop: 4 }}>
              {recipe.description}
            </p>
          )}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 14, color: 'var(--color-text-muted)' }}>
            <span>{recipe.servings} raciones</span>
            {recipe.estimated_minutes && <span>{recipe.estimated_minutes} min</span>}
            {formatCost(recipe.estimated_cost) && <span>{formatCost(recipe.estimated_cost)}</span>}
            <span>{recipe.ingredients.length} ingredientes</span>
            {recipe.calories_per_serving != null && <span>{Math.round(recipe.calories_per_serving)} kcal/racion</span>}
          </div>
          {mealTypes.length > 0 && (
            <div className="recipe-tags" style={{ marginTop: 8 }}>
              {mealTypes.map((mealType) => (
                <span key={mealType} className={`recipe-tag recipe-tag-meal recipe-tag-${mealType}`}>{mealType}</span>
              ))}
            </div>
          )}
          {recipe.tags && recipe.tags.length > 0 && (
            <div className="recipe-tags" style={{ marginTop: 8 }}>
              {recipe.tags.map((tag) => (
                <span key={tag} className="recipe-tag">{tag}</span>
              ))}
            </div>
          )}
        </div>

        <div className="actions-row" style={{ flexShrink: 0 }}>
          <button className="btn btn-primary" onClick={() => setShowAddToList(true)} disabled={actionLoading}>
            + Anadir a lista
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleDuplicate} disabled={actionLoading}>
            Copiar
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowEditForm(true)}
            disabled={actionLoading}
          >
            Editar receta
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleDelete}
            disabled={actionLoading}
            style={{ color: 'var(--color-danger)' }}
          >
            Eliminar
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/recipes')}>
            Volver
          </button>
        </div>
      </div>

      <div className="recipe-edit-hint">
        <strong>Edicion completa disponible.</strong> Pulsa <em>Editar receta</em> para cambiar
        ingredientes, pasos y tambien anadir, reemplazar o eliminar la imagen.
      </div>

      <div className="card recipe-nutrition-card" style={{ marginTop: 24 }}>
        <div className="card-header">
          <h2>Nutricion por racion</h2>
          <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
            Ideal para {mealTypes.length > 0 ? mealTypes.join(', ') : 'sin definir'}
          </span>
        </div>
        <div className="card-body recipe-nutrition-grid">
          <div className="recipe-nutrition-item">
            <span className="recipe-nutrition-label">Calorias</span>
            <strong>{recipe.calories_per_serving != null ? `${Math.round(recipe.calories_per_serving)} kcal` : 'Sin dato'}</strong>
          </div>
          <div className="recipe-nutrition-item">
            <span className="recipe-nutrition-label">Proteina</span>
            <strong>{recipe.protein_g != null ? `${recipe.protein_g.toFixed(1)} g` : 'Sin dato'}</strong>
          </div>
          <div className="recipe-nutrition-item">
            <span className="recipe-nutrition-label">Carbohidratos</span>
            <strong>{recipe.carbs_g != null ? `${recipe.carbs_g.toFixed(1)} g` : 'Sin dato'}</strong>
          </div>
          <div className="recipe-nutrition-item">
            <span className="recipe-nutrition-label">Grasas</span>
            <strong>{recipe.fat_g != null ? `${recipe.fat_g.toFixed(1)} g` : 'Sin dato'}</strong>
          </div>
          <div className="recipe-nutrition-item">
            <span className="recipe-nutrition-label">Fibra</span>
            <strong>{recipe.fiber_g != null ? `${recipe.fiber_g.toFixed(1)} g` : 'Sin dato'}</strong>
          </div>
          <div className="recipe-nutrition-item">
            <span className="recipe-nutrition-label">Azucares</span>
            <strong>{recipe.sugar_g != null ? `${recipe.sugar_g.toFixed(1)} g` : 'Sin dato'}</strong>
          </div>
          <div className="recipe-nutrition-item">
            <span className="recipe-nutrition-label">Sodio</span>
            <strong>{recipe.sodium_mg != null ? `${Math.round(recipe.sodium_mg)} mg` : 'Sin dato'}</strong>
          </div>
          <div className="recipe-nutrition-item">
            <span className="recipe-nutrition-label">Raciones</span>
            <strong>{recipe.servings}</strong>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-header">
          <h2>Ingredientes</h2>
          <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
            para {recipe.servings} raciones
          </span>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {recipe.ingredients.length === 0 ? (
            <p style={{ padding: 16, color: 'var(--color-text-muted)' }}>Sin ingredientes</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {recipe.ingredients
                .slice()
                .sort((a, b) => a.position - b.position)
                .map((ingredient) => (
                  <li
                    key={ingredient.id}
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: 8,
                      padding: '10px 20px',
                      borderBottom: '1px solid var(--color-border)',
                    }}
                  >
                    <span style={{ flex: 1, fontWeight: 500 }}>{ingredient.name}</span>
                    {(ingredient.quantity != null || ingredient.unit) && (
                      <span style={{ color: 'var(--color-text-muted)', fontSize: 14, whiteSpace: 'nowrap' }}>
                        {ingredient.quantity != null ? ingredient.quantity : ''}
                        {ingredient.unit ? ` ${ingredient.unit}` : ''}
                      </span>
                    )}
                    {ingredient.notes && (
                      <span style={{ color: 'var(--color-text-muted)', fontSize: 13, fontStyle: 'italic' }}>
                        ({ingredient.notes})
                      </span>
                    )}
                  </li>
                ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-header">
          <h2>Elaboracion</h2>
          <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
            {steps.length} paso(s)
          </span>
        </div>
        <div className="card-body" style={{ padding: steps.length === 0 ? 16 : 20 }}>
          {steps.length === 0 ? (
            <p style={{ color: 'var(--color-text-muted)' }}>Sin pasos definidos</p>
          ) : (
            <ol style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 14 }}>
              {steps
                .slice()
                .sort((a, b) => a.position - b.position)
                .map((step) => (
                  <li key={`${step.position}-${step.text}`} style={{ paddingLeft: 4 }}>
                    <span style={{ lineHeight: 1.6 }}>{step.text}</span>
                  </li>
                ))}
            </ol>
          )}
        </div>
      </div>

      {showEditForm && (
        <RecipeForm
          initial={recipe}
          onSubmit={handleUpdate}
          onSaved={(updatedRecipe) => {
            setRecipe(updatedRecipe);
            setShowEditForm(false);
          }}
          onCancel={() => setShowEditForm(false)}
          title="Editar receta"
        />
      )}

      {showAddToList && (
        <AddToListModal
          recipeTitle={recipe.title}
          defaultServings={recipe.servings}
          ingredients={recipe.ingredients}
          onConfirm={handleAddToList}
          onCancel={() => setShowAddToList(false)}
        />
      )}
    </div>
  );
}
