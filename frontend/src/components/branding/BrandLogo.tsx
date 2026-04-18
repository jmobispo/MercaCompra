type BrandLogoProps = {
  compact?: boolean;
  iconOnly?: boolean;
  subtitle?: string;
  className?: string;
};

function CartIcon() {
  return (
    <svg viewBox="0 0 160 120" aria-hidden="true" className="brand-logo-mark-svg">
      <defs>
        <linearGradient id="brand-cart-line" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#334155" />
          <stop offset="62%" stopColor="#46566D" />
          <stop offset="100%" stopColor="#F97316" />
        </linearGradient>
        <linearGradient id="brand-cart-basket" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#B8FF2F" />
          <stop offset="100%" stopColor="#33C85B" />
        </linearGradient>
        <linearGradient id="brand-fruit-red" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF7A59" />
          <stop offset="100%" stopColor="#E43F2F" />
        </linearGradient>
        <linearGradient id="brand-fruit-orange" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFD64D" />
          <stop offset="100%" stopColor="#FFB703" />
        </linearGradient>
        <linearGradient id="brand-fruit-green" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#98F24A" />
          <stop offset="100%" stopColor="#15A34A" />
        </linearGradient>
        <filter id="brand-soft-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#AAB8C7" floodOpacity="0.24" />
        </filter>
      </defs>

      <g filter="url(#brand-soft-shadow)">
        <path
          d="M26 28h18c7 0 11 3 15 10l8 14h62c8 0 11 9 5 14l-10 10c-4 5-9 7-15 7H63c-8 0-14-4-18-11L31 45"
          fill="none"
          stroke="url(#brand-cart-line)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M59 45h57c9 0 13 11 7 17l-9 9c-3 3-7 5-11 5H68c-4 0-8-2-9-6l-6-18c-1-4 2-7 6-7Z"
          fill="url(#brand-cart-basket)"
        />
        <circle cx="73" cy="92" r="10" fill="#334155" />
        <circle cx="112" cy="92" r="10" fill="#334155" />
        <circle cx="73" cy="92" r="4" fill="#F8FAFC" />
        <circle cx="112" cy="92" r="4" fill="#F8FAFC" />
        <circle cx="71" cy="35" r="16" fill="url(#brand-fruit-red)" />
        <circle cx="95" cy="42" r="18" fill="url(#brand-fruit-orange)" />
        <circle cx="121" cy="36" r="16" fill="url(#brand-fruit-green)" />
        <path d="M90 15c4-6 9-8 14-8 8 0 15 6 17 14H94c-3 0-4-3-4-6Z" fill="#A3E635" />
        <circle cx="78" cy="25" r="4" fill="#FFF8EE" opacity="0.82" />
        <circle cx="101" cy="31" r="4" fill="#FFF8EE" opacity="0.8" />
        <circle cx="125" cy="28" r="4" fill="#FFF8EE" opacity="0.8" />
      </g>
    </svg>
  );
}

export default function BrandLogo({
  compact = false,
  iconOnly = false,
  subtitle,
  className = '',
}: BrandLogoProps) {
  return (
    <div
      className={[
        'brand-logo',
        compact ? 'is-compact' : '',
        iconOnly ? 'is-icon-only' : '',
        className,
      ].join(' ').trim()}
    >
      {iconOnly ? (
        <div className="brand-logo-mark">
          <CartIcon />
        </div>
      ) : null}
      {!iconOnly && (
        <div className="brand-logo-copy">
          <img
            src="/mercacompra-logo.png"
            alt="MercaCompra"
            className="brand-logo-image"
          />
          {subtitle ? <p className="brand-logo-subtitle">{subtitle}</p> : null}
        </div>
      )}
    </div>
  );
}
