import { useState, useEffect } from 'react';
import { getDemoStatus, seedDemo } from '../api/demo';

export default function DemoBanner() {
  const [visible, setVisible] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    getDemoStatus()
      .then((s) => setVisible(s.demo_mode))
      .catch(() => {/* ignore */});
  }, []);

  if (!visible) return null;

  const handleSeed = async () => {
    setSeeding(true);
    setMsg('');
    try {
      const result = await seedDemo();
      setMsg(result.message);
      setTimeout(() => setMsg(''), 5000);
    } catch {
      setMsg('Error al poblar datos de demo');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div style={{
      background: 'linear-gradient(90deg, #f59e0b, #ef4444)',
      color: '#fff',
      padding: '8px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      fontSize: 13,
      flexWrap: 'wrap',
    }}>
      <span style={{ fontWeight: 700 }}>MODO DEMO</span>
      <span style={{ flex: 1 }}>
        Estás en modo demostración. Los datos son de ejemplo.
        {msg && <span style={{ marginLeft: 8, fontStyle: 'italic' }}>{msg}</span>}
      </span>
      <button
        onClick={handleSeed}
        disabled={seeding}
        style={{
          background: 'rgba(255,255,255,0.2)',
          border: '1px solid rgba(255,255,255,0.5)',
          color: '#fff',
          borderRadius: 6,
          padding: '4px 12px',
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 600,
          whiteSpace: 'nowrap',
        }}
      >
        {seeding ? 'Poblando…' : 'Poblar datos de ejemplo'}
      </button>
    </div>
  );
}
