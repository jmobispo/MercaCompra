import type { User } from '../../types';
import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';

interface NavbarProps {
  title: string;
  user: User | null;
}

export default function Navbar({ title, user }: NavbarProps) {
  const { update } = useAuth();
  const initials = user
    ? (user.username || user.email).slice(0, 2).toUpperCase()
    : '??';
  const [postalCode, setPostalCode] = useState(user?.postal_code ?? '28001');
  const [saving, setSaving] = useState(false);

  const handlePostalSave = async () => {
    const normalized = postalCode.trim();
    if (!/^\d{5}$/.test(normalized) || normalized === user?.postal_code) return;
    setSaving(true);
    try {
      await update({ postal_code: normalized });
    } finally {
      setSaving(false);
    }
  };

  return (
    <header className="topbar">
      <span className="topbar-title">{title}</span>
      <div className="topbar-user">
        {user && (
          <>
            <div className="topbar-postal">
              <label htmlFor="postal-code-topbar">CP</label>
              <input
                id="postal-code-topbar"
                value={postalCode}
                maxLength={5}
                onChange={(e) => setPostalCode(e.target.value)}
                onBlur={handlePostalSave}
                onKeyDown={(e) => e.key === 'Enter' && handlePostalSave()}
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
