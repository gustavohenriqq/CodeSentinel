import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

function scoreColor(s) {
  if (s >= 80) return '#10B981';
  if (s >= 60) return '#84cc16';
  if (s >= 40) return '#F59E0B';
  if (s >= 20) return '#F97316';
  return '#EF4444';
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const score = payload[0].value;
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-strong)',
      borderRadius: 8, padding: '8px 12px',
      fontSize: 12,
    }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: 18, color: scoreColor(score) }}>{score}<span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)' }}>/100</span></div>
    </div>
  );
}

export function ScoreChart({ analyses }) {
  if (!analyses || analyses.length < 2) return null;

  const dados = [...analyses]
    .reverse()
    .map((a, i) => ({
      nome: `#${i + 1}`,
      score: a.score,
      data: new Date(a.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
      id: a.id,
    }));

  const scores = dados.map(d => d.score);
  const minScore = Math.max(0, Math.min(...scores) - 10);
  const maxScore = Math.min(100, Math.max(...scores) + 10);

  const ultimoScore = dados[dados.length - 1]?.score;
  const cor = scoreColor(ultimoScore);

  return (
    <div className="card card-p">
      <div className="card-header" style={{ padding: '0 0 16px', border: 'none' }}>
        <span className="card-title">Evolução do Score</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{dados.length} análises</span>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={dados} margin={{ top: 5, right: 8, left: -28, bottom: 0 }}>
          <XAxis
            dataKey="data"
            tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[minScore, maxScore]}
            tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={80} stroke="var(--success)" strokeDasharray="3 3" opacity={0.3} />
          <Line
            type="monotone"
            dataKey="score"
            stroke={cor}
            strokeWidth={2.5}
            dot={{ fill: cor, r: 4, strokeWidth: 0 }}
            activeDot={{ r: 6, fill: cor, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
