import type { RecipeSummary } from '../../types';
import { resolveBackendUrl } from '../../api/client';

interface RecipeCardProps {
  recipe: RecipeSummary;
  onView: (id: number) => void;
  onEdit?: (id: number) => void;
  onDuplicate?: (id: number) => void;
  onDelete?: (id: number) => void;
  onAddToList?: (id: number) => void;
}

export default function RecipeCard({
  recipe,
  onView,
  onEdit,
  onDuplicate,
  onDelete,
  onAddToList,
}: RecipeCardProps) {
  const formatCost = (cost: number | null) =>
    cost != null ? cost.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }) : null;

  const imageUrl = resolveBackendUrl(recipe.image_url);
  const mealTypes = recipe.meal_types ?? [];

  return (
    <div
      className="recipe-card card"
      style={{ cursor: 'pointer' }}
      onClick={() => onView(recipe.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => event.key === 'Enter' && onView(recipe.id)}
    >
      <div className="recipe-card-media">
        {imageUrl ? (
          <img src={imageUrl} alt={recipe.title} className="recipe-card-image" />
        ) : (
          <div className="recipe-card-placeholder">Sin imagen</div>
        )}
      </div>

      <div className="recipe-card-body">
        <div className="recipe-card-header">
          <h3 className="recipe-card-title">{recipe.title}</h3>
          {recipe.is_public && (
            <span className="badge recipe-card-badge">
              Sugerida
            </span>
          )}
        </div>

        {recipe.description && (
          <p className="recipe-card-desc">{recipe.description}</p>
        )}

        <div className="recipe-card-meta">
          {recipe.estimated_minutes && <span title="Tiempo">{recipe.estimated_minutes} min</span>}
          <span title="Raciones">{recipe.servings} raciones</span>
          <span title="Ingredientes">{recipe.ingredient_count} ingredientes</span>
          {formatCost(recipe.estimated_cost) && <span title="Coste">{formatCost(recipe.estimated_cost)}</span>}
          {recipe.calories_per_serving != null && <span title="Calorias">{Math.round(recipe.calories_per_serving)} kcal</span>}
        </div>

        {mealTypes.length > 0 && (
          <div className="recipe-tags">
            {mealTypes.map((mealType) => (
              <span key={mealType} className={`recipe-tag recipe-tag-meal recipe-tag-${mealType}`}>{mealType}</span>
            ))}
          </div>
        )}

        {recipe.tags && recipe.tags.length > 0 && (
          <div className="recipe-tags">
            {recipe.tags.map((tag) => (
              <span key={tag} className="recipe-tag">{tag}</span>
            ))}
          </div>
        )}
      </div>

      <div className="recipe-card-actions" onClick={(event) => event.stopPropagation()}>
        {onAddToList && (
          <button className="btn btn-primary btn-sm" onClick={() => onAddToList(recipe.id)}>
            + Lista
          </button>
        )}
        {onDuplicate && (
          <button className="btn btn-secondary btn-sm" onClick={() => onDuplicate(recipe.id)}>
            Copiar
          </button>
        )}
        {onEdit && (
          <button className="btn btn-ghost btn-sm" onClick={() => onEdit(recipe.id)}>
            Editar
          </button>
        )}
        {onDelete && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => onDelete(recipe.id)}
            style={{ color: 'var(--color-danger)' }}
          >
            Eliminar
          </button>
        )}
      </div>
    </div>
  );
}
