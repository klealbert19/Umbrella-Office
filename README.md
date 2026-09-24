# Umbrella Office

**Umbrella Office** é um runtime de automação de escritório local-first, seguro e extensível para desenvolvedores. Ele fornece uma interface de linha de comando (CLI) e API programática para executar tarefas de filesystem, processos, npm e git dentro de workspaces isolados e seguros.

## Versão Atual: 0.3.2

### Novidades na V0.3.2
- **Distribuição Autocontida**: Eliminação do script `prepare` - artefatos de build (`dist/`) commitados no repositório
- **Instalação Limpa**: Sem avisos de "install scripts blocked" ao instalar via GitHub
- **Comando `umbrella`**: Binário global renomeado de `umbrella-office` para `umbrella`

### Novidades na V0.3.1
- **Instalação via GitHub**: Correção para instalação direta via `git+https://github.com/klealbert19/Umbrella-Office.git`

### Novidades na V0.3
- **Process Engine**: Execução segura de comandos shell com timeout, validação de cwd e captura de stdout/stderr
- **NPM Tool**: Gerenciamento de pacotes (install, run, test, build, exec) com detecção automática de package manager
- **Git Tool**: Operações Git completas (status, diff, log, branch, remote, add, commit, checkout) com validação de paths
- **Teste de Integração Real**: Fluxo completo validando workspace → scan → npm install/test/build → git status/diff/add/commit/log

---

## Instalação

O Umbrella Office é distribuído **diretamente via GitHub** (não depende do npm Registry):

```bash
# Instalação oficial via GitHub
npm install -g git+https://github.com/klealbert19/Umbrella-Office.git#master
```

Após a instalação, o comando `umbrella` estará disponível globalmente:

```bash
umbrella --version
umbrella --help
```

### Atualização

Para atualizar para a versão mais recente:

```bash
npm install -g git+https://github.com/klealbert19/Umbrella-Office.git#master
```

### Desenvolvimento Local

```bash
# Clone e build local
git clone https://github.com/klealbert19/Umbrella-Office
cd Umbrella-Office
npm install
npm run build
npm link
```

## Início Rápido

```bash
# Iniciar CLI interativo
umbrella

# Ou executar comando único (modo pipe)
echo 'workspace.open {"path": "/caminho/projeto"}' | umbrella
```

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                      OfficeRuntime                          │
│  (State Machine: INIT → READY → RUNNING → SHUTTING_DOWN)   │
└──────────────────────────┬──────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
┌─────────────────┐ ┌───────────────┐ ┌───────────────┐
│  TaskRouter     │ │PermissionMgr  │ │ ConfigManager │
│  (routes tasks) │ │(boundaries)   │ │(persistence)  │
└────────┬────────┘ └───────┬───────┘ └───────┬───────┘
         │                  │                 │
    ┌────┴────┐       ┌─────┴─────┐    ┌──────┴──────┐
    ▼         ▼       ▼           ▼    ▼             ▼
LocalExec  FS Engine  WorkspaceMgr  Scanner  ProcessTool
    │         │           │           │         │
    ▼         ▼           ▼           ▼         ▼
  spawn    read/write   open/close  detect    NpmTool
  cmds     edit/delete  scan        project   GitTool
