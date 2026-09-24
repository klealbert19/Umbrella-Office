/**
 * Testes de WorkspaceManager + ProjectScanner (V0.2).
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Logger } from '../src/logging/logger';
import { FilesystemSecurity } from '../src/filesystem/filesystem-security';
import { FilesystemEngine } from '../src/filesystem/filesystem-engine';
import { ProjectScanner } from '../src/scanner/project-scanner';
import { WorkspaceManager } from '../src/workspace/workspace-manager';
import { ConfigManager } from '../src/config/config-manager';

function makeLogger(): Logger {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'umbrella-ws-log-'));
  return new Logger(path.join(dir, 'office.log'));
}

async function makeStack() {
  const logger = makeLogger();
  const security = new FilesystemSecurity(logger);
  const engine = new FilesystemEngine(logger, security);
  const scanner = new ProjectScanner(logger, engine);
  const configManager = new ConfigManager(logger);
  await configManager.init();
  const manager = new WorkspaceManager(logger, security, scanner, configManager);
  return { logger, security, engine, scanner, manager };
}

describe('workspace-manager', () => {
  it('should open, info and close a workspace', async () => {
    const { manager } = await makeStack();
    const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'umbrella-ws-'));

    const opened = await manager.openWorkspace(ws);
    expect(opened.success).toBe(true);
    expect(opened.workspace?.path).toBe(path.resolve(ws));
    expect(opened.workspace?.name).toBeTruthy();
    expect(manager.getActiveWorkspacePath()).toBe(path.resolve(ws));

    const info = await manager.getWorkspaceInfo();
    expect(info.success).toBe(true);
    expect(info.workspace?.path).toBe(path.resolve(ws));

    const closed = await manager.closeWorkspace();
    expect(closed.success).toBe(true);
    expect(manager.getActiveWorkspacePath()).toBeNull();
  });

  it('should fail to open a file (not a directory)', async () => {
    const { manager } = await makeStack();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'umbrella-ws-file-'));
    const file = path.join(dir, 'a.txt');
    fs.writeFileSync(file, 'hi');
    const result = await manager.openWorkspace(file);
    expect(result.success).toBe(false);
    expect(result.code).toBe('NOT_A_DIRECTORY');
  });

  it('should fail to open nonexistent path', async () => {
    const { manager } = await makeStack();
    const result = await manager.openWorkspace(path.join(os.tmpdir(), `nope-${Date.now()}`));
    expect(result.success).toBe(false);
  });

  it('should fail info/close with no active workspace', async () => {
    const { manager } = await makeStack();
    const info = await manager.getWorkspaceInfo();
    expect(info.success).toBe(false);
    expect(info.code).toBe('NO_ACTIVE_WORKSPACE');
    const closed = await manager.closeWorkspace();
    expect(closed.success).toBe(false);
  });

  it('should scan an opened workspace', async () => {
    const { manager } = await makeStack();
    const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'umbrella-ws-scan-'));
    fs.writeFileSync(path.join(ws, 'package.json'), JSON.stringify({ name: 'demo' }));
    fs.writeFileSync(path.join(ws, 'package-lock.json'), '{}');
    fs.writeFileSync(path.join(ws, 'tsconfig.json'), '{}');

    const opened = await manager.openWorkspace(ws);
    expect(opened.success).toBe(true);

    const scanned = await manager.scanWorkspace();
    expect(scanned.success).toBe(true);
    expect(scanned.scan?.projectTypes).toContain('nodejs');
    expect(scanned.scan?.projectTypes).toContain('typescript');
    expect(scanned.scan?.packageManager).toBe('npm');
  });
});

describe('project-scanner', () => {
  it('should detect nodejs + npm + typescript', async () => {
    const logger = makeLogger();
    const security = new FilesystemSecurity(logger);
    const engine = new FilesystemEngine(logger, security);
    const scanner = new ProjectScanner(logger, engine);

    const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'umbrella-scan-'));
    security.setActiveWorkspace(ws);
    fs.writeFileSync(path.join(ws, 'package.json'), JSON.stringify({ name: 'x' }));
    fs.writeFileSync(path.join(ws, 'package-lock.json'), '{}');
    fs.writeFileSync(path.join(ws, 'tsconfig.json'), '{}');

    const result = await scanner.scanProject(ws);
    expect(result.success).toBe(true);
    expect(result.project?.projectTypes).toContain('nodejs');
    expect(result.project?.projectTypes).toContain('typescript');
    expect(result.project?.packageManager).toBe('npm');
  });

  it('should detect python, flutter and git', async () => {
    const logger = makeLogger();
    const security = new FilesystemSecurity(logger);
    const engine = new FilesystemEngine(logger, security);
    const scanner = new ProjectScanner(logger, engine);

    const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'umbrella-scan2-'));
    security.setActiveWorkspace(ws);
    fs.writeFileSync(path.join(ws, 'requirements.txt'), 'requests\n');
    fs.writeFileSync(path.join(ws, 'pubspec.yaml'), 'name: demo\n');
    fs.mkdirSync(path.join(ws, '.git'));

    const result = await scanner.scanProject(ws);
    expect(result.success).toBe(true);
    expect(result.project?.projectTypes).toContain('python');
    expect(result.project?.projectTypes).toContain('flutter');
    expect(result.project?.git).toBe(true);
  });

  it('should detect pnpm/yarn/bun via lockfiles', async () => {
    const logger = makeLogger();
    const security = new FilesystemSecurity(logger);
    const engine = new FilesystemEngine(logger, security);
    const scanner = new ProjectScanner(logger, engine);

    const cases: Array<[string, string]> = [
      ['pnpm-lock.yaml', 'pnpm'],
      ['yarn.lock', 'yarn'],
      ['bun.lockb', 'bun'],
    ];
    for (const [lock, expected] of cases) {
      const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'umbrella-pm-'));
      security.setActiveWorkspace(ws);
      fs.writeFileSync(path.join(ws, 'package.json'), '{}');
      fs.writeFileSync(path.join(ws, lock), '');
      const result = await scanner.scanProject(ws);
      expect(result.success).toBe(true);
      expect(result.project?.packageManager).toBe(expected);
    }
  });

  it('should exclude node_modules/.git from counts', async () => {
    const logger = makeLogger();
    const security = new FilesystemSecurity(logger);
    const engine = new FilesystemEngine(logger, security);
    const scanner = new ProjectScanner(logger, engine);

    const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'umbrella-excl-'));
    security.setActiveWorkspace(ws);
    fs.mkdirSync(path.join(ws, 'node_modules'));
    fs.writeFileSync(path.join(ws, 'node_modules', 'x.js'), 'x');
    fs.writeFileSync(path.join(ws, 'real.txt'), 'hi');

    const result = await scanner.scanProject(ws);
    expect(result.success).toBe(true);
    expect(result.project?.excludedDirectories).toContain('node_modules');
    expect(result.project?.files).toContain('real.txt');
  });
});
