import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';

import { resolveBackendUrl } from '../api/client';
import { getLists } from '../api/lists';
import { getRecipes } from '../api/recipes';
import {
  generateWeeklyPlan,
  generateWeeklyPlanShoppingList,
  getWeeklyPlan,
  getWeeklyPlanSummary,
  updateWeeklyPlan,
} from '../api/weeklyPlans';
import MealSlotPickerModal from '../components/weekly-plan/MealSlotPickerModal';
import type {
  AddToListResult,
  RecipeSummary,
  ShoppingListSummary,
  WeeklyMealSlot,
  WeeklyPlan,
  WeeklyPlanDay,
  WeeklyPlanDayPayload,
  WeeklyPlanDaySummary,
  WeeklyPlanGeneratedSummary,
  WeeklyPlanPreferences,
} from '../types';

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
const SLOT_LABELS: Array<{ key: WeeklyMealSlot; label: string; group: 'desayuno' | 'comida' | 'cena' }> = [
  { key: 'desayuno', label: 'Desayuno', group: 'desayuno' },
  { key: 'merienda', label: 'Merienda', group: 'desayuno' },
  { key: 'comida_primero', label: 'Primer plato', group: 'comida' },
  { key: 'comida_segundo', label: 'Segundo plato', group: 'comida' },
  { key: 'comida_postre', label: 'Postre', group: 'comida' },
  { key: 'cena_primero', label: 'Primer plato', group: 'cena' },
  { key: 'cena_segundo', label: 'Segundo plato', group: 'cena' },
  { key: 'cena_postre', label: 'Postre', group: 'cena' },
];
const SLOT_GROUPS: Array<{ key: 'desayuno' | 'comida' | 'merienda' | 'cena'; label: string; slots: WeeklyMealSlot[] }> = [
  { key: 'desayuno', label: 'Desayuno', slots: ['desayuno'] },
  { key: 'comida', label: 'Comida', slots: ['comida_primero', 'comida_segundo', 'comida_postre'] },
  { key: 'merienda', label: 'Merienda', slots: ['merienda'] },
  { key: 'cena', label: 'Cena', slots: ['cena_primero', 'cena_segundo', 'cena_postre'] },
];
const PREFERENCE_LABELS: Array<{ key: keyof WeeklyPlanPreferences; label: string }> = [
  { key: 'economico', label: 'Economico' },
  { key: 'rapido', label: 'Rapido' },
  { key: 'saludable', label: 'Saludable' },
  { key: 'familiar', label: 'Familiar' },
];

type CalendarCell = {
  isoDate: string;
  dayNumber: number;
  dayIndex: number | null;
  weekdayIndex: number;
  isCurrentMonth: boolean;
  isActivePlanDay: boolean;
};

const defaultPreferences: WeeklyPlanPreferences = {
  economico: false,
  rapido: false,
  saludable: false,
  familiar: false,
};

const slotMeta = new Map(SLOT_LABELS.map((slot) => [slot.key, slot]));

