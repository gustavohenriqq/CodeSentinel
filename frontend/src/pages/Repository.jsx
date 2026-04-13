import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useToast } from '../hooks/useToast.jsx';
import { Layout } from '../components/Layout.jsx';
import { ScoreRing } from '../components/ScoreRing.jsx';
import { ScoreChart } from '../components/ScoreChart.jsx';
import { EmptyState } from '../components/EmptyState.jsx';

export function Repository() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [repo, setRepo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analisando, setAnalisando] = useState(false);
  const [deletando, setDeletando] = useState(false);
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [showBadge, setShowBadge] = useState(false);

  useEffect(() => { fetchRepo(); }, [id]);

  async function fetchRepo() {
    try {
      const { data } = await api.getRepo(id);
      setRepo(data);
    } catch {
      toast.error('Repositório não encontrado.');
      navigate('/');
    } finally {
      setLoading(false);
    }
  }

  async function rodarAnalise() {
    setAnalisando(true);
    try {
      const { data } = await api.runAnalysis(id);
      toast.success('Análise concluída!');
      navigate(`/analyses/${data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Falha na análise.');
      setAnalisando(false);
    }
  }

  async function toggleWebhook() {
    setWebhookLoading(true);
    try {
      if (repo.webhookId) {
        await api.desativarWebhook(id);
        setRepo(p => ({ ...p, webhookId: null }));
        toast.success('Webhook desativado.');
      } else {
        const { data } = await api.ativarWebhook(id);
        setRepo(p => ({ ...p, webhookId: String(data.webhookId) }));
        toast.success('Webhook ativado! Scans automáticos em cada push.');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Falha no webhook.');
    } finally {
      setWebhookLoading(false);
    }
  }

  async function removerRepo() {
    try {
      await api.deleteRepo(id);
      toast.success('Repositório removido.');
      navigate('/');
    } catch {
      toast.error('Falha ao remover.');
    }
  }

  if (loading) return (
    <Layout>
      <div className="page-loader">
        <div className="spinner spinner-lg" style={{ borderTopColor: 'var(--indigo)' }} />
      </div>
    </Layout>
  );

  const ultimaAnalise = repo.analyses?.[0];
  // Em dev usa o proxy do Vite, em produção usa a URL real do backend
  const backendBase = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:3001`;
  const badgeUrl = import.meta.env.VITE_API_URL ? `${backendBase}/api/badge/${id}` : `/api/badge/${id}`;
  const badgeUrlAbsoluto = `${backendBase}/api/badge/${id}`;
  const badgeMd = `[![CodeSentinel](${badgeUrlAbsoluto})](${window.location.origin}/repos/${id})`;

  return (
    <Layout>
      <div className="breadcrumb">
        <Link to="/">Visão Geral</Link>
        <span className="breadcrumb-sep">›</span>
        <span style={{ color: 'var(--text-secondary)' }}>{repo.name}</span>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 16, opacity: 0.4 }}>⎇</span>
            <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em' }}>{repo.name}</h1>
            {repo.private && <span className="private-tag">privado</span>}
            {repo.webhookId && (
              <span style={{ fontSize: 10, fontWeight: 700, background: 'var(--success-bg)', border: '1px solid var(--success-border)', color: 'var(--success)', borderRadius: 99, padding: '1px 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                ⚡ auto-scan
              </span>
            )}
          </div>
          <div className="font-mono text-xs text-muted">{repo.fullName}</div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a href={repo.url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
            GitHub ↗
          </a>
          <button onClick={() => setShowBadge(!showBadge)} className="btn btn-secondary btn-sm">
            🏷️ Badge
          </button>
          <button onClick={rodarAnalise} className="btn btn-primary" disabled={analisando}>
            {analisando ? <><span className="spinner" /> Escaneando...</> : '🔍 Escanear agora'}
          </button>
        </div>
      </div>

      {/* Badge modal */}
      {showBadge && (
        <div className="card card-p mb-20">
          <div style={{ fontWeight: 600, marginBottom: 12 }}>🏷️ Badge de segurança para o README</div>
          <div style={{ background: 'var(--bg-base)', borderRadius: 8, padding: 12, marginBottom: 10 }}>
            <img src={badgeUrl} alt="CodeSentinel badge" style={{ height: 20 }} onError={(e) => { e.target.style.display="none"; }} />
          </div>
          <div className="font-mono text-xs" style={{ background: 'var(--bg-code)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', marginBottom: 10, wordBreak: 'break-all' }}>
            {badgeMd}
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => { navigator.clipboard.writeText(badgeMd); toast.success('Copiado!'); }}>
            Copiar markdown
          </button>
        </div>
      )}

      {/* Score + severidade */}
      {ultimaAnalise && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
          <div className="card card-p" style={{ display: 'flex', alignItems: 'center', gap: 24, flex: '0 0 auto' }}>
            <ScoreRing score={ultimaAnalise.score} size={130} strokeWidth={11} />
            <div>
              <div className="text-xs text-muted mb-4" style={{ textTransform: 'uppercase', letterSpacing: '0.07em' }}>Último scan</div>
              <div className="text-sm text-secondary">{formatarData(ultimaAnalise.createdAt)}</div>
              {ultimaAnalise.triggeredBy && ultimaAnalise.triggeredBy !== 'manual' && (
                <div className="text-xs" style={{ color: 'var(--success)', marginTop: 4 }}>⚡ {ultimaAnalise.triggeredBy}</div>
              )}
            </div>
          </div>
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, minWidth: 240 }}>
            {[
              { label: 'Crítica', count: ultimaAnalise.criticalCount, color: 'var(--danger)',  bg: 'var(--danger-bg)',  border: 'var(--danger-border)' },
              { label: 'Alta',    count: ultimaAnalise.highCount,     color: 'var(--orange)',  bg: 'var(--orange-bg)',  border: 'var(--orange-border)' },
              { label: 'Média',   count: ultimaAnalise.mediumCount,   color: 'var(--warning)', bg: 'var(--warning-bg)', border: 'var(--warning-border)' },
              { label: 'Baixa',   count: ultimaAnalise.lowCount,      color: 'var(--success)', bg: 'var(--success-bg)', border: 'var(--success-border)' },
            ].map(({ label, count, color, bg, border }) => (
              <div key={label} className="card card-p" style={{ background: count > 0 ? bg : undefined, borderColor: count > 0 ? border : undefined }}>
                <div className="text-xs text-muted mb-8" style={{ textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</div>
                <div style={{ fontSize: 32, fontWeight: 700, color: count > 0 ? color : 'var(--text-muted)', lineHeight: 1 }}>{count}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sem análise */}
      {!ultimaAnalise && (
        <div className="card mb-28">
          <EmptyState icon="🛡️" title="Nenhuma análise ainda"
            description="Rode o primeiro scan para analisar os workflows e arquivos deste repositório."
            action={<button className="btn btn-primary" onClick={rodarAnalise} disabled={analisando}>🔍 Rodar primeiro scan</button>}
          />
        </div>
      )}

      {/* Gráfico de evolução */}
      {repo.analyses?.length >= 2 && (
        <div className="mb-28">
          <ScoreChart analyses={repo.analyses} />
        </div>
      )}

      {/* Webhook toggle */}
      <div className="card card-p mb-20">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 3 }}>
              ⚡ Scan automático via webhook
              {repo.webhookId && <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--success)', background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 99, padding: '1px 7px', fontWeight: 700 }}>ATIVO</span>}
            </div>
            <div className="text-sm text-muted">
              {repo.webhookId
                ? 'O repositório será escaneado automaticamente a cada push na branch principal.'
                : 'Ative para escanear automaticamente a cada push. Requer APP_URL configurado no servidor.'}
            </div>
          </div>
          <button
            className={`btn btn-sm ${repo.webhookId ? 'btn-danger' : 'btn-secondary'}`}
            onClick={toggleWebhook}
            disabled={webhookLoading}
          >
            {webhookLoading ? <span className="spinner" /> : null}
            {repo.webhookId ? 'Desativar' : 'Ativar webhook'}
          </button>
        </div>
      </div>

      {/* Histórico */}
      {repo.analyses?.length > 0 && (
        <>
          <div className="section-header mb-12">
            <span className="section-title">Histórico de Análises</span>
          </div>
          <div className="card mb-28">
            <table className="table">
              <thead>
                <tr>
                  <th>Data</th><th>Score</th><th>Problemas</th>
                  <th>Crítica</th><th>Alta</th><th>Origem</th><th></th>
                </tr>
              </thead>
              <tbody>
                {repo.analyses.map((a, i) => (
                  <tr key={a.id}>
                    <td>
                      <div style={{ fontSize: 13 }}>{formatarData(a.createdAt)}</div>
                      {i === 0 && <span className="chip" style={{ fontSize: 10, marginTop: 3, color: 'var(--indigo)', borderColor: 'rgba(99,102,241,0.3)', background: 'var(--indigo-subtle)' }}>mais recente</span>}
                    </td>
                    <td>
                      <span style={{ fontWeight: 700, fontSize: 18, color: scoreColor(a.score) }}>{a.score}</span>
                      <span className="text-muted text-xs">/100</span>
                    </td>
                    <td><span style={{ fontWeight: 600 }}>{a.totalFindings}</span></td>
                    <td>{a.criticalCount > 0 ? <span className="badge badge-critical">{a.criticalCount}</span> : <span className="text-muted">—</span>}</td>
                    <td>{a.highCount > 0 ? <span className="badge badge-high">{a.highCount}</span> : <span className="text-muted">—</span>}</td>
                    <td><span className="chip" style={{ fontSize: 10 }}>{a.triggeredBy === 'manual' ? '🖱️ manual' : `⚡ ${a.triggeredBy}`}</span></td>
                    <td><Link to={`/analyses/${a.id}`} className="btn btn-ghost btn-sm" style={{ fontSize: 12 }}>Ver →</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Zona de perigo */}
      <div className="card card-p" style={{ borderColor: 'var(--danger-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 3 }}>Remover repositório</div>
            <div className="text-sm text-muted">Todo o histórico será apagado permanentemente.</div>
          </div>
          {deletando ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setDeletando(false)}>Cancelar</button>
              <button className="btn btn-danger btn-sm" onClick={removerRepo}>Confirmar</button>
            </div>
          ) : (
            <button className="btn btn-danger btn-sm" onClick={() => setDeletando(true)}>Remover</button>
          )}
        </div>
      </div>
    </Layout>
  );
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