```

### Componentes Principais

| Componente | Responsabilidade |
|------------|------------------|
| **OfficeRuntime** | Orquestrador principal, máquina de estados, ciclo de vida |
| **TaskRouter** | Roteia tasks para executores apropriados |
| **PermissionManager** | Boundaries de permissão por workspace |
| **ConfigManager** | Persistência em `~/.umbrella/config.json` + `state.json` |
| **FilesystemEngine** | Operações de arquivo seguras (read, write, edit, delete, list, mkdir) |
| **WorkspaceManager** | Gerencia workspace ativo, abertura/fechamento, scan |
| **ProjectScanner** | Detecta tipo de projeto, package manager, git |
| **ProcessTool** | Execução de processos com timeout e validação |
| **NpmTool** | Operações npm/yarn/pnpm via ProcessTool |
| **GitTool** | Operações git via ProcessTool |

---

## Segurança

### Contenção de Workspace
Todas as operações de filesystem, processo, npm e git são **contidas no workspace ativo**:

```typescript
// Validação de path (simplificada)
function ensureWithinWorkspace(targetPath: string): string {
  const resolved = path.resolve(targetPath);
  const realPath = fs.realpathSync(resolved); // Resolve symlinks
  const workspace = getActiveWorkspace();
  const workspaceReal = fs.realpathSync(workspace);
  
  const relative = path.relative(workspaceReal, realPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Path traversal attempt blocked');
  }
  return realPath;
}
```

### Proteções Implementadas
- ✅ Bloqueio de path traversal (`../`)
- ✅ Resolução de symlinks/junctions (Windows + Unix)
- ✅ Validação de cwd para processos
- ✅ Validação de paths para operações git
- ✅ Permissões granulares por tipo de operação

### Modelo de Permissões (V0.3)

| Permissão | Operações | Default |
|-----------|-----------|---------|
| `filesystem.read` | readFile, listDirectory | ✅ |
| `filesystem.write` | writeFile, createDirectory | ✅ |
| `filesystem.edit` | editFile | ✅ |
| `filesystem.delete` | deleteFile | ✅ |
| `workspace.open` | workspace.open | ✅ |
| `workspace.close` | workspace.close | ✅ |
| `workspace.scan` | workspace.scan | ✅ |
| `process.execute` | process.execute | ✅ |
| `npm.execute` | npm.install, run, test, build, exec | ✅ |
| `git.read` | git.status, diff, log, branch, remote | ✅ |
| `git.write` | git.add, commit, checkout | ✅ |

---

## CLI - Comandos Disponíveis

### Workspace
```bash
workspace.open <path>     # Abre workspace (persiste como ativo)
workspace.close           # Fecha workspace ativo
workspace.info            # Info do workspace ativo
workspace.scan            # Escaneia projeto (tipo, PM, git)
```

### Filesystem
```bash
fs.read <path>                    # Lê arquivo
fs.write <path> <content>         # Escreve arquivo (cria dirs)
fs.edit <path> <old> <new>        # Edita arquivo (substitui primeira ocorrência)
fs.delete <path>                  # Deleta arquivo
fs.list <path>                    # Lista diretório
fs.mkdir <path>                   # Cria diretório (recursivo)
```

### Process
```bash
process.exec <command> [args...]  # Executa comando com timeout (default 30s)
# Ex: process.exec node script.js
# Ex: process.exec npm test
```

### NPM
```bash
npm.install [package...]          # npm install (ou yarn/pnpm)
npm.run <script> [args...]        # npm run <script>
npm.test [args...]                # npm test
npm.build [args...]               # npm run build
npm.exec <command> [args...]      # npx <command>
```

### Git
```bash
git.status                        # git status --porcelain
git.diff [path]                   # git diff
git.log [options]                 # git log --oneline -10
git.branch [name]                 # git branch (lista ou cria)
git.remote [name] [url]           # git remote (lista ou adiciona)
git.add <paths...>                # git add <paths>
git.commit <message>              # git commit -m <message>
git.checkout <branch>             # git checkout <branch>
```

### Sistema
```bash
help                              # Mostra ajuda
version                           # Mostra versão
exit / quit                       # Sai do CLI
```

---

## API Programática

```typescript
import { OfficeRuntime } from '@umbrella/office';

const runtime = new OfficeRuntime();
await runtime.start();

// Abrir workspace
const result = await runtime.executeTask({
  type: 'workspace.open',
  payload: { path: '/caminho/projeto' }
});

// Executar npm test
const testResult = await runtime.executeTask({
  type: 'npm.test',
  payload: { args: ['--coverage'] }
});

// Executar comando arbitrário
const procResult = await runtime.executeTask({
  type: 'process.execute',
  payload: { 
    command: 'node', 
    args: ['build.js'],
    timeout: 60000 
  }
});

