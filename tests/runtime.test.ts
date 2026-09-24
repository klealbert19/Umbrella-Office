/**
 * Testes de PermissionManager, LocalExecutor, TaskRouter,
 * TunnelClient, UpdateManager e OfficeRuntime.
 *
 * Execução usa o próprio Node.js (process.execPath) para ser cross-platform.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Logger } from '../src/logging/logger';
import { PermissionManager } from '../src/execution/permission-manager';
import { LocalExecutor } from '../src/execution/local-executor';
import { TaskRouter } from '../src/core/task-router';
import { createLocalCommandTask } from '../src/core/task';
import { TunnelClient } from '../src/tunnel/tunnel-client';
import { UpdateManager } from '../src/update/update-manager';
import { OfficeRuntime } from '../src/core/office-runtime';

function makeLogger(): Logger {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'umbrella-log-'));
  return new Logger(path.join(dir, 'office.log'));
}

describe('permission', () => {
  it('should allow process.execute by default', () => {
    const pm = new PermissionManager(makeLogger());
    expect(pm.isAllowed('process.execute')).toBe(true);
  });

  it('should deny after revoke', () => {
    const pm = new PermissionManager(makeLogger());
    pm.revoke('process.execute');
    expect(pm.isAllowed('process.execute')).toBe(false);
    expect(() => pm.checkTaskPermission('local.command')).toThrow();
  });
});

describe('executor', () => {
  it('should execute node --version', async () => {
    const executor = new LocalExecutor(makeLogger());
    const task = createLocalCommandTask(process.execPath, ['--version']);
    const result = await executor.execute(task);
    expect(result.success).toBe(true);
    expect(result.output).toMatch(/v\d+\.\d+\.\d+/);
    expect(result.exitCode).toBe(0);
  }, 15000);

  it('should fail gracefully on unknown command', async () => {
    const executor = new LocalExecutor(makeLogger());
    const task = createLocalCommandTask('__umbrella_nonexistent_cmd__', []);
    const result = await executor.execute(task);
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  }, 15000);
});

describe('router', () => {
  it('should route Task to LocalExecutor', async () => {
    const logger = makeLogger();
    const pm = new PermissionManager(logger);
    const executor = new LocalExecutor(logger);
    const router = new TaskRouter(executor, pm, logger);

    const task = createLocalCommandTask(process.execPath, ['--version']);
    const result = await router.route(task);
    expect(result.success).toBe(true);
    expect(result.taskId).toBe(task.id);
  }, 15000);

  it('should reject unknown task types', async () => {
    const logger = makeLogger();
    const router = new TaskRouter(
      new LocalExecutor(logger),
      new PermissionManager(logger),
      logger
    );
    const result = await router.route({
      id: 'x',
      type: 'unknown.type',
      payload: {},
      createdAt: new Date().toISOString(),
    });
    expect(result.success).toBe(false);
  });
});

describe('tunnel', () => {
  it('should stay DISCONNECTED when orchestrator disabled', async () => {
    const tunnel = new TunnelClient(makeLogger(), { enabled: false, endpoint: null });
    await tunnel.start();
    expect(tunnel.getState()).toBe('DISCONNECTED');
    expect(tunnel.isConnected()).toBe(false);
  });
});

describe('update', () => {
  it('should report current version and NOT_CONFIGURED', async () => {
    const updater = new UpdateManager(makeLogger());
    expect(updater.getCurrentVersion()).toBe('0.2.0');
    const info = await updater.checkForUpdates();
    expect(info.status).toBe('NOT_CONFIGURED');
    expect(info.message).toBe('Update system: NOT CONFIGURED');
  });
});

describe('runtime', () => {
  it('should startup ONLINE and shutdown STOPPED', async () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'umbrella-runtime-'));
    const target = path.join(base, '.umbrella');
    const runtime = new OfficeRuntime();

    await runtime.start(target);
    expect(runtime.getState()).toBe('ONLINE');
    expect(runtime.getMode()).toBe('LOCAL');
    expect(runtime.getTunnelClient().getState()).toBe('DISCONNECTED');

    await runtime.stop();
    expect(runtime.getState()).toBe('STOPPED');
    expect(fs.existsSync(path.join(target, 'config.json'))).toBe(true);
    expect(fs.existsSync(path.join(target, 'state.json'))).toBe(true);
  }, 15000);
});
