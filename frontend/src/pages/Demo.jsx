import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LogoWithText } from '../components/Logo.jsx';
import { ScoreRing } from '../components/ScoreRing.jsx';
import { FindingCard } from '../components/FindingCard.jsx';
import { SeverityBadge } from '../components/SeverityBadge.jsx';
import { useTheme } from '../hooks/useTheme.jsx';

const DEMO_FINDINGS = [
  {
    id: '1', severity: 'critical', title: 'CRÍTICO: pull_request_target com checkout do código do PR',
    description: 'O workflow ci.yml usa pull_request_target e faz checkout do código do PR — vetor de ataque "pwn request".',
    reason: 'pull_request_target roda com permissões elevadas. Fazer checkout do código de fork expõe todos os secrets do workflow.',
    suggestion: 'Nunca faça checkout do código do PR em workflows pull_request_target. Use pull_request para build/teste.',
    file: 'ci.yml',
    reference: 'https://securitylab.github.com/research/github-actions-preventing-pwn-requests/',
    dismissals: [],
  },
  {
    id: '2', severity: 'critical', title: 'Secret value pode estar sendo impresso nos logs',
    description: 'O step "debug" no job "build" usa echo com um secret, expondo-o nos logs do workflow.',
    reason: 'Imprimir secrets nos logs é um problema grave. Mesmo mascarados, podem ser reconstruídos.',
    suggestion: 'Nunca use echo com secrets. Passe-os como variáveis de ambiente para os comandos.',
    file: 'deploy.yml',
    reference: 'https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions',
    dismissals: [],
  },
  {
    id: '3', severity: 'high', title: 'Action "octokit/request-action@main" usa referência mutável',
    description: 'A action está apontando para @main, que pode mudar a qualquer momento sem aviso.',
    reason: 'Referências mutáveis permitem que o mantenedor altere silenciosamente o código no seu workflow.',
    suggestion: 'Fixe em um commit SHA completo: octokit/request-action@<sha-completo>',
    file: 'ci.yml',
    reference: 'https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions',
    dismissals: [],
  },
  {
    id: '4', severity: 'high', title: 'Container Docker roda como root (sem instrução USER)',
    description: 'O Dockerfile não define USER, fazendo o container rodar como root por padrão.',
    reason: 'Containers como root têm acesso elevado ao host em caso de escape do container.',
    suggestion: 'Adicione ao Dockerfile:\nRUN adduser -S appuser\nUSER appuser',
    file: 'Dockerfile',
    reference: 'https://docs.docker.com/develop/develop-images/dockerfile_best-practices/#user',
    dismissals: [],
  },
  {
    id: '5', severity: 'medium', title: 'Nenhuma permissão declarada no workflow',
    description: 'O workflow release.yml não declara permissões explícitas, usando os permissivos padrões do GitHub.',
    reason: 'Sem declaração, o GITHUB_TOKEN herda permissões de escrita em vários escopos sensíveis.',
    suggestion: 'Adicione permissions: read-all no topo do workflow e libere apenas o necessário.',
    file: 'release.yml',
    reference: 'https://docs.github.com/en/actions/security-guides/automatic-token-authentication',
    dismissals: [],
  },
  {
    id: '6', severity: 'low', title: 'Sem instrução HEALTHCHECK no Dockerfile',
    description: 'O Dockerfile não define um HEALTHCHECK para verificar se o container está saudável.',
    reason: 'Sem HEALTHCHECK, orquestradores não conseguem detectar containers em estado degradado.',
    suggestion: 'Adicione: HEALTHCHECK --interval=30s CMD curl -f http://localhost/health || exit 1',
    file: 'Dockerfile',
    reference: 'https://docs.docker.com/engine/reference/builder/#healthcheck',
    dismissals: [],
  },
];

const DEMO_ANALISES = [
  { score: 45, createdAt: new Date(Date.now() - 14 * 86400000) },
  { score: 52, createdAt: new Date(Date.now() - 10 * 86400000) },
  { score: 48, createdAt: new Date(Date.now() - 7 * 86400000) },
  { score: 61, createdAt: new Date(Date.now() - 4 * 86400000) },
  { score: 34, createdAt: new Date(Date.now() - 1 * 86400000) },
];

