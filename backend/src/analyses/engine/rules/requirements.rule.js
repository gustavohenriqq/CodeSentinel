// Pacotes Python com vulnerabilidades conhecidas ou histórico perigoso
const PACOTES_VULNERAVEIS = {
  'django': { versaoSegura: '4.2.0', descricao: 'Versões anteriores à 4.2 têm várias CVEs críticas.' },
  'flask': { versaoSegura: '2.3.0', descricao: 'Versões anteriores têm vulnerabilidades de XSS e CSRF.' },
  'requests': { versaoSegura: '2.31.0', descricao: 'Versões antigas têm vulnerabilidades de SSL/TLS.' },
  'pillow': { versaoSegura: '10.0.0', descricao: 'Versões antigas têm múltiplas CVEs de execução de código.' },
  'cryptography': { versaoSegura: '41.0.0', descricao: 'Versões antigas têm vulnerabilidades no backend OpenSSL.' },
  'pyyaml': { versaoSegura: '6.0', descricao: 'Versões < 6.0 permitem execução de código via yaml.load().' },
  'urllib3': { versaoSegura: '2.0.0', descricao: 'Versões antigas têm vulnerabilidades de header injection.' },
  'werkzeug': { versaoSegura: '3.0.0', descricao: 'Versões antigas têm vulnerabilidades no debugger.' },
  'paramiko': { versaoSegura: '3.0.0', descricao: 'Versões antigas têm vulnerabilidades de autenticação SSH.' },
  'lxml': { versaoSegura: '4.9.3', descricao: 'Versões antigas têm vulnerabilidades de XXE e injeção de XML.' },
};

function parseVersao(versaoStr) {
  if (!versaoStr) return null;
  // Remove operadores semânticos e pega só os números
  const match = versaoStr.match(/(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!match) return null;
  return {
    major: parseInt(match[1]),
    minor: parseInt(match[2]),
    patch: parseInt(match[3] || 0),
  };
}

function versaoMenorQue(v1, v2) {
  if (!v1 || !v2) return false;
  if (v1.major !== v2.major) return v1.major < v2.major;
  if (v1.minor !== v2.minor) return v1.minor < v2.minor;
  return v1.patch < v2.patch;
}

function checkRequirementsTxt(file) {
  const findings = [];
  const linhas = file.content.split('\n');

  const semVersao = [];
  const versaoFlutuante = [];

  for (const linha of linhas) {
    const trimada = linha.trim();

    // Ignora comentários, vazias e opções (-r, --index-url, etc.)
    if (!trimada || trimada.startsWith('#') || trimada.startsWith('-')) continue;

    // Extrai nome e versão
    const matchExato = trimada.match(/^([a-zA-Z0-9_.-]+)\s*==\s*([^\s;]+)/);
    const matchOperador = trimada.match(/^([a-zA-Z0-9_.-]+)\s*([><=!~]+)\s*([^\s;,]+)/);
    const nomeSemVersao = trimada.match(/^([a-zA-Z0-9_.-]+)\s*$/);

    if (nomeSemVersao) {
      semVersao.push(nomeSemVersao[1]);
    } else if (!matchExato && matchOperador) {
      // Tem operador mas não é == (ex: >=, ~=)
      const operador = matchOperador[2];
      if (operador === '>=' || operador === '~=' || operador === '^') {
        versaoFlutuante.push(trimada);
      }
    }

    // Verifica pacotes conhecidamente vulneráveis
    if (matchExato) {
      const nomePacote = matchExato[1].toLowerCase();
      const versaoAtual = parseVersao(matchExato[2]);
      const info = PACOTES_VULNERAVEIS[nomePacote];

      if (info) {
        const versaoSegura = parseVersao(info.versaoSegura);
        if (versaoMenorQue(versaoAtual, versaoSegura)) {
          findings.push({
            title: `${nomePacote} com versão potencialmente vulnerável (${matchExato[2]})`,
            description: `O pacote ${nomePacote}==${matchExato[2]} pode ter vulnerabilidades conhecidas. ${info.descricao}`,
            severity: 'high',
            file: file.name,
            reference: `https://pypi.org/project/${nomePacote}/#history`,
            reason: info.descricao,
            suggestion: `Atualize para ${nomePacote}>=${info.versaoSegura} e execute pip audit para verificar vulnerabilidades.`,
          });
        }
      }
    }
  }

  // Dependências sem versão fixada
  if (semVersao.length > 0) {
    findings.push({
      title: `${semVersao.length} dependência(s) Python sem versão fixada`,
      description: `Os pacotes ${semVersao.slice(0, 5).join(', ')}${semVersao.length > 5 ? ` e mais ${semVersao.length - 5}` : ''} não têm versão especificada.`,
      severity: 'medium',
      file: file.name,
      reference: 'https://pip.pypa.io/en/stable/reference/requirements-file-format/',
      reason: 'Sem versão fixada, pip instala sempre a versão mais recente, que pode ter breaking changes ou vulnerabilidades introduzidas.',
      suggestion: 'Execute pip freeze > requirements.txt para fixar as versões exatas. Use pip-compile do pip-tools para gerenciamento de dependências transitivas.',
    });
  }

  // pyyaml sem versão segura é especialmente perigoso
  const temPyyamlInseguro = linhas.some(l => {
    const m = l.trim().match(/^pyyaml\s*==\s*([^\s;]+)/i);
    if (!m) return false;
    const v = parseVersao(m[1]);
    return versaoMenorQue(v, { major: 6, minor: 0, patch: 0 });
  });

  if (temPyyamlInseguro) {
    findings.push({
      title: 'PyYAML com versão vulnerável a execução de código',
      description: 'Versões do PyYAML anteriores à 6.0 permitem execução arbitrária de código via yaml.load() sem Loader.',
      severity: 'critical',
      file: file.name,
      reference: 'https://pyyaml.org/wiki/PyYAMLDocumentation',
      reason: 'yaml.load() em versões antigas executa código Python arbitrário presente no YAML. Isso é uma vulnerabilidade crítica se o YAML vier de fontes não confiáveis.',
      suggestion: 'Atualize para pyyaml>=6.0 e substitua yaml.load(data) por yaml.safe_load(data) em todo o código.',
    });
  }

  return findings;
}

module.exports = { checkRequirementsTxt };
