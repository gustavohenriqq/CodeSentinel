import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../hooks/useAuth.jsx';
import { useToast } from '../hooks/useToast.jsx';
import { Layout } from '../components/Layout.jsx';

export function Settings() {
  const { user, login, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [perfil, setPerfil] = useState({ name: '', email: '' });
  const [senhas, setSenhas] = useState({ senhaAtual: '', novaSenha: '', confirmar: '' });
  const [token, setToken] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);
  const [salvandoSenha, setSalvandoSenha] = useState(false);
  const [salvandoToken, setSalvandoToken] = useState(false);
  const [deletando, setDeletando] = useState(false);
  const [confirmarDelecao, setConfirmarDelecao] = useState(false);

  useEffect(() => {
    api.getPerfil()
      .then(({ data }) => {
        setPerfil({ name: data.name, email: data.email });
        setToken(data.temToken ? '(token salvo — substitua para atualizar)' : '');
      })
      .catch(() => toast.error('Falha ao carregar perfil.'))
      .finally(() => setCarregando(false));
  }, []);

  async function salvarPerfil(e) {
    e.preventDefault();
    setSalvandoPerfil(true);
    try {
      const { data } = await api.atualizarPerfil({ name: perfil.name });
      // Atualiza token JWT com novo nome
      const tokenAtual = localStorage.getItem('token');
      login(tokenAtual, { ...user, name: data.name });
      toast.success('Perfil atualizado!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Falha ao salvar.');
    } finally {
      setSalvandoPerfil(false);
    }
  }

  async function trocarSenha(e) {
    e.preventDefault();
    if (senhas.novaSenha !== senhas.confirmar) {
      toast.error('As senhas não coincidem.');
      return;
    }
    setSalvandoSenha(true);
    try {
      await api.trocarSenha({ senhaAtual: senhas.senhaAtual, novaSenha: senhas.novaSenha });
      toast.success('Senha alterada com sucesso!');
      setSenhas({ senhaAtual: '', novaSenha: '', confirmar: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Falha ao alterar senha.');
    } finally {
      setSalvandoSenha(false);
    }
  }

  async function salvarToken(e) {
    e.preventDefault();
    if (!token || token.startsWith('(')) return;
    setSalvandoToken(true);
    try {
      await api.atualizarToken({ githubToken: token });
      toast.success('Token GitHub atualizado!');
      setToken('(token salvo — substitua para atualizar)');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Falha ao salvar token.');
    } finally {
      setSalvandoToken(false);
    }
  }

  async function deletarConta() {
    setDeletando(true);
    try {
      await api.deletarConta();
      logout();
      navigate('/login');
      toast.success('Conta deletada.');
    } catch {
      toast.error('Falha ao deletar conta.');
      setDeletando(false);
    }
  }

  if (carregando) return (
    <Layout>
      <div className="page-loader">
        <div className="spinner spinner-lg" style={{ borderTopColor: 'var(--indigo)' }} />
      </div>
    </Layout>
  );

  return (
    <Layout>
      <div className="page-header">
        <h1 className="page-title">Configurações</h1>
        <p className="page-subtitle">Gerencie seu perfil, senha e integrações.</p>
      </div>

      <div style={{ maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Perfil */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">👤 Perfil</span>
          </div>
          <form onSubmit={salvarPerfil} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Nome</label>
              <input
                className="input"
                value={perfil.name}
                onChange={e => setPerfil(p => ({ ...p, name: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">E-mail <span className="text-muted text-xs">(não editável)</span></label>
              <input className="input" value={perfil.email} disabled style={{ opacity: 0.5 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-primary btn-sm" disabled={salvandoPerfil}>
                {salvandoPerfil && <span className="spinner" />}
                {salvandoPerfil ? 'Salvando...' : 'Salvar nome'}
              </button>
            </div>
          </form>
        </div>

        {/* Senha */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">🔒 Alterar Senha</span>
          </div>
          <form onSubmit={trocarSenha} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Senha atual</label>
              <input
                className="input" type="password" placeholder="••••••••"
                value={senhas.senhaAtual}
                onChange={e => setSenhas(p => ({ ...p, senhaAtual: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Nova senha</label>
              <input
                className="input" type="password" placeholder="Mínimo 6 caracteres"
                value={senhas.novaSenha} minLength={6}
                onChange={e => setSenhas(p => ({ ...p, novaSenha: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Confirmar nova senha</label>
              <input
                className="input" type="password" placeholder="Repita a nova senha"
                value={senhas.confirmar}
                onChange={e => setSenhas(p => ({ ...p, confirmar: e.target.value }))}
                required
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-primary btn-sm" disabled={salvandoSenha}>
                {salvandoSenha && <span className="spinner" />}
                {salvandoSenha ? 'Alterando...' : 'Alterar senha'}
              </button>
            </div>
          </form>
        </div>

        {/* Token GitHub */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">🔑 Token GitHub</span>
          </div>
          <form onSubmit={salvarToken} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Personal Access Token</label>
              <input
                className="input" type="password"
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                value={token}
                onFocus={() => { if (token.startsWith('(')) setToken(''); }}
                onChange={e => setToken(e.target.value)}
              />
              <span className="form-hint">
                Escopo necessário: <code>repo</code>.{' '}
                <a href="https://github.com/settings/tokens/new" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--indigo)' }}>
                  Gerar token ↗
                </a>
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-primary btn-sm"
                disabled={salvandoToken || !token || token.startsWith('(')}>
                {salvandoToken && <span className="spinner" />}
                {salvandoToken ? 'Salvando...' : 'Atualizar token'}
              </button>
            </div>
          </form>
        </div>

        {/* Zona de perigo */}
        <div className="card" style={{ borderColor: 'var(--danger-border)' }}>
          <div className="card-header" style={{ borderColor: 'var(--danger-border)' }}>
            <span className="card-title" style={{ color: 'var(--danger)' }}>⚠️ Zona de Perigo</span>
          </div>
          <div style={{ padding: '20px 24px' }}>
            <div className="flex-between">
              <div>
                <div style={{ fontWeight: 600, marginBottom: 3 }}>Deletar conta</div>
                <div className="text-sm text-muted">Apaga permanentemente sua conta e todos os dados.</div>
              </div>
              {confirmarDelecao ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setConfirmarDelecao(false)}>Cancelar</button>
                  <button className="btn btn-danger btn-sm" onClick={deletarConta} disabled={deletando}>
                    {deletando && <span className="spinner" />}
                    Confirmar
                  </button>
                </div>
              ) : (
                <button className="btn btn-danger btn-sm" onClick={() => setConfirmarDelecao(true)}>
                  Deletar conta
                </button>
              )}
            </div>
          </div>
        </div>

      </div>
    </Layout>
  );
}
