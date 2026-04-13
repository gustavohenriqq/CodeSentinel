function checkVersionPinning(workflowName, workflowContent, parsedYaml) {
  const findings = [];

  if (!parsedYaml.jobs) return findings;

  const mutableRefs = ['@main', '@master', '@HEAD', '@latest', '@dev', '@trunk', '@next'];

  for (const [jobName, job] of Object.entries(parsedYaml.jobs)) {
    if (!job || !job.steps) continue;

    for (const step of job.steps) {
      if (!step || !step.uses) continue;

      const action = step.uses;

      // Ignora actions locais (./ e docker://)
      if (action.startsWith('./') || action.startsWith('docker://')) continue;

      // 1. Referência mutável (main, master, etc.)
      const hasMutableRef = mutableRefs.some(ref => action.toLowerCase().endsWith(ref.toLowerCase()));
      if (hasMutableRef) {
        findings.push({
          title: `Action "${action}" usa referência mutável`,
          description: `A action no job "${jobName}" está apontando para uma branch mutável. O código pode mudar a qualquer momento sem aviso.`,
          severity: 'high',
          file: workflowName,
          reference: 'https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions#using-third-party-actions',
          reason: 'Referências mutáveis como @main permitem que o mantenedor (ou um atacante) altere silenciosamente o código que roda no seu workflow.',
          suggestion: `Fixe em um commit SHA completo: ${action.split('@')[0]}@<sha-completo-do-commit>`,
        });
        continue;
      }

      const ref = action.split('@')[1] || '';
      const isExternal = !action.startsWith('actions/') && !action.startsWith('github/');

      // 2. Action externa com só versão major (@v1, @v2, @v3...)
      if (isExternal && /^v\d+$/.test(ref)) {
        findings.push({
          title: `Action externa "${action}" usa apenas versão major`,
          description: `A action usa a tag @${ref} que pode ser movida pelo mantenedor para incluir mudanças não anunciadas.`,
          severity: 'medium',
          file: workflowName,
          reference: 'https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions#using-third-party-actions',
          reason: 'Tags de versão major são ponteiros mutáveis. Mantenedores podem movê-las para novos commits.',
          suggestion: `Considere fixar "${action}" a um SHA completo para builds determinísticos e seguros.`,
        });
        continue;
      }

      // 3. Actions oficiais (actions/*) com versão major — aviso mais suave
      if (action.startsWith('actions/') && /^v\d+$/.test(ref)) {
        findings.push({
          title: `Action oficial "${action}" usa versão major`,
          description: `Mesmo actions oficiais do GitHub com tags @v1, @v2, etc. podem receber atualizações inesperadas.`,
          severity: 'low',
          file: workflowName,
          reference: 'https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions#using-third-party-actions',
          reason: 'Tags major são mutáveis. Para builds totalmente reproduzíveis, SHA é mais seguro.',
          suggestion: `Para máxima segurança, fixe "${action}" a um SHA completo.`,
        });
      }
    }
  }

  return findings;
}

module.exports = { checkVersionPinning };
