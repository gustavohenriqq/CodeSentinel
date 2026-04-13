import axios from 'axios';

// Em produção usa a URL do backend no Vercel, em dev usa o proxy do Vite
const baseURL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

const client = axios.create({
  baseURL,
  timeout: 30000,
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    const url = err.config?.url || '';

    // Só desloga se o 401 vier do próprio backend (token JWT expirado/inválido)
    // NÃO desloga em erros de rotas externas como GitHub API
    const rotasQuePodemDeslogar = [
      '/repos',
      '/analyses',
      '/profile',
    ];

    const ehRotaProtegida = rotasQuePodemDeslogar.some(r => url.includes(r));
    const mensagem = err.response?.data?.message || '';

    // Só desloga se:
    // 1. Status é 401 E
    // 2. É uma rota protegida E
    // 3. A mensagem é de token inválido/expirado (não de erro externo)
    const mensagensDeDeslogar = [
      'autenticação necessária',
      'token inválido ou expirado',
      'no token provided',
      'invalid token',
      'jwt',
    ];

    const ehErroDeAuth = mensagensDeDeslogar.some(m =>
      mensagem.toLowerCase().includes(m)
    );

    if (status === 401 && ehRotaProtegida && ehErroDeAuth) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }

    return Promise.reject(err);
  }
);

export const api = {
  // Auth
  register: (d) => client.post('/auth/register', d),
  login:    (d) => client.post('/auth/login', d),

  // Perfil
  getPerfil:       ()  => client.get('/profile'),
  atualizarPerfil: (d) => client.patch('/profile', d),
  trocarSenha:     (d) => client.patch('/profile/password', d),
  atualizarToken:  (d) => client.patch('/profile/token', d),
  deletarConta:    ()  => client.delete('/profile'),

  // Repos
  getRepos:    ()    => client.get('/repos'),
  addRepo:     (d)   => client.post('/repos', d),
  getRepo:     (id)  => client.get(`/repos/${id}`),
  deleteRepo:  (id)  => client.delete(`/repos/${id}`),

  // Webhook
  ativarWebhook:    (id) => client.post(`/repos/${id}/webhook`),
  desativarWebhook: (id) => client.delete(`/repos/${id}/webhook`),

  // Análises
  runAnalysis:  (repoId) => client.post(`/repos/${repoId}/analyze`),
  getAnalyses:  (repoId) => client.get(`/repos/${repoId}/analyses`),
  getAnalysis:  (id)     => client.get(`/analyses/${id}`),
  comparar:     (id)     => client.get(`/analyses/${id}/compare`),
  createIssue:  (id)     => client.post(`/analyses/${id}/create-issue`),

  // Findings
  dispensarFinding: (id, d) => client.post(`/findings/${id}/dismiss`, d),
  restaurarFinding: (id)    => client.delete(`/findings/${id}/dismiss`),
};