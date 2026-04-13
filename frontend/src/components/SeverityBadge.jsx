const CONFIG = {
  critical: { label: 'Crítica',  cls: 'badge-critical', dot: 'dot-critical' },
  high:     { label: 'Alta',     cls: 'badge-high',     dot: 'dot-high' },
  medium:   { label: 'Média',    cls: 'badge-medium',   dot: 'dot-medium' },
  low:      { label: 'Baixa',    cls: 'badge-low',      dot: 'dot-low' },
};

export function SeverityBadge({ severity }) {
  const c = CONFIG[severity] || CONFIG.low;
  return (
    <span className={`badge ${c.cls}`}>
      <span className={`dot ${c.dot}`} />
      {c.label}
    </span>
  );
}
