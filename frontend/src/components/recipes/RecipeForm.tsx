import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { deleteRecipeImage, enrichRecipeWithAI, uploadRecipeImage } from '../../api/recipes';
import { resolveBackendUrl } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import type {
  AIRecipeEnrichResult,
  Recipe,
  RecipeIngredientPayload,
  RecipeStepPayload,
  CreateRecipePayload,
  RecipeMealType,
} from '../../types';

interface RecipeFormProps {
  initial?: Recipe;
  onSubmit: (payload: CreateRecipePayload) => Promise<Recipe>;
  onCancel: () => void;
  onSaved?: (recipe: Recipe) => void;
  title?: string;
}

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const TARGET_IMAGE_MAX_BYTES = 900 * 1024;
const TARGET_IMAGE_MAX_DIMENSION = 1600;
const MEAL_TYPE_OPTIONS: Array<{ value: RecipeMealType; label: string }> = [
  { value: 'desayuno', label: 'Desayuno' },
  { value: 'comida', label: 'Comida' },
  { value: 'cena', label: 'Cena' },
  { value: 'merienda', label: 'Merienda' },
  { value: 'postre', label: 'Postre' },
];

function emptyIngredient(): RecipeIngredientPayload {
  return { name: '', quantity: null, unit: '', notes: '', product_query: '' };
}

function emptyStep(): RecipeStepPayload {
  return { text: '' };
}

function extractApiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === 'string' && detail.trim()) {
      return detail;
    }
    if (Array.isArray(detail) && detail.length > 0) {
      return detail
        .map((item) => {
          if (typeof item === 'string') return item;
          if (item && typeof item === 'object' && 'msg' in item && typeof item.msg === 'string') {
            return item.msg;
          }
          return null;
        })
        .filter((msg): msg is string => Boolean(msg))
        .join(' · ');
    }
    if (typeof error.message === 'string' && error.message.trim()) {
      return error.message;
    }
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

async function optimizeImageFile(file: File): Promise<File> {
  if (file.type === 'image/gif' || file.size <= TARGET_IMAGE_MAX_BYTES) {
    return file;
  }

  const imageBitmap = await createImageBitmap(file);
  const scale = Math.min(
    1,
    TARGET_IMAGE_MAX_DIMENSION / Math.max(imageBitmap.width, imageBitmap.height)
  );
  const width = Math.max(1, Math.round(imageBitmap.width * scale));
  const height = Math.max(1, Math.round(imageBitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    imageBitmap.close();
    return file;
  }
  context.drawImage(imageBitmap, 0, 0, width, height);
  imageBitmap.close();

  const candidateQualities = [0.86, 0.78, 0.7, 0.62, 0.54];
  for (const quality of candidateQualities) {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality)
    );
    if (!blob) continue;
    const optimized = new File(
      [blob],
      file.name.replace(/\.[^.]+$/, '') + '.jpg',
      { type: 'image/jpeg' }
    );
    if (optimized.size <= TARGET_IMAGE_MAX_BYTES) {
      return optimized;
    }
  }

  const finalBlob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.5)
  );
  if (!finalBlob) return file;
  return new File(
    [finalBlob],
    file.name.replace(/\.[^.]+$/, '') + '.jpg',
    { type: 'image/jpeg' }
  );
}

