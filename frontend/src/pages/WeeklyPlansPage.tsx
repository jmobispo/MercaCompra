import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { createWeeklyPlan, deleteWeeklyPlan, getWeeklyPlans } from '../api/weeklyPlans';
import type { CreateWeeklyPlanPayload, WeeklyPlanSummary } from '../types';

const defaultForm: CreateWeeklyPlanPayload = {
  title: 'Plan semanal',
  people_count: 2,
  days_count: 7,
  start_date: new Date().toISOString().slice(0, 10),
  budget_target: null,
};

export default function WeeklyPlansPage() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<WeeklyPlanSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateWeeklyPlanPayload>(defaultForm);

  const fetchPlans = async () => {
    try {
      const data = await getWeeklyPlans();
      setPlans(data);
    } catch {
      setError('Error al cargar los planes semanales');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const handleCreate = async () => {
    try {
      const created = await createWeeklyPlan(form);
      navigate(`/weekly-plans/${created.id}`);
    } catch {
      setError('No se pudo crear el plan');
    }
  };

  const handleDelete = async (plan: WeeklyPlanSummary) => {
    if (!window.confirm(`Eliminar "${plan.title}"?`)) return;
    try {
      await deleteWeeklyPlan(plan.id);
      setPlans((prev) => prev.filter((item) => item.id !== plan.id));
    } catch {
      setError('No se pudo eliminar el plan');
    }
  };

  if (loading) {
    return <div className="loading-overlay"><span className="loading-spinner" /><span>Cargando planes...</span></div>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Planificacion semanal</h1>
          <p>{plans.length} plan(es) guardados</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          + Nuevo plan
        </button>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      {plans.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📅</div>
          <p>No tienes planes semanales todavia</p>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>Crear primer plan</button>
        </div>
      ) : (
        <div className="lists-grid">
          {plans.map((plan) => (
            <div key={plan.id} className="list-card">
              <div className="list-card-header">
                <div className="list-card-title" onClick={() => navigate(`/weekly-plans/${plan.id}`)} role="button" tabIndex={0}>
                  {plan.title}
                </div>
                <div className="list-card-actions">
                  <button className="btn-icon" onClick={() => navigate(`/weekly-plans/${plan.id}`)} title="Abrir">
                    👁
                  </button>
                  <button className="btn-icon danger" onClick={() => handleDelete(plan)} title="Eliminar">
                    ×
                  </button>
                </div>
              </div>
              <div className="list-card-stats">
                <div className="list-card-stat">
                  <span className="label">Personas</span>
                  <span className="value">{plan.people_count}</span>
                </div>
                <div className="list-card-stat">
                  <span className="label">Dias</span>
                  <span className="value">{plan.days_count}</span>
                </div>
                <div className="list-card-stat">
                  <span className="label">Comidas asignadas</span>
                  <span className="value">{plan.assigned_days}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={(event) => event.target === event.currentTarget && setShowForm(false)}>
          <div className="modal-content" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h2>Nuevo plan semanal</h2>
              <button className="btn-icon" onClick={() => setShowForm(false)}>×</button>
            </div>
            <div style={{ display: 'grid', gap: 12, padding: '8px 4px 16px' }}>
              <input className="form-input" value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} placeholder="Titulo" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <input className="form-input" type="number" min={1} max={20} value={form.people_count} onChange={(e) => setForm((prev) => ({ ...prev, people_count: Number(e.target.value) }))} placeholder="Personas" />
                <input className="form-input" type="number" min={1} max={31} value={form.days_count} onChange={(e) => setForm((prev) => ({ ...prev, days_count: Number(e.target.value) }))} placeholder="Dias" />
              </div>
              <input className="form-input" type="date" value={form.start_date ?? ''} onChange={(e) => setForm((prev) => ({ ...prev, start_date: e.target.value }))} />
              <input className="form-input" type="number" min={0} value={form.budget_target ?? ''} onChange={(e) => setForm((prev) => ({ ...prev, budget_target: e.target.value ? Number(e.target.value) : null }))} placeholder="Presupuesto objetivo opcional" />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleCreate}>Crear plan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
