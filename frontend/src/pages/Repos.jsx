import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useToast } from '../hooks/useToast.jsx';
import { Layout } from '../components/Layout.jsx';
import { ScoreRing } from '../components/ScoreRing.jsx';
import { EmptyState } from '../components/EmptyState.jsx';

export function Repos() {
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();

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

  return (
    <Layout>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Repositórios</h1>
            <p className="page-subtitle">Todos os repositórios GitHub que você está monitorando.</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Adicionar
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex-col gap-10">
          {[1,2,3].map(i => (
            <div key={i} className="card card-p" style={{ height: 90 }}>
              <div className="skeleton" style={{ height: 14, width: '40%', marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 11, width: '20%' }} />
            </div>
          ))}
        </div>
      ) : repos.length === 0 ? (
        <div className="card">
          <EmptyState icon="📁" title="Nenhum repositório"
            description="Adicione um repositório GitHub para começar a escanear seus workflows de CI/CD."
            action={<button className="btn btn-primary" onClick={() => setShowModal(true)}>Adicionar repositório</button>}
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
                      <span style={{ fontSize: 13, opacity: 0.4 }}>⎇</span>
                      <span className="repo-name">{repo.name}</span>
                      {repo.private && <span className="private-badge">privado</span>}
                    </div>
                    <div className="repo-full">{repo.fullName}</div>
                  </div>
                  {ultima
                    ? <ScoreRing score={ultima.score} size={52} strokeWidth={5} />
                    : <span className="text-xs text-muted">Nunca escaneado</span>
                  }
                </div>
                <div className="repo-meta">
                  <span className="repo-meta-item">📅 {tempoAtras(repo.createdAt)}</span>
                  <span className="repo-meta-item">🔎 {repo.analyses?.length || 0} scan{repo.analyses?.length !== 1 ? 's' : ''}</span>
                  {ultima?.criticalCount > 0 && <span className="badge badge-critical">{ultima.criticalCount} crítica{ultima.criticalCount > 1 ? 's' : ''}</span>}
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
            setShowModal(false);
            toast.success(`${repo.name} adicionado com sucesso!`);
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
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">Adicionar Repositório</div>
          <p className="modal-desc">Cole a URL do GitHub ou informe o dono e nome do repositório.</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert alert-error">{error}</div>}
            <div className="form-group">
              <label className="form-label">URL ou dono</label>
              <input className="input" autoFocus required placeholder="vercel ou https://github.com/vercel/next.js"
                value={form.owner} onChange={handleOwner} />
            </div>
            <div className="form-group">
              <label className="form-label">Nome do repositório</label>
              <input className="input" required placeholder="next.js"
                value={form.repo} onChange={e => setForm(p => ({ ...p, repo: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Token do GitHub <span className="text-muted" style={{ fontWeight: 400 }}>(opcional)</span></label>
              <input className="input" type="password" placeholder="ghp_..."
                value={form.githubToken} onChange={e => setForm(p => ({ ...p, githubToken: e.target.value }))} />
              <span className="form-hint">
                Precisa do escopo <code>repo</code>.{' '}
                <a href="https://github.com/settings/tokens/new" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--indigo)' }}>Gerar ↗</a>
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
  return `há ${Math.floor(h/24)}d`;
}
