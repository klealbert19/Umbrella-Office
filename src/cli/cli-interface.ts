/**
 * Interface CLI interativa do Umbrella Office.
 *
 * Comandos: help, status, version, config, run, workspace, file, process, npm, git, exit
 * Permanece interativa, trata Ctrl+C, EOF, comandos vazios e inválidos.
 */
import * as readline from 'readline';
import { OfficeRuntime } from '../core/office-runtime';
import { createLocalCommandTask } from '../core/task';
import { createFilesystemTask, createWorkspaceTask, createProcessTask, createNpmTask, createGitTask, createSchedulerTask, createWebhookTask, createPluginTask, createRemoteTask } from '../core/task-v2';

export class CliInterface {
  private readonly runtime: OfficeRuntime;
  private rl: readline.Interface | null = null;
  private exitRequested: (() => void) | null = null;
  private readonly isPipe: boolean;

  constructor(runtime: OfficeRuntime) {
    this.runtime = runtime;
    this.isPipe = !process.stdin.isTTY;
  }

  async start(): Promise<void> {
    console.log(this.runtime.getBanner());

    // terminal:false quando stdin é pipe (testes e2e / automação).
    // Com terminal:true o readline não quebra linhas de pipe em eventos 'line'.
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: 'office> ',
      terminal: !this.isPipe,
    });

    if (!this.isPipe) {
      this.rl.prompt();
    }

    // Fila de comandos: garante que comandos assíncronos (`run`) sejam
    // processados em ordem, sem sobreposição quando a entrada chega via pipe.
    // O shutdown (via `exit` ou EOF) entra na fila, aguardando tasks
    // em andamento antes de encerrar o runtime.
    let queue: Promise<void> = Promise.resolve();
    let resolveDone!: () => void;
    const done = new Promise<void>((resolve) => {
      resolveDone = resolve;
    });

    // Estado de shutdown unificado
    let shutdownTriggered = false;

    const triggerShutdown = () => {
      if (shutdownTriggered) return;
      shutdownTriggered = true;
      queue = queue.then(() => this.shutdown());
      void queue.then(() => resolveDone());
    };

    this.rl.on('line', (line: string) => {
      queue = queue.then(() => {
        return this.handleLine(line);
      });
    });

    // EOF (Ctrl+D / pipe fechado): apenas marca para shutdown após fila drenar.
    // NÃO resolve done aqui — o shutdown será disparado pelo exitRequested
    // ou explicitamente quando a fila terminar.
    this.rl.on('close', () => {
      // Em modo pipe, o close pode disparar antes de processarmos todos os comandos.
      // Não fazemos nada aqui — o shutdown será disparado pelo stdin.end ou exit.
    });

    // Ctrl+C não deve matar o processo abruptamente
    this.rl.on('SIGINT', () => {
      console.log('\n(Use "exit" para encerrar)');
      if (!this.isPipe) {
        this.rl?.prompt();
      }
    });

    // `exit`: entra na fila e resolve quando o shutdown concluir.
    this.exitRequested = () => {
      triggerShutdown();
    };

    // Quando stdin termina (pipe), dispara shutdown se ainda não foi disparado.
    process.stdin.on('end', () => {
      triggerShutdown();
    });

    await done;
  }

  /**
   * Divide uma linha em tokens respeitando aspas duplas/simples.
   * Necessário para caminhos com espaço (ex.: "C:\Program Files\...").
   */
  private splitLine(line: string): string[] {
    const out: string[] = [];
    let cur = '';
    let quote: string | null = null;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i] as string;
      if (quote) {
        if (ch === quote) {
          quote = null;
        } else {
          cur += ch;
        }
      } else if (ch === '"' || ch === "'") {
        quote = ch;
      } else if (/\s/.test(ch)) {
        if (cur.length > 0) {
          out.push(cur);
          cur = '';
        }
      } else {
        cur += ch;
      }
    }
    if (cur.length > 0) out.push(cur);
    return out;
  }

  private async handleLine(rawLine: string): Promise<void> {
    const line = rawLine.trim();

    if (line === '') {
      this.rl?.prompt();
      return;
    }

    const [command, ...rest] = this.splitLine(line);
    const cmd = (command ?? '').toLowerCase();

    try {
      switch (cmd) {
        case 'help':
          this.printHelp();
          break;
        case 'status':
          this.printStatus();
          break;
        case 'version':
          this.printVersion();
          break;
        case 'config':
          this.printConfig();
          break;
        case 'run':
          await this.handleRun(rest);
          break;
        case 'process':
          await this.handleProcess(rest);
          break;
        case 'npm':
          await this.handleNpm(rest);
          break;
        case 'git':
          await this.handleGit(rest);
          break;
        case 'workspace':
          await this.handleWorkspace(rest);
          break;
        case 'file':
          await this.handleFile(rest);
          break;
        case 'scheduler':
          await this.handleScheduler(rest);
          break;
        case 'webhook':
          await this.handleWebhook(rest);
          break;
        case 'plugin':
          await this.handlePlugin(rest);
          break;
        case 'remote':
          await this.handleRemote(rest);
          break;
        case 'exit':
        case 'quit':
          this.exitRequested?.();
          return;
        default:
          console.log(`Unknown command: ${command}. Type "help" for available commands.`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`Error: ${message}`);
    }

    if (this.rl) {
      try {
        this.rl.prompt();
      } catch {
        // ignora se readline já foi fechado
      }
    }
  }

  private printHelp(): void {
    console.log('Available commands:');
    console.log('  help              Show this help');
    console.log('  status            Show runtime status');
    console.log('  version           Show version info');
    console.log('  config            Show current configuration');
    console.log('  run <cmd> [args]  Execute a local command (e.g. run node --version)');
    console.log('  process <cmd>     Process operations:');
    console.log('    run <cmd> [args]  Execute a process with args');
    console.log('  npm <cmd>         NPM operations (requires npm project):');
    console.log('    install [args]    Run npm install');
    console.log('    run <script> [args]  Run npm script');
    console.log('    test [args]       Run npm test');
    console.log('    build             Run npm run build');
    console.log('    exec <args...>    Execute arbitrary npm command');
    console.log('  git <cmd>         Git operations (requires git repo):');
    console.log('    status            Show git status --short');
    console.log('    diff [args]       Show git diff');
    console.log('    log [args]        Show git log (recent)');
    console.log('    branch            Show branches');
    console.log('    remote            Show remotes');
    console.log('    add <paths...>    Stage files');
    console.log('    commit <message>  Commit staged changes');
    console.log('    checkout <branch> Checkout branch');
    console.log('  workspace <cmd>    Workspace management:');
    console.log('    open <path>      Open a workspace at the specified path');
    console.log('    info              Show current workspace information');
    console.log('    current           Show current workspace path');
    console.log('    close             Close the current workspace');
    console.log('    scan [path]       Scan workspace for project type');
    console.log('  file <cmd>         File operations (requires open workspace):');
    console.log('    read <path>       Read file content');
    console.log('    write <path> <content>  Write file');
    console.log('    edit <path> <old> <new> [--all]  Edit file');
    console.log('    delete <path>     Delete file');
    console.log('    list <path>       List directory');
    console.log('    mkdir <path>      Create directory');
    console.log('  scheduler <cmd>    Task Scheduler:');
    console.log('    create <name> <taskType> <scheduleType> <value>  Create scheduled task');
    console.log('    list              List all scheduled tasks');
    console.log('    info <id>         Show task details');
    console.log('    run <id>          Execute task immediately');
    console.log('    pause <id>        Pause a task');
    console.log('    resume <id>       Resume a paused task');
    console.log('    remove <id>       Remove a task');
    console.log('  webhook <cmd>      Webhook Server:');
    console.log('    status            Show webhook server status');
    console.log('    start             Start webhook server');
    console.log('    stop              Stop webhook server');
    console.log('    list              List registered endpoints');
    console.log('    register <path> <eventType>  Register endpoint');
    console.log('    unregister <path> Unregister endpoint');
    console.log('  plugin <cmd>       Plugin System:');
    console.log('    list              List loaded plugins');
    console.log('    info <id>         Show plugin details');
    console.log('    enable <id>       Enable a plugin');
    console.log('    disable <id>      Disable a plugin');
    console.log('    load <path>       Load plugin from path');
    console.log('    unload <id>       Unload and remove plugin');
    console.log('  remote <cmd>       Remote Workspace:');
    console.log('    connect <type> <name> <path> [options]  Connect to remote workspace');
    console.log('    disconnect        Disconnect from remote workspace');
    console.log('    status            Show current connection status');
    console.log('    providers         List available providers');
    console.log('  exit              Shutdown the runtime');
  }

  private printStatus(): void {
    for (const line of this.runtime.getStatusLines()) {
      console.log(line);
    }
  }

  private printVersion(): void {
    for (const line of this.runtime.getVersionLines()) {
      console.log(line);
    }
  }

  private printConfig(): void {
    const config = this.runtime.getConfigManager().getConfig();
    console.log(`Office: ${config.office.name}`);
    console.log(`Config version: ${config.configVersion}`);
    console.log(`Orchestrator: ${config.orchestrator.enabled ? 'ENABLED' : 'DISABLED'}`);
    if (config.orchestrator.endpoint) {
      console.log(`Endpoint: ${config.orchestrator.endpoint}`);
    }
    console.log(`Home: ${this.runtime.getConfigManager().homeDir}`);
  }

  private async handleRun(args: string[]): Promise<void> {
    if (args.length === 0) {
      console.log('Usage: run <command> [args...]');
      return;
    }
    const [command, ...cmdArgs] = args as [string, ...string[]];
    const task = createLocalCommandTask(command, cmdArgs);
    console.log('Task started...');
    const result = await this.runtime.getTaskRouter().route(task);
    if (result.success) {
      if (result.output) {
        console.log(result.output);
      }
      console.log('Task completed successfully.');
    } else {
      console.log(`Task failed: ${result.error ?? 'unknown error'}`);
    }
  }

  private async handleWorkspace(args: string[]): Promise<void> {
    if (args.length === 0) {
      console.log('Usage: workspace <command> [args...]');
      console.log('Commands:');
      console.log('  open <path>      Open a workspace at the specified path');
      console.log('  info              Show current workspace information');
      console.log('  current           Show current workspace path');
      console.log('  close             Close the current workspace');
      console.log('  scan              Scan current directory for project type');
      return;
    }
    const [command, ...rest] = args;
    const cmd = command.toLowerCase();
    
    try {
      switch (cmd) {
        case 'open':
          await this.handleWorkspaceOpen(rest);
          break;
        case 'info':
          await this.handleWorkspaceInfo();
          break;
        case 'current':
          await this.handleWorkspaceCurrent();
          break;
        case 'close':
          await this.handleWorkspaceClose();
          break;
        case 'scan':
          await this.handleWorkspaceScan(rest);
          break;
        default:
          console.log(`Unknown workspace command: ${command}`);
          console.log('Type "help" for available commands.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`Error: ${message}`);
    }
  }

  private async handleWorkspaceOpen(args: string[]): Promise<void> {
    if (args.length === 0) {
      console.log('Usage: workspace open <path>');
      return;
    }
    const [path] = args;
    const task = createWorkspaceTask('workspace.open', { path });
    console.log(`Opening workspace at: ${path}`);
    const result = await this.runtime.getTaskRouter().route(task);
    if (result.success) {
      console.log('Workspace opened successfully.');
    } else {
      console.log(`Failed to open workspace: ${result.error ?? 'unknown error'}`);
    }
  }

  private async handleWorkspaceInfo(): Promise<void> {
    const task = createWorkspaceTask('workspace.read', {});
    const result = await this.runtime.getTaskRouter().route(task);
    if (result.success) {
      console.log('Workspace information:');
      if (result.output) {
        console.log(result.output as string);
      }
    } else {
      console.log(`Failed to get workspace info: ${result.error ?? 'unknown error'}`);
    }
  }

  private async handleWorkspaceCurrent(): Promise<void> {
    const task = createWorkspaceTask('workspace.read', {});
    const result = await this.runtime.getTaskRouter().route(task);
    if (result.success) {
      console.log('Current workspace:');
      if (result.output) {
        console.log(result.output as string);
      }
    } else {
      console.log(`Failed to get current workspace: ${result.error ?? 'unknown error'}`);
    }
  }

  private async handleWorkspaceClose(): Promise<void> {
    const task = createWorkspaceTask('workspace.close', {});
    console.log('Closing workspace...');
    const result = await this.runtime.getTaskRouter().route(task);
    if (result.success) {
      console.log('Workspace closed successfully.');
    } else {
      console.log(`Failed to close workspace: ${result.error ?? 'unknown error'}`);
    }
  }

  private async handleWorkspaceScan(args: string[]): Promise<void> {
    const [path] = args;
    const task = createWorkspaceTask('workspace.scan', { path });
    console.log('Scanning workspace for project type...');
    const result = await this.runtime.getTaskRouter().route(task);
    if (result.success) {
      console.log('Scan completed successfully.');
      if (result.output) {
        console.log(result.output as string);
      }
    } else {
      console.log(`Scan failed: ${result.error ?? 'unknown error'}`);
    }
  }

  private async handleFile(args: string[]): Promise<void> {
    if (args.length === 0) {
      console.log('Usage: file <command> [args...]');
      console.log('Commands:');
      console.log('  read <path>                    Read file content');
      console.log('  write <path> <content>         Write file');
      console.log('  edit <path> <old> <new> [--all]  Edit file');
      console.log('  delete <path>                  Delete file');
      console.log('  list <path>                    List directory');
      console.log('  mkdir <path>                   Create directory');
      return;
    }
    const [sub, ...rest] = args;
    const cmd = (sub ?? '').toLowerCase();
    try {
      switch (cmd) {
        case 'read': {
          if (rest.length === 0) {
            console.log('Usage: file read <path>');
            return;
          }
          const task = createFilesystemTask('filesystem.read', { path: rest[0] });
          const result = await this.runtime.getTaskRouter().route(task);
          if (result.success) {
            console.log(result.output ?? '');
          } else {
            console.log(`Failed to read file: ${result.error ?? 'unknown error'}`);
          }
          break;
        }
        case 'write': {
          if (rest.length < 2) {
            console.log('Usage: file write <path> <content>');
            return;
          }
          const filePath = rest[0] as string;
          const content = rest.slice(1).join(' ');
          const task = createFilesystemTask('filesystem.write', { path: filePath, content });
          const result = await this.runtime.getTaskRouter().route(task);
          if (result.success) {
            console.log(result.output ?? 'File written successfully.');
          } else {
            console.log(`Failed to write file: ${result.error ?? 'unknown error'}`);
          }
          break;
        }
        case 'edit': {
          if (rest.length < 3) {
            console.log('Usage: file edit <path> <oldText> <newText> [--all]');
            return;
          }
          const filePath = rest[0] as string;
          const oldText = rest[1] as string;
          const newText = rest[2] as string;
          const replaceAll = rest.includes('--all');
          const task = createFilesystemTask('filesystem.edit', { path: filePath, oldText, newText, replaceAll });
          const result = await this.runtime.getTaskRouter().route(task);
          if (result.success) {
            console.log(result.output ?? 'File edited successfully.');
          } else {
            console.log(`Failed to edit file: ${result.error ?? 'unknown error'}`);
          }
          break;
        }
        case 'delete':
        case 'rm': {
          if (rest.length === 0) {
            console.log('Usage: file delete <path>');
            return;
          }
          const task = createFilesystemTask('filesystem.delete', { path: rest[0] });
          const result = await this.runtime.getTaskRouter().route(task);
          if (result.success) {
            console.log('File deleted successfully.');
          } else {
            console.log(`Failed to delete file: ${result.error ?? 'unknown error'}`);
          }
          break;
        }
        case 'list':
        case 'ls': {
          if (rest.length === 0) {
            console.log('Usage: file list <path>');
            return;
          }
          const task = createFilesystemTask('directory.list', { path: rest[0] });
          const result = await this.runtime.getTaskRouter().route(task);
          if (result.success) {
            console.log(result.output ?? '');
          } else {
            console.log(`Failed to list directory: ${result.error ?? 'unknown error'}`);
          }
          break;
        }
        case 'mkdir': {
          if (rest.length === 0) {
            console.log('Usage: file mkdir <path>');
            return;
          }
          const task = createFilesystemTask('directory.create', { path: rest[0] });
          const result = await this.runtime.getTaskRouter().route(task);
          if (result.success) {
            console.log('Directory created successfully.');
          } else {
            console.log(`Failed to create directory: ${result.error ?? 'unknown error'}`);
          }
          break;
        }
        default:
          console.log(`Unknown file command: ${sub}`);
          console.log('Type "help" for available commands.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`Error: ${message}`);
    }
  }

  private async handleProcess(args: string[]): Promise<void> {
    if (args.length === 0) {
      console.log('Usage: process <command>');
      console.log('Commands:');
      console.log('  run <cmd> [args...]  Execute a process with args');
      return;
    }
    const [sub, ...rest] = args;
    const cmd = sub.toLowerCase();

    try {
      switch (cmd) {
        case 'run': {
          if (rest.length === 0) {
            console.log('Usage: process run <command> [args...]');
            return;
          }
          const [command, ...cmdArgs] = rest;
          const task = createProcessTask({
            command,
            args: cmdArgs,
          });
          console.log('Process started...');
          const result = await this.runtime.getTaskRouter().route(task);
          if (result.success) {
            if (result.output) {
              console.log(result.output);
            }
            console.log('Process completed successfully.');
          } else {
            console.log(`Process failed: ${result.error ?? 'unknown error'}`);
          }
          break;
        }
        default:
          console.log(`Unknown process command: ${sub}`);
          console.log('Type "help" for available commands.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`Error: ${message}`);
    }
  }

  private async handleNpm(args: string[]): Promise<void> {
    if (args.length === 0) {
      console.log('Usage: npm <command>');
      console.log('Commands:');
      console.log('  install [args...]    Run npm install');
      console.log('  run <script> [args...]  Run npm script');
      console.log('  test [args...]       Run npm test');
      console.log('  build                Run npm run build');
      console.log('  exec <args...>       Execute arbitrary npm command');
      return;
    }
    const [sub, ...rest] = args;
    const cmd = sub.toLowerCase();

    try {
      switch (cmd) {
        case 'install': {
          const task = createNpmTask('npm.install', {
            args: rest,
          });
          console.log('Running npm install...');
          const result = await this.runtime.getTaskRouter().route(task);
          if (result.success) {
            if (result.output) {
              console.log(result.output);
            }
            console.log('npm install completed successfully.');
          } else {
            console.log(`npm install failed: ${result.error ?? 'unknown error'}`);
          }
          break;
        }
        case 'run': {
          if (rest.length === 0) {
            console.log('Usage: npm run <script> [args...]');
            return;
          }
          const [script, ...scriptArgs] = rest;
          const task = createNpmTask('npm.run', {
            script,
            args: scriptArgs,
          });
          console.log(`Running npm run ${script}...`);
          const result = await this.runtime.getTaskRouter().route(task);
          if (result.success) {
            if (result.output) {
              console.log(result.output);
            }
            console.log('npm run completed successfully.');
          } else {
            console.log(`npm run failed: ${result.error ?? 'unknown error'}`);
          }
          break;
        }
        case 'test': {
          const task = createNpmTask('npm.test', {
            args: rest,
          });
          console.log('Running npm test...');
          const result = await this.runtime.getTaskRouter().route(task);
          if (result.success) {
            if (result.output) {
              console.log(result.output);
            }
            console.log('npm test completed successfully.');
          } else {
            console.log(`npm test failed: ${result.error ?? 'unknown error'}`);
          }
          break;
        }
        case 'build': {
          const task = createNpmTask('npm.build', {});
          console.log('Running npm run build...');
          const result = await this.runtime.getTaskRouter().route(task);
          if (result.success) {
            if (result.output) {
              console.log(result.output);
            }
            console.log('npm build completed successfully.');
          } else {
            console.log(`npm build failed: ${result.error ?? 'unknown error'}`);
          }
          break;
        }
        case 'exec': {
          if (rest.length === 0) {
            console.log('Usage: npm exec <args...>');
            return;
          }
          const task = createNpmTask('npm.exec', {
            args: rest,
          });
          console.log(`Running npm ${rest.join(' ')}...`);
          const result = await this.runtime.getTaskRouter().route(task);
          if (result.success) {
            if (result.output) {
              console.log(result.output);
            }
            console.log('npm exec completed successfully.');
          } else {
            console.log(`npm exec failed: ${result.error ?? 'unknown error'}`);
          }
          break;
        }
        default:
          console.log(`Unknown npm command: ${sub}`);
          console.log('Type "help" for available commands.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`Error: ${message}`);
    }
  }

  private async handleGit(args: string[]): Promise<void> {
    if (args.length === 0) {
      console.log('Usage: git <command>');
      console.log('Commands:');
      console.log('  status            Show git status --short');
      console.log('  diff [args...]    Show git diff');
      console.log('  log [args...]     Show git log (recent)');
      console.log('  branch            Show branches');
      console.log('  remote            Show remotes');
      console.log('  add <paths...>    Stage files');
      console.log('  commit <message>  Commit staged changes');
      console.log('  checkout <branch> Checkout branch');
      return;
    }
    const [sub, ...rest] = args;
    const cmd = sub.toLowerCase();

    try {
      switch (cmd) {
        case 'status': {
          const task = createGitTask('git.status', {});
          const result = await this.runtime.getTaskRouter().route(task);
          if (result.success) {
            if (result.output) {
              console.log(result.output);
            }
          } else {
            console.log(`git status failed: ${result.error ?? 'unknown error'}`);
          }
          break;
        }
        case 'diff': {
          const task = createGitTask('git.diff', {
            args: rest,
          });
          const result = await this.runtime.getTaskRouter().route(task);
          if (result.success) {
            if (result.output) {
              console.log(result.output);
            }
          } else {
            console.log(`git diff failed: ${result.error ?? 'unknown error'}`);
          }
          break;
        }
        case 'log': {
          const task = createGitTask('git.log', {
            args: rest,
          });
          const result = await this.runtime.getTaskRouter().route(task);
          if (result.success) {
            if (result.output) {
              console.log(result.output);
            }
          } else {
            console.log(`git log failed: ${result.error ?? 'unknown error'}`);
          }
          break;
        }
        case 'branch': {
          const task = createGitTask('git.branch', {});
          const result = await this.runtime.getTaskRouter().route(task);
          if (result.success) {
            if (result.output) {
              console.log(result.output);
            }
          } else {
            console.log(`git branch failed: ${result.error ?? 'unknown error'}`);
          }
          break;
        }
        case 'remote': {
          const task = createGitTask('git.remote', {});
          const result = await this.runtime.getTaskRouter().route(task);
          if (result.success) {
            if (result.output) {
              console.log(result.output);
            }
          } else {
            console.log(`git remote failed: ${result.error ?? 'unknown error'}`);
          }
          break;
        }
        case 'add': {
          if (rest.length === 0) {
            console.log('Usage: git add <paths...>');
            return;
          }
          const task = createGitTask('git.add', {
            paths: rest,
          });
          console.log(`Staging files: ${rest.join(', ')}`);
          const result = await this.runtime.getTaskRouter().route(task);
          if (result.success) {
            if (result.output) {
              console.log(result.output);
            }
            console.log('Files staged successfully.');
          } else {
            console.log(`git add failed: ${result.error ?? 'unknown error'}`);
          }
          break;
        }
        case 'commit': {
          if (rest.length === 0) {
            console.log('Usage: git commit <message>');
            return;
          }
          const message = rest.join(' ');
          const task = createGitTask('git.commit', {
            message,
          });
          console.log(`Committing with message: ${message}`);
          const result = await this.runtime.getTaskRouter().route(task);
          if (result.success) {
            if (result.output) {
              console.log(result.output);
            }
            console.log('Commit completed successfully.');
          } else {
            console.log(`git commit failed: ${result.error ?? 'unknown error'}`);
          }
          break;
        }
        case 'checkout': {
          if (rest.length === 0) {
            console.log('Usage: git checkout <branch>');
            return;
          }
          const [branch] = rest;
          const task = createGitTask('git.checkout', {
            branch,
          });
          console.log(`Checking out branch: ${branch}`);
          const result = await this.runtime.getTaskRouter().route(task);
          if (result.success) {
            if (result.output) {
              console.log(result.output);
            }
            console.log('Checkout completed successfully.');
          } else {
            console.log(`git checkout failed: ${result.error ?? 'unknown error'}`);
          }
          break;
        }
        default:
          console.log(`Unknown git command: ${sub}`);
          console.log('Type "help" for available commands.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`Error: ${message}`);
    }
  }

  private async handleScheduler(args: string[]): Promise<void> {
    if (args.length === 0) {
      console.log('Usage: scheduler <command> [args...]');
      console.log('Commands:');
      console.log('  create <name> <taskType> <scheduleType> <value>  Create scheduled task');
      console.log('  list              List all scheduled tasks');
      console.log('  info <id>         Show task details');
      console.log('  run <id>          Execute task immediately');
      console.log('  pause <id>        Pause a task');
      console.log('  resume <id>       Resume a paused task');
      console.log('  remove <id>       Remove a task');
      return;
    }
    const [sub, ...rest] = args;
    const cmd = sub.toLowerCase();

    try {
      switch (cmd) {
        case 'create': {
          if (rest.length < 4) {
            console.log('Usage: scheduler create <name> <taskType> <scheduleType> <value>');
            console.log('Example: scheduler create "daily-backup" "process.execute" "cron" "0 2 * * *"');
            return;
          }
          const [name, taskType, scheduleType, ...valueParts] = rest;
          const value = valueParts.join(' ');
          const task = createSchedulerTask('scheduler.create', {
            name,
            task: { type: taskType, payload: {} },
            schedule: { type: scheduleType as 'once' | 'interval' | 'cron', value },
          });
          const result = await this.runtime.getTaskRouter().route(task);
          if (result.success) {
            console.log('Scheduled task created:');
            console.log(result.output);
          } else {
            console.log(`Failed to create task: ${result.error ?? 'unknown error'}`);
          }
          break;
        }
        case 'list': {
          const task = createSchedulerTask('scheduler.list', {});
          const result = await this.runtime.getTaskRouter().route(task);
          if (result.success) {
            console.log(result.output);
          } else {
            console.log(`Failed to list tasks: ${result.error ?? 'unknown error'}`);
          }
          break;
        }
        case 'info': {
          if (rest.length === 0) {
            console.log('Usage: scheduler info <id>');
            return;
          }
          const task = createSchedulerTask('scheduler.info', { id: rest[0] });
          const result = await this.runtime.getTaskRouter().route(task);
          if (result.success) {
            console.log(result.output);
          } else {
            console.log(`Failed to get task info: ${result.error ?? 'unknown error'}`);
          }
          break;
        }
        case 'run': {
          if (rest.length === 0) {
            console.log('Usage: scheduler run <id>');
            return;
          }
          const task = createSchedulerTask('scheduler.run', { id: rest[0] });
          console.log('Running task...');
          const result = await this.runtime.getTaskRouter().route(task);
          if (result.success) {
            if (result.output) console.log(result.output);
            console.log('Task executed successfully.');
          } else {
            console.log(`Task failed: ${result.error ?? 'unknown error'}`);
          }
          break;
        }
        case 'pause': {
          if (rest.length === 0) {
            console.log('Usage: scheduler pause <id>');
            return;
          }
          const task = createSchedulerTask('scheduler.pause', { id: rest[0] });
          const result = await this.runtime.getTaskRouter().route(task);
          if (result.success) {
            console.log('Task paused.');
          } else {
            console.log(`Failed to pause task: ${result.error ?? 'unknown error'}`);
          }
          break;
        }
        case 'resume': {
          if (rest.length === 0) {
            console.log('Usage: scheduler resume <id>');
            return;
          }
          const task = createSchedulerTask('scheduler.resume', { id: rest[0] });
          const result = await this.runtime.getTaskRouter().route(task);
          if (result.success) {
            console.log('Task resumed.');
          } else {
            console.log(`Failed to resume task: ${result.error ?? 'unknown error'}`);
          }
          break;
        }
        case 'remove': {
          if (rest.length === 0) {
            console.log('Usage: scheduler remove <id>');
            return;
          }
          const task = createSchedulerTask('scheduler.remove', { id: rest[0] });
          const result = await this.runtime.getTaskRouter().route(task);
          if (result.success) {
            console.log('Task removed.');
          } else {
            console.log(`Failed to remove task: ${result.error ?? 'unknown error'}`);
          }
          break;
        }
        default:
          console.log(`Unknown scheduler command: ${sub}`);
          console.log('Type "help" for available commands.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`Error: ${message}`);
    }
  }

  private async handleWebhook(args: string[]): Promise<void> {
    if (args.length === 0) {
      console.log('Usage: webhook <command> [args...]');
      console.log('Commands:');
      console.log('  status            Show webhook server status');
      console.log('  start             Start webhook server');
      console.log('  stop              Stop webhook server');
      console.log('  list              List registered endpoints');
      console.log('  register <path> <eventType>  Register endpoint');
      console.log('  unregister <path> Unregister endpoint');
      return;
    }
    const [sub, ...rest] = args;
    const cmd = sub.toLowerCase();

    try {
      switch (cmd) {
        case 'status': {
          const task = createWebhookTask('webhook.status', {});
          const result = await this.runtime.getTaskRouter().route(task);
          if (result.success) {
            console.log(result.output);
          } else {
            console.log(`Failed to get status: ${result.error ?? 'unknown error'}`);
          }
          break;
        }
        case 'start': {
          const task = createWebhookTask('webhook.start', {});
          const result = await this.runtime.getTaskRouter().route(task);
          if (result.success) {
            console.log('Webhook server started.');
          } else {
            console.log(`Failed to start: ${result.error ?? 'unknown error'}`);
          }
          break;
        }
        case 'stop': {
          const task = createWebhookTask('webhook.stop', {});
          const result = await this.runtime.getTaskRouter().route(task);
          if (result.success) {
            console.log('Webhook server stopped.');
          } else {
            console.log(`Failed to stop: ${result.error ?? 'unknown error'}`);
          }
          break;
        }
        case 'list': {
          const task = createWebhookTask('webhook.list', {});
          const result = await this.runtime.getTaskRouter().route(task);
          if (result.success) {
            console.log(result.output);
          } else {
            console.log(`Failed to list endpoints: ${result.error ?? 'unknown error'}`);
          }
          break;
        }
        case 'register': {
          if (rest.length < 2) {
            console.log('Usage: webhook register <path> <eventType>');
            return;
          }
          const [path, eventType] = rest;
          const task = createWebhookTask('webhook.register', { path, eventType });
          const result = await this.runtime.getTaskRouter().route(task);
          if (result.success) {
            console.log('Endpoint registered.');
          } else {
            console.log(`Failed to register: ${result.error ?? 'unknown error'}`);
          }
          break;
        }
        case 'unregister': {
          if (rest.length === 0) {
            console.log('Usage: webhook unregister <path>');
            return;
          }
          const task = createWebhookTask('webhook.unregister', { path: rest[0] });
          const result = await this.runtime.getTaskRouter().route(task);
          if (result.success) {
            console.log('Endpoint unregistered.');
          } else {
            console.log(`Failed to unregister: ${result.error ?? 'unknown error'}`);
          }
          break;
        }
        default:
          console.log(`Unknown webhook command: ${sub}`);
          console.log('Type "help" for available commands.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`Error: ${message}`);
    }
  }

  private async handlePlugin(args: string[]): Promise<void> {
    if (args.length === 0) {
      console.log('Usage: plugin <command> [args...]');
      console.log('Commands:');
      console.log('  list              List loaded plugins');
      console.log('  info <id>         Show plugin details');
      console.log('  enable <id>       Enable a plugin');
      console.log('  disable <id>      Disable a plugin');
      console.log('  load <path>       Load plugin from path');
      console.log('  unload <id>       Unload and remove plugin');
      return;
    }
    const [sub, ...rest] = args;
    const cmd = sub.toLowerCase();

    try {
      switch (cmd) {
        case 'list': {
          const task = createPluginTask('plugin.list', {});
          const result = await this.runtime.getTaskRouter().route(task);
          if (result.success) {
            console.log(result.output);
          } else {
            console.log(`Failed to list plugins: ${result.error ?? 'unknown error'}`);
          }
          break;
        }
        case 'info': {
          if (rest.length === 0) {
            console.log('Usage: plugin info <id>');
            return;
          }
          const task = createPluginTask('plugin.info', { id: rest[0] });
          const result = await this.runtime.getTaskRouter().route(task);
          if (result.success) {
            console.log(result.output);
          } else {
            console.log(`Failed to get plugin info: ${result.error ?? 'unknown error'}`);
          }
          break;
        }
        case 'enable': {
          if (rest.length === 0) {
            console.log('Usage: plugin enable <id>');
            return;
          }
          const task = createPluginTask('plugin.enable', { id: rest[0] });
          const result = await this.runtime.getTaskRouter().route(task);
          if (result.success) {
            console.log('Plugin enabled.');
          } else {
            console.log(`Failed to enable plugin: ${result.error ?? 'unknown error'}`);
          }
          break;
        }
        case 'disable': {
          if (rest.length === 0) {
            console.log('Usage: plugin disable <id>');
            return;
          }
          const task = createPluginTask('plugin.disable', { id: rest[0] });
          const result = await this.runtime.getTaskRouter().route(task);
          if (result.success) {
            console.log('Plugin disabled.');
          } else {
            console.log(`Failed to disable plugin: ${result.error ?? 'unknown error'}`);
          }
          break;
        }
        case 'load': {
          if (rest.length === 0) {
            console.log('Usage: plugin load <path>');
            return;
          }
          const task = createPluginTask('plugin.load', { path: rest[0] });
          const result = await this.runtime.getTaskRouter().route(task);
          if (result.success) {
            console.log('Plugin loaded.');
            console.log(result.output);
          } else {
            console.log(`Failed to load plugin: ${result.error ?? 'unknown error'}`);
          }
          break;
        }
        case 'unload': {
          if (rest.length === 0) {
            console.log('Usage: plugin unload <id>');
            return;
          }
          const task = createPluginTask('plugin.unload', { id: rest[0] });
          const result = await this.runtime.getTaskRouter().route(task);
          if (result.success) {
            console.log('Plugin removed.');
          } else {
            console.log(`Failed to remove plugin: ${result.error ?? 'unknown error'}`);
          }
          break;
        }
        default:
          console.log(`Unknown plugin command: ${sub}`);
          console.log('Type "help" for available commands.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`Error: ${message}`);
    }
  }

  private async handleRemote(args: string[]): Promise<void> {
    if (args.length === 0) {
      console.log('Usage: remote <command> [args...]');
      console.log('Commands:');
      console.log('  connect <type> <name> <path> [options]  Connect to remote workspace');
      console.log('  disconnect        Disconnect from remote workspace');
      console.log('  status            Show current connection status');
      console.log('  providers         List available providers');
      return;
    }
    const [sub, ...rest] = args;
    const cmd = sub.toLowerCase();

    try {
      switch (cmd) {
        case 'connect': {
          if (rest.length < 3) {
            console.log('Usage: remote connect <type> <name> <path> [options]');
            console.log('Types: local, ssh, wsl');
            console.log('SSH options: --host <host> --port <port> --user <user> --key <keyPath>');
            console.log('WSL options: --distro <distribution>');
            return;
          }
          const [type, name, path] = rest;
          const options: Record<string, string> = {};
          for (let i = 3; i < rest.length; i += 2) {
            if (rest[i].startsWith('--')) {
              options[rest[i].slice(2)] = rest[i + 1] ?? '';
            }
          }
          const payload: any = { type, name, path };
          if (type === 'ssh') {
            payload.host = options.host;
            payload.port = options.port ? parseInt(options.port, 10) : 22;
            payload.user = options.user;
            payload.keyPath = options.key;
          } else if (type === 'wsl') {
            payload.distribution = options.distro;
          }
          const task = createRemoteTask('remote.connect', payload);
          const result = await this.runtime.getTaskRouter().route(task);
          if (result.success) {
            console.log('Workspace connected.');
          } else {
            console.log(`Failed to connect: ${result.error ?? 'unknown error'}`);
          }
          break;
        }
        case 'disconnect': {
          const task = createRemoteTask('remote.disconnect', {});
          const result = await this.runtime.getTaskRouter().route(task);
          if (result.success) {
            console.log('Workspace disconnected.');
          } else {
            console.log(`Failed to disconnect: ${result.error ?? 'unknown error'}`);
          }
          break;
        }
        case 'status': {
          const task = createRemoteTask('remote.status', {});
          const result = await this.runtime.getTaskRouter().route(task);
          if (result.success) {
            console.log(result.output);
          } else {
            console.log(`Failed to get status: ${result.error ?? 'unknown error'}`);
          }
          break;
        }
        case 'providers': {
          const task = createRemoteTask('remote.providers', {});
          const result = await this.runtime.getTaskRouter().route(task);
          if (result.success) {
            console.log(result.output);
          } else {
            console.log(`Failed to list providers: ${result.error ?? 'unknown error'}`);
          }
          break;
        }
        default:
          console.log(`Unknown remote command: ${sub}`);
          console.log('Type "help" for available commands.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`Error: ${message}`);
    }
  }

  private async shutdown(): Promise<void> {
    try {
      this.rl?.close();
    } catch {
      // ignora
    }
    try {
      await this.runtime.stop();
    } catch {
      // ignora
    }
    console.log('Goodbye.');
  }
}