export function Demo() {
  const { theme, toggle } = useTheme();
  const [filtro, setFiltro] = useState('all');

  const filtrados = filtro === 'all'
    ? DEMO_FINDINGS
    : DEMO_FINDINGS.filter(f => f.severity === filtro);

  const score = 34;
  const counts = {
    criticalCount: 2, highCount: 2, mediumCount: 1, lowCount: 1,
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      {/* Top bar */}
      <header style={{
        background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)',
        padding: '0 40px', height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <Link to="/">
          <LogoWithText iconSize={24} />
        </Link>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{
            fontSize: 11, fontWeight: 700, color: 'var(--warning)',
            background: 'var(--warning-bg)', border: '1px solid var(--warning-border)',
            borderRadius: 99, padding: '2px 10px', textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            🎬 Modo demonstração
          </span>
          <button onClick={toggle} className="btn btn-ghost btn-sm" style={{ fontSize: 12 }}>
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <Link to="/register" className="btn btn-primary btn-sm">
            Criar conta grátis →
          </Link>
        </div>
      </header>

      <main style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>
        {/* Banner */}
        <div className="alert alert-info mb-24" style={{ fontSize: 13.5 }}>
          <span>ℹ️</span>
          <span>
            Este é um relatório de demonstração com dados fictícios.{' '}
            <Link to="/register" style={{ color: 'var(--indigo)', fontWeight: 600 }}>
              Crie uma conta grátis
            </Link>{' '}
            para analisar seus próprios repositórios.
          </span>
        </div>

        {/* Header do relatório */}
        <div className="card card-p mb-20">
          <div style={{ display: 'flex', gap: 28, alignItems: 'center', flexWrap: 'wrap' }}>
            <ScoreRing score={score} size={130} strokeWidth={11} />
            <div style={{ flex: 1 }}>
              <div className="font-mono text-xs text-muted mb-6">acme-corp/backend-api</div>
              <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 4 }}>
                Relatório de Segurança
              </h1>
              <div className="text-sm text-muted mb-20">
                Hoje · {DEMO_FINDINGS.length} problemas encontrados
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {[
                  { key: 'criticalCount', label: 'Crítica', cor: 'var(--danger)', bg: 'var(--danger-bg)', border: 'var(--danger-border)' },
                  { key: 'highCount',     label: 'Alta',    cor: 'var(--orange)', bg: 'var(--orange-bg)', border: 'var(--orange-border)' },
                  { key: 'mediumCount',   label: 'Média',   cor: 'var(--warning)',bg: 'var(--warning-bg)',border: 'var(--warning-border)' },
                  { key: 'lowCount',      label: 'Baixa',   cor: 'var(--success)',bg: 'var(--success-bg)',border: 'var(--success-border)' },
                ].map(({ key, label, cor, bg, border }) => (
                  <div key={key} style={{ display:'flex',alignItems:'center',gap:8,padding:'7px 14px',borderRadius:'var(--r-sm)',background:bg,border:`1px solid ${border}` }}>
                    <span style={{ fontSize: 22, fontWeight: 800, color: cor, lineHeight: 1 }}>{counts[key]}</span>
                    <span className="text-xs text-muted">{label}</span>
                  </div>
                ))}
              </div>
            </div>
            <Link to="/register" className="btn btn-primary">
              Analisar meu repo →
            </Link>
          </div>
        </div>

        {/* Filtros */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span className="section-title">Problemas encontrados ({filtrados.length})</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {['all','critical','high','medium','low'].map(sev => {
              const labels = { all:'Todos', critical:'Crítica', high:'Alta', medium:'Média', low:'Baixa' };
              return (
                <button key={sev} onClick={() => setFiltro(sev)}
                  className={`btn btn-sm ${filtro === sev ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ fontSize: 12 }}>
                  {labels[sev]}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 32 }}>
          {filtrados.map(f => <FindingCard key={f.id} finding={f} />)}
        </div>

        {/* CTA */}
        <div className="card card-p" style={{
          textAlign: 'center',
          background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(56,189,248,0.06))',
          borderColor: 'var(--indigo-border)',
        }}>
          <div style={{ fontSize: 24, marginBottom: 12 }}>🛡️</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8 }}>
            Quer testar com seus próprios repositórios?
          </h2>
          <p className="text-secondary text-sm" style={{ marginBottom: 20, maxWidth: 400, margin: '0 auto 20px' }}>
            Crie uma conta e conecte seu repositório GitHub para ver o relatório real.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <Link to="/register" className="btn btn-primary">Criar conta grátis →</Link>
            <Link to="/login" className="btn btn-secondary">Já tenho conta</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