await runtime.shutdown();
```

---

## Configuração

Arquivos em `~/.umbrella/`:
- `config.json` - Configuração do usuário (nunca sobrescrito)
- `state.json` - Estado da sessão (workspace ativo, etc.)
- `logs/office.log` - Logs estruturados JSON

### Exemplo config.json
```json
{
  "version": 1,
  "office": {
    "defaultTimeout": 30000,
    "maxLogSize": 10485760
  },
  "orchestrator": {
    "autoSaveInterval": 5000
  }
}
```

---

## Desenvolvimento

### Scripts Disponíveis
```bash
npm run build       # Compila TypeScript (tsc)
npm run dev         # Executa com ts-node (watch)
npm run start       # Executa build compilado
npm run test        # Executa todos os testes (Jest)
npm run typecheck   # Verifica tipos (tsc --noEmit)
```

### Estrutura de Testes
```
tests/
├── config.test.ts          # ConfigManager
├── filesystem.test.ts      # FilesystemEngine
├── process.test.ts         # ProcessTool
├── npm.test.ts             # NpmTool
├── git.test.ts             # GitTool
├── workspace.test.ts       # WorkspaceManager
├── router-v2.test.ts       # TaskRouter V0.3
├── runtime.test.ts         # OfficeRuntime
├── task-v2.test.ts         # Task types V0.3
├── task.test.ts            # Task types V0.1/0.2
├── version.test.ts         # Version info
├── install.test.ts         # Installation flow
├── usage.test.ts           # CLI usage
└── integration.test.ts     # Fluxo E2E real
```

### Executar Testes
```bash
# Todos os testes (112 testes)
npm test

