function checkDangerousPatterns(workflowName, workflowContent, parsedYaml) {
  const findings = [];

  // 1. Script injection via github context em run steps
  const injectionPatterns = [
    /\$\{\{\s*github\.event\.pull_request\.(title|body|head\.ref|head\.label)\s*\}\}/g,
    /\$\{\{\s*github\.event\.issue\.(title|body)\s*\}\}/g,
    /\$\{\{\s*github\.event\.comment\.body\s*\}\}/g,
    /\$\{\{\s*github\.head_commit\.message\s*\}\}/g,
    /\$\{\{\s*github\.event\.inputs\.\w+\s*\}\}/g,
  ];

  // Só é injection se estiver dentro de um run: step
  if (parsedYaml.jobs) {
    for (const [jobName, job] of Object.entries(parsedYaml.jobs)) {
      if (!job?.steps) continue;
      for (const step of job.steps) {
        if (!step?.run) continue;
        for (const pattern of injectionPatterns) {
          if (pattern.test(step.run)) {
            findings.push({
              title: 'Possível injeção de script via dados do evento GitHub',
              description: `Um step do job "${jobName}" usa dados de entrada não confiáveis diretamente em um script shell.`,
              severity: 'critical',
              file: workflowName,
              reference: 'https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions#understanding-the-risk-of-script-injections',
              reason: 'Usar ${{ github.event.* }} diretamente em scripts shell permite que atacantes injetem comandos através de títulos de PR, mensagens de commit ou corpos de issue.',
              suggestion: 'Atribua o valor a uma variável de ambiente primeiro: env: TITLE: ${{ github.event.pull_request.title }} e use $TITLE no script.',
            });
            break;
          }
        }
      }
    }
  }

  // 2. pull_request_target (muito comum e perigoso)
  const triggers = parsedYaml.on || {};
  const hasPrTarget =
    triggers === 'pull_request_target' ||
    (typeof triggers === 'object' && 'pull_request_target' in triggers);

  if (hasPrTarget) {
    const checksOutPRCode =
      workflowContent.includes('ref:') &&
      (workflowContent.includes('github.event.pull_request') || workflowContent.includes('head.sha'));

    if (checksOutPRCode) {
      findings.push({
        title: 'CRÍTICO: pull_request_target com checkout do código do PR',
        description: 'O workflow usa pull_request_target e faz checkout do código do pull request — vetor de ataque conhecido como "pwn request".',
        severity: 'critical',
        file: workflowName,
        reference: 'https://securitylab.github.com/research/github-actions-preventing-pwn-requests/',
        reason: 'pull_request_target roda com permissões elevadas e acesso a secrets. Fazer checkout do código de um fork nesse contexto expõe todos os secrets do workflow.',
        suggestion: 'Nunca faça checkout do código do PR em workflows pull_request_target. Use pull_request para build/teste e pull_request_target apenas para operações seguras sem execução de código externo.',
      });
    } else {
      findings.push({
        title: 'Uso do trigger pull_request_target',
        description: 'O workflow usa pull_request_target que roda com permissões elevadas e acesso a secrets.',
        severity: 'high',
        file: workflowName,
        reference: 'https://securitylab.github.com/research/github-actions-preventing-pwn-requests/',
        reason: 'pull_request_target foi criado para casos específicos. Se mal configurado, permite que PRs de forks acessem secrets e escrevam no repositório.',
        suggestion: 'Verifique se é realmente necessário. Certifique-se de não executar nenhum código vindo do PR neste workflow.',
      });
    }
  }

  // 3. workflow_dispatch inputs usados diretamente em run
  if (parsedYaml.on?.workflow_dispatch?.inputs && parsedYaml.jobs) {
    const inputNames = Object.keys(parsedYaml.on.workflow_dispatch.inputs);
    for (const [jobName, job] of Object.entries(parsedYaml.jobs)) {
      if (!job?.steps) continue;
      for (const step of job.steps) {
        if (!step?.run) continue;
        const usedInputs = inputNames.filter(name =>
          step.run.includes(`github.event.inputs.${name}`)
        );
        if (usedInputs.length > 0) {
          findings.push({
            title: `Inputs do workflow_dispatch usados diretamente em script`,
            description: `O job "${jobName}" usa inputs (${usedInputs.join(', ')}) diretamente em um comando shell sem sanitização.`,
            severity: 'medium',
            file: workflowName,
            reference: 'https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions',
            reason: 'Inputs de workflow_dispatch são controlados por quem dispara o workflow. Usá-los diretamente em scripts pode permitir injeção de comandos.',
            suggestion: 'Use variáveis de ambiente: env: MY_INPUT: ${{ github.event.inputs.myInput }} e referencie como $MY_INPUT no script.',
          });
          break;
        }
      }
    }
  }

  // 4. Self-hosted runners
  if (parsedYaml.jobs) {
    for (const [jobName, job] of Object.entries(parsedYaml.jobs)) {
      if (!job) continue;
      const runsOn = job['runs-on'];
      const isSelfHosted =
        runsOn === 'self-hosted' ||
        (Array.isArray(runsOn) && runsOn.includes('self-hosted')) ||
        (typeof runsOn === 'string' && runsOn.includes('self-hosted'));

      if (isSelfHosted) {
        findings.push({
          title: `Job "${jobName}" usa runner self-hosted`,
          description: 'Runners self-hosted persistem estado entre execuções e podem ser compartilhados entre repositórios.',
          severity: 'medium',
          file: workflowName,
          reference: 'https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions#hardening-for-self-hosted-runners',
          reason: 'Runners self-hosted mantêm dados do workspace entre runs. Workflows maliciosos podem envenenar o ambiente do runner.',
          suggestion: 'Use runners efêmeros quando possível. Garanta que o runner tenha apenas as permissões mínimas necessárias.',
        });
      }
    }
  }

  // 5. Trigger em push para branch protegida sem proteções
  const triggers2 = parsedYaml.on || {};
  const hasPushToMain =
    (typeof triggers2 === 'object') &&
    triggers2.push?.branches?.some(b => ['main', 'master', 'production', 'prod'].includes(b));

  if (hasPushToMain && parsedYaml.jobs) {
    // Verifica se tem algum deploy ou publish nos steps
    const hasDeployStep = workflowContent.match(/\b(deploy|publish|release|npm publish|docker push|kubectl|terraform apply)\b/i);
    if (hasDeployStep) {
      findings.push({
        title: 'Deploy/publish disparado automaticamente em push para branch principal',
        description: 'O workflow faz deploy ou publicação automaticamente em qualquer push para a branch principal.',
        severity: 'medium',
        file: workflowName,
        reference: 'https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment',
        reason: 'Deployments automáticos sem aprovação manual em branches protegidas aumentam o risco de publicação acidental ou de código comprometido.',
        suggestion: 'Configure environments com required reviewers para deployments em produção. Considere adicionar um step de aprovação manual.',
      });
    }
  }

  // 6. Uso de curl/wget para baixar e executar scripts externos
  if (parsedYaml.jobs) {
    for (const [jobName, job] of Object.entries(parsedYaml.jobs)) {
      if (!job?.steps) continue;
      for (const step of job.steps) {
        if (!step?.run) continue;
        const pipeToShell = /\b(curl|wget)\b.*\|\s*(bash|sh|zsh|python|node)/i.test(step.run);
        if (pipeToShell) {
          findings.push({
            title: 'Download e execução direta de script remoto',
            description: `Um step do job "${jobName}" baixa e executa um script externo via pipe (curl|bash).`,
            severity: 'high',
            file: workflowName,
            reference: 'https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions',
            reason: 'curl | bash é uma prática extremamente arriscada. O script remoto pode ser alterado para executar código malicioso.',
            suggestion: 'Baixe o script, verifique o checksum SHA256, e só então execute. Ou use uma GitHub Action verificada em vez de scripts externos.',
          });
          break;
        }
      }
    }
  }

  return findings;
}

module.exports = { checkDangerousPatterns };
