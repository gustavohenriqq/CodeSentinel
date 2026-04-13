const express = require('express');
const prisma = require('../prisma/prisma');
const { getAllSecurityFiles, createIssue } = require('../github/github.service');
const { analyzeAll } = require('./engine/analyzer');
const { authMiddleware } = require('../auth/auth.middleware');
const { enviarNotificacaoAnalise } = require('../email/email.service');

const router = express.Router();
router.use(authMiddleware);

// POST /api/repos/:id/analyze
router.post('/repos/:id/analyze', async (req, res) => {
  try {
    const repo = await prisma.repository.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: { user: true },
    });

    if (!repo) return res.status(404).json({ message: 'Repositório não encontrado.' });
    if (!repo.user.githubToken) {
      return res.status(400).json({ message: 'Nenhum token GitHub configurado.' });
    }

    console.log(`🔍 Análise iniciada: ${repo.fullName}`);

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
      include: { findings: true },
    });

    // Envia e-mail se houver críticos (não bloqueia a resposta)
    if (result.criticalCount > 0) {
      enviarNotificacaoAnalise(repo.user.email, repo.user.name, repo, { ...analysis, ...result })
        .catch(() => {});
    }

    console.log(`✅ Análise concluída: score ${result.score}, ${result.totalFindings} problema(s)`);
    res.status(201).json(analysis);
  } catch (err) {
    console.error('❌ Erro na análise:', err);
    res.status(err.status || 500).json({ message: err.message || 'Falha na análise.' });
  }
});

// GET /api/repos/:id/analyses
router.get('/repos/:id/analyses', async (req, res) => {
  try {
    const repo = await prisma.repository.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!repo) return res.status(404).json({ message: 'Repositório não encontrado.' });

    const analyses = await prisma.analysis.findMany({
      where: { repositoryId: req.params.id },
      orderBy: { createdAt: 'desc' },
      include: { findings: true, issueLogs: true },
    });

    res.json(analyses);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Falha ao buscar análises.' });
  }
});

// GET /api/analyses/:id
router.get('/analyses/:id', async (req, res) => {
  try {
    const analysis = await prisma.analysis.findFirst({
      where: { id: req.params.id },
      include: {
        findings: { orderBy: { severity: 'asc' } },
        repository: true,
        issueLogs: true,
      },
    });

    if (!analysis) return res.status(404).json({ message: 'Análise não encontrada.' });
    if (analysis.repository.userId !== req.user.id) {
      return res.status(403).json({ message: 'Acesso negado.' });
    }

    res.json(analysis);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Falha ao buscar análise.' });
  }
});

