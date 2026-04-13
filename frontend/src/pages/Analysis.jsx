import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useToast } from '../hooks/useToast.jsx';
import { Layout } from '../components/Layout.jsx';
import { ScoreRing } from '../components/ScoreRing.jsx';
import { FindingCard } from '../components/FindingCard.jsx';
import { EmptyState } from '../components/EmptyState.jsx';

const ORDEM_SEV = ['critical', 'high', 'medium', 'low'];

// Agrupa findings por tipo de arquivo
function agruparPorArquivo(findings) {
  const grupos = {};
  for (const f of findings) {
    const tipo = detectarTipo(f.file);
    if (!grupos[tipo]) grupos[tipo] = { label: tipo, icon: iconeTipo(tipo), items: [] };
    grupos[tipo].items.push(f);
  }
  return Object.values(grupos);
}

function detectarTipo(filename) {
  const name = filename.toLowerCase();
  if (name.includes('workflow') || name.endsWith('.yml') || name.endsWith('.yaml')) return 'GitHub Actions';
  if (name.includes('dockerfile')) return 'Dockerfile';
  if (name.includes('docker-compose')) return 'Docker Compose';
  if (name.includes('package.json')) return 'package.json';
  if (name.includes('.env')) return 'Arquivo .env';
  if (name.includes('requirements')) return 'requirements.txt';
  if (name.includes('.gitignore')) return '.gitignore';
  return 'Outros';
}

function iconeTipo(tipo) {
  const icons = {
    'GitHub Actions': '⚙️',
    'Dockerfile': '🐳',
    'Docker Compose': '🐳',
    'package.json': '📦',
    'Arquivo .env': '🔑',
    'requirements.txt': '🐍',
    '.gitignore': '📋',
    'Outros': '📄',
  };
  return icons[tipo] || '📄';
}

