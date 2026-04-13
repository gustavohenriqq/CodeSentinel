const PADROES_SECRETS = [
  { pattern: /^(AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY)\s*=\s*.+/im,  label: 'Credencial AWS' },
  { pattern: /^(GITHUB_TOKEN|GH_TOKEN|GITHUB_PAT)\s*=\s*.+/im,         label: 'Token GitHub' },
  { pattern: /^(DATABASE_URL|DB_PASSWORD|POSTGRES_PASSWORD|MYSQL_ROOT_PASSWORD)\s*=\s*.+/im, label: 'Credencial de banco de dados' },
  { pattern: /^(STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET)\s*=\s*.+/im,  label: 'Chave Stripe' },
  { pattern: /^(SENDGRID_API_KEY|MAILGUN_API_KEY)\s*=\s*.+/im,          label: 'Chave de serviço de e-mail' },
  { pattern: /^(JWT_SECRET|SESSION_SECRET|APP_SECRET|SECRET_KEY)\s*=\s*.+/im, label: 'Chave secreta da aplicação' },
  { pattern: /^(PRIVATE_KEY|RSA_PRIVATE|SSH_PRIVATE)\s*=\s*.+/im,       label: 'Chave privada' },
  { pattern: /^(SLACK_TOKEN|SLACK_WEBHOOK)\s*=\s*.+/im,                 label: 'Token Slack' },
  { pattern: /^(TWILIO_AUTH_TOKEN|TWILIO_ACCOUNT_SID)\s*=\s*.+/im,      label: 'Credencial Twilio' },
  { pattern: /^(GOOGLE_API_KEY|GOOGLE_CLIENT_SECRET)\s*=\s*.+/im,       label: 'Credencial Google' },
  { pattern: /^(FIREBASE_API_KEY|FIREBASE_PRIVATE_KEY)\s*=\s*.+/im,     label: 'Credencial Firebase' },
  { pattern: /^(HEROKU_API_KEY|VERCEL_TOKEN|NETLIFY_AUTH_TOKEN)\s*=\s*.+/im, label: 'Token de plataforma de deploy' },
  // Valores que parecem secrets reais (hashes longos, tokens JWT, etc.)
  { pattern: /=\s*[a-zA-Z0-9+/]{32,}/m, label: 'Possível valor de secret (string longa)' },
];

function checkEnvFile(file) {
  const findings = [];
  const nomeArquivo = file.name.toLowerCase();

  // .env real não deveria estar no repositório
  if (nomeArquivo === '.env' || nomeArquivo.match(/^\.env\.(local|production|prod|staging)$/)) {
    findings.push({
      title: `Arquivo ${file.name} commitado no repositório`,
      description: `O arquivo ${file.name} foi encontrado no repositório. Arquivos .env geralmente contêm credenciais reais.`,
      severity: 'critical',
      file: file.name,
      reference: 'https://12factor.net/config',
      reason: 'Arquivos .env com credenciais reais expostos no repositório podem ser lidos por qualquer pessoa com acesso, comprometendo a segurança do sistema.',
      suggestion: `Adicione "${file.name}" ao .gitignore imediatamente. Use .env.example com valores fictícios como documentação. Revogue e regenere todas as credenciais expostas.`,
    });
  }

  // Verifica conteúdo em busca de secrets reais (não placeholders)
  const linhas = file.content.split('\n');
  const secretsEncontrados = new Set();

  for (const { pattern, label } of PADROES_SECRETS) {
    // Pula a regra de "string longa" para arquivos .example ou .sample
    if (label.includes('string longa') && (nomeArquivo.includes('example') || nomeArquivo.includes('sample'))) {
      continue;
    }

    for (const linha of linhas) {
      // Ignora comentários e linhas vazias
      if (linha.trim().startsWith('#') || !linha.trim()) continue;
      // Ignora placeholders óbvios
      if (/=\s*(YOUR_|<|CHANGE_ME|PLACEHOLDER|EXAMPLE|xxx|todo)/i.test(linha)) continue;
      // Ignora valores vazios
      if (/=\s*$/.test(linha)) continue;

      if (pattern.test(linha) && !secretsEncontrados.has(label)) {
        secretsEncontrados.add(label);
        findings.push({
          title: `${label} com valor real em ${file.name}`,
          description: `O arquivo ${file.name} contém o que parece ser uma credencial real do tipo "${label}".`,
          severity: nomeArquivo === '.env.example' || nomeArquivo === '.env.sample' ? 'medium' : 'critical',
          file: file.name,
          reference: 'https://docs.github.com/en/code-security/secret-scanning/about-secret-scanning',
          reason: 'Credenciais reais em arquivos versionados ficam permanentemente no histórico do Git, mesmo após remoção posterior.',
          suggestion: 'Revogue imediatamente a credencial exposta. Remova o arquivo do histórico com git filter-branch ou BFG Repo-Cleaner. Use variáveis de ambiente em runtime.',
        });
        break;
      }
    }
  }

  return findings;
}

function checkGitignore(file) {
  const findings = [];
  const conteudo = file.content;

  // Arquivos que deveriam estar no .gitignore
  const deveriamEstar = [
    { padrao: /^\.env$/m,            label: '.env', importante: true },
    { padrao: /^\.env\.\*/m,         label: '.env.*', importante: true },
    { padrao: /node_modules/m,       label: 'node_modules/', importante: false },
    { padrao: /\.pem$|\.key$/m,      label: 'Chaves privadas (*.pem, *.key)', importante: true },
    { padrao: /id_rsa|id_ed25519/m,  label: 'Chaves SSH', importante: true },
    { padrao: /\.DS_Store/m,         label: '.DS_Store', importante: false },
    { padrao: /dist\/|build\//m,     label: 'Pasta de build (dist/, build/)', importante: false },
  ];

  const ausentes = deveriamEstar.filter(({ padrao }) => !padrao.test(conteudo));
  const ausentesImportantes = ausentes.filter(a => a.importante);

  if (ausentesImportantes.length > 0) {
    findings.push({
      title: `Entradas importantes ausentes no .gitignore`,
      description: `O .gitignore não inclui: ${ausentesImportantes.map(a => a.label).join(', ')}.`,
      severity: 'medium',
      file: file.name,
      reference: 'https://git-scm.com/docs/gitignore',
      reason: 'Sem essas entradas, arquivos sensíveis como .env e chaves privadas podem ser commitados acidentalmente.',
      suggestion: `Adicione ao .gitignore:\n${ausentesImportantes.map(a => a.label.split(' ')[0]).join('\n')}`,
    });
  }

  return findings;
}

module.exports = { checkEnvFile, checkGitignore };