// GET /api/analyses/:id/compare
router.get('/analyses/:id/compare', async (req, res) => {
  try {
    const analiseAtual = await prisma.analysis.findFirst({
      where: { id: req.params.id },
      include: { findings: true, repository: true },
    });

    if (!analiseAtual) return res.status(404).json({ message: 'Análise não encontrada.' });
    if (analiseAtual.repository.userId !== req.user.id) {
      return res.status(403).json({ message: 'Acesso negado.' });
    }

    const analiseAnterior = await prisma.analysis.findFirst({
      where: {
        repositoryId: analiseAtual.repositoryId,
        createdAt: { lt: analiseAtual.createdAt },
      },
      orderBy: { createdAt: 'desc' },
      include: { findings: true },
    });

    if (!analiseAnterior) {
      return res.json({ temComparacao: false, mensagem: 'Não há análise anterior para comparar.' });
    }

    const titulos_atual    = new Set(analiseAtual.findings.map(f => f.title));
    const titulos_anterior = new Set(analiseAnterior.findings.map(f => f.title));

    const novos       = analiseAtual.findings.filter(f => !titulos_anterior.has(f.title));
    const resolvidos  = analiseAnterior.findings.filter(f => !titulos_atual.has(f.title));
    const persistentes= analiseAtual.findings.filter(f => titulos_anterior.has(f.title));

    res.json({
      temComparacao: true,
      analiseAnteriorData: analiseAnterior.createdAt,
      scoreAnterior: analiseAnterior.score,
      scoreAtual: analiseAtual.score,
      diffScore: analiseAtual.score - analiseAnterior.score,
      novosProblemas: novos,
      problemasResolvidos: resolvidos,
      problemasEmAberto: persistentes,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Falha ao comparar análises.' });
  }
});

// POST /api/findings/:id/dismiss — só funciona após rodar migration_v2.sql
router.post('/findings/:id/dismiss', async (req, res) => {
  try {
    const { reason, note } = req.body;
    const motivos = ['false_positive', 'accepted_risk', 'wont_fix'];
    if (!reason || !motivos.includes(reason)) {
      return res.status(400).json({ message: 'Motivo inválido. Use: false_positive, accepted_risk ou wont_fix.' });
    }

    const finding = await prisma.finding.findFirst({
      where: { id: req.params.id },
      include: { analysis: { include: { repository: true } } },
    });

    if (!finding) return res.status(404).json({ message: 'Finding não encontrado.' });
    if (finding.analysis.repository.userId !== req.user.id) {
      return res.status(403).json({ message: 'Acesso negado.' });
    }

    const dismissal = await prisma.dismissal.upsert({
      where: { findingId: req.params.id },
      update: { reason, note: note || null },
      create: {
        findingId: req.params.id,
        analysisId: finding.analysisId,
        userId: req.user.id,
        reason,
        note: note || null,
      },
    });

    res.json(dismissal);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Falha ao dispensar finding. Execute o migration_v2.sql no Supabase.' });
  }
});

// DELETE /api/findings/:id/dismiss
router.delete('/findings/:id/dismiss', async (req, res) => {
  try {
    const dismissal = await prisma.dismissal.findFirst({
      where: { findingId: req.params.id, userId: req.user.id },
    });
    if (!dismissal) return res.status(404).json({ message: 'Dismissal não encontrado.' });
    await prisma.dismissal.delete({ where: { id: dismissal.id } });
    res.json({ message: 'Dismissal removido.' });
  } catch (err) {
    res.status(500).json({ message: 'Falha ao remover dismissal.' });
  }
});

// POST /api/analyses/:id/create-issue
router.post('/analyses/:id/create-issue', async (req, res) => {
  try {
    const analysis = await prisma.analysis.findFirst({
      where: { id: req.params.id },
      include: { findings: true, repository: true, issueLogs: true },
    });

    if (!analysis) return res.status(404).json({ message: 'Análise não encontrada.' });
    if (analysis.repository.userId !== req.user.id) return res.status(403).json({ message: 'Acesso negado.' });

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user.githubToken) return res.status(400).json({ message: 'Nenhum token GitHub configurado.' });

    if (analysis.issueLogs.length > 0) {
      return res.json({ message: 'Issue já criada.', issueUrl: analysis.issueLogs[0].issueUrl });
    }

    const corpo = montarCorpoIssue(analysis);
    const titulo = `[CodeSentinel] Auditoria de Segurança — Score: ${analysis.score}/100`;
    const { url, number } = await createIssue(user.githubToken, analysis.repository.owner, analysis.repository.name, titulo, corpo);
    await prisma.issueLog.create({ data: { analysisId: analysis.id, issueUrl: url, issueNumber: number } });

    res.json({ issueUrl: url, issueNumber: number });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message || 'Falha ao criar issue.' });
  }
});

function montarCorpoIssue(analysis) {
  const repo = analysis.repository;
  const data = new Date(analysis.createdAt).toLocaleDateString('pt-BR');
  const emoji = analysis.score >= 80 ? '🟢' : analysis.score >= 60 ? '🟡' : analysis.score >= 40 ? '🟠' : '🔴';
  const bySev = {
    critical: analysis.findings.filter(f => f.severity === 'critical'),
    high:     analysis.findings.filter(f => f.severity === 'high'),
    medium:   analysis.findings.filter(f => f.severity === 'medium'),
    low:      analysis.findings.filter(f => f.severity === 'low'),
  };
  const labelSev = { critical: '🔴 Crítica', high: '🟠 Alta', medium: '🟡 Média', low: '🟢 Baixa' };

  let corpo = `## ${emoji} Auditoria de Segurança — CodeSentinel\n\n`;
  corpo += `**Repositório:** \`${repo.fullName}\` · **Data:** ${data} · **Score:** ${analysis.score}/100\n\n`;
  corpo += `| Severidade | Quantidade |\n|---|---|\n`;
  corpo += `| 🔴 Crítica | ${analysis.criticalCount} |\n| 🟠 Alta | ${analysis.highCount} |\n`;
  corpo += `| 🟡 Média | ${analysis.mediumCount} |\n| 🟢 Baixa | ${analysis.lowCount} |\n\n---\n\n`;

  for (const [sev, achados] of Object.entries(bySev)) {
    if (!achados.length) continue;
    corpo += `### ${labelSev[sev]}\n\n`;
    for (const f of achados) {
      corpo += `#### ${f.title}\n**Arquivo:** \`${f.file}\`\n\n${f.description}\n\n`;
      corpo += `**Risco:** ${f.reason}\n\n**Correção:** ${f.suggestion}\n\n`;
      if (f.reference) corpo += `**Docs:** ${f.reference}\n\n`;
      corpo += `---\n\n`;
    }
  }
  corpo += `*Gerado pelo [CodeSentinel](https://github.com)*`;
  return corpo;
}

module.exports = router;
