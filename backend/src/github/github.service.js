const axios = require('axios');

function getClient(token) {
  return axios.create({
    baseURL: 'https://api.github.com',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
}

async function getRepo(token, owner, repo) {
  try {
    const { data } = await getClient(token).get(`/repos/${owner}/${repo}`);
    return data;
  } catch (err) {
    if (err.response?.status === 404) {
      throw { status: 404, message: `Repositório ${owner}/${repo} não encontrado ou sem acesso.` };
    }
    if (err.response?.status === 401) {
      throw { status: 401, message: 'Token GitHub inválido ou sem permissão.' };
    }
    throw { status: 400, message: 'Falha ao buscar repositório no GitHub.' };
  }
}

async function getFile(client, owner, repo, path) {
  try {
    const { data } = await client.get(`/repos/${owner}/${repo}/contents/${path}`);
    if (data.encoding === 'base64') {
      return {
        name: data.name,
        path: data.path,
        content: Buffer.from(data.content, 'base64').toString('utf-8'),
      };
    }
    return null;
  } catch {
    return null;
  }
}

async function listDir(client, owner, repo, path) {
  try {
    const { data } = await client.get(`/repos/${owner}/${repo}/contents/${path}`);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function getWorkflowFiles(token, owner, repo) {
  const client = getClient(token);
  const files = await listDir(client, owner, repo, '.github/workflows');
  const yamlFiles = files.filter(f => f.name.endsWith('.yml') || f.name.endsWith('.yaml'));
  const contents = await Promise.all(yamlFiles.map(f => getFile(client, owner, repo, f.path)));
  return contents.filter(Boolean);
}

async function getAllSecurityFiles(token, owner, repo) {
  const client = getClient(token);

  const rootFiles = [
    'package.json', 'Dockerfile', 'dockerfile',
    'docker-compose.yml', 'docker-compose.yaml',
    '.env', '.env.example', '.env.sample', '.env.local',
    'requirements.txt', 'requirements-dev.txt',
    '.gitignore', 'Pipfile',
  ];

  const [rootResults, workflows, extraDockerfiles] = await Promise.all([
    Promise.all(rootFiles.map(f => getFile(client, owner, repo, f))),
    getWorkflowFiles(token, owner, repo),
    Promise.all([
      getFile(client, owner, repo, 'docker/Dockerfile'),
      getFile(client, owner, repo, 'build/Dockerfile'),
    ]),
  ]);

  const result = {
    workflows,
    packageJson: null,
    dockerfile: null,
    dockerCompose: null,
    envFiles: [],
    requirementsTxt: null,
    gitignore: null,
  };

  for (const file of rootResults.filter(Boolean)) {
    const name = file.name.toLowerCase();
    if (name === 'package.json')              result.packageJson = file;
    else if (name === 'dockerfile')           result.dockerfile = file;
    else if (name.startsWith('docker-compose')) result.dockerCompose = file;
    else if (name.startsWith('.env'))         result.envFiles.push(file);
    else if (name.includes('requirements'))  result.requirementsTxt = file;
    else if (name === '.gitignore')           result.gitignore = file;
  }

  if (!result.dockerfile) {
    result.dockerfile = extraDockerfiles.find(Boolean) || null;
  }

  return result;
}

async function createIssue(token, owner, repo, title, body) {
  try {
    const { data } = await getClient(token).post(`/repos/${owner}/${repo}/issues`, {
      title,
      body,
      labels: ['security', 'codesentinel'],
    });
    return { url: data.html_url, number: data.number };
  } catch {
    throw { status: 400, message: 'Falha ao criar issue. Verifique se o token tem escopo repo.' };
  }
}

module.exports = { getRepo, getWorkflowFiles, getAllSecurityFiles, createIssue };
