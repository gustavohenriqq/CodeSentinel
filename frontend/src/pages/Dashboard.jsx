import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../hooks/useAuth.jsx';
import { useToast } from '../hooks/useToast.jsx';
import { Layout } from '../components/Layout.jsx';
import { ScoreRing } from '../components/ScoreRing.jsx';
import { EmptyState } from '../components/EmptyState.jsx';

export function Dashboard() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => { fetchRepos(); }, []);

  async function fetchRepos() {
    try {
      const { data } = await api.getRepos();
      setRepos(data);
    } catch {
      toast.error('Falha ao carregar repositórios.');
    } finally {
      setLoading(false);
    }
  }

  const reposComAnalise = repos.filter(r => r.analyses?.length > 0);
  const totalScans = repos.reduce((s, r) => s + (r.analyses?.length || 0), 0);
  const mediaScore = reposComAnalise.length > 0
    ? Math.round(reposComAnalise.reduce((s, r) => s + r.analyses[0].score, 0) / reposComAnalise.length)
    : null;
  const totalCritical = repos.reduce((s, r) => s + (r.analyses?.[0]?.criticalCount || 0), 0);

  function scoreColor(s) {
    if (!s) return '';
    if (s >= 80) return 'score-great';
    if (s >= 60) return 'score-good';
    if (s >= 40) return 'score-ok';
    if (s >= 20) return 'score-bad';
    return 'score-crit';
  }

  return (
    <Layout>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">
              Olá, {user?.name?.split(' ')[0]} 👋
            </h1>
            <p className="page-subtitle">Visão geral de segurança dos seus repositórios monitorados.</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Adicionar repositório
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="stat-grid mb-28">
        <div className="stat-card">
          <div className="stat-label">Repositórios</div>
          <div className="stat-value">{repos.length}</div>
          <div className="stat-sub">monitorados</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Análises</div>
          <div className="stat-value">{totalScans}</div>
          <div className="stat-sub">scans realizados</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Score médio</div>
          <div className={`stat-value ${scoreColor(mediaScore)}`}>
            {mediaScore !== null ? mediaScore : '—'}
          </div>
          <div className="stat-sub">pontuação de segurança</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Críticos</div>
          <div className="stat-value" style={{ color: totalCritical > 0 ? 'var(--danger)' : 'var(--success)' }}>
            {totalCritical}
          </div>
          <div className="stat-sub">{totalCritical > 0 ? 'precisam de atenção' : 'nenhum problema'}</div>
        </div>
      </div>

      {/* Repos */}
      <div className="section-header mb-12">
        <span className="section-title">Repositórios</span>
        {repos.length > 0 && (
          <Link to="/repos" className="btn btn-ghost btn-sm" style={{ fontSize: 12 }}>
            Ver todos →
          </Link>
        )}
      </div>

      {loading ? (
        <div className="flex-col gap-10">
          {[1,2,3].map(i => (
            <div key={i} className="card card-p" style={{ height: 90 }}>
              <div className="skeleton" style={{ height: 14, width: '40%', marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 11, width: '25%' }} />
            </div>
          ))}
        </div>
      ) : repos.length === 0 ? (
        <div className="card">
          <EmptyState
            icon="🔍"
            title="Nenhum repositório ainda"
            description="Adicione seu primeiro repositório GitHub para começar a escanear os workflows de CI/CD em busca de vulnerabilidades."
            action={
              <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                Adicionar primeiro repositório
              </button>
            }
          />
        </div>
      ) : (
        <div className="flex-col gap-10">
          {repos.map(repo => {
            const ultima = repo.analyses?.[0];
            return (
              <Link key={repo.id} to={`/repos/${repo.id}`} className="repo-card">
                <div className="repo-header">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="flex items-center gap-8 mb-4">
                      <span style={{ fontSize: 13, opacity: 0.5 }}>⎇</span>
                      <span className="repo-name">{repo.name}</span>
                      {repo.private && <span className="private-badge">privado</span>}
                    </div>
                    <div className="repo-full">{repo.fullName}</div>
                  </div>

                  {ultima ? (
                    <div className="flex items-center gap-16" style={{ flexShrink: 0 }}>
                      <ScoreRing score={ultima.score} size={56} strokeWidth={5} />
                      <div style={{ textAlign: 'right' }}>
                        <div className="text-xs text-muted mb-6">{tempoAtras(ultima.createdAt)}</div>
                        <div className="flex gap-6 justify-end">
                          {ultima.criticalCount > 0 && <span className="badge badge-critical">{ultima.criticalCount} crítica{ultima.criticalCount > 1 ? 's':''}</span>}
                          {ultima.highCount > 0 && <span className="badge badge-high">{ultima.highCount} alta{ultima.highCount > 1 ? 's':''}</span>}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div className="text-xs text-muted mb-8">Nunca escaneado</div>
                      <span className="chip" style={{ color: 'var(--indigo)', borderColor: 'rgba(99,102,241,0.3)', background: 'var(--indigo-subtle)' }}>
                        Iniciar scan →
                      </span>
                    </div>
                  )}
                </div>

                <div className="repo-meta">
                  <span className="repo-meta-item">📅 Adicionado {tempoAtras(repo.createdAt)}</span>
                  {ultima && <span className="repo-meta-item">🔎 {ultima.totalFindings} problema{ultima.totalFindings !== 1 ? 's' : ''}</span>}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {showModal && (
        <ModalAdicionarRepo
          onClose={() => setShowModal(false)}
          onAdded={repo => {
            setRepos(p => [{ ...repo, analyses: [] }, ...p]);
            setShowModal(false);
            toast.success(`Repositório ${repo.name} adicionado!`);
            navigate(`/repos/${repo.id}`);
          }}
        />
      )}
    </Layout>
  );
}

function ModalAdicionarRepo({ onClose, onAdded }) {
  const [form, setForm] = useState({ owner: '', repo: '', githubToken: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleOwner(e) {
    const v = e.target.value;
    const m = v.match(/github\.com\/([^/]+)\/([^/\s]+)/);
    if (m) setForm(p => ({ ...p, owner: m[1], repo: m[2].replace(/\.git$/, '') }));
    else setForm(p => ({ ...p, owner: v }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const { data } = await api.addRepo(form);
      onAdded(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Falha ao adicionar repositório.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">Adicionar Repositório</div>
          <p className="modal-desc">
            Conecte um repositório GitHub para escanear seus workflows de CI/CD.
            Cole a URL completa ou informe o dono e o nome separadamente.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert alert-error">{error}</div>}

            <div className="form-group">
              <label className="form-label">URL do GitHub ou dono do repositório</label>
              <input className="input" name="owner" autoFocus required
                placeholder="vercel  ou  https://github.com/vercel/next.js"
                value={form.owner} onChange={handleOwner} />
            </div>

            <div className="form-group">
              <label className="form-label">Nome do repositório</label>
              <input className="input" name="repo" required placeholder="next.js"
                value={form.repo} onChange={e => setForm(p => ({ ...p, repo: e.target.value }))} />
            </div>

            <div className="form-group">
              <label className="form-label">
                Token do GitHub
                <span className="text-muted font-mono text-xs" style={{ fontWeight: 400 }}>(opcional se já salvo)</span>
              </label>
              <input className="input" type="password" name="githubToken"
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                value={form.githubToken} onChange={e => setForm(p => ({ ...p, githubToken: e.target.value }))} />
              <span className="form-hint">
                Precisa do escopo <code>repo</code>.{' '}
                <a href="https://github.com/settings/tokens/new" target="_blank" rel="noopener noreferrer"
                  style={{ color: 'var(--indigo)' }}>Gerar token ↗</a>
              </span>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="spinner" /> : null}
              {loading ? 'Adicionando...' : 'Adicionar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function tempoAtras(data) {
  const s = Math.floor((Date.now() - new Date(data)) / 1000);
  if (s < 60) return 'agora mesmo';
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `há ${d}d`;
  return new Date(data).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}
