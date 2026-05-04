import type { User } from '../types';

export function applyUserAppearance(user: User | null) {
  const root = document.documentElement;
  const theme = user?.theme_mode === 'dark' ? 'dark' : 'light';
  const accent = (user?.accent_color || 'green').trim().toLowerCase();

  root.setAttribute('data-theme', theme);
  root.setAttribute('data-accent', accent);
}
