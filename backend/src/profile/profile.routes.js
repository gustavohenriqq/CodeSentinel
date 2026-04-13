const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../prisma/prisma');
const { authMiddleware } = require('../auth/auth.middleware');

const router = express.Router();
router.use(authMiddleware);

// GET /api/profile
router.get('/', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, email: true, githubToken: true, createdAt: true },
    });
    if (!user) return res.status(404).json({ message: 'Usuário não encontrado.' });

    // Mascara o token — mostra só os primeiros 8 caracteres
    const tokenMascarado = user.githubToken
      ? `${user.githubToken.slice(0, 8)}${'•'.repeat(20)}`
      : null;

    res.json({ ...user, githubToken: tokenMascarado, temToken: !!user.githubToken });
  } catch (err) {
    res.status(500).json({ message: 'Falha ao buscar perfil.' });
  }
});

// PATCH /api/profile — atualiza nome
router.patch('/', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || name.trim().length < 2) {
      return res.status(400).json({ message: 'Nome deve ter pelo menos 2 caracteres.' });
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { name: name.trim() },
      select: { id: true, name: true, email: true, createdAt: true },
    });

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Falha ao atualizar perfil.' });
  }
});

// PATCH /api/profile/password — troca senha
router.patch('/password', async (req, res) => {
  try {
    const { senhaAtual, novaSenha } = req.body;

    if (!senhaAtual || !novaSenha) {
      return res.status(400).json({ message: 'Senha atual e nova senha são obrigatórias.' });
    }
    if (novaSenha.length < 6) {
      return res.status(400).json({ message: 'A nova senha deve ter pelo menos 6 caracteres.' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const correta = await bcrypt.compare(senhaAtual, user.password);

    if (!correta) {
      return res.status(401).json({ message: 'Senha atual incorreta.' });
    }

    const hash = await bcrypt.hash(novaSenha, 10);
    await prisma.user.update({ where: { id: req.user.id }, data: { password: hash } });

    res.json({ message: 'Senha alterada com sucesso.' });
  } catch (err) {
    res.status(500).json({ message: 'Falha ao alterar senha.' });
  }
});

// PATCH /api/profile/token — atualiza token GitHub
router.patch('/token', async (req, res) => {
  try {
    const { githubToken } = req.body;
    if (!githubToken) return res.status(400).json({ message: 'Token é obrigatório.' });

    await prisma.user.update({ where: { id: req.user.id }, data: { githubToken } });
    res.json({ message: 'Token GitHub atualizado com sucesso.' });
  } catch (err) {
    res.status(500).json({ message: 'Falha ao atualizar token.' });
  }
});

// DELETE /api/profile — deleta conta
router.delete('/', async (req, res) => {
  try {
    await prisma.user.delete({ where: { id: req.user.id } });
    res.json({ message: 'Conta deletada com sucesso.' });
  } catch (err) {
    res.status(500).json({ message: 'Falha ao deletar conta.' });
  }
});

module.exports = router;
