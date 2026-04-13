function checkPermissions(workflowName, workflowContent, parsedYaml) {
  const findings = [];

  // 1. write-all explícito
  if (parsedYaml.permissions === 'write-all') {
    findings.push({
      title: 'Workflow usa permissões write-all',
      description: 'O workflow concede acesso de escrita a todos os escopos, violando o princípio do menor privilégio.',
      severity: 'critical',
      file: workflowName,
      reference: 'https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#permissions',
      reason: 'permissions: write-all dá ao GITHUB_TOKEN acesso total de escrita a todos os escopos do repositório.',
      suggestion: 'Substitua por permissões específicas. Exemplo: permissions: { contents: read, pull-requests: write }',
    });
  }

  // 2. Sem declaração de permissões — padrão inseguro (muito comum!)
  const hasTopLevelPerms = parsedYaml.permissions !== undefined;
  if (!hasTopLevelPerms) {
    findings.push({
      title: 'Nenhuma permissão declarada no workflow',
      description: 'O workflow não declara permissões explícitas, usando os permissivos padrões do GitHub que incluem write em vários escopos.',
      severity: 'medium',
      file: workflowName,
      reference: 'https://docs.github.com/en/actions/security-guides/automatic-token-authentication#permissions-for-the-github_token',
      reason: 'Sem declaração explícita, o GITHUB_TOKEN herda permissões de escrita em contents, packages e outros escopos sensíveis dependendo das configurações da organização.',
      suggestion: 'Adicione permissions: read-all no topo do workflow e depois libere apenas o que for necessário por job.',
    });
  }

  // 3. Permissões amplas em objetos
  if (parsedYaml.permissions && typeof parsedYaml.permissions === 'object') {
    const dangerousPerms = [];
    for (const [scope, level] of Object.entries(parsedYaml.permissions)) {
      if (level === 'write' && ['contents', 'packages', 'deployments', 'security-events', 'actions', 'id-token'].includes(scope)) {
        dangerousPerms.push(scope);
      }
    }
    if (dangerousPerms.length >= 2) {
      findings.push({
        title: `Permissões de escrita em escopos sensíveis: ${dangerousPerms.join(', ')}`,
        description: `O workflow concede write em ${dangerousPerms.length} escopos sensíveis ao mesmo tempo.`,
        severity: 'high',
        file: workflowName,
        reference: 'https://docs.github.com/en/actions/security-guides/automatic-token-authentication#permissions-for-the-github_token',
        reason: 'Múltiplas permissões de escrita ampliam o impacto caso algum step seja comprometido.',
        suggestion: 'Remova permissões desnecessárias. Cada job deve ter apenas o que precisa para funcionar.',
      });
    }
  }

  // 4. Jobs sem permissões declaradas quando o workflow tem
  if (parsedYaml.jobs) {
    for (const [jobName, job] of Object.entries(parsedYaml.jobs)) {
      if (!job) continue;
      if (job.permissions === 'write-all') {
        findings.push({
          title: `Job "${jobName}" usa write-all permissions`,
          description: `O job "${jobName}" concede write em todos os escopos no nível do job.`,
          severity: 'high',
          file: workflowName,
          reference: 'https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#jobsjob_idpermissions',
          reason: 'Mesmo no nível de job, write-all representa risco significativo se algum step for comprometido.',
          suggestion: `Substitua permissions: write-all no job "${jobName}" pelos escopos específicos que ele precisa.`,
        });
      }
    }
  }

  return findings;
}

module.exports = { checkPermissions };
