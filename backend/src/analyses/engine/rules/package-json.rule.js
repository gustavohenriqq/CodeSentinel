const PACOTES_PERIGOSOS = {
  'event-stream': 'Sofreu ataque de supply chain em 2018 com código malicioso injetado.',
  'flatmap-stream': 'Payload malicioso injetado via event-stream.',
  'eslint-scope': 'Versão 3.7.2 continha código que roubava tokens npm.',
  'getcookies': 'Continha backdoor para roubo de dados.',
  'node-ipc': 'Versões 10.1.1 e 10.1.2 continham código destrutivo (protestware).',
  'peacenotwar': 'Módulo malicioso inserido como dependência do node-ipc.',
  'colors': 'Versão 1.4.1+ propositalmente quebrada pelo autor (protestware).',
  'faker': 'Versão 6.6.6 propositalmente quebrada pelo autor (protestware).',
  'ua-parser-js': 'Versões 0.7.29, 0.8.0 e 1.0.0 continham malware.',
  'coa': 'Versões 2.0.3 e 2.0.4 continham malware.',
  'rc': 'Versão 1.2.9 continha malware.',
  'xz': 'Backdoor crítico descoberto em 2024.',
};

const SCRIPTS_SUSPEITOS = [
  { pattern: /curl\s+.*\|\s*(bash|sh)/i, titulo: 'Script npm faz download e execução de código remoto', severidade: 'critical' },
  { pattern: /wget\s+.*\|\s*(bash|sh)/i, titulo: 'Script npm faz download e execução de código remoto', severidade: 'critical' },
  { pattern: /eval\s*\(/i, titulo: 'Script npm usa eval()', severidade: 'high' },
  { pattern: /require\s*\(\s*['"`]child_process['"`]\s*\)/i, titulo: 'Script npm usa child_process', severidade: 'medium' },
  { pattern: /process\.env\.\w+\s*=\s*["'`]/i, titulo: 'Script npm modifica variáveis de ambiente', severidade: 'medium' },
];

function checkPackageJson(file) {
  const findings = [];
  let pkg;

  try {
    pkg = JSON.parse(file.content);
  } catch {
    findings.push({
      title: 'package.json inválido ou malformado',
      description: 'O arquivo package.json não pôde ser interpretado como JSON válido.',
      severity: 'medium',
      file: file.name,
      reference: 'https://docs.npmjs.com/cli/v9/configuring-npm/package-json',
      reason: 'Um package.json inválido pode causar falhas no build e comportamentos inesperados.',
      suggestion: 'Valide o JSON usando um linter ou https://jsonlint.com.',
    });
    return findings;
  }

  const todasDeps = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
    ...pkg.peerDependencies,
  };

  // 1. Pacotes conhecidamente perigosos
  for (const [pacote, motivo] of Object.entries(PACOTES_PERIGOSOS)) {
    if (todasDeps[pacote] !== undefined) {
      findings.push({
        title: `Dependência comprometida detectada: ${pacote}`,
        description: `O pacote "${pacote}" está listado como dependência. ${motivo}`,
        severity: 'critical',
        file: file.name,
        reference: 'https://socket.dev',
        reason: motivo,
        suggestion: `Remova "${pacote}" imediatamente e verifique se houve comprometimento do ambiente. Execute npm audit para ver vulnerabilidades adicionais.`,
      });
    }
  }

  // 2. Dependências com versão exata sem lock file (risco de substituição)
  const versoesFlutuantes = [];
  for (const [dep, versao] of Object.entries(pkg.dependencies || {})) {
    if (versao === '*' || versao === 'latest' || versao === 'x') {
      versoesFlutuantes.push(dep);
    }
  }
  if (versoesFlutuantes.length > 0) {
    findings.push({
      title: `${versoesFlutuantes.length} dependência(s) sem versão fixada`,
      description: `As dependências ${versoesFlutuantes.slice(0, 5).join(', ')}${versoesFlutuantes.length > 5 ? ` e mais ${versoesFlutuantes.length - 5}` : ''} usam "*", "latest" ou "x" como versão.`,
      severity: 'high',
      file: file.name,
      reference: 'https://docs.npmjs.com/about-semantic-versioning',
      reason: 'Versões flutuantes instalam automaticamente qualquer nova versão publicada, incluindo versões maliciosas ou com breaking changes.',
      suggestion: 'Use versões semânticas específicas (ex: "1.2.3" ou "^1.2.3") e mantenha um package-lock.json commitado no repositório.',
    });
  }

  // 3. Scripts suspeitos
  const scripts = pkg.scripts || {};
  for (const [nomeScript, comandoScript] of Object.entries(scripts)) {
    for (const { pattern, titulo, severidade } of SCRIPTS_SUSPEITOS) {
      if (pattern.test(comandoScript)) {
        findings.push({
          title: `${titulo} (script: ${nomeScript})`,
          description: `O script "${nomeScript}" contém um padrão potencialmente perigoso: ${comandoScript.slice(0, 120)}`,
          severity: severidade,
          file: file.name,
          reference: 'https://docs.npmjs.com/cli/v9/using-npm/scripts',
          reason: 'Scripts npm executam automaticamente em eventos como install, build e test. Código malicioso aqui afeta todos que instalam o pacote.',
          suggestion: 'Revise o script e substitua downloads dinâmicos por dependências versionadas e verificadas.',
        });
        break;
      }
    }
  }

  // 4. postinstall script (muito usado para malware)
  if (scripts.postinstall) {
    findings.push({
      title: 'Script postinstall definido no package.json',
      description: `O script postinstall executa automaticamente após npm install: "${scripts.postinstall.slice(0, 100)}"`,
      severity: 'medium',
      file: file.name,
      reference: 'https://docs.npmjs.com/cli/v9/using-npm/scripts#life-cycle-scripts',
      reason: 'Scripts postinstall são frequentemente usados em ataques de supply chain para executar código malicioso no ambiente de quem instala.',
      suggestion: 'Verifique se o postinstall é realmente necessário. Se for, documente claramente o que ele faz.',
    });
  }

  // 5. Sem campo "engines" (indica falta de controle de versão do Node)
  if (!pkg.engines && Object.keys(pkg.dependencies || {}).length > 5) {
    findings.push({
      title: 'Versão do Node.js não especificada em engines',
      description: 'O package.json não define o campo "engines" com a versão do Node.js requerida.',
      severity: 'low',
      file: file.name,
      reference: 'https://docs.npmjs.com/cli/v9/configuring-npm/package-json#engines',
      reason: 'Sem restrição de versão do Node, o projeto pode ser executado em versões desatualizadas com vulnerabilidades conhecidas.',
      suggestion: 'Adicione ao package.json: "engines": { "node": ">=18.0.0" } especificando a versão mínima suportada.',
    });
  }

  return findings;
}

module.exports = { checkPackageJson };
