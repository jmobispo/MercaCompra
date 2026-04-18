import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import BrandLogo from '../components/branding/BrandLogo';

interface FormErrors {
  email?: string;
  username?: string;
  password?: string;
  confirmPassword?: string;
  postal_code?: string;
}

export default function RegisterPage() {
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});

  const validate = (): boolean => {
    const errs: FormErrors = {};
    if (!email.trim()) errs.email = 'El email es obligatorio';
    else if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) errs.email = 'Email no válido';
    if (!username.trim()) errs.username = 'El nombre de usuario es obligatorio';
    if (!password) errs.password = 'La contraseña es obligatoria';
    else if (password.length < 6) errs.password = 'Mínimo 6 caracteres';
    if (password !== confirmPassword) errs.confirmPassword = 'Las contraseñas no coinciden';
    if (!postalCode.trim()) errs.postal_code = 'El código postal es obligatorio';
    else if (!/^\d{5}$/.test(postalCode)) errs.postal_code = 'Código postal no válido (5 dígitos)';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setError('');
    try {
      await register(email, username, password, postalCode);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setError(
        axiosErr?.response?.data?.detail ||
          (err instanceof Error ? err.message : 'Error al registrarse')
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <BrandLogo subtitle="Tu compra organizada, inteligente y lista para movil" />
        </div>

        <div className="auth-form">
          <h2>Registro</h2>

          {error && <div className="alert alert-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="email">Email *</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                autoFocus
                className={fieldErrors.email ? 'error' : ''}
                autoComplete="email"
              />
              {fieldErrors.email && <p className="field-error">{fieldErrors.email}</p>}
            </div>

            <div className="form-group">
              <label htmlFor="username">Nombre de usuario *</label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Tu nombre"
                className={fieldErrors.username ? 'error' : ''}
                autoComplete="username"
              />
              {fieldErrors.username && <p className="field-error">{fieldErrors.username}</p>}
            </div>

            <div className="form-group">
              <label htmlFor="postal-code">Código postal *</label>
              <input
                id="postal-code"
                type="text"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder="46001"
                maxLength={5}
                className={fieldErrors.postal_code ? 'error' : ''}
                autoComplete="postal-code"
              />
              {fieldErrors.postal_code && <p className="field-error">{fieldErrors.postal_code}</p>}
            </div>

            <div className="form-group">
              <label htmlFor="password">Contraseña *</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className={fieldErrors.password ? 'error' : ''}
                autoComplete="new-password"
              />
              {fieldErrors.password && <p className="field-error">{fieldErrors.password}</p>}
            </div>

            <div className="form-group">
              <label htmlFor="confirm-password">Confirmar contraseña *</label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repite la contraseña"
                className={fieldErrors.confirmPassword ? 'error' : ''}
                autoComplete="new-password"
              />
              {fieldErrors.confirmPassword && (
                <p className="field-error">{fieldErrors.confirmPassword}</p>
              )}
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-full"
              disabled={loading}
              style={{ marginTop: 8 }}
            >
              {loading ? (
                <>
                  <span className="loading-spinner white" style={{ width: 16, height: 16 }} />
                  Creando cuenta…
                </>
              ) : (
                'Crear cuenta'
              )}
            </button>
          </form>
        </div>

        <div className="auth-link">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login">Inicia sesión</Link>
        </div>
      </div>
    </div>
  );
}