# Testes específicos
npm test -- --testPathPattern=process
npm test -- --testPathPattern=integration
```

---

## Roadmap

### V0.4 (Próximo)
- [ ] **Task Scheduler**: Agendamento de tasks recorrentes/cron
- [ ] **Webhook Server**: Receber eventos externos (GitHub, GitLab)
- [ ] **Plugin System**: Carregamento dinâmico de ferramentas customizadas
- [ ] **Remote Workspace**: SSH/WSL support para workspaces remotos

### V1.0 (Estável)
- [ ] API estável e documentada
- [ ] Binários nativos (pkg/nexe)
- [ ] Instaladores multiplataforma
- [ ] Telemetria opcional

---

## Licença

MIT License - veja [LICENSE](LICENSE) para detalhes.

---

## Contribuição

1. Fork o repositório
2. Crie branch: `git checkout -b feature/nova-funcionalidade`
3. Commit: `git commit -m 'feat: adiciona nova funcionalidade'`
4. Push: `git push origin feature/nova-funcionalidade`
5. Abra Pull Request

---

**Desenvolvido com ❤️ para desenvolvedores que valorizam automação local-first segura.**

Runtime local do ecossistema Umbrella. Nesta versão (V0.2) funciona **100% localmente e sem internet**.

## V0.2 — O que está implementado

- `OfficeRuntime` com estados `STARTING / ONLINE / STOPPING / STOPPED / ERROR`
- Versionamento centralizado (`0.2.0`, protocolo `1`, config `1`)
- Configuração em `~/.umbrella/` (criação automática, nunca sobrescreve sem necessidade)
- `state.json` com `lastVersion`, `lastStartedAt`, `lastShutdownAt`, `activeWorkspace`
- Infraestrutura de migrações (`migrations/`)
- `Task` / `TaskResult` com IDs e timestamps
- `TaskRouter` → `PermissionManager` → `LocalExecutor` / `FilesystemEngine` / `WorkspaceManager`
- `PermissionManager` com 11 permissões V0.2 (todas habilitadas por padrão):
  - `process.execute`
  - `filesystem.read`, `filesystem.write`, `filesystem.edit`, `filesystem.delete`
  - `directory.list`, `directory.create`
  - `workspace.open`, `workspace.close`, `workspace.read`, `workspace.scan`
- `LocalExecutor` com `spawn(command, args[])` — sem shell concatenado, compatível Windows
- `TunnelClient` (sempre `DISCONNECTED` na V0.2 — fronteira arquitetural)
- `UpdateManager` (infraestrutura; `checkForUpdates()` retorna `NOT_CONFIGURED`)
- **Filesystem Engine** — operações seguras de leitura/escrita/edição/exclusão de arquivos e listagem/criação de diretórios
  - `file.read` — retorna `path`, `content`, `size`, `encoding`, `modifiedAt`
  - `file.write` — cria arquivo, sobrescreve, cria diretórios-pai, não loga conteúdo
  - `file.edit` — substituição segura com `oldText`/`newText`, suporte `replaceAll`, retorna contagem
  - `file.delete` — apenas arquivos, valida workspace, não permite escapar
  - `directory.list` — entradas estruturadas: `name`, `relativePath`, `type`, `size`, `modifiedAt`
  - `directory.create` — recursivo, validado contra workspace
- **Workspace Manager** — controle de workspace ativo, persistência e segurança
  - `workspace.open <path>` — aceita absoluto/relativo, valida existência e tipo diretório
  - `workspace.info` / `workspace.current` — retorna `id`, `name`, `path`, `openedAt`
  - `workspace.close` — limpa estado, atualiza persistência
  - `workspace.scan` — delega para Project Scanner
  - Persistência automática no `state.json` (carrega na inicialização se ainda existir)
- **Project Scanner** — detecção de tipo de projeto (Node.js, TypeScript, Flutter, Python), gerenciador de pacotes e Git
  - Node.js → `package.json`
  - TypeScript → `tsconfig.json`
  - Flutter → `pubspec.yaml`
  - Python → `pyproject.toml` ou `requirements.txt`
  - Genérico → fallback se nenhum detectado
  - Package Manager Detection: `package-lock.json` (npm), `pnpm-lock.yaml` (pnpm), `yarn.lock` (yarn), `bun.lock`/`bun.lockb` (bun)
  - Git Detection: verifica existência de `.git`
  - Exclusões centralizadas: `node_modules`, `.git`, `dist`, `build`, `coverage`, `.next`, `.cache`, `.dart_tool`, `.idea`, `.vscode`
  - Limite de 1000 arquivos detalhados retornados
- **Segurança do Workspace** — proteção robusta contra path traversal
  - `path.resolve()` + `path.relative()` + `fs.realpathSync()` para validação
  - Bloqueia `..`, symlinks, junctions
  - Funciona no Windows e Unix-like
- CLI interativa (`help`, `status`, `version`, `config`, `run`, `exit`, `workspace open`, `workspace info`, `workspace current`, `workspace close`, `workspace scan`, `file read`, `file write`, `file edit`, `file delete`, `file list`, `file mkdir`)
- Logging em `~/.umbrella/logs/office.log` (operações, caminhos, tamanhos, resultados — sem conteúdo sensível)
- Testes automatizados cross-platform (Windows / Linux / macOS) — 78 testes passando

## Instalação

```bash
npm install
```

## Desenvolvimento

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Execução

```bash
npm start
```

Exemplo de sessão:

```
☂️ Umbrella Office
Version: 0.2.0
Status: LOCAL
Orchestrator: OFFLINE

office> status
Runtime: ONLINE
Mode: LOCAL
Tunnel: DISCONNECTED
Version: 0.2.0

office> version
Umbrella Office
Version: 0.2.0
Protocol: 1
Config: 1

office> run node --version
Task started...
v24.x.x
Task completed successfully.

office> workspace open .
Workspace opened successfully.

office> workspace scan
Scan completed successfully.

office> file write hello.txt hello world
File written successfully.

office> file read hello.txt
hello world

