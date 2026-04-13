function checkSecrets(workflowName, workflowContent, parsedYaml) {
  const findings = [];

  if (!parsedYaml.jobs) return findings;

  for (const [jobName, job] of Object.entries(parsedYaml.jobs)) {
    if (!job || !job.steps) continue;

    for (const step of job.steps) {
      if (!step) continue;

      if (step.run && typeof step.run === 'string') {
        // Secret ecoado nos logs
        if (/echo\s+.*\$\{\{\s*secrets\./gi.test(step.run)) {
          findings.push({
            title: 'Valor de secret pode estar sendo impresso nos logs',
            description: `O step "${step.name || 'sem nome'}" no job "${jobName}" parece ecoar um secret, o que pode expô-lo nos logs do workflow.`,
            severity: 'critical',
            file: workflowName,
            reference: 'https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions#accessing-secrets',
            reason: 'Imprimir secrets nos logs é um problema grave de segurança. Mesmo secrets mascarados podem ser reconstruídos a partir de saídas parciais.',
            suggestion: 'Nunca use echo com secrets. Passe secrets como variáveis de ambiente para os comandos em vez de usá-los diretamente.',
          });
        }

        // Secret passado direto em curl/wget
        if (/(curl|wget).*\$\{\{\s*secrets\./gi.test(step.run)) {
          findings.push({
            title: 'Secret usado diretamente em requisição de rede',
            description: `O step "${step.name || 'sem nome'}" no job "${jobName}" passa um secret diretamente para curl/wget.`,
            severity: 'high',
            file: workflowName,
            reference: 'https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions',
            reason: 'Secrets em argumentos de linha de comando podem aparecer em listagens de processos e no histórico do shell.',
            suggestion: 'Passe secrets como variáveis de ambiente: env: MY_TOKEN: ${{ secrets.MY_TOKEN }} e use $MY_TOKEN nos comandos.',
          });
        }
      }

      // Muitos secrets em um único step
      if (step.env) {
        const secretsNoEnv = Object.entries(step.env).filter(
          ([, val]) => typeof val === 'string' && val.includes('secrets.')
        );
        if (secretsNoEnv.length > 5) {
          findings.push({
            title: `Muitos secrets expostos no step "${step.name || 'sem nome'}"`,
            description: `${secretsNoEnv.length} secrets estão expostos como variáveis de ambiente em um único step.`,
            severity: 'low',
            file: workflowName,
            reference: 'https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions',
            reason: 'Expor muitos secrets em um único step aumenta o risco caso o step ou a action seja comprometida.',
            suggestion: 'Passe apenas os secrets estritamente necessários para cada step.',
          });
        }
      }
    }
  }

  // Secrets globais no workflow
  if (parsedYaml.env) {
    const secretsGlobais = Object.entries(parsedYaml.env).filter(
      ([, val]) => typeof val === 'string' && val.includes('secrets.')
    );
    if (secretsGlobais.length > 0) {
      findings.push({
        title: 'Secrets expostos como variáveis de ambiente globais',
        description: `${secretsGlobais.length} secret(s) definido(s) globalmente (${secretsGlobais.map(([k]) => k).join(', ')}), disponíveis para todos os steps e jobs.`,
        severity: 'medium',
        file: workflowName,
        reference: 'https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#env',
        reason: 'Secrets globais ficam disponíveis para todos os steps e todas as actions, incluindo terceiros. Isso viola o princípio do menor privilégio.',
        suggestion: 'Mova os secrets para os steps ou jobs específicos que precisam deles.',
      });
    }
  }

  return findings;
}

module.exports = { checkSecrets };
