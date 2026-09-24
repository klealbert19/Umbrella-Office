# Umbrella Office

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
