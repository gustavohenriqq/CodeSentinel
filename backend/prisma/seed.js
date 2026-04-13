require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('senha123', 10);

  const alice = await prisma.user.upsert({
    where: { email: 'alice@codesentinel.dev' },
    update: {},
    create: { email: 'alice@codesentinel.dev', password: hash, name: 'Alice Dev' },
  });

  await prisma.user.upsert({
    where: { email: 'bob@codesentinel.dev' },
    update: {},
    create: { email: 'bob@codesentinel.dev', password: hash, name: 'Bob Segura' },
  });

  const repo1 = await prisma.repository.upsert({
    where: { userId_fullName: { userId: alice.id, fullName: 'vercel/next.js' } },
    update: {},
    create: {
      userId: alice.id,
      owner: 'vercel',
      name: 'next.js',
      fullName: 'vercel/next.js',
      url: 'https://github.com/vercel/next.js',
      private: false,
    },
  });

  const repo2 = await prisma.repository.upsert({
    where: { userId_fullName: { userId: alice.id, fullName: 'facebook/react' } },
    update: {},
    create: {
      userId: alice.id,
      owner: 'facebook',
      name: 'react',
      fullName: 'facebook/react',
      url: 'https://github.com/facebook/react',
      private: false,
    },
  });

  await prisma.analysis.create({
    data: {
      repositoryId: repo1.id,
      score: 25,
      totalFindings: 5,
      criticalCount: 2,
      highCount: 2,
      mediumCount: 1,
      lowCount: 0,
      findings: {
        create: [
          {
            title: 'Workflow usa write-all permissions',
            description: 'O workflow concede acesso de escrita a todos os escopos.',
            severity: 'critical',
            file: 'ci.yml',
            reference: 'https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#permissions',
            reason: 'permissions: write-all dá ao GITHUB_TOKEN acesso total de escrita.',
            suggestion: 'Substitua por permissões específicas: permissions: { contents: read }',
          },
          {
            title: 'Action "octokit/request-action@main" usa referência mutável',
            description: 'A action está apontando para @main, que pode mudar a qualquer momento.',
            severity: 'high',
            file: 'ci.yml',
            reference: 'https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions',
            reason: 'Referências mutáveis permitem que o código executado mude sem aviso.',
            suggestion: 'Fixe em um SHA completo: octokit/request-action@<sha>',
          },
          {
            title: 'Possível injeção de script via dados do evento GitHub',
            description: 'Um step usa ${{ github.event.pull_request.title }} diretamente em um script.',
            severity: 'critical',
            file: 'ci.yml',
            reference: 'https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions',
            reason: 'Permite injeção de comandos via título do PR.',
            suggestion: 'Use uma variável de ambiente intermediária: env: TITLE: ${{ github.event.pull_request.title }}',
          },
          {
            title: 'Uso do trigger pull_request_target',
            description: 'pull_request_target roda com permissões elevadas e acesso a secrets.',
            severity: 'high',
            file: 'release.yml',
            reference: 'https://securitylab.github.com/research/github-actions-preventing-pwn-requests/',
            reason: 'Se mal configurado, permite que PRs de forks acessem secrets.',
            suggestion: 'Verifique se é necessário e garanta que nenhum código do PR é executado.',
          },
          {
            title: 'Secrets expostos como variáveis de ambiente globais',
            description: '3 secrets definidos como env vars globais, disponíveis para todos os steps.',
            severity: 'medium',
            file: 'release.yml',
            reference: 'https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#env',
            reason: 'Secrets globais ficam disponíveis para todas as actions, incluindo terceiros.',
            suggestion: 'Mova os secrets para os steps específicos que precisam deles.',
          },
        ],
      },
    },
  });

  await prisma.analysis.create({
    data: {
      repositoryId: repo2.id,
      score: 72,
      totalFindings: 2,
      criticalCount: 0,
      highCount: 0,
      mediumCount: 2,
      lowCount: 0,
      findings: {
        create: [
          {
            title: 'Action "codecov/codecov-action@v3" usa só versão major',
            description: 'A tag @v3 é mutável e pode receber atualizações inesperadas.',
            severity: 'medium',
            file: 'build.yml',
            reference: 'https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions',
            reason: 'Tags major podem ser movidas pelo mantenedor a qualquer momento.',
            suggestion: 'Considere fixar em um SHA completo para builds determinísticos.',
          },
          {
            title: 'Nenhuma permissão declarada no workflow',
            description: 'O workflow não declara permissões explícitas.',
            severity: 'medium',
            file: 'build.yml',
            reference: 'https://docs.github.com/en/actions/security-guides/automatic-token-authentication',
            reason: 'Sem declaração, o token herda permissões amplas por padrão.',
            suggestion: 'Adicione permissions: read-all no topo do workflow.',
          },
        ],
      },
    },
  });

  console.log('seed concluído');
  console.log('alice@codesentinel.dev — senha123');
  console.log('bob@codesentinel.dev   — senha123');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
