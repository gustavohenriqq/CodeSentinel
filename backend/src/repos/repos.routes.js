const express = require('express');
const prisma = require('../prisma/prisma');
const { getRepo } = require('../github/github.service');
const { authMiddleware } = require('../auth/auth.middleware');

const router = express.Router();

// POST /token precisa vir ANTES do authMiddleware global
// para não conflitar com /:id
router.post('/token', authMiddleware, async (req, res) => {
  try {
    const { githubToken } = req.body;
    if (!githubToken) return res.status(400).json({ message: 'Token é obrigatório.' });
    await prisma.user.update({ where: { id: req.user.id }, data: { githubToken } });
    res.json({ message: 'Token GitHub atualizado com sucesso.' });
  } catch (err) {
    console.error('Erro /token:', err.message);
    res.status(500).json({ message: 'Falha ao atualizar token.' });
  }
});

router.use(authMiddleware);

// GET /api/repos
router.get('/', async (req, res) => {
  try {
    const repos = await prisma.repository.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        analyses: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            score: true,
            totalFindings: true,
            criticalCount: true,
            highCount: true,
            createdAt: true,
          },
        },
      },
    });
    res.json(repos);
  } catch (err) {
    console.error('Erro GET /repos:', err.message);
    res.status(500).json({ message: 'Falha ao buscar repositórios.' });
  }
});

// POST /api/repos
router.post('/', async (req, res) => {
  try {
    const { owner, repo, githubToken } = req.body;
    console.log('POST /repos body:', { owner, repo, temToken: !!githubToken });

    if (!owner || !repo) {
      return res.status(400).json({ message: 'Dono e nome do repositório são obrigatórios.' });
    }

    // 1. Busca o usuário
    let user;
    try {
      user = await prisma.user.findUnique({ where: { id: req.user.id } });
      console.log('Usuário encontrado:', !!user, 'temToken:', !!user?.githubToken);
    } catch (err) {
      console.error('Erro ao buscar usuário:', err.message);
      return res.status(500).json({ message: 'Erro ao buscar usuário: ' + err.message });
    }

    const token = githubToken || user?.githubToken;
    if (!token) {
      return res.status(400).json({ message: 'Nenhum token GitHub fornecido.' });
    }

    // 2. Salva token se fornecido
    if (githubToken) {
      try {
        await prisma.user.update({ where: { id: req.user.id }, data: { githubToken } });
        console.log('Token salvo com sucesso');
      } catch (err) {
        console.error('Erro ao salvar token:', err.message);
        // Não bloqueia — continua mesmo sem salvar o token
      }
    }

    // 3. Valida no GitHub
    let ghRepo;
    try {
      console.log('Buscando repo no GitHub:', owner, repo);
      ghRepo = await getRepo(token, owner, repo);
      console.log('Repo encontrado no GitHub:', ghRepo.full_name);
    } catch (err) {
      console.error('Erro GitHub:', err.message || err);
      return res.status(err.status || 400).json({ message: err.message || 'Erro ao buscar no GitHub.' });
    }

    // 4. Verifica duplicata
    try {
      const existente = await prisma.repository.findFirst({
        where: { userId: req.user.id, fullName: ghRepo.full_name },
      });
      if (existente) {
        return res.status(409).json({ message: 'Repositório já adicionado.' });
      }
    } catch (err) {
      console.error('Erro ao verificar duplicata:', err.message);
      return res.status(500).json({ message: 'Erro ao verificar repositório: ' + err.message });
    }

    // 5. Cria no banco
    let criado;
    try {
      criado = await prisma.repository.create({
        data: {
          userId: req.user.id,
          owner: ghRepo.owner.login,
          name: ghRepo.name,
          fullName: ghRepo.full_name,
          url: ghRepo.html_url,
          private: ghRepo.private,
        },
      });
      console.log('Repo criado no banco:', criado.id);
    } catch (err) {
      console.error('Erro ao criar repo no banco:', err.message);
      return res.status(500).json({ message: 'Erro ao salvar repositório: ' + err.message });
    }

    res.status(201).json(criado);
  } catch (err) {
    console.error('Erro geral POST /repos:', err.message);
    res.status(500).json({ message: 'Falha ao adicionar repositório: ' + err.message });
  }
});

// GET /api/repos/:id
router.get('/:id', async (req, res) => {
  try {
    const repo = await prisma.repository.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: {
        analyses: {
          orderBy: { createdAt: 'desc' },
          include: { findings: true, issueLogs: true },
        },
      },
    });
    if (!repo) return res.status(404).json({ message: 'Repositório não encontrado.' });
    res.json(repo);
  } catch (err) {
    console.error('Erro GET /repos/:id:', err.message);
    res.status(500).json({ message: 'Falha ao buscar repositório.' });
  }
});

// DELETE /api/repos/:id
router.delete('/:id', async (req, res) => {
  try {
    const repo = await prisma.repository.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!repo) return res.status(404).json({ message: 'Repositório não encontrado.' });
    await prisma.repository.delete({ where: { id: req.params.id } });
    res.json({ message: 'Repositório removido com sucesso.' });
  } catch (err) {
    console.error('Erro DELETE /repos/:id:', err.message);
    res.status(500).json({ message: 'Falha ao remover repositório.' });
  }
});

module.exports = router;
