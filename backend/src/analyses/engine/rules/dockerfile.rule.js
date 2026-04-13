function checkDockerfile(file) {
  const findings = [];
  const lines = file.content.split('\n');
  const conteudo = file.content;

  // 1. Imagem base sem tag (latest implícito)
  const fromLines = lines.filter(l => l.trim().toUpperCase().startsWith('FROM'));
  for (const linha of fromLines) {
    const match = linha.match(/FROM\s+([^\s]+)/i);
    if (!match) continue;
    const imagem = match[1];

    // Ignora multi-stage aliases (FROM x AS y)
    if (imagem.toLowerCase() === 'scratch') continue;

    const temTag = imagem.includes(':');
    const temDigest = imagem.includes('@sha256:');

    if (!temTag && !temDigest) {
      findings.push({
        title: `Imagem base sem versão: ${imagem}`,
        description: `A instrução FROM usa "${imagem}" sem especificar uma tag, o que usa implicitamente "latest".`,
        severity: 'high',
        file: file.name,
        reference: 'https://docs.docker.com/develop/develop-images/dockerfile_best-practices/#from',
        reason: 'Imagens com tag "latest" mudam com o tempo. Builds não são reproduzíveis e novas versões podem introduzir vulnerabilidades ou breaking changes.',
        suggestion: `Fixe a versão: FROM ${imagem}:1.x.x ou use digest: FROM ${imagem}@sha256:<hash>`,
      });
    } else if (temTag && !temDigest) {
      const tag = imagem.split(':')[1];
      if (tag === 'latest') {
        findings.push({
          title: `Imagem base usa tag "latest": ${imagem}`,
          description: `A instrução FROM usa a tag "latest" que é mutável e não garante reprodutibilidade.`,
          severity: 'high',
          file: file.name,
          reference: 'https://docs.docker.com/develop/develop-images/dockerfile_best-practices/#from',
          reason: 'A tag "latest" sempre aponta para a versão mais recente, que pode mudar a qualquer momento quebrando o build ou introduzindo vulnerabilidades.',
          suggestion: `Substitua por uma versão específica, ex: FROM ${imagem.split(':')[0]}:1.x.x`,
        });
      }
    }
  }

  // 2. Rodando como root (sem USER definido)
  const temUserInstruction = lines.some(l => l.trim().toUpperCase().startsWith('USER'));
  if (!temUserInstruction) {
    findings.push({
      title: 'Container roda como root (sem instrução USER)',
      description: 'O Dockerfile não define uma instrução USER, fazendo o container rodar como root por padrão.',
      severity: 'high',
      file: file.name,
      reference: 'https://docs.docker.com/develop/develop-images/dockerfile_best-practices/#user',
      reason: 'Containers rodando como root têm acesso elevado ao host em caso de escape do container. Também viola o princípio do menor privilégio.',
      suggestion: 'Adicione ao final do Dockerfile antes do CMD/ENTRYPOINT:\nRUN addgroup -S appgroup && adduser -S appuser -G appgroup\nUSER appuser',
    });
  }

  // 3. Secrets em ARG ou ENV
  const padroesSensíveis = [
    /\b(password|passwd|secret|api_key|apikey|token|private_key|access_key|auth)\s*[=:]/i,
    /\b(AWS_SECRET|AWS_ACCESS|DATABASE_URL|DB_PASSWORD|GITHUB_TOKEN)\s*=/i,
  ];

  for (const linha of lines) {
    const isArg = linha.trim().toUpperCase().startsWith('ARG');
    const isEnv = linha.trim().toUpperCase().startsWith('ENV');

    if (!isArg && !isEnv) continue;

    for (const pattern of padroesSensíveis) {
      if (pattern.test(linha)) {
        findings.push({
          title: `Possível secret em instrução ${isArg ? 'ARG' : 'ENV'}: ${linha.trim().slice(0, 80)}`,
          description: `A instrução ${isArg ? 'ARG' : 'ENV'} parece definir uma variável sensível diretamente no Dockerfile.`,
          severity: 'critical',
          file: file.name,
          reference: 'https://docs.docker.com/engine/swarm/secrets/',
          reason: `Valores em ${isArg ? 'ARG' : 'ENV'} ficam visíveis no histórico da imagem (docker history) e em qualquer layer intermediário. Secrets assim vazam para qualquer um que tenha acesso à imagem.`,
          suggestion: 'Nunca coloque secrets no Dockerfile. Use Docker secrets, variáveis de ambiente em runtime, ou um gerenciador de secrets como Vault.',
        });
        break;
      }
    }
  }

  // 4. ADD com URL externa (risco de conteúdo mutável)
  const addComUrl = lines.filter(l => /^ADD\s+https?:\/\//i.test(l.trim()));
  if (addComUrl.length > 0) {
    findings.push({
      title: 'ADD com URL externa no Dockerfile',
      description: `O Dockerfile usa ADD com URL remota: ${addComUrl[0].trim().slice(0, 100)}`,
      severity: 'medium',
      file: file.name,
      reference: 'https://docs.docker.com/develop/develop-images/dockerfile_best-practices/#add-or-copy',
      reason: 'ADD com URL não verifica integridade do arquivo baixado. O conteúdo pode mudar ou ser substituído por conteúdo malicioso.',
      suggestion: 'Use RUN curl com verificação de checksum:\nRUN curl -fsSL https://... -o arquivo.tar.gz && echo "HASH *arquivo.tar.gz" | sha256sum -c',
    });
  }

  // 5. curl | bash ou wget | sh no RUN
  const runPipeShell = lines.filter(l =>
    l.trim().toUpperCase().startsWith('RUN') &&
    /(curl|wget).*\|\s*(bash|sh|python|node)/i.test(l)
  );
  if (runPipeShell.length > 0) {
    findings.push({
      title: 'RUN faz download e execução direta de script remoto',
      description: `Uma instrução RUN baixa e executa um script externo: ${runPipeShell[0].trim().slice(0, 120)}`,
      severity: 'high',
      file: file.name,
      reference: 'https://docs.docker.com/develop/develop-images/dockerfile_best-practices/',
      reason: 'Baixar e executar scripts remotos sem verificação de integridade permite que conteúdo malicioso seja inserido na imagem.',
      suggestion: 'Baixe o script, verifique o SHA256 e só então execute:\nRUN curl -fsSL https://... -o script.sh && echo "HASH script.sh" | sha256sum -c && bash script.sh',
    });
  }

  // 6. COPY ou ADD de .env ou arquivos sensíveis
  const copySensivel = lines.filter(l => {
    const upper = l.trim().toUpperCase();
    return (upper.startsWith('COPY') || upper.startsWith('ADD')) &&
      /\.env|\.pem|\.key|\.p12|\.pfx|id_rsa|\.secret/i.test(l);
  });
  if (copySensivel.length > 0) {
    findings.push({
      title: 'Arquivo sensível copiado para a imagem Docker',
      description: `O Dockerfile copia um arquivo potencialmente sensível: ${copySensivel[0].trim().slice(0, 100)}`,
      severity: 'critical',
      file: file.name,
      reference: 'https://docs.docker.com/develop/develop-images/dockerfile_best-practices/',
      reason: 'Arquivos .env, chaves privadas e certificados copiados para a imagem ficam acessíveis a qualquer um que tenha acesso à imagem, mesmo que deletados em layers posteriores.',
      suggestion: 'Nunca copie arquivos de configuração sensíveis para a imagem. Use variáveis de ambiente em runtime ou Docker secrets.',
    });
  }

  // 7. Sem HEALTHCHECK
  const temHealthcheck = conteudo.toUpperCase().includes('HEALTHCHECK');
  if (!temHealthcheck && fromLines.length > 0) {
    findings.push({
      title: 'Sem instrução HEALTHCHECK no Dockerfile',
      description: 'O Dockerfile não define um HEALTHCHECK para verificar se o container está funcionando corretamente.',
      severity: 'low',
      file: file.name,
      reference: 'https://docs.docker.com/engine/reference/builder/#healthcheck',
      reason: 'Sem HEALTHCHECK, orquestradores como Kubernetes e Docker Swarm não conseguem detectar quando o container está em estado degradado.',
      suggestion: 'Adicione um HEALTHCHECK:\nHEALTHCHECK --interval=30s --timeout=3s CMD curl -f http://localhost/health || exit 1',
    });
  }

  return findings;
}

module.exports = { checkDockerfile };
