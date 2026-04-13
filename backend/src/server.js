require('dotenv').config();
const express = require('express');
const cors = require('cors');
const prisma = require('./prisma/prisma');

const authRoutes     = require('./auth/auth.routes');
const reposRoutes    = require('./repos/repos.routes');
const analysesRoutes = require('./analyses/analyses.routes');
const profileRoutes  = require('./profile/profile.routes');
const { authMiddleware } = require('./auth/auth.middleware');

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// Webhook precisa de body raw — ANTES do express.json()
app.post('/api/webhooks/github/:repoId', express.raw({ type: 'application/json' }), async (req, res) => {
  res.status(200).json({ received: true });
  // Processamento assíncrono
  setImmediate(async () => {
    try {
      const crypto = require('crypto');
      const { repoId } = req.params;
      const signature = req.headers['x-hub-signature-256'];
      if (req.headers['x-github-event'] !== 'push') return;

      const repo = await prisma.repository.findFirst({
        where: { id: repoId },
        include: { user: true },
      });
      if (!repo?.user?.githubToken) return;

      const secret = process.env.WEBHOOK_SECRET || 'codesentinel-webhook-secret-2024';
      const esperado = `sha256=${crypto.createHmac('sha256', secret).update(req.body).digest('hex')}`;
      if (!signature || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(esperado))) return;

      let dados;
      try { dados = JSON.parse(req.body.toString()); } catch { return; }

      const branch = dados.ref?.replace('refs/heads/', '');
      if (!['main', 'master', 'develop', 'dev'].includes(branch)) return;

      console.log(`🔔 Webhook push: ${repo.fullName} (${branch})`);

      const { getAllSecurityFiles } = require('./github/github.service');
      const { analyzeAll } = require('./analyses/engine/analyzer');
      const { enviarNotificacaoAnalise } = require('./email/email.service');

      const arquivos = await getAllSecurityFiles(repo.user.githubToken, repo.owner, repo.name);
      const result = analyzeAll(arquivos);

      const analysis = await prisma.analysis.create({
        data: {
          repositoryId: repo.id,
          score: result.score,
          totalFindings: result.totalFindings,
          criticalCount: result.criticalCount,
          highCount: result.highCount,
          mediumCount: result.mediumCount,
          lowCount: result.lowCount,
          status: 'completed',
          findings: {
            create: result.findings.map(f => ({
              title: f.title, description: f.description, severity: f.severity,
              file: f.file, reference: f.reference || null, reason: f.reason, suggestion: f.suggestion,
            })),
          },
        },
      });

      if (result.criticalCount > 0) {
        enviarNotificacaoAnalise(repo.user.email, repo.user.name, repo, { ...analysis, ...result }).catch(() => {});
      }
      console.log(`✅ Webhook análise concluída: score ${result.score}`);
    } catch (err) {
      console.error('❌ Erro no webhook:', err.message);
    }
  });
});

app.use(express.json());

app.use((req, res, next) => {
  console.log(`→ ${req.method} ${req.path}`);
  next();
});

