/**
 * Testes automatizados de uso do Umbrella Office (V0.2).
 *
 * Cobre o fluxo real de utilização:
 *  1. Uso via API (OfficeRuntime + TaskRouter): start → open → write/read/edit/list/mkdir/scan → close → stop
 *  2. Uso via CLI e2e (processo `node dist/main.js` com stdin piped): mesmos comandos do usuário final
 *  3. Robustez: comandos inválidos não derrubam a CLI
 *
 * 100% local, sem rede, cross-platform (Windows/Linux/macOS).
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawn } from 'child_process';
import { OfficeRuntime } from '../src/core/office-runtime';
import { createLocalCommandTask } from '../src/core/task';
import { createFilesystemTask, createWorkspaceTask } from '../src/core/task-v2';

const ROOT = path.resolve(__dirname, '..');
const DIST_MAIN = path.join(ROOT, 'dist', 'main.js');

function makeTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

describe('uso via API: fluxo completo do usuário', () => {
  it('start → run node --version → open → file ops → scan → close → stop', async () => {
    const homeBase = makeTempDir('umbrella-uso-home-');
    const target = path.join(homeBase, '.umbrella');
    const ws = makeTempDir('umbrella-uso-ws-');
    // Arquivo marcador para o scanner detectar nodejs
    fs.writeFileSync(path.join(ws, 'package.json'), JSON.stringify({ name: 'demo-uso' }));

    const runtime = new OfficeRuntime();
    await runtime.start(target);
    expect(runtime.getState()).toBe('ONLINE');

    const router = runtime.getTaskRouter();

    // 1. run (local.command)
    const runResult = await router.route(createLocalCommandTask(process.execPath, ['--version']));
    expect(runResult.success).toBe(true);
    expect(String(runResult.output)).toMatch(/v\d+\.\d+\.\d+/);

    // 2. workspace open
    const open = await router.route(createWorkspaceTask('workspace.open', { path: ws }));
    expect(open.success).toBe(true);

    // 3. file write + read
    const file = path.join(ws, 'hello.txt');
    const written = await router.route(
      createFilesystemTask('filesystem.write', { path: file, content: 'hello umbrella' })
    );
    expect(written.success).toBe(true);

    const read = await router.route(createFilesystemTask('filesystem.read', { path: file }));
    expect(read.success).toBe(true);
    expect(read.output).toBe('hello umbrella');

    // 4. file edit
    const edited = await router.route(
      createFilesystemTask('filesystem.edit', { path: file, oldText: 'umbrella', newText: 'office' })
    );
    expect(edited.success).toBe(true);
    const read2 = await router.route(createFilesystemTask('filesystem.read', { path: file }));
    expect(read2.output).toBe('hello office');

    // 5. directory.create + directory.list
    const sub = path.join(ws, 'docs');
    const mkdir = await router.route(createFilesystemTask('directory.create', { path: sub }));
    expect(mkdir.success).toBe(true);
    const listed = await router.route(createFilesystemTask('directory.list', { path: ws }));
    expect(listed.success).toBe(true);
    expect(String(listed.output)).toContain('hello.txt');

    // 6. workspace scan (detecta nodejs via package.json)
    const scan = await router.route(createWorkspaceTask('workspace.scan', {}));
    expect(scan.success).toBe(true);
    expect(String(scan.output)).toContain('nodejs');

    // 7. workspace read + close
    const info = await router.route(createWorkspaceTask('workspace.read', {}));
    expect(info.success).toBe(true);
    const close = await router.route(createWorkspaceTask('workspace.close', {}));
    expect(close.success).toBe(true);

    // 8. stop persiste config/state
    await runtime.stop();
    expect(runtime.getState()).toBe('STOPPED');
    expect(fs.existsSync(path.join(target, 'config.json'))).toBe(true);
    expect(fs.existsSync(path.join(target, 'state.json'))).toBe(true);
  }, 30000);

  it('uso via API: helpers openWorkspace/closeWorkspace/scanWorkspace do runtime', async () => {
    const homeBase = makeTempDir('umbrella-uso-help-');
    const target = path.join(homeBase, '.umbrella');
    const ws = makeTempDir('umbrella-uso-ws2-');

    const runtime = new OfficeRuntime();
    await runtime.start(target);

    const open = await runtime.openWorkspace(ws);
    expect(open.success).toBe(true);

    const scan = await runtime.scanWorkspace();
    expect(scan.success).toBe(true);

    const close = await runtime.closeWorkspace();
    expect(close.success).toBe(true);

    await runtime.stop();
  }, 30000);
});

interface CliRunResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

/**
 * Executa a CLI real (`node dist/main.js`) alimentando comandos via stdin,
 * como um usuário digitando. Isola o HOME para não poluir ~/.umbrella real.
 */
