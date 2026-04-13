# CodeSentinel

Ferramenta de auditoria de segurança para repositórios GitHub. Conecta ao seu repo, lê os arquivos de configuração e gera um relatório com os problemas encontrados e como corrigir cada um.

Fiz esse projeto pra aprender mais sobre segurança em pipelines de CI/CD e praticar full-stack com Node e React. Acabou ficando funcional de verdade, então resolvi deixar público.

![preview](https://i.imgur.com/placeholder.png)

---

## O que ele faz

- Conecta a qualquer repositório público ou privado do GitHub
- Analisa arquivos de workflow do GitHub Actions (`.github/workflows`)
- Analisa `package.json`, `Dockerfile`, `docker-compose.yml`, `.env` e `requirements.txt`
- Gera um score de 0 a 100 com base nos problemas encontrados
- Mostra o que foi detectado, por que é um risco e como corrigir
- Abre uma issue no GitHub com o relatório completo
- Gráfico de evolução do score ao longo dos scans
- Badge de segurança pra colocar no README do seu projeto
- Modo demo em `/demo` sem precisar criar conta

---

## Stack

- **Frontend:** React + Vite + React Router + Recharts
- **Backend:** Node.js + Express
- **Banco:** PostgreSQL via Supabase + Prisma
- **Auth:** JWT + bcrypt
- **Integração:** GitHub REST API

---

## Rodando localmente

### Pré-requisitos

- Node.js 18+
- Conta no [Supabase](https://supabase.com) (free tier funciona)

### 1. Clone

```bash
git clone https://github.com/seuusuario/codesentinel.git
cd codesentinel
```

### 2. Configure o banco

Crie um projeto no Supabase e vá em **Settings → Database → Connection String → URI**.

Execute o SQL abaixo no **SQL Editor** do Supabase para criar as tabelas:

```sql
create table if not exists users (
  id text primary key default gen_random_uuid()::text,
  email text unique not null,
  password text not null,
  name text not null,
  github_token text,
  created_at timestamp with time zone default now()
);

create table if not exists repositories (
  id text primary key default gen_random_uuid()::text,
  user_id text not null references users(id) on delete cascade,
  owner text not null,
  name text not null,
  full_name text not null,
  url text not null,
  private boolean default false,
  webhook_id text,
  created_at timestamp with time zone default now(),
  unique(user_id, full_name)
);

create table if not exists analyses (
  id text primary key default gen_random_uuid()::text,
  repository_id text not null references repositories(id) on delete cascade,
  score integer not null,
  total_findings integer default 0,
  critical_count integer default 0,
  high_count integer default 0,
  medium_count integer default 0,
  low_count integer default 0,
  status text default 'completed',
  created_at timestamp with time zone default now()
);

create table if not exists findings (
  id text primary key default gen_random_uuid()::text,
  analysis_id text not null references analyses(id) on delete cascade,
  title text not null,
  description text not null,
  severity text not null,
  file text not null,
  reference text,
  reason text not null,
  suggestion text not null,
  created_at timestamp with time zone default now()
);

create table if not exists issue_logs (
  id text primary key default gen_random_uuid()::text,
  analysis_id text not null references analyses(id) on delete cascade,
  issue_url text not null,
  issue_number integer not null,
  created_at timestamp with time zone default now()
);
```

### 3. Configure o backend

```bash
cd backend
cp .env.example .env
```

Preencha o `.env`:

```env
DATABASE_URL="postgresql://postgres:[SENHA]@db.[REF].supabase.co:5432/postgres"
DIRECT_URL="postgresql://postgres:[SENHA]@db.[REF].supabase.co:5432/postgres"
JWT_SECRET="uma-string-longa-qualquer"
PORT=3001
FRONTEND_URL="http://localhost:5173"
```

```bash
npm install
npx prisma generate
npm run dev
```

### 4. Configure o frontend

```bash
cd frontend
npm install
npm run dev
```

Acesse `http://localhost:5173`.

---

## Token do GitHub

Para conectar repositórios você precisa de um Personal Access Token com escopo `repo`.

Gere em: [github.com/settings/tokens/new](https://github.com/settings/tokens/new)

---

## O que é analisado

### GitHub Actions (`.github/workflows`)
| Problema | Severidade |
|---|---|
| `permissions: write-all` no workflow | Crítica |
| Script injection via `${{ github.event.* }}` em scripts | Crítica |
| `pull_request_target` com checkout do código do PR | Crítica |
| Secret ecoado com `echo` nos logs | Crítica |
| Action com referência mutável (`@main`, `@master`) | Alta |
| Job com `permissions: write-all` | Alta |
| Secret passado direto em curl/wget | Alta |
| `pull_request_target` sem checkout | Alta |
| Action externa com só versão major (`@v3`) | Média |
| Secrets expostos como variáveis globais | Média |
| Inputs do `workflow_dispatch` usados em scripts | Média |
| Self-hosted runner | Média |

### package.json
- Dependências sem versão fixada (`*`, `latest`)
- Pacotes com histórico de comprometimento (event-stream, ua-parser-js, etc.)
- Scripts `postinstall` suspeitos
- `curl | bash` em scripts npm

### Dockerfile
- Imagem base sem tag ou com `latest`
- Container rodando como root (sem `USER`)
- Secrets em `ARG` ou `ENV`
- `ADD` com URL externa
- `RUN curl | bash`
- `COPY` de arquivos `.env` ou chaves privadas
- Sem `HEALTHCHECK`

### docker-compose.yml
- `privileged: true`
- Docker socket montado (`/var/run/docker.sock`)
- Senhas hardcoded em variáveis de ambiente
- Porta SSH (22) exposta
- Sem limites de recursos
- `network_mode: host`

### Arquivos .env
- `.env` commitado no repositório
- Credenciais reais de AWS, GitHub, Stripe, banco de dados, etc.

### requirements.txt
- Dependências Python sem versão fixada
- PyYAML vulnerável a execução de código
- Django, Flask, Pillow com versões antigas

---

## Estrutura

```
codesentinel/
├── backend/
│   ├── src/
│   │   ├── server.js
│   │   ├── auth/
│   │   ├── repos/
│   │   ├── analyses/
│   │   │   └── engine/
│   │   │       └── rules/      # uma regra por arquivo
│   │   ├── github/
│   │   ├── email/
│   │   ├── profile/
│   │   └── webhooks/
│   └── prisma/
│       └── schema.prisma
└── frontend/
    └── src/
        ├── pages/
        ├── components/
        ├── hooks/
        └── api/
```

---

## Endpoints

```
POST  /api/auth/register
POST  /api/auth/login

GET   /api/repos
POST  /api/repos
GET   /api/repos/:id
DEL   /api/repos/:id
POST  /api/repos/:id/analyze
GET   /api/repos/:id/analyses

GET   /api/analyses/:id
GET   /api/analyses/:id/compare
POST  /api/analyses/:id/create-issue

GET   /api/profile
PATCH /api/profile
PATCH /api/profile/password
PATCH /api/profile/token

GET   /api/badge/:repoId        (público, sem auth)
```

---

## Licença

MIT
