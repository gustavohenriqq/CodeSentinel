const express = require('express');
const crypto = require('crypto');
const prisma = require('../prisma/prisma');
const { getAllSecurityFiles } = require('../github/github.service');
const { analyzeAll } = require('../analyses/engine/analyzer');
const { enviarNotificacaoAnalise } = require('../email/email.service');

const router = express.Router();

// Verifica assinatura do webhook do GitHub
function verificarAssinatura(payload, signature, secret) {
  if (!signature) return false;
  const esperado = `sha256=${crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')}`;
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(esperado)
  );
}

// POST /api/webhooks/github/:repoId
router.post('/github/:repoId', express.raw({ type: 'application/json' }), async (req, res) => {
  const { repoId } = req.params;
  const signature = req.headers['x-hub-signature-256'];
  const evento = req.headers['x-github-event'];

  // Confirma recebimento imediatamente (GitHub exige resposta rápida)
  res.status(200).json({ received: true });

  try {
    // Busca o repositório
    const repo = await prisma.repository.findFirst({
      where: { id: repoId },
      include: { user: true },
    });

    if (!repo || !repo.user.githubToken) return;

    // Verifica assinatura
    const secret = process.env.WEBHOOK_SECRET || 'codesentinel-webhook-secret-2024';
    const payload = req.body;

    if (!verificarAssinatura(payload, signature, secret)) {
      console.warn(`⚠️ Assinatura inválida no webhook do repo ${repoId}`);
      return;
    }

    // Só processa eventos de push
    if (evento !== 'push') return;

    let dados;
    try {
      dados = JSON.parse(payload.toString());
    } catch {
      return;
    }

    // Ignora pushes para branches que não sejam main/master
    const branch = dados.ref?.replace('refs/heads/', '');
    if (!['main', 'master', 'develop', 'dev'].includes(branch)) return;

    console.log(`🔔 Webhook recebido: push em ${repo.fullName} (${branch})`);

    // Roda análise automática
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
        triggeredBy: `push:${branch}`,
        findings: {
          create: result.findings.map(f => ({
            title: f.title,
            description: f.description,
            severity: f.severity,
            file: f.file,
            reference: f.reference || null,
            reason: f.reason,
            suggestion: f.suggestion,
          })),
        },
      },
    });

    console.log(`✅ Análise automática concluída: ${repo.fullName} — score ${result.score}`);

    // Envia e-mail se houver problemas críticos
    if (result.criticalCount > 0) {
      await enviarNotificacaoAnalise(
        repo.user.email,
        repo.user.name,
        repo,
        { ...analysis, ...result }
      );
    }
  } catch (err) {
    console.error('❌ Erro no processamento do webhook:', err.message);
  }
});

// POST /api/repos/:id/webhook — ativa webhook no GitHub
router.post('/repos/:id/webhook', async (req, res) => {
  // Middleware de auth aplicado no server.js
  try {
    const repo = await prisma.repository.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: { user: true },
    });

    if (!repo) return res.status(404).json({ message: 'Repositório não encontrado.' });
    if (!repo.user.githubToken) return res.status(400).json({ message: 'Token GitHub necessário.' });

    const appUrl = process.env.APP_URL;
    if (!appUrl || appUrl.includes('localhost')) {
      return res.status(400).json({
        message: 'Configure APP_URL no .env com uma URL pública (ex: use ngrok) para ativar webhooks.',
        help: 'Execute: npx ngrok http 3001 e coloque a URL no .env como APP_URL=https://xxx.ngrok.io',
      });
    }

    // Cria webhook no GitHub
    const axios = require('axios');
    const client = axios.create({
      baseURL: 'https://api.github.com',
      headers: {
        Authorization: `Bearer ${repo.user.githubToken}`,
        Accept: 'application/vnd.github+json',
      },
    });

    const webhookUrl = `${appUrl}/api/webhooks/github/${repo.id}`;
    const secret = process.env.WEBHOOK_SECRET || 'codesentinel-webhook-secret-2024';

    // Remove webhook anterior se existir
    if (repo.webhookId) {
      try {
        await client.delete(`/repos/${repo.owner}/${repo.name}/hooks/${repo.webhookId}`);
      } catch { /* ignora se não existir */ }
    }

    const { data } = await client.post(`/repos/${repo.owner}/${repo.name}/hooks`, {
      name: 'web',
      active: true,
      events: ['push'],
      config: {
        url: webhookUrl,
        content_type: 'json',
        secret,
        insecure_ssl: '0',
      },
    });

    await prisma.repository.update({
      where: { id: repo.id },
      data: { webhookId: String(data.id) },
    });

    res.json({ message: 'Webhook ativado com sucesso!', webhookUrl, webhookId: data.id });
  } catch (err) {
    console.error('Erro ao criar webhook:', err.response?.data || err.message);
    res.status(500).json({ message: 'Falha ao criar webhook. Verifique se o token tem permissão admin:repo_hook.' });
  }
});

// DELETE /api/repos/:id/webhook — desativa webhook
router.delete('/repos/:id/webhook', async (req, res) => {
  try {
    const repo = await prisma.repository.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: { user: true },
    });

    if (!repo || !repo.webhookId) {
      return res.status(404).json({ message: 'Webhook não encontrado.' });
    }

    const axios = require('axios');
    const client = axios.create({
      baseURL: 'https://api.github.com',
      headers: { Authorization: `Bearer ${repo.user.githubToken}` },
    });

    await client.delete(`/repos/${repo.owner}/${repo.name}/hooks/${repo.webhookId}`);
    await prisma.repository.update({ where: { id: repo.id }, data: { webhookId: null } });

    res.json({ message: 'Webhook desativado com sucesso.' });
  } catch (err) {
    res.status(500).json({ message: 'Falha ao remover webhook.' });
  }
});

module.exports = router;
