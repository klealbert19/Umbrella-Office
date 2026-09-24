/**
 * Testes de TaskRouter V0.2 (filesystem + workspace) e PermissionManager estendido.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Logger } from '../src/logging/logger';
import { PermissionManager } from '../src/execution/permission-manager';
import { LocalExecutor } from '../src/execution/local-executor';
import { TaskRouter } from '../src/core/task-router';
import { createFilesystemTask, createWorkspaceTask } from '../src/core/task-v2';
import { FilesystemSecurity } from '../src/filesystem/filesystem-security';
import { FilesystemEngine } from '../src/filesystem/filesystem-engine';
import { ProjectScanner } from '../src/scanner/project-scanner';
import { WorkspaceManager } from '../src/workspace/workspace-manager';
import { ConfigManager } from '../src/config/config-manager';

function makeLogger(): Logger {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'umbrella-rv2-log-'));
  return new Logger(path.join(dir, 'office.log'));
}

async function makeRouter() {
  const logger = makeLogger();
  const pm = new PermissionManager(logger);
  const executor = new LocalExecutor(logger);
  const security = new FilesystemSecurity(logger);
  const engine = new FilesystemEngine(logger, security);
  const scanner = new ProjectScanner(logger, engine);
  const configManager = new ConfigManager(logger);
  await configManager.init();
  const manager = new WorkspaceManager(logger, security, scanner, configManager);
  const router = new TaskRouter(executor, pm, logger, engine, manager);
  return { logger, pm, router, manager, engine };
}

describe('permission-v2', () => {
  it('should allow all V0.2 permissions by default', () => {
    const pm = new PermissionManager(makeLogger());
    const all = [
      'process.execute',
      'filesystem.read',
      'filesystem.write',
      'filesystem.edit',
      'filesystem.delete',
      'directory.list',
      'directory.create',
      'workspace.open',
      'workspace.close',
      'workspace.read',
      'workspace.scan',
    ] as const;
    for (const p of all) {
      expect(pm.isAllowed(p)).toBe(true);
    }
  });

  it('should deny filesystem task after revoke', async () => {
    const { pm, router } = await makeRouter();
    pm.revoke('filesystem.read');
    expect(() => pm.checkTaskPermission('filesystem.read')).toThrow();
    const task = createFilesystemTask('filesystem.read', { path: '/tmp/x' });
    const result = await router.route(task);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Permission denied/);
  });

  it('should deny workspace task after revoke', () => {
    const pm = new PermissionManager(makeLogger());
    pm.revoke('workspace.open');
    expect(() => pm.checkTaskPermission('workspace.open')).toThrow();
    pm.revoke('workspace.scan');
    expect(() => pm.checkTaskPermission('workspace.scan')).toThrow();
  });
});

describe('router-v2-filesystem', () => {
  it('should route filesystem.write then filesystem.read', async () => {
    const { router, manager } = await makeRouter();
    const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'umbrella-rv2-ws-'));
    const open = await router.route(createWorkspaceTask('workspace.open', { path: ws }));
    expect(open.success).toBe(true);
    expect(manager.getActiveWorkspacePath()).toBe(path.resolve(ws));

    const file = path.join(ws, 'note.txt');
    const written = await router.route(createFilesystemTask('filesystem.write', { path: file, content: 'hello router' }));
    expect(written.success).toBe(true);

    const read = await router.route(createFilesystemTask('filesystem.read', { path: file }));
    expect(read.success).toBe(true);
    expect(read.output).toBe('hello router');
  });

  it('should route directory.create + directory.list + filesystem.delete', async () => {
    const { router } = await makeRouter();
    const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'umbrella-rv2-ws2-'));
    await router.route(createWorkspaceTask('workspace.open', { path: ws }));

    const sub = path.join(ws, 'docs');
    const created = await router.route(createFilesystemTask('directory.create', { path: sub }));
    expect(created.success).toBe(true);

    const file = path.join(sub, 'a.txt');
    await router.route(createFilesystemTask('filesystem.write', { path: file, content: 'x' }));

    const listed = await router.route(createFilesystemTask('directory.list', { path: sub }));
    expect(listed.success).toBe(true);
    expect(String(listed.output)).toContain('a.txt');

    const edited = await router.route(
      createFilesystemTask('filesystem.edit', { path: file, oldText: 'x', newText: 'y' })
    );
    expect(edited.success).toBe(true);

    const deleted = await router.route(createFilesystemTask('filesystem.delete', { path: file }));
    expect(deleted.success).toBe(true);
  });

  it('should fail filesystem without engine', async () => {
    const logger = makeLogger();
    const router = new TaskRouter(
      new LocalExecutor(logger),
      new PermissionManager(logger),
      logger
    );
    const result = await router.route(createFilesystemTask('filesystem.read', { path: '/tmp/x' }));
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/FilesystemEngine not initialized/);
  });
});

describe('router-v2-workspace', () => {
  it('should route workspace.open/read/scan/close', async () => {
    const { router } = await makeRouter();
    const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'umbrella-rv2-ws3-'));
    fs.writeFileSync(path.join(ws, 'package.json'), JSON.stringify({ name: 'demo' }));

    const open = await router.route(createWorkspaceTask('workspace.open', { path: ws }));
    expect(open.success).toBe(true);

    const read = await router.route(createWorkspaceTask('workspace.read', {}));
    expect(read.success).toBe(true);
    expect(String(read.output)).toContain(path.basename(ws));

    const scan = await router.route(createWorkspaceTask('workspace.scan', {}));
    expect(scan.success).toBe(true);
    expect(String(scan.output)).toContain('nodejs');

    const close = await router.route(createWorkspaceTask('workspace.close', {}));
    expect(close.success).toBe(true);

    const readAfter = await router.route(createWorkspaceTask('workspace.read', {}));
    expect(readAfter.success).toBe(false);
  });

  it('should fail workspace without manager', async () => {
    const logger = makeLogger();
    const router = new TaskRouter(
      new LocalExecutor(logger),
      new PermissionManager(logger),
      logger
    );
    const result = await router.route(createWorkspaceTask('workspace.open', { path: '/tmp' }));
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/WorkspaceManager not initialized/);
  });
});