office> exit
Goodbye.
```

## Testes

```bash
npm test
```

## Typecheck

```bash
npm run typecheck
```

## Estrutura

```
umbrella-office/
├── src/
│   ├── main.ts                  # ponto de entrada
│   ├── core/
│   │   ├── version.ts           # versão centralizada
│   │   ├── office-runtime.ts    # runtime principal
│   │   ├── task.ts              # abstração Task V0.1
│   │   ├── task-v2.ts           # tasks filesystem/workspace V0.2
│   │   ├── task-router.ts       # roteador de tarefas
│   │   └── result.ts            # TaskResult
│   ├── config/
│   │   ├── config-manager.ts    # ~/.umbrella, config.json, state.json
│   │   └── config-schema.ts     # esquema + config padrão
│   ├── execution/
│   │   ├── local-executor.ts    # spawn controlado
│   │   └── permission-manager.ts# fronteira de segurança (V0.2 estendido)
│   ├── filesystem/
│   │   ├── filesystem-engine.ts # read/write/edit/delete/list/mkdir
│   │   ├── filesystem-security.ts # containment no workspace ativo
│   │   └── filesystem-types.ts  # tipos de arquivo/diretório
│   ├── workspace/
│   │   ├── workspace-manager.ts # open/close/info/scan + persistência
│   │   └── workspace-types.ts   # contratos de workspace
│   ├── scanner/
│   │   ├── project-scanner.ts   # detecção nodejs/ts/flutter/python, pm, git
│   │   └── project-types.ts     # tipos de scan
│   ├── tunnel/
│   │   └── tunnel-client.ts     # fronteira p/ futuro Orchestrator
│   ├── update/
│   │   └── update-manager.ts    # infraestrutura de atualização
│   ├── cli/
│   │   └── cli-interface.ts     # CLI interativa
│   ├── logging/
│   │   └── logger.ts            # log em arquivo
│   └── migrations/
│       └── migration-runner.ts  # infraestrutura de migrações
├── migrations/                  # pasta p/ futuras migrações versionadas
├── tests/                       # testes Jest (ts-jest)
├── package.json
├── tsconfig.json
└── README.md
```

## Arquitetura

```
CLI
 ↓
Task (V0.1 local.command | V0.2 filesystem.* / directory.* / workspace.*)
 ↓
TaskRouter
 ↓
PermissionManager
 ↓
LocalExecutor | FilesystemEngine | WorkspaceManager (+ ProjectScanner)
 ↓
Process | Arquivos no workspace ativo
```

```
TunnelClient
     │
     └── preparado para futuro Orchestrator
```

## Diretório do usuário

```
~/.umbrella/
├── config.json
├── state.json
└── logs/
    └── office.log
```

No Windows o diretório home é resolvido via `os.homedir()`. A configuração existente nunca é sobrescrita; futuras versões usarão migrações via `configVersion`.

## Limitações atuais (V0.2)

- **Não é um agente autônomo** — não possui LLM, planejamento, loops de correção ou execução autônoma
- **Não possui Orchestrator** — `TunnelClient` permanece `DISCONNECTED`; fronteira arquitetural apenas
- **Não executa comandos de package manager** — apenas detecta (npm, pnpm, yarn, bun)
- **Não executa Git** — apenas detecta presença de `.git`
- **Não possui interface gráfica** — apenas CLI interativa
- **Não possui memória semântica / RAG** — apenas estado local em `state.json`
- **Filesystem limitado ao workspace ativo** — não acessa arquivos fora do workspace por segurança
- **Scanner não recursivo profundo** — lista apenas primeiro nível (com exclusões), limita a 1000 arquivos

## Roadmap futuro (V0.3+)

- Orchestrator real + Tunnel funcional
- Agent / Subagent system
- LLM integration
- Autonomous development loops
- Git automation
- Package manager execution (npm/pnpm/yarn/bun)
- Process tooling avançado
- Development Task Engine
- Browser automation
- MCP integration
- Semantic memory / RAG

## O que NÃO está implementado (fora do escopo da V0.2)

LLM, 9Router, modelos de IA, Colibrì, CocoIndex, MCP, browser automation, agentes, subagentes, Skills, memória semântica, RAG, banco de dados, Docker, Git automation, servidor HTTP, WebSocket funcional, Orchestrator, Pocket, interface gráfica, Electron, plugins, telemetria externa, cloud storage.
