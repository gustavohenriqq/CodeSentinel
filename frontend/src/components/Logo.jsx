// Logo isolada (só o ícone escudo)
export function LogoIcon({ size = 32, className = '' }) {
  return (
    <img
      src="/logo.svg"
      alt="CodeSentinel"
      width={size}
      height={size}
      className={className}
      style={{ display: 'block' }}
    />
  );
}

// Logo com texto inline (usada na sidebar e auth)
export function LogoWithText({ iconSize = 28 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <LogoIcon size={iconSize} />
      <span style={{
        fontFamily: 'Inter, sans-serif',
        fontWeight: 800,
        fontSize: iconSize * 0.6,
        letterSpacing: '-0.04em',
        lineHeight: 1,
      }}>
        <span style={{ color: 'var(--text-primary)' }}>Code</span>
        <span style={{
          background: 'linear-gradient(90deg, #A78BFA, #6366F1)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>Sentinel</span>
      </span>
    </div>
  );
}
