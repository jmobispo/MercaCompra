import { useMemo, useState } from 'react';

import { resolveBackendUrl } from '../../api/client';
import type { RecipeSummary } from '../../types';

type MealSlot = 'desayuno' | 'comida' | 'cena';

const SLOT_OPTIONS: Array<{ key: MealSlot; label: string }> = [
  { key: 'desayuno', label: 'Desayuno' },
  { key: 'comida', label: 'Comida' },
  { key: 'cena', label: 'Cena' },
];

interface MealSlotPickerModalProps {
  open: boolean;
  dayLabel: string;
  mealSlot: MealSlot;
  selectedRecipeId: number | null;
  recipes: RecipeSummary[];
  saving: boolean;
  onClose: () => void;
  onSelectMealSlot: (slot: MealSlot) => void;
  onAssignRecipe: (recipeId: number) => void;
  onClearRecipe: () => void;
}

export default function MealSlotPickerModal({
  open,
  dayLabel,
  mealSlot,
  selectedRecipeId,
  recipes,
  saving,
  onClose,
  onSelectMealSlot,
  onAssignRecipe,
  onClearRecipe,
}: MealSlotPickerModalProps) {
  const [query, setQuery] = useState('');

  const filteredRecipes = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = recipes.filter((recipe) => {
      const haystack = [
        recipe.title,
        recipe.description ?? '',
        ...(recipe.tags ?? []),
        ...(recipe.meal_types ?? []),
      ].join(' ').toLowerCase();
      return q ? haystack.includes(q) : true;
    });

    const scored = [...base].sort((left, right) => {
      const leftPriority = left.meal_types?.includes(mealSlot) ? 1 : 0;
      const rightPriority = right.meal_types?.includes(mealSlot) ? 1 : 0;
      if (leftPriority !== rightPriority) return rightPriority - leftPriority;
      return left.title.localeCompare(right.title, 'es');
    });

    return scored;
  }, [mealSlot, query, recipes]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal-content meal-picker-modal">
        <div className="modal-header">
          <div>
            <h2>Elegir receta</h2>
            <p className="meal-picker-subtitle">{dayLabel}</p>
          </div>
          <button className="btn-icon" onClick={onClose}>×</button>
        </div>

        <div className="modal-body modal-body-scroll meal-picker-body">
          <div className="meal-slot-tabs" role="tablist" aria-label="Tipo de comida">
            {SLOT_OPTIONS.map((slot) => (
              <button
                key={slot.key}
                type="button"
                className={`meal-slot-tab${mealSlot === slot.key ? ' is-active' : ''}`}
                onClick={() => onSelectMealSlot(slot.key)}
              >
                {slot.label}
              </button>
            ))}
          </div>

          <div className="meal-picker-toolbar">
            <input
              className="form-input"
              placeholder="Buscar receta..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onClearRecipe}
              disabled={saving || selectedRecipeId == null}
            >
              Quitar receta
            </button>
          </div>

          <div className="meal-picker-grid">
            {filteredRecipes.map((recipe) => {
              const imageUrl = resolveBackendUrl(recipe.image_url);
              const isSelected = recipe.id === selectedRecipeId;
              return (
                <button
                  key={recipe.id}
                  type="button"
                  className={`meal-recipe-card${isSelected ? ' is-selected' : ''}`}
                  onClick={() => onAssignRecipe(recipe.id)}
                  disabled={saving}
                >
                  <div className="meal-recipe-card-media">
                    {imageUrl ? (
                      <img src={imageUrl} alt={recipe.title} className="meal-recipe-card-image" />
                    ) : (
                      <div className="meal-recipe-card-placeholder">Sin imagen</div>
                    )}
                  </div>
                  <div className="meal-recipe-card-content">
                    <div className="meal-recipe-card-header">
                      <h3>{recipe.title}</h3>
                      {isSelected && <span className="meal-recipe-selected-badge">Actual</span>}
                    </div>
                    <p className="meal-recipe-card-description">
                      {recipe.description?.trim() || 'Sin descripcion'}
                    </p>
                    <div className="meal-recipe-card-meta">
                      {recipe.calories_per_serving != null ? (
                        <span>{Math.round(recipe.calories_per_serving)} kcal</span>
                      ) : (
                        <span>Kcal sin definir</span>
                      )}
                      {recipe.estimated_minutes ? <span>{recipe.estimated_minutes} min</span> : <span>Tiempo libre</span>}
                      {recipe.estimated_cost != null ? (
                        <span>{recipe.estimated_cost.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                      ) : (
                        <span>Coste sin definir</span>
                      )}
                    </div>
                    {((recipe.meal_types && recipe.meal_types.length > 0) || (recipe.tags && recipe.tags.length > 0)) && (
                      <div className="meal-recipe-card-tags">
                        {(recipe.meal_types ?? []).map((mealType) => (
                          <span
                            key={mealType}
                            className={`recipe-tag recipe-tag-meal recipe-tag-${mealType}${mealType === mealSlot ? ' is-slot-match' : ''}`}
                          >
                            {mealType}
                          </span>
                        ))}
                        {(recipe.tags ?? []).slice(0, 3).map((tag) => (
                          <span key={tag} className="recipe-tag">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {filteredRecipes.length === 0 && (
            <div className="empty-state" style={{ padding: 24 }}>
              <div className="empty-icon">R</div>
              <p>No hay recetas que coincidan con la busqueda</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