export default function RecipeForm({
  initial,
  onSubmit,
  onCancel,
  onSaved,
  title = 'Receta',
}: RecipeFormProps) {
  const [recipeTitle, setRecipeTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [servings, setServings] = useState(initial?.servings ?? 4);
  const [minutes, setMinutes] = useState<string>(initial?.estimated_minutes?.toString() ?? '');
  const [cost, setCost] = useState<string>(initial?.estimated_cost?.toString() ?? '');
  const [calories, setCalories] = useState<string>(initial?.calories_per_serving?.toString() ?? '');
  const [protein, setProtein] = useState<string>(initial?.protein_g?.toString() ?? '');
  const [carbs, setCarbs] = useState<string>(initial?.carbs_g?.toString() ?? '');
  const [fat, setFat] = useState<string>(initial?.fat_g?.toString() ?? '');
  const [fiber, setFiber] = useState<string>(initial?.fiber_g?.toString() ?? '');
  const [sugar, setSugar] = useState<string>(initial?.sugar_g?.toString() ?? '');
  const [sodium, setSodium] = useState<string>(initial?.sodium_mg?.toString() ?? '');
  const [mealTypes, setMealTypes] = useState<RecipeMealType[]>(initial?.meal_types ?? []);
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
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(resolveBackendUrl(initial?.image_url));
  const [removeImage, setRemoveImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [enrichingAI, setEnrichingAI] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const user = useAuthStore((state) => state.user);
  const canUseRecipeAI = Boolean(user?.ai_enabled && user?.has_ai_api_key && user?.ai_recipe_autofill);

  const currentImageLabel = useMemo(() => {
    if (selectedImage) return selectedImage.name;
    if (previewUrl && !removeImage) return 'Imagen actual';
    return '';
  }, [previewUrl, removeImage, selectedImage]);

  useEffect(() => {
    if (!selectedImage) return undefined;
    const objectUrl = URL.createObjectURL(selectedImage);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedImage]);

  const addIngredient = () => setIngredients((prev) => [...prev, emptyIngredient()]);
  const removeIngredient = (index: number) => setIngredients((prev) => prev.filter((_, idx) => idx !== index));
  const updateIngredient = (
    index: number,
    field: keyof RecipeIngredientPayload,
    value: string | number | null,
  ) => {
    setIngredients((prev) => prev.map((ingredient, idx) => (
      idx === index ? { ...ingredient, [field]: value } : ingredient
    )));
  };

  const addStep = () => setSteps((prev) => [...prev, emptyStep()]);
  const removeStep = (index: number) => setSteps((prev) => prev.filter((_, idx) => idx !== index));
  const updateStep = (index: number, value: string) => {
    setSteps((prev) => prev.map((step, idx) => (idx === index ? { ...step, text: value } : step)));
  };
  const toggleMealType = (mealType: RecipeMealType) => {
    setMealTypes((prev) => (
      prev.includes(mealType)
        ? prev.filter((item) => item !== mealType)
        : [...prev, mealType]
    ));
  };

  const handleImageSelection = async (file: File | null) => {
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError('La imagen debe ser JPG, PNG, WEBP o GIF.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError('La imagen supera el maximo de 5 MB.');
      return;
    }

    setError('');
    try {
      const optimized = await optimizeImageFile(file);
      setSelectedImage(optimized);
      if (optimized !== file) {
        setInfo('La imagen se ha optimizado automaticamente para guardarla mejor.');
      }
    } catch {
      setSelectedImage(file);
    }
    setRemoveImage(false);
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setPreviewUrl(null);
    setRemoveImage(true);
  };

  const handleEnrichWithAI = async () => {
    if (!canUseRecipeAI) return;
    if (!recipeTitle.trim()) {
      setError('Escribe al menos el titulo antes de usar la IA.');
      return;
    }
    const cleanIngredients = ingredients.filter((ingredient) => ingredient.name.trim());
    if (cleanIngredients.length === 0) {
      setError('Añade ingredientes antes de pedir ayuda con IA.');
      return;
    }

    setEnrichingAI(true);
    setError('');
    setInfo('');
    try {
      const result = await enrichRecipeWithAI({
        title: recipeTitle.trim(),
        description: description.trim() || null,
        servings,
        estimated_minutes: minutes ? parseInt(minutes, 10) : null,
        estimated_cost: cost ? parseFloat(cost) : null,
        calories_per_serving: calories ? parseFloat(calories) : null,
        protein_g: protein ? parseFloat(protein) : null,
        carbs_g: carbs ? parseFloat(carbs) : null,
        fat_g: fat ? parseFloat(fat) : null,
        fiber_g: fiber ? parseFloat(fiber) : null,
        sugar_g: sugar ? parseFloat(sugar) : null,
        sodium_mg: sodium ? parseFloat(sodium) : null,
        meal_types: mealTypes,
        tags: tagsRaw.split(',').map((tag) => tag.trim()).filter(Boolean),
        ingredients: cleanIngredients,
        steps,
      });

      if (!description.trim() && result.description) setDescription(result.description);
      if (!minutes && result.estimated_minutes != null) setMinutes(String(result.estimated_minutes));
      if (!cost && result.estimated_cost != null) setCost(String(result.estimated_cost));
      if (!calories && result.calories_per_serving != null) setCalories(String(result.calories_per_serving));
      if (!protein && result.protein_g != null) setProtein(String(result.protein_g));
      if (!carbs && result.carbs_g != null) setCarbs(String(result.carbs_g));
      if (!fat && result.fat_g != null) setFat(String(result.fat_g));
      if (!fiber && result.fiber_g != null) setFiber(String(result.fiber_g));
      if (!sugar && result.sugar_g != null) setSugar(String(result.sugar_g));
      if (!sodium && result.sodium_mg != null) setSodium(String(result.sodium_mg));
      if (mealTypes.length === 0 && result.meal_types.length > 0) {
        setMealTypes(result.meal_types);
      }
      if (!tagsRaw.trim() && result.tags.length > 0) {
        setTagsRaw(result.tags.join(', '));
      }
      if (steps.filter((step) => step.text.trim()).length === 0 && result.steps.length > 0) {
        setSteps(result.steps.map((step, index) => ({ text: step.text, position: step.position ?? index })));
      }

      setInfo(result.summary ?? 'La IA ha completado los campos que faltaban.');
    } catch (err) {
      setError(extractApiErrorMessage(err, 'No se pudo completar la receta con IA.'));
    } finally {
      setEnrichingAI(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!recipeTitle.trim()) {
      setError('El titulo es obligatorio');
      return;
    }

    if (ingredients.filter((ingredient) => ingredient.name.trim()).length === 0) {
      setError('Añade al menos un ingrediente');
      return;
    }

    if (steps.some((step) => !step.text.trim())) {
      setError('Completa o elimina los pasos vacios antes de guardar');
      return;
    }

    setSaving(true);
    setError('');
    setInfo('');

    try {
      const cleanedIngredients = ingredients
        .filter((ingredient) => ingredient.name.trim())
        .map((ingredient, position) => ({
          ...ingredient,
          name: ingredient.name.trim(),
          quantity: ingredient.quantity ?? null,
          unit: ingredient.unit?.trim() || null,
          notes: ingredient.notes?.trim() || null,
          product_query: ingredient.product_query?.trim() || null,
          position,
        }));

      const cleanedSteps = steps
        .filter((step) => step.text.trim())
        .map((step, position) => ({
          text: step.text.trim(),
          position,
        }));

      let aiResult: AIRecipeEnrichResult | null = null;
      const shouldAutoEnrich =
        canUseRecipeAI &&
        (
          !description.trim() ||
          !minutes ||
          !cost ||
          !calories ||
          !protein ||
          !carbs ||
          !fat ||
          !fiber ||
          !sugar ||
          !sodium ||
          mealTypes.length === 0 ||
          !tagsRaw.trim() ||
          cleanedSteps.length === 0
        );

      if (shouldAutoEnrich) {
        try {
          aiResult = await enrichRecipeWithAI({
            title: recipeTitle.trim(),
            description: description.trim() || null,
            servings,
            estimated_minutes: minutes ? parseInt(minutes, 10) : null,
            estimated_cost: cost ? parseFloat(cost) : null,
            calories_per_serving: calories ? parseFloat(calories) : null,
            protein_g: protein ? parseFloat(protein) : null,
            carbs_g: carbs ? parseFloat(carbs) : null,
            fat_g: fat ? parseFloat(fat) : null,
            fiber_g: fiber ? parseFloat(fiber) : null,
            sugar_g: sugar ? parseFloat(sugar) : null,
            sodium_mg: sodium ? parseFloat(sodium) : null,
            meal_types: mealTypes,
            tags: tagsRaw.split(',').map((tag) => tag.trim()).filter(Boolean),
            ingredients: cleanedIngredients,
            steps: cleanedSteps,
          });
          if (aiResult?.summary) {
            setInfo(aiResult.summary);
          }
        } catch {
          // Si la IA falla, no bloqueamos el guardado manual.
        }
      }

      let savedRecipe = await onSubmit({
        title: recipeTitle.trim(),
        description: description.trim() || aiResult?.description || null,
        servings,
        estimated_minutes: minutes ? parseInt(minutes, 10) : (aiResult?.estimated_minutes ?? null),
        estimated_cost: cost ? parseFloat(cost) : (aiResult?.estimated_cost ?? null),
        calories_per_serving: calories ? parseFloat(calories) : (aiResult?.calories_per_serving ?? null),
        protein_g: protein ? parseFloat(protein) : (aiResult?.protein_g ?? null),
        carbs_g: carbs ? parseFloat(carbs) : (aiResult?.carbs_g ?? null),
        fat_g: fat ? parseFloat(fat) : (aiResult?.fat_g ?? null),
        fiber_g: fiber ? parseFloat(fiber) : (aiResult?.fiber_g ?? null),
        sugar_g: sugar ? parseFloat(sugar) : (aiResult?.sugar_g ?? null),
        sodium_mg: sodium ? parseFloat(sodium) : (aiResult?.sodium_mg ?? null),
        meal_types: mealTypes.length > 0 ? mealTypes : (aiResult?.meal_types ?? []),
        tags: tagsRaw.split(',').map((tag) => tag.trim()).filter(Boolean).length > 0
          ? tagsRaw.split(',').map((tag) => tag.trim()).filter(Boolean)
          : (aiResult?.tags ?? []),
        ingredients: cleanedIngredients,
        steps: cleanedSteps.length > 0
          ? cleanedSteps
          : (aiResult?.steps ?? []).map((step, position) => ({
            text: step.text.trim(),
            position: step.position ?? position,
          })),
      });

      if (selectedImage) {
        savedRecipe = await uploadRecipeImage(savedRecipe.id, selectedImage);
      } else if (removeImage && savedRecipe.image_url) {
        savedRecipe = await deleteRecipeImage(savedRecipe.id);
      }

      onSaved?.(savedRecipe);
      onCancel();
    } catch (err) {
      setError(extractApiErrorMessage(err, 'Error al guardar la receta'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(event) => event.target === event.currentTarget && onCancel()}>
      <div className="modal-content" style={{ maxWidth: 820, maxHeight: '90vh' }}>
        <div className="modal-header">
          <h2>{title}</h2>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {canUseRecipeAI && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => void handleEnrichWithAI()}
                disabled={saving || enrichingAI}
              >
                {enrichingAI ? 'Completando...' : 'Completar con IA'}
              </button>
            )}
            <button className="btn-icon" onClick={onCancel}>×</button>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div className="modal-body modal-body-scroll recipe-form-grid">
            {error && <div className="alert alert-error">{error}</div>}
            {info && <div className="alert alert-success">{info}</div>}

            <div className="form-group">
              <label className="form-label">Titulo *</label>
              <input
                className="form-input"
                value={recipeTitle}
                onChange={(event) => setRecipeTitle(event.target.value)}
                placeholder="Ej. Tortilla de patatas"
                maxLength={200}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Descripcion</label>
              <textarea
                className="form-input"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Breve descripcion de la receta..."
                rows={2}
                style={{ resize: 'vertical' }}
              />
            </div>

            <div className="recipe-form-columns">
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
              <label className="form-label">Ideal para</label>
              <div className="recipe-meal-type-picker">
                {MEAL_TYPE_OPTIONS.map((option) => {
                  const active = mealTypes.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={`recipe-meal-type-chip${active ? ' is-active' : ''}`}
                      onClick={() => toggleMealType(option.value)}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Nutricion por racion</label>
              <div className="recipe-form-columns recipe-form-columns-wide">
                <div className="form-group">
                  <label className="form-label">Calorias (kcal)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={calories}
                    onChange={(event) => setCalories(event.target.value)}
                    placeholder="480"
                    min={0}
                    step="1"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Proteina (g)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={protein}
                    onChange={(event) => setProtein(event.target.value)}
                    placeholder="24"
                    min={0}
                    step="0.1"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Carbohidratos (g)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={carbs}
                    onChange={(event) => setCarbs(event.target.value)}
                    placeholder="42"
                    min={0}
                    step="0.1"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Grasas (g)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={fat}
                    onChange={(event) => setFat(event.target.value)}
                    placeholder="18"
                    min={0}
                    step="0.1"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Fibra (g)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={fiber}
                    onChange={(event) => setFiber(event.target.value)}
                    placeholder="5"
                    min={0}
                    step="0.1"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Azucares (g)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={sugar}
                    onChange={(event) => setSugar(event.target.value)}
                    placeholder="4"
                    min={0}
                    step="0.1"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Sodio (mg)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={sodium}
                    onChange={(event) => setSodium(event.target.value)}
                    placeholder="620"
                    min={0}
                    step="1"
                  />
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Etiquetas (separadas por coma)</label>
              <input
                className="form-input"
                value={tagsRaw}
                onChange={(event) => setTagsRaw(event.target.value)}
                placeholder="pasta, rapida, italiana"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Imagen</label>
              <div className="recipe-image-editor">
                <div className="recipe-image-preview">
                  {previewUrl && !removeImage ? (
                    <img src={previewUrl} alt="Vista previa de la receta" />
                  ) : (
                    <div className="recipe-image-placeholder">Sin imagen</div>
                  )}
                </div>
                <div className="recipe-image-actions">
                  <label className="btn btn-secondary btn-sm">
                    {previewUrl && !removeImage ? 'Reemplazar imagen' : 'Añadir imagen'}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      style={{ display: 'none' }}
                      onChange={(event) => { void handleImageSelection(event.target.files?.[0] ?? null); }}
                    />
                  </label>
                  {(previewUrl || initial?.image_url) && !removeImage && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={handleRemoveImage}>
                      Eliminar imagen
                    </button>
                  )}
                  {currentImageLabel && (
                    <span className="text-muted" style={{ fontSize: 12 }}>{currentImageLabel}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="form-group">
              <div className="recipe-form-section-header">
                <label className="form-label" style={{ margin: 0 }}>Ingredientes *</label>
                <button type="button" className="btn btn-secondary btn-sm" onClick={addIngredient}>
                  + Añadir ingrediente
                </button>
              </div>

              <div className="recipe-rows">
                {ingredients.map((ingredient, index) => (
                  <div key={`ingredient-${index}`} className="recipe-ingredient-row">
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
                    <input
                      className="form-input"
                      value={ingredient.product_query ?? ''}
                      onChange={(event) => updateIngredient(index, 'product_query', event.target.value)}
                      placeholder="Busqueda sugerida"
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
            </div>

            <div className="form-group">
              <div className="recipe-form-section-header">
                <label className="form-label" style={{ margin: 0 }}>Elaboracion</label>
                <button type="button" className="btn btn-secondary btn-sm" onClick={addStep}>
                  + Añadir paso
                </button>
              </div>

              {steps.length === 0 ? (
                <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>Sin pasos definidos todavia.</p>
              ) : (
                <div className="recipe-step-list">
                  {steps.map((step, index) => (
                    <div key={`step-${index}`} className="recipe-step-row">
                      <div className="recipe-step-number">{index + 1}</div>
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