// Badge SVG público
app.get('/api/badge/:repoId', async (req, res) => {
  // CORS explícito para badges — podem ser usados em qualquer site
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const ultima = await prisma.analysis.findFirst({
      where: { repositoryId: req.params.repoId },
      orderBy: { createdAt: 'desc' },
      select: { score: true },
    });
    const score = ultima?.score ?? 0;
    const cor = score >= 80 ? '10B981' : score >= 60 ? '84cc16' : score >= 40 ? 'F59E0B' : score >= 20 ? 'F97316' : 'EF4444';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="156" height="20">
  <rect rx="3" width="156" height="20" fill="#555"/>
  <rect rx="3" x="108" width="48" height="20" fill="#${cor}"/>
  <rect x="108" width="4" height="20" fill="#${cor}"/>
  <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,sans-serif" font-size="11">
    <text x="54" y="15" fill="#010101" fill-opacity=".3">CodeSentinel</text>
    <text x="54" y="14">CodeSentinel</text>
    <text x="132" y="15" fill="#010101" fill-opacity=".3">${score}/100</text>
    <text x="132" y="14">${score}/100</text>
  </g>
</svg>`;
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'no-cache, max-age=0');
    res.send(svg);
  } catch { res.status(500).send(''); }
});

app.use('/api/auth',    authRoutes);
app.use('/api/repos',   reposRoutes);
app.use('/api',         analysesRoutes);
app.use('/api/profile', profileRoutes);

// Ativar webhook — requer migration_v2.sql executado (adiciona coluna webhook_id)
app.post('/api/repos/:id/webhook', authMiddleware, async (req, res) => {
  try {
    const appUrl = process.env.APP_URL;
    if (!appUrl || appUrl.includes('localhost')) {
      return res.status(400).json({
        message: 'Configure APP_URL no .env com uma URL pública para ativar webhooks.',
        help: 'Execute: npx ngrok http 3001 e adicione APP_URL=https://xxx.ngrok.io no .env',
      });
    }

    const repo = await prisma.repository.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: { user: true },
    });
    if (!repo) return res.status(404).json({ message: 'Repositório não encontrado.' });
    if (!repo.user.githubToken) return res.status(400).json({ message: 'Token GitHub necessário.' });

    const axios = require('axios');
    const client = axios.create({
      baseURL: 'https://api.github.com',
      headers: { Authorization: `Bearer ${repo.user.githubToken}`, Accept: 'application/vnd.github+json' },
    });

    const secret = process.env.WEBHOOK_SECRET || 'codesentinel-webhook-secret-2024';
    const { data } = await client.post(`/repos/${repo.owner}/${repo.name}/hooks`, {
      name: 'web', active: true, events: ['push'],
      config: {
        url: `${appUrl}/api/webhooks/github/${repo.id}`,
        content_type: 'json', secret, insecure_ssl: '0',
      },
    });

    // Tenta salvar webhookId — só funciona se a coluna existir (após migration_v2.sql)
    try {
      await prisma.repository.update({ where: { id: repo.id }, data: { webhookId: String(data.id) } });
    } catch {
      console.warn('⚠️ Coluna webhook_id não existe ainda. Execute migration_v2.sql no Supabase.');
    }

    res.json({ message: 'Webhook ativado com sucesso!', webhookId: data.id });
  } catch (err) {
    console.error('Erro webhook:', err.response?.data || err.message);
    res.status(500).json({ message: 'Falha ao criar webhook. O token precisa ter permissão admin:repo_hook.' });
  }
});

app.delete('/api/repos/:id/webhook', authMiddleware, async (req, res) => {
  try {
    const repo = await prisma.repository.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: { user: true },
    });
    if (!repo) return res.status(404).json({ message: 'Repositório não encontrado.' });

    if (repo.webhookId && repo.user.githubToken) {
      const axios = require('axios');
      try {
        await axios.delete(
          `https://api.github.com/repos/${repo.owner}/${repo.name}/hooks/${repo.webhookId}`,
          { headers: { Authorization: `Bearer ${repo.user.githubToken}` } }
        );
      } catch { /* ignora se não encontrar */ }
    }

    try {
      await prisma.repository.update({ where: { id: repo.id }, data: { webhookId: null } });
    } catch { /* coluna pode não existir ainda */ }

    res.json({ message: 'Webhook desativado.' });
  } catch (err) {
    res.status(500).json({ message: 'Falha ao remover webhook.' });
  }
});


app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'conectado', versao: '2.0.0' });
  } catch (err) {
    res.status(500).json({ status: 'erro', error: err.message });
  }
});

app.use((req, res) => {
  res.status(404).json({ message: `Rota ${req.method} ${req.path} não encontrada.` });
});

app.use((err, req, res, next) => {
  console.error('❌ Erro não tratado:', err.message);
  res.status(500).json({ message: err.message || 'Erro interno.' });
});

const PORT = process.env.PORT || 3001;

async function iniciar() {
  try {
    await prisma.$connect();
    console.log('✅ Banco conectado');
  } catch (err) {
    console.error('❌ Falha no banco:', err.message);
    process.exit(1);
  }
  app.listen(PORT, () => {
    console.log(`🛡️  CodeSentinel v2.0 rodando em http://localhost:${PORT}`);
  });
}

iniciar();
