import type { User } from '../../types';

interface NavbarProps {
  title: string;
  user: User | null;
}

export default function Navbar({ title, user }: NavbarProps) {
  const initials = user
    ? (user.username || user.email).slice(0, 2).toUpperCase()
    : '??';

  return (
    <header className="topbar">
      <span className="topbar-title">{title}</span>
      <div className="topbar-user">
        {user && (
          <>
            <span>{user.username || user.email}</span>
            <div className="avatar">{initials}</div>
          </>
        )}
      </div>
    </header>
  );
}
