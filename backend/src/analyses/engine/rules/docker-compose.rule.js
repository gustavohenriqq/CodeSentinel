const yaml = require('js-yaml');

function checkDockerCompose(file) {
  const findings = [];
  let compose;

  try {
    compose = yaml.load(file.content);
  } catch {
    findings.push({
      title: 'docker-compose.yml com YAML inválido',
      description: 'O arquivo docker-compose não pôde ser interpretado como YAML válido.',
      severity: 'medium',
      file: file.name,
      reference: 'https://docs.docker.com/compose/compose-file/',
      reason: 'YAML inválido impede que o docker-compose suba corretamente.',
      suggestion: 'Valide a sintaxe em https://www.yamllint.com ou use docker-compose config para verificar.',
    });
    return findings;
  }

  if (!compose || !compose.services) return findings;

  for (const [nomeServico, servico] of Object.entries(compose.services)) {
    if (!servico) continue;

    // 1. Modo privilegiado
    if (servico.privileged === true) {
      findings.push({
        title: `Serviço "${nomeServico}" roda em modo privilegiado`,
        description: `O serviço "${nomeServico}" tem privileged: true, concedendo acesso total ao host.`,
        severity: 'critical',
        file: file.name,
        reference: 'https://docs.docker.com/compose/compose-file/compose-file-v3/#domainname-hostname-ipc-mac_address-privileged-read_only-shm_size-stdin_open-tty-user-working_dir',
        reason: 'Modo privilegiado remove todas as proteções de segurança do container. O processo tem acesso root ao host, podendo escapar do container.',
        suggestion: `Remova "privileged: true" do serviço "${nomeServico}". Se precisar de capacidades específicas, use a opção "cap_add" com apenas o necessário.`,
      });
    }

    // 2. Monta o socket do Docker (/var/run/docker.sock)
    const volumes = servico.volumes || [];
    const montaDockerSocket = volumes.some(v => {
      const vol = typeof v === 'string' ? v : v.source || '';
      return vol.includes('/var/run/docker.sock');
    });
    if (montaDockerSocket) {
      findings.push({
        title: `Serviço "${nomeServico}" monta o Docker socket`,
        description: `O serviço "${nomeServico}" monta /var/run/docker.sock, dando controle total do Docker ao container.`,
        severity: 'critical',
        file: file.name,
        reference: 'https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html',
        reason: 'Acesso ao Docker socket é equivalente a acesso root no host. Qualquer processo dentro do container pode criar novos containers, montar o sistema de arquivos do host, etc.',
        suggestion: 'Evite montar o Docker socket. Se necessário para CI/CD, use ferramentas como Kaniko, Buildah ou DinD (Docker-in-Docker) de forma controlada.',
      });
    }

    // 3. Secrets ou senhas em variáveis de ambiente hardcoded
    const envVars = servico.environment || {};
    const envArray = Array.isArray(envVars) ? envVars : Object.entries(envVars).map(([k, v]) => `${k}=${v}`);

    const padroesSensiveis = /\b(password|passwd|secret|api_key|apikey|token|private_key|database_url|db_pass)\s*=/i;

    for (const env of envArray) {
      const envStr = String(env);
      if (padroesSensiveis.test(envStr) && !envStr.endsWith('=') && !envStr.includes('${')) {
        // Tem valor hardcoded (não está vazio nem usando variável de ambiente)
        findings.push({
          title: `Secret hardcoded em variável de ambiente do serviço "${nomeServico}"`,
          description: `Uma variável de ambiente sensível tem valor fixo no docker-compose: ${envStr.split('=')[0]}=***`,
          severity: 'high',
          file: file.name,
          reference: 'https://docs.docker.com/compose/use-secrets/',
          reason: 'Senhas e tokens hardcoded no docker-compose ficam expostos para qualquer um com acesso ao repositório ou ao arquivo.',
          suggestion: 'Use variáveis de ambiente do sistema: DB_PASSWORD=${DB_PASSWORD} ou use Docker secrets para dados sensíveis.',
        });
        break;
      }
    }

    // 4. Porta 22 (SSH) exposta publicamente
    const ports = servico.ports || [];
    for (const porta of ports) {
      const portaStr = String(typeof porta === 'object' ? porta.published || '' : porta);
      if (/^(0\.0\.0\.0:)?22[:\/]/.test(portaStr) || portaStr === '22') {
        findings.push({
          title: `Serviço "${nomeServico}" expõe porta SSH (22) publicamente`,
          description: `A porta 22 está mapeada para o host, expondo SSH à rede.`,
          severity: 'high',
          file: file.name,
          reference: 'https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html',
          reason: 'Expor SSH diretamente via Docker pode contornar firewalls e expor o serviço à internet.',
          suggestion: 'Bind na interface local: "127.0.0.1:22:22" ou use um bastion host para acesso SSH.',
        });
      }
    }

    // 5. Sem limits de recursos (pode causar DoS)
    const temLimits = servico.deploy?.resources?.limits || servico.mem_limit || servico.cpus;
    if (!temLimits) {
      findings.push({
        title: `Serviço "${nomeServico}" sem limite de recursos`,
        description: `O serviço "${nomeServico}" não tem limites de CPU ou memória definidos.`,
        severity: 'low',
        file: file.name,
        reference: 'https://docs.docker.com/compose/compose-file/compose-file-v3/#resources',
        reason: 'Sem limites, um único container pode consumir todos os recursos do host causando indisponibilidade dos demais serviços.',
        suggestion: `Adicione limites ao serviço "${nomeServico}":\ndeploy:\n  resources:\n    limits:\n      cpus: "0.5"\n      memory: 512M`,
      });
    }

    // 6. network_mode: host
    if (servico.network_mode === 'host') {
      findings.push({
        title: `Serviço "${nomeServico}" usa network_mode: host`,
        description: `O serviço "${nomeServico}" compartilha a pilha de rede do host (network_mode: host).`,
        severity: 'high',
        file: file.name,
        reference: 'https://docs.docker.com/network/host/',
        reason: 'network_mode: host remove o isolamento de rede do container. O container pode acessar e escutar em qualquer porta do host.',
        suggestion: 'Use a rede padrão bridge ou crie redes Docker dedicadas. Exponha apenas as portas necessárias.',
      });
    }
  }

  return findings;
}

module.exports = { checkDockerCompose };
