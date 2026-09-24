/**
 * Interface CLI interativa do Umbrella Office.
 *
 * Comandos: help, status, version, config, run, workspace, file, exit
 * Permanece interativa, trata Ctrl+C, EOF, comandos vazios e inválidos.
 */
import * as readline from 'readline';
import { OfficeRuntime } from '../core/office-runtime';
import { createLocalCommandTask } from '../core/task';
import { createFilesystemTask, createWorkspaceTask } from '../core/task-v2';

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
        case 'workspace':
          await this.handleWorkspace(rest);
          break;
        case 'file':
          await this.handleFile(rest);
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
