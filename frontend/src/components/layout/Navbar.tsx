import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import type { User } from '../../types';
import BrandLogo from '../branding/BrandLogo';

interface NavbarProps {
  title: string;
  user: User | null;
}

export default function Navbar({ title, user }: NavbarProps) {
  const { update } = useAuth();
  const initials = user ? (user.username || user.email).slice(0, 2).toUpperCase() : '??';
  const [postalCode, setPostalCode] = useState(user?.postal_code ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPostalCode(user?.postal_code ?? '');
  }, [user?.postal_code]);

  const submitPostalCode = async () => {
    const next = postalCode.trim();
    if (!user || !next || next === user.postal_code || next.length < 5) return;
    setSaving(true);
    try {
      await update({ postal_code: next });
    } finally {
      setSaving(false);
    }
  };

  return (
    <header className="topbar">
      <div className="topbar-title-group">
        <BrandLogo iconOnly className="topbar-logo-badge" />
        <div className="topbar-title-stack">
          <span className="topbar-title">{title}</span>
          <span className="topbar-caption">MercaCompra</span>
        </div>
      </div>
      <div className="topbar-user">
        {user && (
          <>
            <div className="postal-inline">
              <span className="postal-label">CP</span>
              <input
                value={postalCode}
                onChange={(event) => setPostalCode(event.target.value)}
                onBlur={submitPostalCode}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void submitPostalCode();
                  }
                }}
                maxLength={5}
                inputMode="numeric"
                disabled={saving}
              />
            </div>
            <span>{user.username || user.email}</span>
            <div className="avatar">{initials}</div>
          </>
        )}
      </div>
    </header>
  );
}
