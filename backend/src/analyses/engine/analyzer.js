const yaml = require('js-yaml');

const { checkPermissions }       = require('./rules/permissions.rule');
const { checkVersionPinning }    = require('./rules/version-pinning.rule');
const { checkSecrets }           = require('./rules/secrets.rule');
const { checkDangerousPatterns } = require('./rules/dangerous-patterns.rule');
const { checkPackageJson }       = require('./rules/package-json.rule');
const { checkDockerfile }        = require('./rules/dockerfile.rule');
const { checkDockerCompose }     = require('./rules/docker-compose.rule');
const { checkEnvFile, checkGitignore } = require('./rules/env-files.rule');
const { checkRequirementsTxt }   = require('./rules/requirements.rule');

const PESOS = { critical: 30, high: 15, medium: 7, low: 3 };

function analyzeAll(arquivos) {
  const findings = [];
  const arquivosAnalisados = [];

  if (arquivos.workflows?.length > 0) {
    arquivosAnalisados.push(`${arquivos.workflows.length} workflow(s)`);
    for (const file of arquivos.workflows) {
      let parsed;
      try {
        parsed = yaml.load(file.content);
      } catch {
        findings.push({
          title: 'YAML inválido no arquivo de workflow',
          description: `O arquivo "${file.name}" não pôde ser interpretado como YAML válido.`,
          severity: 'medium',
          file: file.name,
          reference: 'https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions',
          reason: 'YAML inválido faz o workflow falhar ao ser executado.',
          suggestion: 'Valide a sintaxe em https://www.yamllint.com.',
        });
        continue;
      }
      if (!parsed || typeof parsed !== 'object') continue;
      findings.push(
        ...checkPermissions(file.name, file.content, parsed),
        ...checkVersionPinning(file.name, file.content, parsed),
        ...checkSecrets(file.name, file.content, parsed),
        ...checkDangerousPatterns(file.name, file.content, parsed),
      );
    }
  }

  if (arquivos.packageJson) {
    arquivosAnalisados.push('package.json');
    findings.push(...checkPackageJson(arquivos.packageJson));
  }

  if (arquivos.dockerfile) {
    arquivosAnalisados.push('Dockerfile');
    findings.push(...checkDockerfile(arquivos.dockerfile));
  }

  if (arquivos.dockerCompose) {
    arquivosAnalisados.push('docker-compose.yml');
    findings.push(...checkDockerCompose(arquivos.dockerCompose));
  }

  if (arquivos.envFiles?.length > 0) {
    for (const envFile of arquivos.envFiles) {
      arquivosAnalisados.push(envFile.name);
      findings.push(...checkEnvFile(envFile));
    }
  }

  if (arquivos.requirementsTxt) {
    arquivosAnalisados.push('requirements.txt');
    findings.push(...checkRequirementsTxt(arquivos.requirementsTxt));
  }

  if (arquivos.gitignore) {
    findings.push(...checkGitignore(arquivos.gitignore));
  }

  if (arquivosAnalisados.length === 0) {
    findings.push({
      title: 'Nenhum arquivo monitorado encontrado',
      description: 'Não foram encontrados workflows, Dockerfile, package.json ou outros arquivos monitorados.',
      severity: 'low',
      file: '/',
      reference: 'https://docs.github.com/en/actions/using-workflows',
      reason: 'Sem arquivos de configuração, não é possível verificar a segurança do pipeline.',
      suggestion: 'Configure GitHub Actions em .github/workflows/ ou adicione um Dockerfile/package.json.',
    });
  }

  const score = Math.max(0, 100 - findings.reduce((sum, f) => sum + (PESOS[f.severity] || 0), 0));

  return {
    score,
    totalFindings: findings.length,
    criticalCount: findings.filter(f => f.severity === 'critical').length,
    highCount:     findings.filter(f => f.severity === 'high').length,
    mediumCount:   findings.filter(f => f.severity === 'medium').length,
    lowCount:      findings.filter(f => f.severity === 'low').length,
    findings,
    arquivosAnalisados,
  };
}

function analyzeWorkflows(workflowFiles) {
  return analyzeAll({ workflows: workflowFiles });
}

module.exports = { analyzeAll, analyzeWorkflows };
