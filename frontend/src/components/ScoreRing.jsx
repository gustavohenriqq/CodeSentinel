export function ScoreRing({ score, size = 100, strokeWidth = 9 }) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const offset = ((100 - score) / 100) * circ;

  function color(s) {
    if (s >= 80) return '#10B981';
    if (s >= 60) return '#34D399';
    if (s >= 40) return '#F59E0B';
    if (s >= 20) return '#F97316';
    return '#EF4444';
  }

  function label(s) {
    if (s >= 80) return 'Seguro';
    if (s >= 60) return 'Bom';
    if (s >= 40) return 'Atenção';
    if (s >= 20) return 'Risco';
    return 'Crítico';
  }

  const c = color(score);

  return (
    <div className="score-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r}
          fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={strokeWidth} />
        <circle cx={size/2} cy={size/2} r={r}
          fill="none" stroke={c} strokeWidth={strokeWidth}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 8px ${c}60)`, transition: 'stroke-dashoffset 0.9s cubic-bezier(0.4,0,0.2,1)' }}
        />
      </svg>
      <div className="score-text">
        <div className="score-number" style={{ color: c, fontSize: size * 0.22 }}>{score}</div>
        <div className="score-label" style={{ fontSize: size * 0.1 }}>{label(score)}</div>
      </div>
    </div>
  );
}