export function Analysis() {
  const { id } = useParams();
  const toast = useToast();
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [criandoIssue, setCriandoIssue] = useState(false);
  const [issueUrl, setIssueUrl] = useState(null);
  const [filtro, setFiltro] = useState('all');
  const [agrupado, setAgrupado] = useState(false);

  useEffect(() => { fetchAnalysis(); }, [id]);

  async function fetchAnalysis() {
    try {
      const { data } = await api.getAnalysis(id);
      setAnalysis(data);
      if (data.issueLogs?.length > 0) setIssueUrl(data.issueLogs[0].issueUrl);
    } catch {
      toast.error('Análise não encontrada.');
    } finally {
      setLoading(false);
    }
  }

  async function criarIssue() {
    setCriandoIssue(true);
    try {
      const { data } = await api.createIssue(id);
      setIssueUrl(data.issueUrl);
      toast.success('Issue criada no GitHub!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Falha ao criar issue.');
    } finally {
      setCriandoIssue(false);
    }
  }

  if (loading) return (
    <Layout>
      <div className="page-loader">
        <div className="spinner spinner-lg" style={{ borderTopColor: 'var(--indigo)' }} />
        <span className="page-loader-text">Carregando relatório...</span>
      </div>
    </Layout>
  );

  if (!analysis) return null;

  const findingsFiltrados = filtro === 'all'
    ? [...analysis.findings].sort((a, b) => ORDEM_SEV.indexOf(a.severity) - ORDEM_SEV.indexOf(b.severity))
    : analysis.findings.filter(f => f.severity === filtro);

  const grupos = agruparPorArquivo(findingsFiltrados);

  const descricaoScore =
    analysis.score >= 80 ? 'Seguro' :
    analysis.score >= 60 ? 'Aceitável' :
    analysis.score >= 40 ? 'Precisa de atenção' :
    analysis.score >= 20 ? 'Em risco' : 'Risco crítico';

  return (
    <Layout>
      <div className="breadcrumb">
        <Link to="/">Visão Geral</Link>
        <span className="breadcrumb-sep">›</span>
        <Link to={`/repos/${analysis.repository.id}`}>{analysis.repository.name}</Link>
        <span className="breadcrumb-sep">›</span>
        <span style={{ color: 'var(--text-secondary)' }}>Relatório</span>
      </div>

      {/* Header */}
      <div className="card card-p mb-20">
        <div style={{ display: 'flex', gap: 28, alignItems: 'center', flexWrap: 'wrap' }}>
          <ScoreRing score={analysis.score} size={130} strokeWidth={11} />

          <div style={{ flex: 1 }}>
            <div className="font-mono text-xs text-muted mb-6">{analysis.repository.fullName}</div>
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 4 }}>
              Relatório de Segurança
            </h1>
            <div className="text-sm text-muted mb-20">
              {formatarData(analysis.createdAt)} · {analysis.totalFindings} problema{analysis.totalFindings !== 1 ? 's' : ''} encontrado{analysis.totalFindings !== 1 ? 's' : ''}
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {[
                { key: 'criticalCount', label: 'Crítica',  cor: 'var(--danger)',  bg: 'var(--danger-bg)',  border: 'var(--danger-border)' },
                { key: 'highCount',     label: 'Alta',     cor: 'var(--orange)',  bg: 'var(--orange-bg)',  border: 'var(--orange-border)' },
                { key: 'mediumCount',   label: 'Média',    cor: 'var(--warning)', bg: 'var(--warning-bg)', border: 'var(--warning-border)' },
                { key: 'lowCount',      label: 'Baixa',    cor: 'var(--success)', bg: 'var(--success-bg)', border: 'var(--success-border)' },
              ].filter(s => analysis[s.key] > 0).map(({ key, label, cor, bg, border }) => (
                <div key={key} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 14px', borderRadius: 'var(--r-sm)',
                  background: bg, border: `1px solid ${border}`,
                }}>
                  <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.04em', color: cor, lineHeight: 1 }}>
                    {analysis[key]}
                  </span>
                  <span className="text-xs text-muted">{label}</span>
                </div>
              ))}
              {analysis.totalFindings === 0 && (
                <span className="badge badge-low" style={{ padding: '6px 14px', fontSize: 13 }}>
                  ✓ Nenhum problema encontrado
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignSelf: 'flex-start' }}>
            {issueUrl ? (
              <a href={issueUrl} target="_blank" rel="noopener noreferrer" className="btn btn-success btn-sm">
                ✓ Issue criada ↗
              </a>
            ) : (
              <button
                className="btn btn-secondary btn-sm"
                onClick={criarIssue}
                disabled={criandoIssue || analysis.totalFindings === 0}
              >
                {criandoIssue ? <span className="spinner" /> : '⚑'}
                {criandoIssue ? 'Criando...' : 'Abrir issue no GitHub'}
              </button>
            )}
            <Link
              to={`/repos/${analysis.repository.id}`}
              className="btn btn-ghost btn-sm"
              style={{ justifyContent: 'center' }}
            >
              ← Voltar ao repositório
            </Link>
          </div>
        </div>
      </div>

      {/* Findings */}
      {analysis.findings.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="✅"
            title="Nenhum problema encontrado"
            description="Ótimo! Não foram detectadas vulnerabilidades nos arquivos analisados deste repositório."
          />
        </div>
      ) : (
        <>
          {/* Barra de filtros */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
            <span className="section-title">
              Problemas encontrados ({findingsFiltrados.length})
            </span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {/* Filtro por severidade */}
              {['all', 'critical', 'high', 'medium', 'low'].map(sev => {
                const labels = { all: 'Todos', critical: 'Crítica', high: 'Alta', medium: 'Média', low: 'Baixa' };
                const countKey = { critical: 'criticalCount', high: 'highCount', medium: 'mediumCount', low: 'lowCount' }[sev];
                const count = countKey ? analysis[countKey] : null;
                if (sev !== 'all' && count === 0) return null;
                return (
                  <button
                    key={sev}
                    onClick={() => setFiltro(sev)}
                    className={`btn btn-sm ${filtro === sev ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ fontSize: 12 }}
                  >
                    {labels[sev]}
                    {count > 0 && (
                      <span style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 99, padding: '0 5px', fontSize: 10 }}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
              <div style={{ width: 1, background: 'var(--border)', margin: '0 2px' }} />
              {/* Toggle agrupado */}
              <button
                onClick={() => setAgrupado(!agrupado)}
                className={`btn btn-sm ${agrupado ? 'btn-primary' : 'btn-ghost'}`}
                style={{ fontSize: 12 }}
                title="Agrupar por tipo de arquivo"
              >
                {agrupado ? '⊞ Agrupado' : '⊟ Lista'}
              </button>
            </div>
          </div>

          {agrupado ? (
            // Modo agrupado por tipo de arquivo
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {grupos.map(grupo => (
                <div key={grupo.label}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    marginBottom: 10, paddingBottom: 8,
                    borderBottom: '1px solid var(--border)',
                  }}>
                    <span style={{ fontSize: 16 }}>{grupo.icon}</span>
                    <span style={{ fontWeight: 600, fontSize: 13.5 }}>{grupo.label}</span>
                    <span className="chip" style={{ fontSize: 11 }}>{grupo.items.length} problema{grupo.items.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {grupo.items.map(f => <FindingCard key={f.id} finding={f} />)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Modo lista
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {findingsFiltrados.map(f => <FindingCard key={f.id} finding={f} />)}
            </div>
          )}
        </>
      )}

      {/* Score explicado */}
      <div className="card card-p mt-24">
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>📊 Como o score é calculado</div>
        <div className="text-sm text-secondary" style={{ lineHeight: 1.8 }}>
          O score começa em <strong style={{ color: 'var(--text-primary)' }}>100</strong> e é reduzido por cada problema:
          <strong style={{ color: 'var(--danger)' }}> crítico</strong> −30,
          <strong style={{ color: 'var(--orange)' }}> alto</strong> −15,
          <strong style={{ color: 'var(--warning)' }}> médio</strong> −7,
          <strong style={{ color: 'var(--success)' }}> baixo</strong> −3.
          Mínimo 0.
          <br />
          Este repositório obteve <strong style={{ color: scoreColor(analysis.score) }}>{analysis.score}/100</strong> — {descricaoScore}.
        </div>

        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Arquivos analisados
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {['GitHub Actions', 'Dockerfile', 'Docker Compose', 'package.json', '.env', 'requirements.txt', '.gitignore'].map(tipo => {
              const temProblemas = analysis.findings.some(f => detectarTipoSimples(f.file) === tipo);
              const arquivoExiste = analysis.findings.length > 0 ||
                analysis.findings.some(f => detectarTipoSimples(f.file) === tipo);
              return (
                <span key={tipo} className="chip" style={{
                  fontSize: 11,
                  color: temProblemas ? 'var(--warning)' : 'var(--text-muted)',
                  borderColor: temProblemas ? 'var(--warning-border)' : 'var(--border)',
                }}>
                  {iconeTipoSimples(tipo)} {tipo}
                  {temProblemas && ' ⚠'}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </Layout>
  );
}

function detectarTipoSimples(filename) {
  const name = filename.toLowerCase();
  if (name.endsWith('.yml') || name.endsWith('.yaml')) return 'GitHub Actions';
  if (name.includes('dockerfile')) return 'Dockerfile';
  if (name.includes('docker-compose')) return 'Docker Compose';
  if (name.includes('package.json')) return 'package.json';
  if (name.includes('.env')) return '.env';
  if (name.includes('requirements')) return 'requirements.txt';
  if (name.includes('.gitignore')) return '.gitignore';
  return 'Outros';
}

function iconeTipoSimples(tipo) {
  const icons = {
    'GitHub Actions': '⚙️', 'Dockerfile': '🐳', 'Docker Compose': '🐳',
    'package.json': '📦', '.env': '🔑', 'requirements.txt': '🐍', '.gitignore': '📋',
  };
  return icons[tipo] || '📄';
}

function scoreColor(s) {
  if (s >= 80) return 'var(--success)';
  if (s >= 60) return '#34D399';
  if (s >= 40) return 'var(--warning)';
  if (s >= 20) return 'var(--orange)';
  return 'var(--danger)';
}

function formatarData(data) {
  return new Date(data).toLocaleString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