const toIsoDate = (value: Date) => {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addDays = (base: Date, amount: number) => {
  const next = new Date(base);
  next.setDate(next.getDate() + amount);
  return next;
};

function extractApiError(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === 'string' && detail.trim()) {
      return detail.trim();
    }
    if (Array.isArray(detail) && detail.length > 0) {
      const firstMessage = detail
        .map((item) => (typeof item?.msg === 'string' ? item.msg : null))
        .find(Boolean);
      if (firstMessage) {
        return firstMessage;
      }
    }
    if (typeof error.message === 'string' && error.message.trim()) {
      return error.message.trim();
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return fallback;
}

function buildCalendar(startDateIso: string, daysCount: number): CalendarCell[] {
  const startDate = new Date(`${startDateIso}T00:00:00`);
  const calendarMonth = startDate.getMonth();
  const calendarYear = startDate.getFullYear();
  const firstDayOfMonth = new Date(calendarYear, calendarMonth, 1);
  const firstWeekday = (firstDayOfMonth.getDay() + 6) % 7;
  const calendarStart = addDays(firstDayOfMonth, -firstWeekday);

  const activeDates = new Map<string, number>();
  for (let index = 0; index < daysCount; index += 1) {
    activeDates.set(toIsoDate(addDays(startDate, index)), index);
  }

  return Array.from({ length: 42 }, (_, offset) => {
    const current = addDays(calendarStart, offset);
    const isoDate = toIsoDate(current);
    const activeIndex = activeDates.get(isoDate);
    return {
      isoDate,
      dayNumber: current.getDate(),
      dayIndex: activeIndex ?? null,
      weekdayIndex: (current.getDay() + 6) % 7,
      isCurrentMonth: current.getMonth() === calendarMonth,
      isActivePlanDay: activeIndex !== undefined,
    };
  });
}

function getSlotDay(plan: WeeklyPlan, dayIndex: number, mealSlot: WeeklyMealSlot): WeeklyPlanDay | null {
  return plan.days.find((day) => day.day_index === dayIndex && day.meal_slot === mealSlot) ?? null;
}

function getDaySummary(summary: WeeklyPlanGeneratedSummary | null, dayIndex: number): WeeklyPlanDaySummary | null {
  return summary?.days.find((day) => day.day_index === dayIndex) ?? null;
}

function mergePlanWithSummary(plan: WeeklyPlan, summary: WeeklyPlanGeneratedSummary | null): WeeklyPlan {
  if (!summary) {
    return plan;
  }

  return {
    ...plan,
    days: plan.days.map((day) => {
      const summaryMeal = summary.days
        .find((summaryDay) => summaryDay.day_index === day.day_index)
        ?.meals.find((meal) => meal.meal_slot === day.meal_slot);

      if (!summaryMeal || summaryMeal.recipe_id == null || day.recipe_id === summaryMeal.recipe_id) {
        return day;
      }

      return {
        ...day,
        recipe_id: summaryMeal.recipe_id,
        recipe_title: summaryMeal.recipe_title ?? day.recipe_title,
      };
    }),
  };
}

export default function WeeklyPlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const planId = Number(id);

  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [summary, setSummary] = useState<WeeklyPlanGeneratedSummary | null>(null);
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [lists, setLists] = useState<ShoppingListSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingMenu, setGeneratingMenu] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [generatingList, setGeneratingList] = useState(false);
  const [listGenerationPhase, setListGenerationPhase] = useState(0);
  const [error, setError] = useState('');
  const [showGenerateList, setShowGenerateList] = useState(false);
  const [pickerState, setPickerState] = useState<{ dayIndex: number; mealSlot: WeeklyMealSlot } | null>(null);
  const [pickerSaving, setPickerSaving] = useState(false);
  const [generateMode, setGenerateMode] = useState<'new' | 'existing'>('new');
  const [selectedListId, setSelectedListId] = useState<number | null>(null);
  const [newListName, setNewListName] = useState('Lista semanal');
  const [result, setResult] = useState<AddToListResult | null>(null);

  useEffect(() => {
    if (!generatingList) {
      setListGenerationPhase(0);
      return;
    }

    setListGenerationPhase(0);
    const timer = window.setInterval(() => {
      setListGenerationPhase((current) => Math.min(current + 1, 2));
    }, 1400);

    return () => window.clearInterval(timer);
  }, [generatingList]);

  const loadSummary = useCallback(async (targetPlanId: number) => {
    setSummaryLoading(true);
    try {
      const data = await getWeeklyPlanSummary(targetPlanId);
      setSummary(data);
      setPlan((current) => (current && current.id === targetPlanId ? mergePlanWithSummary(current, data) : current));
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [planData, summaryData, recipesData, listsData] = await Promise.all([
        getWeeklyPlan(planId),
        getWeeklyPlanSummary(planId),
        getRecipes(),
        getLists(),
      ]);
      setPlan(mergePlanWithSummary(planData, summaryData));
      setSummary(summaryData);
      setRecipes(recipesData);
      setLists(listsData.filter((item) => !item.is_archived));
      setSelectedListId(listsData.find((item) => !item.is_archived)?.id ?? null);
      setNewListName(`Lista: ${planData.title}`);
    } catch {
      setError('No se pudo cargar el plan');
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    if (!planId) return;
    void fetchData();
  }, [fetchData, planId]);

  const calendarCells = useMemo(() => {
    if (!plan) return [];
    return buildCalendar(plan.start_date, plan.days_count);
  }, [plan]);

  const recipesById = useMemo(() => new Map(recipes.map((recipe) => [recipe.id, recipe])), [recipes]);

  const persistPlan = async (nextPlan: WeeklyPlan, mode: 'picker' | 'manual' = 'manual') => {
    if (mode === 'picker') {
      setPickerSaving(true);
    } else {
      setSaving(true);
    }

    try {
      const updated = await updateWeeklyPlan(nextPlan.id, {
        title: nextPlan.title,
        people_count: nextPlan.people_count,
        days_count: nextPlan.days_count,
        start_date: nextPlan.start_date,
        budget_target: nextPlan.budget_target,
        preferences: nextPlan.preferences,
        days: nextPlan.days.map<WeeklyPlanDayPayload>((day) => ({
          day_index: day.day_index,
          meal_slot: day.meal_slot,
          recipe_id: day.recipe_id,
          meal_type: day.meal_type,
        })),
      });
      setPlan(updated);
      setResult(null);
      setError('');
      await loadSummary(updated.id);
      return updated;
    } catch {
      setError(mode === 'picker' ? 'No se pudo asignar la receta' : 'No se pudo guardar el plan');
      throw new Error('save_failed');
    } finally {
      if (mode === 'picker') {
        setPickerSaving(false);
      } else {
        setSaving(false);
      }
    }
  };

  const handleSave = async () => {
    if (!plan) return;
    await persistPlan(plan, 'manual');
  };

  const handleGenerateMenu = async () => {
    if (!plan) return;
    setGeneratingMenu(true);
    try {
      const generated = await generateWeeklyPlan(plan.id);
      const generatedSummary = await getWeeklyPlanSummary(generated.id);
      setSummary(generatedSummary);
      setPlan(mergePlanWithSummary(generated, generatedSummary));
      setError('');
      setResult(null);
    } catch {
      setError('No se pudo generar el menu semanal');
    } finally {
      setGeneratingMenu(false);
    }
  };

  const handleGenerateShoppingList = async () => {
    if (!plan) return;
    setGeneratingList(true);
    try {
      const generated = await generateWeeklyPlanShoppingList(plan.id, {
        list_id: generateMode === 'existing' ? selectedListId : null,
        new_list_name: generateMode === 'new' ? newListName : null,
      });
      setResult(generated);
      setError('');
    } catch (error) {
      setError(extractApiError(error, 'No se pudo generar la lista de compra'));
    } finally {
      setGeneratingList(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-overlay">
        <span className="loading-spinner" />
        <span>Cargando plan...</span>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="empty-state">
        <div className="empty-icon">P</div>
        <p>Plan no encontrado</p>
        <button className="btn btn-secondary" onClick={() => navigate('/weekly-plans')}>
          Volver
        </button>
      </div>
    );
  }

  const monthLabel = new Date(`${plan.start_date}T00:00:00`).toLocaleDateString('es-ES', {
    month: 'long',
    year: 'numeric',
  });

  const openPicker = (dayIndex: number, mealSlot: WeeklyMealSlot = 'comida_primero') => {
    setPickerState({ dayIndex, mealSlot });
  };

  const pickerDay = pickerState ? pickerState.dayIndex : null;
  const pickerMealSlot = pickerState?.mealSlot ?? 'comida_primero';
  const pickerSelectedRecipe = pickerDay != null ? getSlotDay(plan, pickerDay, pickerMealSlot)?.recipe_id ?? null : null;
  const pickerDayLabel =
    pickerDay != null
      ? `${calendarCells.find((cell) => cell.dayIndex === pickerDay)?.dayNumber ?? ''} ${monthLabel}`
      : '';

  const assignRecipeFromPicker = async (recipeId: number | null) => {
    if (!plan || pickerState == null) return;
    const previousPlan = plan;
    const previousPicker = pickerState;

    let updated = false;
    const nextDays = plan.days.map((day) => {
      if (day.day_index === pickerState.dayIndex && day.meal_slot === pickerState.mealSlot) {
        updated = true;
        return {
          ...day,
          recipe_id: recipeId,
          recipe_title: recipeId != null ? recipesById.get(recipeId)?.title ?? null : null,
          meal_type: pickerState.mealSlot,
        };
      }
      return day;
    });

    if (!updated) {
      nextDays.push({
        id: pickerState.dayIndex * -10,
        day_index: pickerState.dayIndex,
        meal_slot: pickerState.mealSlot,
        recipe_id: recipeId,
        recipe_title: recipeId != null ? recipesById.get(recipeId)?.title ?? null : null,
        meal_type: pickerState.mealSlot,
      });
    }

    const nextPlan = { ...plan, days: nextDays };
    setPlan(nextPlan);

    try {
      await persistPlan(nextPlan, 'picker');
      setPickerState(null);
    } catch {
      setPlan(previousPlan);
      setPickerState(previousPicker);
    }
  };

  const totalAssignedMeals = plan.days.filter((day) => day.recipe_id != null).length;
  const totalPlannedMeals = Math.max(plan.days_count * SLOT_LABELS.length, 1);
  const assignedPct = Math.round((totalAssignedMeals / totalPlannedMeals) * 100);
  const weeklyCost = summary?.total_estimated_cost ?? 0;
  const budgetTarget = plan.budget_target ?? summary?.budget_target ?? null;
  const budgetPct = budgetTarget && budgetTarget > 0 ? Math.min(100, Math.round((weeklyCost / budgetTarget) * 100)) : 0;
  const generationStatusMessages = [
    'Preparando ingredientes y consolidando cantidades...',
    'Buscando productos y reduciendo lo que ya tienes en despensa...',
    'Optimizando la lista final para que sea mas util...',
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <input
            className="inline-edit-input"
            value={plan.title}
            onChange={(event) => setPlan({ ...plan, title: event.target.value })}
            style={{ fontSize: 28, fontWeight: 700, width: '100%' }}
          />
          <p>
            {plan.people_count} personas · {plan.days_count} días · desde {plan.start_date}
          </p>
        </div>
        <div className="actions-row">
          <button className="btn btn-secondary" onClick={() => navigate('/weekly-plans')}>
            Volver
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => {
              setResult(null);
              setError('');
              setShowGenerateList(true);
            }}
          >
            Generar lista
          </button>
          <button className="btn btn-secondary" onClick={() => void handleGenerateMenu()} disabled={generatingMenu}>
            {generatingMenu ? 'Generando...' : 'Generar menu'}
          </button>
          <button className="btn btn-primary" onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar plan'}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}
      {result && (
        <div className="alert alert-success" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              Lista generada: {result.list_name}. Añadidos {result.added}, reales {result.resolved_real ?? 0}, fallback{' '}
              {result.resolved_fallback ?? 0}, pendientes {result.unresolved ?? 0}, cubiertos por despensa{' '}
              {result.pantry_covered ?? 0}, ajustados por despensa {result.pantry_reduced ?? 0}
              {result.optimization_suggestions_applied
                ? `, optimizaciones aplicadas ${result.optimization_suggestions_applied}.`
                : '.'}
            </div>
            <button className="btn btn-secondary" onClick={() => navigate(`/lists/${result.list_id}`)}>
              Ir a la lista
            </button>
          </div>
        </div>
      )}

      <div className="plan-overview-strip">
        <div className="plan-overview-card">
          <span className="plan-overview-label">Cobertura del plan</span>
          <strong>{assignedPct}%</strong>
          <small>{totalAssignedMeals}/{totalPlannedMeals} huecos completos</small>
          <div className="progress-bar-container">
            <div className="progress-bar" style={{ width: `${assignedPct}%` }} />
          </div>
        </div>
        <div className="plan-overview-card">
          <span className="plan-overview-label">Coste estimado</span>
          <strong>{weeklyCost.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</strong>
          <small>
            {budgetTarget
              ? `Presupuesto ${budgetTarget.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}`
              : 'Sin presupuesto semanal'}
          </small>
          {budgetTarget ? (
            <div className="progress-bar-container">
              <div
                className={`progress-bar${summary?.within_budget === false ? ' over-budget' : ''}`}
                style={{ width: `${budgetPct}%` }}
              />
            </div>
          ) : null}
        </div>
        <div className="plan-overview-card">
          <span className="plan-overview-label">Nutrición media</span>
          <strong>{Math.round(summary?.average_daily_calories ?? 0)} kcal/día</strong>
          <small>
            P {Math.round((summary?.total_protein_g ?? 0) / Math.max(plan.days_count, 1))} g · C{' '}
            {Math.round((summary?.total_carbs_g ?? 0) / Math.max(plan.days_count, 1))} g · G{' '}
            {Math.round((summary?.total_fat_g ?? 0) / Math.max(plan.days_count, 1))} g
          </small>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body plan-summary-grid">
          <div className="plan-summary-item">
            <span className="plan-summary-label">Personas</span>
            <input
              className="form-input plan-summary-input"
              type="number"
              min={1}
              max={20}
              value={plan.people_count}
              onChange={(event) => setPlan({ ...plan, people_count: Number(event.target.value), preferences: plan.preferences ?? defaultPreferences })}
            />
          </div>
          <div className="plan-summary-item">
            <span className="plan-summary-label">Días</span>
            <input
              className="form-input plan-summary-input"
              type="number"
              min={1}
              max={31}
              value={plan.days_count}
              onChange={(event) => setPlan({ ...plan, days_count: Number(event.target.value), preferences: plan.preferences ?? defaultPreferences })}
            />
          </div>
          <div className="plan-summary-item">
            <span className="plan-summary-label">Fecha de inicio</span>
            <input
              className="form-input plan-summary-input"
              type="date"
              value={plan.start_date}
              onChange={(event) => setPlan({ ...plan, start_date: event.target.value, preferences: plan.preferences ?? defaultPreferences })}
            />
          </div>
          <div className="plan-summary-item plan-summary-item-accent">
            <span className="plan-summary-label">Presupuesto semanal</span>
            <input
              className="form-input plan-summary-input"
              type="number"
              min={0}
              value={plan.budget_target ?? ''}
              onChange={(event) =>
                setPlan({
                  ...plan,
                  budget_target: event.target.value ? Number(event.target.value) : null,
                  preferences: plan.preferences ?? defaultPreferences,
                })
              }
            />
          </div>
        </div>
        <div className="card-body" style={{ paddingTop: 0 }}>
          <div className="form-label">Preferencias del generador</div>
          <div className="recipe-form-toggle-grid">
            {PREFERENCE_LABELS.map(({ key, label }) => {
              const active = Boolean((plan.preferences ?? defaultPreferences)[key]);
              return (
                <button
                  key={key}
                  type="button"
                  className={`recipe-toggle-chip${active ? ' is-active' : ''}`}
                  onClick={() =>
                    setPlan({
                      ...plan,
                      preferences: {
                        ...(plan.preferences ?? defaultPreferences),
                        [key]: !active,
                      },
                    })
                  }
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {summary && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-body meal-plan-metrics-grid">
            <div className="meal-plan-metric-card">
              <span className="meal-plan-metric-label">Coste semanal</span>
              <strong>{summary.total_estimated_cost.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</strong>
              <small>
                Media diaria {summary.average_daily_cost.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
              </small>
            </div>
            <div className="meal-plan-metric-card">
              <span className="meal-plan-metric-label">Calorías semanales</span>
              <strong>{Math.round(summary.total_estimated_calories)} kcal</strong>
              <small>Media diaria {Math.round(summary.average_daily_calories)} kcal</small>
            </div>
            <div className="meal-plan-metric-card">
              <span className="meal-plan-metric-label">Macros semanales</span>
              <strong>
                P {Math.round(summary.total_protein_g)} g · C {Math.round(summary.total_carbs_g)} g · G {Math.round(summary.total_fat_g)} g
              </strong>
              <small>{totalAssignedMeals} huecos asignados</small>
            </div>
            <div className={`meal-plan-metric-card${summary.within_budget === false ? ' is-warning' : ''}`}>
              <span className="meal-plan-metric-label">Presupuesto</span>
              <strong>
                {summary.budget_target != null
                  ? summary.budget_target.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
                  : 'Sin limite'}
              </strong>
              <small>
                {summary.budget_remaining != null
                  ? summary.budget_remaining >= 0
                    ? `Restan ${summary.budget_remaining.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}`
                    : `Se supera en ${Math.abs(summary.budget_remaining).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}`
                  : 'Sin control de presupuesto'}
              </small>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div>
            <h2 style={{ marginBottom: 4 }}>Calendario de {monthLabel}</h2>
            <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
              Vista simplificada por bloques: desayuno, comida por platos, merienda y cena por platos.
            </p>
          </div>
          {summaryLoading && <span className="loading-spinner" />}
        </div>
        <div className="card-body">
          <div className="meal-calendar-weekdays">
            {WEEKDAY_LABELS.map((label, index) => (
              <div key={label} className={`meal-calendar-weekday${index >= 5 ? ' is-weekend' : ''}`}>
                {label}
              </div>
            ))}
          </div>
          <div className="meal-calendar-grid">
            {calendarCells.map((cell) => {
              const daySummary = cell.isActivePlanDay ? getDaySummary(summary, cell.dayIndex!) : null;

              return (
                <div
                  key={cell.isoDate}
                  className={[
                    'meal-calendar-cell',
                    cell.isCurrentMonth ? '' : 'is-outside',
                    cell.isActivePlanDay ? 'is-active' : 'is-inactive',
                    cell.weekdayIndex >= 5 ? 'is-weekend' : '',
                  ].join(' ').trim()}
                >
                  <button
                    type="button"
                    className="meal-calendar-date"
                    onClick={() => cell.isActivePlanDay && openPicker(cell.dayIndex!, 'comida_primero')}
                  >
                    <span>{cell.dayNumber}</span>
                    {cell.isActivePlanDay && <small>Dia {cell.dayIndex! + 1}</small>}
                  </button>

                  {cell.isActivePlanDay ? (
                    <>
                      <div className="meal-calendar-day-summary compact">
                        <strong>{Math.round(daySummary?.estimated_day_calories ?? 0)} kcal</strong>
                        <small>
                          {(daySummary?.estimated_day_cost ?? 0).toLocaleString('es-ES', {
                            style: 'currency',
                            currency: 'EUR',
                          })}
                        </small>
                        <span>
                          P {Math.round(daySummary?.protein_g ?? 0)} g · C {Math.round(daySummary?.carbs_g ?? 0)} g · G {Math.round(daySummary?.fat_g ?? 0)} g
                        </span>
                      </div>

                      <div className="meal-calendar-slots grouped">
                        {SLOT_GROUPS.map((group) => (
                          <div key={`${cell.isoDate}-${group.key}`} className={`meal-group-card meal-group-card-${group.key}`}>
                            <div className="meal-group-card-header">
                              <span>{group.label}</span>
                            </div>
                            <div className="meal-group-card-body">
                              {group.slots.map((slotKey) => {
                                const slot = slotMeta.get(slotKey)!;
                                const day = getSlotDay(plan, cell.dayIndex!, slot.key);
                                const mealSummary = daySummary?.meals.find((meal) => meal.meal_slot === slot.key) ?? null;
                                const effectiveRecipeId = day?.recipe_id ?? mealSummary?.recipe_id ?? null;
                                const recipe = effectiveRecipeId != null ? recipesById.get(effectiveRecipeId) ?? null : null;
                                const recipeImage = recipe?.image_url ? resolveBackendUrl(recipe.image_url) : null;
                                const hasAssignment = effectiveRecipeId != null || Boolean(mealSummary?.recipe_title);
                                const recipeTitle = mealSummary?.recipe_title ?? recipe?.title ?? 'Receta asignada';
                                const recipeMinutes = recipe?.estimated_minutes ?? null;
                                const recipeCost = mealSummary?.estimated_cost ?? recipe?.estimated_cost ?? null;
                                const recipeCalories = mealSummary?.calories ?? recipe?.calories_per_serving ?? null;

                                return (
                                  <button
                                    key={`${cell.isoDate}-${slot.key}`}
                                    type="button"
                                    className={`meal-slot-card compact${hasAssignment ? ' has-selection' : ''}`}
                                    onClick={() => openPicker(cell.dayIndex!, slot.key)}
                                  >
                                    <div className="meal-slot-card-headline">
                                      <span className="meal-slot-card-label">{slot.label}</span>
                                      {hasAssignment && recipeCalories != null ? (
                                        <span className="meal-slot-card-kcal">
                                          {Math.round(recipeCalories)} kcal
                                        </span>
                                      ) : null}
                                    </div>
                                    {hasAssignment ? (
                                      <div className="meal-slot-card-content">
                                        <div className="meal-slot-card-media">
                                          {recipeImage ? (
                                            <img src={recipeImage} alt={recipeTitle} className="meal-slot-card-image" />
                                          ) : (
                                            <div className="meal-slot-card-placeholder">Sin imagen</div>
                                          )}
                                        </div>
                                        <div className="meal-slot-card-text">
                                          <strong>{recipeTitle}</strong>
                                          <small>
                                            {recipeMinutes ? `${recipeMinutes} min` : 'Tiempo libre'}
                                            {recipeCost != null
                                              ? ` · ${(mealSummary?.estimated_cost ?? recipeCost).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}`
                                              : ''}
                                          </small>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="meal-slot-card-empty">Añadir receta</div>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="meal-calendar-disabled">Fuera del rango del plan</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {showGenerateList && (
        <div className="modal-overlay" onClick={(event) => !generatingList && event.target === event.currentTarget && setShowGenerateList(false)}>
          <div className="modal-content" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h2>Generar lista de compra</h2>
              <button className="btn-icon" onClick={() => setShowGenerateList(false)} disabled={generatingList}>x</button>
            </div>
            <div style={{ padding: '8px 4px 16px', display: 'grid', gap: 12 }}>
              {result && !generatingList ? (
                <div className="generation-status-card" style={{ gap: 14 }}>
                  <div className="generation-status-header">
                    <span className="success-dot" aria-hidden="true" />
                    <strong>Lista generada correctamente</strong>
                  </div>
                  <p>
                    {result.list_name}. Añadidos {result.added}, reales {result.resolved_real ?? 0}, fallback {result.resolved_fallback ?? 0},
                    pendientes {result.unresolved ?? 0}
                    {result.optimization_suggestions_applied
                      ? ` y optimizaciones aplicadas ${result.optimization_suggestions_applied}.`
                      : '.'}
                  </p>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <button
                      className="btn btn-secondary"
                      onClick={() => {
                        setResult(null);
                        setShowGenerateList(false);
                      }}
                    >
                      Cerrar
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={() => {
                        setShowGenerateList(false);
                        navigate(`/lists/${result.list_id}`);
                      }}
                    >
                      Ir a la lista
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className={`btn btn-sm ${generateMode === 'new' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setGenerateMode('new')} disabled={generatingList}>
                      Nueva lista
                    </button>
                    {lists.length > 0 && (
                      <button className={`btn btn-sm ${generateMode === 'existing' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setGenerateMode('existing')} disabled={generatingList}>
                        Lista existente
                      </button>
                    )}
                  </div>
                  {generateMode === 'new' ? (
                    <input className="form-input" value={newListName} onChange={(event) => setNewListName(event.target.value)} disabled={generatingList} />
                  ) : (
                    <select className="form-input" value={selectedListId ?? ''} onChange={(event) => setSelectedListId(Number(event.target.value))} disabled={generatingList}>
                      {lists.map((list) => (
                        <option key={list.id} value={list.id}>
                          {list.name}
                        </option>
                      ))}
                    </select>
                  )}
                  {generatingList && (
                    <div className="generation-status-card" role="status" aria-live="polite">
                      <div className="generation-status-header">
                        <span className="loading-spinner" />
                        <strong>Generando lista de compra</strong>
                      </div>
                      <p>{generationStatusMessages[listGenerationPhase]}</p>
                      <div className="generation-status-bar">
                        <div className="generation-status-bar-fill" />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="modal-footer">
              {result && !generatingList ? null : (
                <>
                  <button className="btn btn-secondary" onClick={() => setShowGenerateList(false)} disabled={generatingList}>Cancelar</button>
                  <button className="btn btn-primary" onClick={() => void handleGenerateShoppingList()} disabled={generatingList}>
                    {generatingList ? 'Generando...' : 'Generar'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <MealSlotPickerModal
        open={pickerState != null}
        dayLabel={pickerDayLabel}
        mealSlot={pickerMealSlot}
        selectedRecipeId={pickerSelectedRecipe}
        recipes={recipes}
        saving={pickerSaving}
        onClose={() => setPickerState(null)}
        onSelectMealSlot={(slot) => setPickerState((current) => (current ? { ...current, mealSlot: slot } : current))}
        onAssignRecipe={(recipeId) => {
          void assignRecipeFromPicker(recipeId);
        }}
        onClearRecipe={() => {
          void assignRecipeFromPicker(null);
        }}
      />
    </div>
  );
}
