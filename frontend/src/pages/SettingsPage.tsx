import { useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';

const ACCENT_OPTIONS = [
  { value: 'green', label: 'Verde' },
  { value: 'blue', label: 'Azul' },
  { value: 'coral', label: 'Coral' },
  { value: 'amber', label: 'Ambar' },
  { value: 'plum', label: 'Ciruela' },
];

export default function SettingsPage() {
  const { user, update } = useAuth();
  const [username, setUsername] = useState(user?.username ?? '');
  const [postalCode, setPostalCode] = useState(user?.postal_code ?? '');
  const [uiMode, setUiMode] = useState<'basic' | 'advanced'>(user?.ui_mode ?? 'advanced');
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>(user?.theme_mode ?? 'light');
  const [accentColor, setAccentColor] = useState(user?.accent_color ?? 'green');
  const [aiEnabled, setAiEnabled] = useState(Boolean(user?.ai_enabled));
  const [aiModel, setAiModel] = useState(user?.ai_model ?? 'gpt-4.1-mini');
  const [aiApiKey, setAiApiKey] = useState('');
  const [clearAiApiKey, setClearAiApiKey] = useState(false);
  const [aiRecipeAutofill, setAiRecipeAutofill] = useState(Boolean(user?.ai_recipe_autofill ?? true));
  const [aiListAssist, setAiListAssist] = useState(Boolean(user?.ai_list_assist ?? true));
  const [aiPlanAssist, setAiPlanAssist] = useState(Boolean(user?.ai_plan_assist ?? true));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const hasStoredKey = useMemo(
    () => (clearAiApiKey ? false : Boolean(user?.has_ai_api_key)),
    [clearAiApiKey, user?.has_ai_api_key]
  );

  if (!user) {
    return null;
  }

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    try {
      const updated = await update({
        username: username.trim(),
        postal_code: postalCode.trim(),
        ui_mode: uiMode,
        theme_mode: themeMode,
        accent_color: accentColor,
        ai_enabled: aiEnabled,
        ai_provider: 'openai',
        ai_model: aiModel.trim(),
        ai_api_key: aiApiKey.trim() || undefined,
        clear_ai_api_key: clearAiApiKey || undefined,
        ai_recipe_autofill: aiRecipeAutofill,
        ai_list_assist: aiListAssist,
        ai_plan_assist: aiPlanAssist,
      });

      setUsername(updated.username);
      setPostalCode(updated.postal_code);
      setUiMode(updated.ui_mode);
      setThemeMode(updated.theme_mode);
      setAccentColor(updated.accent_color);
      setAiEnabled(updated.ai_enabled);
      setAiModel(updated.ai_model);
      setAiApiKey('');
      setClearAiApiKey(false);
      setAiRecipeAutofill(updated.ai_recipe_autofill);
      setAiListAssist(updated.ai_list_assist);
      setAiPlanAssist(updated.ai_plan_assist);
      setMessage('Configuracion guardada correctamente.');
    } catch {
      setError('No se pudo guardar la configuracion.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-page">
      <div className="page-header">
        <div>
          <h1>Configuracion de la cuenta</h1>
          <p>Ajusta la apariencia de la app y como quieres usar la ayuda con IA.</p>
        </div>
      </div>

      {message && <div className="alert alert-success" style={{ marginBottom: 16 }}>{message}</div>}
      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      <form className="settings-grid" onSubmit={handleSave}>
        <section className="card settings-card">
          <div className="card-header">
            <h2>Cuenta</h2>
          </div>
          <div className="card-body settings-card-body">
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" value={user.email} disabled />
            </div>
            <div className="form-group">
              <label className="form-label">Usuario</label>
              <input className="form-input" value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className="recipe-form-columns">
              <div className="form-group">
                <label className="form-label">Codigo postal</label>
                <input
                  className="form-input"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  maxLength={5}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Modo de uso</label>
                <select className="form-select" value={uiMode} onChange={(e) => setUiMode(e.target.value as 'basic' | 'advanced')}>
                  <option value="basic">Basico</option>
                  <option value="advanced">Avanzado</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        <section className="card settings-card">
          <div className="card-header">
            <h2>Apariencia</h2>
          </div>
          <div className="card-body settings-card-body">
            <div className="form-group">
              <label className="form-label">Tema</label>
              <div className="settings-segment">
                <button
                  type="button"
                  className={`settings-segment-option ${themeMode === 'light' ? 'active' : ''}`}
                  onClick={() => setThemeMode('light')}
                >
                  Claro
                </button>
                <button
                  type="button"
                  className={`settings-segment-option ${themeMode === 'dark' ? 'active' : ''}`}
                  onClick={() => setThemeMode('dark')}
                >
                  Oscuro
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Color principal</label>
              <div className="settings-accent-grid">
                {ACCENT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`accent-chip accent-${option.value} ${accentColor === option.value ? 'active' : ''}`}
                    onClick={() => setAccentColor(option.value)}
                  >
                    <span className="accent-chip-dot" />
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="card settings-card settings-card-wide">
          <div className="card-header">
            <h2>IA y ayuda automatica</h2>
          </div>
          <div className="card-body settings-card-body">
            <label className="settings-toggle">
              <input type="checkbox" checked={aiEnabled} onChange={(e) => setAiEnabled(e.target.checked)} />
              <span>
                <strong>Activar ayuda con IA</strong>
                <small>Permite completar recetas, revisar cantidades y ayudar con planes semanales.</small>
              </span>
            </label>

            <div className="recipe-form-columns">
              <div className="form-group">
                <label className="form-label">Proveedor</label>
                <input className="form-input" value="OpenAI" disabled />
              </div>
              <div className="form-group">
                <label className="form-label">Modelo</label>
                <input className="form-input" value={aiModel} onChange={(e) => setAiModel(e.target.value)} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">API key</label>
              <input
                type="password"
                className="form-input"
                placeholder={hasStoredKey ? `Guardada ${user.ai_api_key_preview ?? ''}` : 'Pega aqui tu clave'}
                value={aiApiKey}
                onChange={(e) => setAiApiKey(e.target.value)}
              />
              <div className="settings-hint-row">
                <span className="form-help">
                  {hasStoredKey
                    ? `Clave actual: ${user.ai_api_key_preview ?? 'guardada'}`
                    : 'Todavia no hay ninguna clave guardada.'}
                </span>
                {hasStoredKey && (
                  <label className="settings-inline-check">
                    <input
                      type="checkbox"
                      checked={clearAiApiKey}
                      onChange={(e) => setClearAiApiKey(e.target.checked)}
                    />
                    Quitar clave guardada
                  </label>
                )}
              </div>
            </div>

            <div className="settings-toggle-grid">
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={aiRecipeAutofill}
                  onChange={(e) => setAiRecipeAutofill(e.target.checked)}
                />
                <span>
                  <strong>Autocompletar recetas</strong>
                  <small>Rellena pasos, calorias y macros a partir de los ingredientes.</small>
                </span>
              </label>
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={aiListAssist}
                  onChange={(e) => setAiListAssist(e.target.checked)}
                />
                <span>
                  <strong>Mejorar listas</strong>
                  <small>Ajusta cantidades absurdas y deja una compra mas practica.</small>
                </span>
              </label>
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={aiPlanAssist}
                  onChange={(e) => setAiPlanAssist(e.target.checked)}
                />
                <span>
                  <strong>Ayudar con planes</strong>
                  <small>Rellena huecos del menu semanal usando tus recetas disponibles.</small>
                </span>
              </label>
            </div>
          </div>
        </section>

        <div className="settings-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar configuracion'}
          </button>
        </div>
      </form>
    </div>
  );
}