function runCliWithInput(commands: string[], timeoutMs = 25000): Promise<CliRunResult> {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(DIST_MAIN)) {
      reject(new Error(`dist/main.js não encontrado. Execute "npm run build" antes dos testes e2e.`));
      return;
    }
    const fakeHome = makeTempDir('umbrella-cli-home-');
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      HOME: fakeHome,
      USERPROFILE: fakeHome,
    };
    const child = spawn(process.execPath, [DIST_MAIN], {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d: Buffer) => {
      stdout += d.toString();
    });
    child.stderr.on('data', (d: Buffer) => {
      stderr += d.toString();
    });

    const timer = setTimeout(() => {
      try {
        child.kill();
      } catch {
        // ignora
      }
      reject(new Error(`CLI e2e timeout após ${timeoutMs}ms. Saída parcial:\n${stdout}\nSTDERR:\n${stderr}`));
    }, timeoutMs);

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, exitCode: code });
    });

    // Envia comandos em sequência e fecha o stdin (EOF)
    const input = commands.join('\n') + '\n';
    child.stdin.write(input, (err) => {
      if (err) {
        clearTimeout(timer);
        reject(err);
        return;
      }
      child.stdin.end();
    });
  });
}

describe('uso via CLI e2e: sessão real do usuário', () => {
  it('banner → status → version → config → run → exit', async () => {
    const result = await runCliWithInput([
      'status',
      'version',
      'config',
      `run "${process.execPath}" --version`,
      'exit',
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Umbrella Office/);
    expect(result.stdout).toMatch(/Runtime: ONLINE/);
    expect(result.stdout).toMatch(/Version: 0\.3\.1/);
    expect(result.stdout).toMatch(/v\d+\.\d+\.\d+/);
    expect(result.stdout).toMatch(/Goodbye/);
  }, 30000);

  it('workspace open → file write/read/list/mkdir → scan → close → exit', async () => {
    const ws = makeTempDir('umbrella-cli-ws-');
    fs.writeFileSync(path.join(ws, 'package.json'), JSON.stringify({ name: 'demo-cli' }));
    const helloFile = path.join(ws, 'hello.txt');
    const docsDir = path.join(ws, 'docs');

    const result = await runCliWithInput([
      `workspace open "${ws}"`,
      'workspace info',
      'workspace current',
      `file write "${helloFile}" hello world`,
      `file read "${helloFile}"`,
      `file list "${ws}"`,
      `file mkdir "${docsDir}"`,
      'workspace scan',
      'workspace close',
      'exit',
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Workspace opened successfully/);
    expect(result.stdout).toMatch(/hello world/);
    expect(result.stdout).toMatch(/hello\.txt/);
    expect(result.stdout).toMatch(/Directory created successfully/);
    expect(result.stdout).toMatch(/Scan completed successfully/);
    expect(result.stdout).toMatch(/Workspace closed successfully/);
    expect(result.stdout).toMatch(/Goodbye/);
    // Efeito colateral real no disco
    expect(fs.existsSync(helloFile)).toBe(true);
    expect(fs.existsSync(docsDir)).toBe(true);
  }, 30000);

  it('comandos inválidos não derrubam a CLI', async () => {
    const result = await runCliWithInput(['comando-inexistente', 'workspace', 'file', 'help', 'exit']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/Unknown command/);
    expect(result.stdout).toMatch(/Available commands/);
    expect(result.stdout).toMatch(/Goodbye/);
  }, 30000);
});
