"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CliInterface = void 0;
/**
 * Interface CLI interativa do Umbrella Office.
 *
 * Comandos: help, status, version, config, run, workspace, file, process, npm, git, exit
 * Permanece interativa, trata Ctrl+C, EOF, comandos vazios e inválidos.
 */
const readline = __importStar(require("readline"));
const task_1 = require("../core/task");
const task_v2_1 = require("../core/task-v2");
class CliInterface {
    runtime;
    rl = null;
    exitRequested = null;
    isPipe;
    constructor(runtime) {
        this.runtime = runtime;
        this.isPipe = !process.stdin.isTTY;
    }
    async start() {
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
        let queue = Promise.resolve();
        let resolveDone;
        const done = new Promise((resolve) => {
            resolveDone = resolve;
        });
        // Estado de shutdown unificado
        let shutdownTriggered = false;
        const triggerShutdown = () => {
            if (shutdownTriggered)
                return;
            shutdownTriggered = true;
            queue = queue.then(() => this.shutdown());
            void queue.then(() => resolveDone());
        };
        this.rl.on('line', (line) => {
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
    splitLine(line) {
        const out = [];
        let cur = '';
        let quote = null;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (quote) {
                if (ch === quote) {
                    quote = null;
                }
                else {
                    cur += ch;
                }
            }
            else if (ch === '"' || ch === "'") {
                quote = ch;
            }
            else if (/\s/.test(ch)) {
                if (cur.length > 0) {
                    out.push(cur);
                    cur = '';
                }
            }
            else {
                cur += ch;
            }
        }
        if (cur.length > 0)
            out.push(cur);
        return out;
    }
    async handleLine(rawLine) {
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
                case 'exit':
                case 'quit':
                    this.exitRequested?.();
                    return;
                default:
                    console.log(`Unknown command: ${command}. Type "help" for available commands.`);
            }
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.log(`Error: ${message}`);
        }
        if (this.rl) {
            try {
                this.rl.prompt();
            }
            catch {
                // ignora se readline já foi fechado
            }
        }
    }
    printHelp() {
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
        console.log('  exit              Shutdown the runtime');
    }
    printStatus() {
        for (const line of this.runtime.getStatusLines()) {
            console.log(line);
        }
    }
    printVersion() {
        for (const line of this.runtime.getVersionLines()) {
            console.log(line);
        }
    }
    printConfig() {
        const config = this.runtime.getConfigManager().getConfig();
        console.log(`Office: ${config.office.name}`);
        console.log(`Config version: ${config.configVersion}`);
        console.log(`Orchestrator: ${config.orchestrator.enabled ? 'ENABLED' : 'DISABLED'}`);
        if (config.orchestrator.endpoint) {
            console.log(`Endpoint: ${config.orchestrator.endpoint}`);
        }
        console.log(`Home: ${this.runtime.getConfigManager().homeDir}`);
    }
    async handleRun(args) {
        if (args.length === 0) {
            console.log('Usage: run <command> [args...]');
            return;
        }
        const [command, ...cmdArgs] = args;
        const task = (0, task_1.createLocalCommandTask)(command, cmdArgs);
        console.log('Task started...');
        const result = await this.runtime.getTaskRouter().route(task);
        if (result.success) {
            if (result.output) {
                console.log(result.output);
            }
            console.log('Task completed successfully.');
        }
        else {
            console.log(`Task failed: ${result.error ?? 'unknown error'}`);
        }
    }
    async handleWorkspace(args) {
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
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.log(`Error: ${message}`);
        }
    }
    async handleWorkspaceOpen(args) {
        if (args.length === 0) {
            console.log('Usage: workspace open <path>');
            return;
        }
        const [path] = args;
        const task = (0, task_v2_1.createWorkspaceTask)('workspace.open', { path });
        console.log(`Opening workspace at: ${path}`);
        const result = await this.runtime.getTaskRouter().route(task);
        if (result.success) {
            console.log('Workspace opened successfully.');
        }
        else {
            console.log(`Failed to open workspace: ${result.error ?? 'unknown error'}`);
        }
    }
    async handleWorkspaceInfo() {
        const task = (0, task_v2_1.createWorkspaceTask)('workspace.read', {});
        const result = await this.runtime.getTaskRouter().route(task);
        if (result.success) {
            console.log('Workspace information:');
            if (result.output) {
                console.log(result.output);
            }
        }
        else {
            console.log(`Failed to get workspace info: ${result.error ?? 'unknown error'}`);
        }
    }
    async handleWorkspaceCurrent() {
        const task = (0, task_v2_1.createWorkspaceTask)('workspace.read', {});
        const result = await this.runtime.getTaskRouter().route(task);
        if (result.success) {
            console.log('Current workspace:');
            if (result.output) {
                console.log(result.output);
            }
        }
        else {
            console.log(`Failed to get current workspace: ${result.error ?? 'unknown error'}`);
        }
    }
    async handleWorkspaceClose() {
        const task = (0, task_v2_1.createWorkspaceTask)('workspace.close', {});
        console.log('Closing workspace...');
        const result = await this.runtime.getTaskRouter().route(task);
        if (result.success) {
            console.log('Workspace closed successfully.');
        }
        else {
            console.log(`Failed to close workspace: ${result.error ?? 'unknown error'}`);
        }
    }
    async handleWorkspaceScan(args) {
        const [path] = args;
        const task = (0, task_v2_1.createWorkspaceTask)('workspace.scan', { path });
        console.log('Scanning workspace for project type...');
        const result = await this.runtime.getTaskRouter().route(task);
        if (result.success) {
            console.log('Scan completed successfully.');
            if (result.output) {
                console.log(result.output);
            }
        }
        else {
            console.log(`Scan failed: ${result.error ?? 'unknown error'}`);
        }
    }
    async handleFile(args) {
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
                    const task = (0, task_v2_1.createFilesystemTask)('filesystem.read', { path: rest[0] });
                    const result = await this.runtime.getTaskRouter().route(task);
                    if (result.success) {
                        console.log(result.output ?? '');
                    }
                    else {
                        console.log(`Failed to read file: ${result.error ?? 'unknown error'}`);
                    }
                    break;
                }
                case 'write': {
                    if (rest.length < 2) {
                        console.log('Usage: file write <path> <content>');
                        return;
                    }
                    const filePath = rest[0];
                    const content = rest.slice(1).join(' ');
                    const task = (0, task_v2_1.createFilesystemTask)('filesystem.write', { path: filePath, content });
                    const result = await this.runtime.getTaskRouter().route(task);
                    if (result.success) {
                        console.log(result.output ?? 'File written successfully.');
                    }
                    else {
                        console.log(`Failed to write file: ${result.error ?? 'unknown error'}`);
                    }
                    break;
                }
                case 'edit': {
                    if (rest.length < 3) {
                        console.log('Usage: file edit <path> <oldText> <newText> [--all]');
                        return;
                    }
                    const filePath = rest[0];
                    const oldText = rest[1];
                    const newText = rest[2];
                    const replaceAll = rest.includes('--all');
                    const task = (0, task_v2_1.createFilesystemTask)('filesystem.edit', { path: filePath, oldText, newText, replaceAll });
                    const result = await this.runtime.getTaskRouter().route(task);
                    if (result.success) {
                        console.log(result.output ?? 'File edited successfully.');
                    }
                    else {
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
                    const task = (0, task_v2_1.createFilesystemTask)('filesystem.delete', { path: rest[0] });
                    const result = await this.runtime.getTaskRouter().route(task);
                    if (result.success) {
                        console.log('File deleted successfully.');
                    }
                    else {
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
                    const task = (0, task_v2_1.createFilesystemTask)('directory.list', { path: rest[0] });
                    const result = await this.runtime.getTaskRouter().route(task);
                    if (result.success) {
                        console.log(result.output ?? '');
                    }
                    else {
                        console.log(`Failed to list directory: ${result.error ?? 'unknown error'}`);
                    }
                    break;
                }
                case 'mkdir': {
                    if (rest.length === 0) {
                        console.log('Usage: file mkdir <path>');
                        return;
                    }
                    const task = (0, task_v2_1.createFilesystemTask)('directory.create', { path: rest[0] });
                    const result = await this.runtime.getTaskRouter().route(task);
                    if (result.success) {
                        console.log('Directory created successfully.');
                    }
                    else {
                        console.log(`Failed to create directory: ${result.error ?? 'unknown error'}`);
                    }
                    break;
                }
                default:
                    console.log(`Unknown file command: ${sub}`);
                    console.log('Type "help" for available commands.');
            }
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.log(`Error: ${message}`);
        }
    }
    async handleProcess(args) {
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
                    const task = (0, task_v2_1.createProcessTask)({
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
                    }
                    else {
                        console.log(`Process failed: ${result.error ?? 'unknown error'}`);
                    }
                    break;
                }
                default:
                    console.log(`Unknown process command: ${sub}`);
                    console.log('Type "help" for available commands.');
            }
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.log(`Error: ${message}`);
        }
    }
    async handleNpm(args) {
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
                    const task = (0, task_v2_1.createNpmTask)('npm.install', {
                        args: rest,
                    });
                    console.log('Running npm install...');
                    const result = await this.runtime.getTaskRouter().route(task);
                    if (result.success) {
                        if (result.output) {
                            console.log(result.output);
                        }
                        console.log('npm install completed successfully.');
                    }
                    else {
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
                    const task = (0, task_v2_1.createNpmTask)('npm.run', {
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
                    }
                    else {
                        console.log(`npm run failed: ${result.error ?? 'unknown error'}`);
                    }
                    break;
                }
                case 'test': {
                    const task = (0, task_v2_1.createNpmTask)('npm.test', {
                        args: rest,
                    });
                    console.log('Running npm test...');
                    const result = await this.runtime.getTaskRouter().route(task);
                    if (result.success) {
                        if (result.output) {
                            console.log(result.output);
                        }
                        console.log('npm test completed successfully.');
                    }
                    else {
                        console.log(`npm test failed: ${result.error ?? 'unknown error'}`);
                    }
                    break;
                }
                case 'build': {
                    const task = (0, task_v2_1.createNpmTask)('npm.build', {});
                    console.log('Running npm run build...');
                    const result = await this.runtime.getTaskRouter().route(task);
                    if (result.success) {
                        if (result.output) {
                            console.log(result.output);
                        }
                        console.log('npm build completed successfully.');
                    }
                    else {
                        console.log(`npm build failed: ${result.error ?? 'unknown error'}`);
                    }
                    break;
                }
                case 'exec': {
                    if (rest.length === 0) {
                        console.log('Usage: npm exec <args...>');
                        return;
                    }
                    const task = (0, task_v2_1.createNpmTask)('npm.exec', {
                        args: rest,
                    });
                    console.log(`Running npm ${rest.join(' ')}...`);
                    const result = await this.runtime.getTaskRouter().route(task);
                    if (result.success) {
                        if (result.output) {
                            console.log(result.output);
                        }
                        console.log('npm exec completed successfully.');
                    }
                    else {
                        console.log(`npm exec failed: ${result.error ?? 'unknown error'}`);
                    }
                    break;
                }
                default:
                    console.log(`Unknown npm command: ${sub}`);
                    console.log('Type "help" for available commands.');
            }
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.log(`Error: ${message}`);
        }
    }
    async handleGit(args) {
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
                    const task = (0, task_v2_1.createGitTask)('git.status', {});
                    const result = await this.runtime.getTaskRouter().route(task);
                    if (result.success) {
                        if (result.output) {
                            console.log(result.output);
                        }
                    }
                    else {
                        console.log(`git status failed: ${result.error ?? 'unknown error'}`);
                    }
                    break;
                }
                case 'diff': {
                    const task = (0, task_v2_1.createGitTask)('git.diff', {
                        args: rest,
                    });
                    const result = await this.runtime.getTaskRouter().route(task);
                    if (result.success) {
                        if (result.output) {
                            console.log(result.output);
                        }
                    }
                    else {
                        console.log(`git diff failed: ${result.error ?? 'unknown error'}`);
                    }
                    break;
                }
                case 'log': {
                    const task = (0, task_v2_1.createGitTask)('git.log', {
                        args: rest,
                    });
                    const result = await this.runtime.getTaskRouter().route(task);
                    if (result.success) {
                        if (result.output) {
                            console.log(result.output);
                        }
                    }
                    else {
                        console.log(`git log failed: ${result.error ?? 'unknown error'}`);
                    }
                    break;
                }
                case 'branch': {
                    const task = (0, task_v2_1.createGitTask)('git.branch', {});
                    const result = await this.runtime.getTaskRouter().route(task);
                    if (result.success) {
                        if (result.output) {
                            console.log(result.output);
                        }
                    }
                    else {
                        console.log(`git branch failed: ${result.error ?? 'unknown error'}`);
                    }
                    break;
                }
                case 'remote': {
                    const task = (0, task_v2_1.createGitTask)('git.remote', {});
                    const result = await this.runtime.getTaskRouter().route(task);
                    if (result.success) {
                        if (result.output) {
                            console.log(result.output);
                        }
                    }
                    else {
                        console.log(`git remote failed: ${result.error ?? 'unknown error'}`);
                    }
                    break;
                }
                case 'add': {
                    if (rest.length === 0) {
                        console.log('Usage: git add <paths...>');
                        return;
                    }
                    const task = (0, task_v2_1.createGitTask)('git.add', {
                        paths: rest,
                    });
                    console.log(`Staging files: ${rest.join(', ')}`);
                    const result = await this.runtime.getTaskRouter().route(task);
                    if (result.success) {
                        if (result.output) {
                            console.log(result.output);
                        }
                        console.log('Files staged successfully.');
                    }
                    else {
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
                    const task = (0, task_v2_1.createGitTask)('git.commit', {
                        message,
                    });
                    console.log(`Committing with message: ${message}`);
                    const result = await this.runtime.getTaskRouter().route(task);
                    if (result.success) {
                        if (result.output) {
                            console.log(result.output);
                        }
                        console.log('Commit completed successfully.');
                    }
                    else {
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
                    const task = (0, task_v2_1.createGitTask)('git.checkout', {
                        branch,
                    });
                    console.log(`Checking out branch: ${branch}`);
                    const result = await this.runtime.getTaskRouter().route(task);
                    if (result.success) {
                        if (result.output) {
                            console.log(result.output);
                        }
                        console.log('Checkout completed successfully.');
                    }
                    else {
                        console.log(`git checkout failed: ${result.error ?? 'unknown error'}`);
                    }
                    break;
                }
                default:
                    console.log(`Unknown git command: ${sub}`);
                    console.log('Type "help" for available commands.');
            }
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.log(`Error: ${message}`);
        }
    }
    async shutdown() {
        try {
            this.rl?.close();
        }
        catch {
            // ignora
        }
        try {
            await this.runtime.stop();
        }
        catch {
            // ignora
        }
        console.log('Goodbye.');
    }
}
exports.CliInterface = CliInterface;
//# sourceMappingURL=cli-interface.js.map