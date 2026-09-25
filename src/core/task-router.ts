/**
 * Roteador de tarefas do Umbrella Office.
 *
 * Fluxo V0.4:
 *   CLI → Task → TaskRouter → PermissionManager → (LocalExecutor | FilesystemEngine | WorkspaceManager | ProcessTool | NpmTool | GitTool | Scheduler | WebhookServer | PluginManager | RemoteWorkspaceManager) → TaskResult
 */
import { Task } from './task';
import { TaskResult, createFailureResult, createSuccessResult } from './result';
import { LocalExecutor } from '../execution/local-executor';
import { PermissionManager } from '../execution/permission-manager';
import { Logger } from '../logging/logger';
import { isFilesystemTask, isWorkspaceTask, isProcessTask, isNpmTask, isGitTask, isSchedulerTask, isWebhookTask, isPluginTask, isRemoteTask } from './task-v2';
import { FilesystemEngine } from '../filesystem/filesystem-engine';
import { WorkspaceManager } from '../workspace/workspace-manager';
import { ProcessTool } from '../tools/process/process-tool';
import { NpmTool } from '../tools/npm/npm-tool';
import { GitTool } from '../tools/git/git-tool';
import { Scheduler } from '../scheduler/scheduler';
import { WebhookServer } from '../webhook/webhook-server';
import { PluginManager } from '../plugins/plugin-manager';
import { RemoteWorkspaceManager } from '../remote/remote-manager';

export class TaskRouter {
  private readonly localExecutor: LocalExecutor;
  private readonly permissionManager: PermissionManager;
  private readonly logger: Logger;
  private readonly filesystemEngine?: FilesystemEngine;
  private readonly workspaceManager?: WorkspaceManager;
  private readonly processTool?: ProcessTool;
  private readonly npmTool?: NpmTool;
  private readonly gitTool?: GitTool;
  private readonly scheduler?: Scheduler;
  private readonly webhookServer?: WebhookServer;
  private readonly pluginManager?: PluginManager;
  private readonly remoteWorkspaceManager?: RemoteWorkspaceManager;

  constructor(
    localExecutor: LocalExecutor,
    permissionManager: PermissionManager,
    logger: Logger,
    filesystemEngine?: FilesystemEngine,
    workspaceManager?: WorkspaceManager,
    processTool?: ProcessTool,
    npmTool?: NpmTool,
    gitTool?: GitTool,
    scheduler?: Scheduler,
    webhookServer?: WebhookServer,
    pluginManager?: PluginManager,
    remoteWorkspaceManager?: RemoteWorkspaceManager
  ) {
    this.localExecutor = localExecutor;
    this.permissionManager = permissionManager;
    this.logger = logger;
    this.filesystemEngine = filesystemEngine;
    this.workspaceManager = workspaceManager;
    this.processTool = processTool;
    this.npmTool = npmTool;
    this.gitTool = gitTool;
    this.scheduler = scheduler;
    this.webhookServer = webhookServer;
    this.pluginManager = pluginManager;
    this.remoteWorkspaceManager = remoteWorkspaceManager;
  }

  getWorkspaceManager(): WorkspaceManager | undefined {
    return this.workspaceManager;
  }

  getFilesystemEngine(): FilesystemEngine | undefined {
    return this.filesystemEngine;
  }

  getProcessTool(): ProcessTool | undefined {
    return this.processTool;
  }

  getNpmTool(): NpmTool | undefined {
    return this.npmTool;
  }

  getGitTool(): GitTool | undefined {
    return this.gitTool;
  }

  getScheduler(): Scheduler | undefined {
    return this.scheduler;
  }

  getWebhookServer(): WebhookServer | undefined {
    return this.webhookServer;
  }

  getPluginManager(): PluginManager | undefined {
    return this.pluginManager;
  }

  getRemoteWorkspaceManager(): RemoteWorkspaceManager | undefined {
    return this.remoteWorkspaceManager;
  }

  async route(task: Task): Promise<TaskResult> {
    const startedAt = new Date().toISOString();
    this.logger.info('Task created', { taskId: task.id, type: task.type });

    try {
      this.permissionManager.checkTaskPermission(task.type);
    } catch (err) {
      const finishedAt = new Date().toISOString();
      const message = err instanceof Error ? err.message : String(err);
      return createFailureResult(task.id, startedAt, finishedAt, message);
    }

    if (task.type === 'local.command') {
      return this.localExecutor.execute(task);
    }

    if (isFilesystemTask(task)) {
      return this.routeFilesystemTask(task);
    }

    if (isWorkspaceTask(task)) {
      return this.routeWorkspaceTask(task);
    }

    if (isProcessTask(task)) {
      return this.routeProcessTask(task);
    }

    if (isNpmTask(task)) {
      return this.routeNpmTask(task);
    }

    if (isGitTask(task)) {
      return this.routeGitTask(task);
    }

    if (isSchedulerTask(task)) {
      return this.routeSchedulerTask(task);
    }

    if (isWebhookTask(task)) {
      return this.routeWebhookTask(task);
    }

    if (isPluginTask(task)) {
      return this.routePluginTask(task);
    }

    if (isRemoteTask(task)) {
      return this.routeRemoteTask(task);
    }

    // Tipos futuros (ex.: remote.*) serão roteados para o TunnelExecutor.
    const finishedAt = new Date().toISOString();
    this.logger.warn('Unknown task type', { taskId: task.id, type: task.type });
    return createFailureResult(task.id, startedAt, finishedAt, `Unknown task type: ${task.type}`);
  }

  private async routeProcessTask(task: Task): Promise<TaskResult> {
    const startedAt = new Date().toISOString();
    if (!this.processTool) {
      const finishedAt = new Date().toISOString();
      return createFailureResult(task.id, startedAt, finishedAt, 'ProcessTool not initialized');
    }
    const payload = task.payload as Record<string, unknown>;
    try {
      const result = await this.processTool.execute({
        command: String(payload['command'] ?? ''),
        args: (payload['args'] as string[]) ?? [],
        cwd: payload['cwd'] as string | undefined,
        env: payload['env'] as Record<string, string> | undefined,
        timeout: payload['timeout'] as number | undefined,
      });
      const finishedAt = new Date().toISOString();
      if (result.success) {
        return createSuccessResult(
          task.id,
          startedAt,
          finishedAt,
          JSON.stringify({
            exitCode: result.exitCode,
            stdout: result.stdout,
            stderr: result.stderr,
            duration: result.duration,
            timedOut: result.timedOut,
          }, null, 2),
          result.exitCode
        );
      }
      return createFailureResult(task.id, startedAt, finishedAt, result.stderr || `Process exited with code ${result.exitCode}`, result.exitCode);
    } catch (err) {
      const finishedAt = new Date().toISOString();
      const message = err instanceof Error ? err.message : String(err);
      return createFailureResult(task.id, startedAt, finishedAt, message);
    }
  }

  private async routeNpmTask(task: Task): Promise<TaskResult> {
    const startedAt = new Date().toISOString();
    if (!this.npmTool) {
      const finishedAt = new Date().toISOString();
      return createFailureResult(task.id, startedAt, finishedAt, 'NpmTool not initialized');
    }
    const payload = task.payload as Record<string, unknown>;
    try {
      let result;
      switch (task.type) {
        case 'npm.install':
          result = await this.npmTool.install({
            args: (payload['args'] as string[]) ?? [],
            cwd: payload['cwd'] as string | undefined,
            env: payload['env'] as Record<string, string> | undefined,
            timeout: payload['timeout'] as number | undefined,
          });
          break;
        case 'npm.run':
          result = await this.npmTool.run({
            script: String(payload['script'] ?? ''),
            args: (payload['args'] as string[]) ?? [],
            cwd: payload['cwd'] as string | undefined,
            env: payload['env'] as Record<string, string> | undefined,
            timeout: payload['timeout'] as number | undefined,
          });
          break;
        case 'npm.test':
          result = await this.npmTool.test({
            args: (payload['args'] as string[]) ?? [],
            cwd: payload['cwd'] as string | undefined,
            env: payload['env'] as Record<string, string> | undefined,
            timeout: payload['timeout'] as number | undefined,
          });
          break;
        case 'npm.build':
          result = await this.npmTool.build({
            cwd: payload['cwd'] as string | undefined,
            env: payload['env'] as Record<string, string> | undefined,
            timeout: payload['timeout'] as number | undefined,
          });
          break;
        case 'npm.exec':
          result = await this.npmTool.exec({
            args: (payload['args'] as string[]) ?? [],
            cwd: payload['cwd'] as string | undefined,
            env: payload['env'] as Record<string, string> | undefined,
            timeout: payload['timeout'] as number | undefined,
          });
          break;
        default:
          const finishedAt = new Date().toISOString();
          return createFailureResult(task.id, startedAt, finishedAt, `Unknown npm task: ${task.type}`);
      }
      const finishedAt = new Date().toISOString();
      if (result.success) {
        return createSuccessResult(
          task.id,
          startedAt,
          finishedAt,
          JSON.stringify({
            exitCode: result.exitCode,
            stdout: result.stdout,
            stderr: result.stderr,
            duration: result.duration,
            timedOut: result.timedOut,
          }, null, 2),
          result.exitCode
        );
      }
      return createFailureResult(task.id, startedAt, finishedAt, result.stderr || `NPM command failed with code ${result.exitCode}`, result.exitCode);
    } catch (err) {
      const finishedAt = new Date().toISOString();
      const message = err instanceof Error ? err.message : String(err);
      return createFailureResult(task.id, startedAt, finishedAt, message);
    }
  }

  private async routeGitTask(task: Task): Promise<TaskResult> {
    const startedAt = new Date().toISOString();
    if (!this.gitTool) {
      const finishedAt = new Date().toISOString();
      return createFailureResult(task.id, startedAt, finishedAt, 'GitTool not initialized');
    }
    const payload = task.payload as Record<string, unknown>;
    try {
      let result;
      switch (task.type) {
        case 'git.status':
          result = await this.gitTool.status({
            cwd: payload['cwd'] as string | undefined,
            timeout: payload['timeout'] as number | undefined,
          });
          break;
        case 'git.diff':
          result = await this.gitTool.diff({
            args: (payload['args'] as string[]) ?? [],
            cwd: payload['cwd'] as string | undefined,
            timeout: payload['timeout'] as number | undefined,
          });
          break;
        case 'git.log':
          result = await this.gitTool.log({
            args: (payload['args'] as string[]) ?? [],
            cwd: payload['cwd'] as string | undefined,
            timeout: payload['timeout'] as number | undefined,
          });
          break;
        case 'git.branch':
          result = await this.gitTool.branch({
            cwd: payload['cwd'] as string | undefined,
            timeout: payload['timeout'] as number | undefined,
          });
          break;
        case 'git.remote':
          result = await this.gitTool.remote({
            cwd: payload['cwd'] as string | undefined,
            timeout: payload['timeout'] as number | undefined,
          });
          break;
        case 'git.add':
          result = await this.gitTool.add({
            paths: (payload['paths'] as string[]) ?? [],
            cwd: payload['cwd'] as string | undefined,
            timeout: payload['timeout'] as number | undefined,
          });
          break;
        case 'git.commit':
          result = await this.gitTool.commit({
            message: String(payload['message'] ?? ''),
            cwd: payload['cwd'] as string | undefined,
            timeout: payload['timeout'] as number | undefined,
          });
          break;
        case 'git.checkout':
          result = await this.gitTool.checkout({
            branch: String(payload['branch'] ?? ''),
            cwd: payload['cwd'] as string | undefined,
            timeout: payload['timeout'] as number | undefined,
          });
          break;
        default:
          const finishedAt = new Date().toISOString();
          return createFailureResult(task.id, startedAt, finishedAt, `Unknown git task: ${task.type}`);
      }
      const finishedAt = new Date().toISOString();
      if (result.success) {
        return createSuccessResult(
          task.id,
          startedAt,
          finishedAt,
          JSON.stringify({
            exitCode: result.exitCode,
            stdout: result.stdout,
            stderr: result.stderr,
            duration: result.duration,
            timedOut: result.timedOut,
          }, null, 2),
          result.exitCode
        );
      }
      return createFailureResult(task.id, startedAt, finishedAt, result.stderr || `Git command failed with code ${result.exitCode}`, result.exitCode);
    } catch (err) {
      const finishedAt = new Date().toISOString();
      const message = err instanceof Error ? err.message : String(err);
      return createFailureResult(task.id, startedAt, finishedAt, message);
    }
  }

  private async routeFilesystemTask(task: Task): Promise<TaskResult> {
    const startedAt = new Date().toISOString();
    if (!this.filesystemEngine) {
      const finishedAt = new Date().toISOString();
      return createFailureResult(task.id, startedAt, finishedAt, 'FilesystemEngine not initialized');
    }
    const payload = task.payload as Record<string, unknown>;
    try {
      switch (task.type) {
        case 'filesystem.read': {
          const result = await this.filesystemEngine.readFile(String(payload['path'] ?? ''));
          const finishedAt = new Date().toISOString();
          if (result.success && result.file) {
            return createSuccessResult(task.id, startedAt, finishedAt, result.file.content, 0);
          }
          return createFailureResult(task.id, startedAt, finishedAt, result.error ?? 'read failed');
        }
        case 'filesystem.write': {
          const result = await this.filesystemEngine.writeFile(String(payload['path'] ?? ''), String(payload['content'] ?? ''));
          const finishedAt = new Date().toISOString();
          if (result.success) {
            return createSuccessResult(task.id, startedAt, finishedAt, `written ${result.bytesWritten ?? 0} bytes`, 0);
          }
          return createFailureResult(task.id, startedAt, finishedAt, result.error ?? 'write failed');
        }
        case 'filesystem.edit': {
          const result = await this.filesystemEngine.editFile(
            String(payload['path'] ?? ''),
            String(payload['oldText'] ?? ''),
            String(payload['newText'] ?? ''),
            Boolean(payload['replaceAll'])
          );
          const finishedAt = new Date().toISOString();
          if (result.success) {
            return createSuccessResult(task.id, startedAt, finishedAt, `replacements: ${result.replacements ?? 0}`, 0);
          }
          return createFailureResult(task.id, startedAt, finishedAt, result.error ?? 'edit failed');
        }
        case 'filesystem.delete': {
          const result = await this.filesystemEngine.deleteFile(String(payload['path'] ?? ''));
          const finishedAt = new Date().toISOString();
          if (result.success) {
            return createSuccessResult(task.id, startedAt, finishedAt, 'deleted', 0);
          }
          return createFailureResult(task.id, startedAt, finishedAt, result.error ?? 'delete failed');
        }
        case 'directory.list': {
          const result = await this.filesystemEngine.listDirectory(String(payload['path'] ?? ''));
          const finishedAt = new Date().toISOString();
          if (result.success && result.entries) {
            return createSuccessResult(task.id, startedAt, finishedAt, JSON.stringify(result.entries, null, 2), 0);
          }
          return createFailureResult(task.id, startedAt, finishedAt, result.error ?? 'list failed');
        }
        case 'directory.create': {
          const result = await this.filesystemEngine.createDirectory(String(payload['path'] ?? ''));
          const finishedAt = new Date().toISOString();
          if (result.success) {
            return createSuccessResult(task.id, startedAt, finishedAt, 'directory created', 0);
          }
          return createFailureResult(task.id, startedAt, finishedAt, result.error ?? 'create failed');
        }
        default: {
          const finishedAt = new Date().toISOString();
          return createFailureResult(task.id, startedAt, finishedAt, `Unknown filesystem task: ${task.type}`);
        }
      }
    } catch (err) {
      const finishedAt = new Date().toISOString();
      const message = err instanceof Error ? err.message : String(err);
      return createFailureResult(task.id, startedAt, finishedAt, message);
    }
  }

  private async routeWorkspaceTask(task: Task): Promise<TaskResult> {
    const startedAt = new Date().toISOString();
    if (!this.workspaceManager) {
      const finishedAt = new Date().toISOString();
      return createFailureResult(task.id, startedAt, finishedAt, 'WorkspaceManager not initialized');
    }
    const payload = task.payload as Record<string, unknown>;
    try {
      switch (task.type) {
        case 'workspace.open': {
          const result = await this.workspaceManager.openWorkspace(String(payload['path'] ?? ''));
          const finishedAt = new Date().toISOString();
          if (result.success && result.workspace) {
            return createSuccessResult(task.id, startedAt, finishedAt, JSON.stringify(result.workspace, null, 2), 0);
          }
          return createFailureResult(task.id, startedAt, finishedAt, result.error ?? 'open failed');
        }
        case 'workspace.close': {
          const result = await this.workspaceManager.closeWorkspace();
          const finishedAt = new Date().toISOString();
          if (result.success) {
            return createSuccessResult(task.id, startedAt, finishedAt, JSON.stringify(result.workspace ?? {}, null, 2), 0);
          }
          return createFailureResult(task.id, startedAt, finishedAt, result.error ?? 'close failed');
        }
        case 'workspace.read': {
          const result = await this.workspaceManager.getWorkspaceInfo();
          const finishedAt = new Date().toISOString();
          if (result.success && result.workspace) {
            return createSuccessResult(task.id, startedAt, finishedAt, JSON.stringify(result.workspace, null, 2), 0);
          }
          return createFailureResult(task.id, startedAt, finishedAt, result.error ?? 'no workspace');
        }
        case 'workspace.scan': {
          const scanPath = payload['path'] ? String(payload['path']) : undefined;
          const result = await this.workspaceManager.scanWorkspace(scanPath);
          const finishedAt = new Date().toISOString();
          if (result.success && result.scan) {
            return createSuccessResult(task.id, startedAt, finishedAt, JSON.stringify(result.scan, null, 2), 0);
          }
          return createFailureResult(task.id, startedAt, finishedAt, result.error ?? 'scan failed');
        }
        default: {
          const finishedAt = new Date().toISOString();
          return createFailureResult(task.id, startedAt, finishedAt, `Unknown workspace task: ${task.type}`);
        }
      }
    } catch (err) {
      const finishedAt = new Date().toISOString();
      const message = err instanceof Error ? err.message : String(err);
      return createFailureResult(task.id, startedAt, finishedAt, message);
    }
  }

  private async routeSchedulerTask(task: Task): Promise<TaskResult> {
    const startedAt = new Date().toISOString();
    if (!this.scheduler) {
      const finishedAt = new Date().toISOString();
      return createFailureResult(task.id, startedAt, finishedAt, 'Scheduler not initialized');
    }
    const payload = task.payload as Record<string, unknown>;
    try {
      let result;
      switch (task.type) {
        case 'scheduler.create': {
          const scheduledTask = this.scheduler.createTask(
            String(payload['name'] ?? ''),
            payload['task'] as { type: string; payload: unknown },
            payload['schedule'] as { type: 'once' | 'interval' | 'cron'; value: string | number }
          );
          const finishedAt = new Date().toISOString();
          return createSuccessResult(task.id, startedAt, finishedAt, JSON.stringify(scheduledTask, null, 2), 0);
        }
        case 'scheduler.list': {
          const tasks = this.scheduler.listTasks();
          const finishedAt = new Date().toISOString();
          return createSuccessResult(task.id, startedAt, finishedAt, JSON.stringify(tasks, null, 2), 0);
        }
        case 'scheduler.info': {
          const taskId = String(payload['id'] ?? '');
          const scheduledTask = this.scheduler.getTask(taskId);
          const finishedAt = new Date().toISOString();
          if (scheduledTask) {
            return createSuccessResult(task.id, startedAt, finishedAt, JSON.stringify(scheduledTask, null, 2), 0);
          }
          return createFailureResult(task.id, startedAt, finishedAt, 'Task not found');
        }
        case 'scheduler.run': {
          const taskId = String(payload['id'] ?? '');
          result = await this.scheduler.runTaskNow(taskId);
          return result;
        }
        case 'scheduler.pause': {
          const taskId = String(payload['id'] ?? '');
          const success = await this.scheduler.pauseTask(taskId);
          const finishedAt = new Date().toISOString();
          if (success) {
            return createSuccessResult(task.id, startedAt, finishedAt, 'Task paused', 0);
          }
          return createFailureResult(task.id, startedAt, finishedAt, 'Task not found');
        }
        case 'scheduler.resume': {
          const taskId = String(payload['id'] ?? '');
          const success = await this.scheduler.resumeTask(taskId);
          const finishedAt = new Date().toISOString();
          if (success) {
            return createSuccessResult(task.id, startedAt, finishedAt, 'Task resumed', 0);
          }
          return createFailureResult(task.id, startedAt, finishedAt, 'Task not found');
        }
        case 'scheduler.remove': {
          const taskId = String(payload['id'] ?? '');
          const success = await this.scheduler.removeTask(taskId);
          const finishedAt = new Date().toISOString();
          if (success) {
            return createSuccessResult(task.id, startedAt, finishedAt, 'Task removed', 0);
          }
          return createFailureResult(task.id, startedAt, finishedAt, 'Task not found');
        }
        default: {
          const finishedAt = new Date().toISOString();
          return createFailureResult(task.id, startedAt, finishedAt, `Unknown scheduler task: ${task.type}`);
        }
      }
    } catch (err) {
      const finishedAt = new Date().toISOString();
      const message = err instanceof Error ? err.message : String(err);
      return createFailureResult(task.id, startedAt, finishedAt, message);
    }
  }

  private async routeWebhookTask(task: Task): Promise<TaskResult> {
    const startedAt = new Date().toISOString();
    if (!this.webhookServer) {
      const finishedAt = new Date().toISOString();
      return createFailureResult(task.id, startedAt, finishedAt, 'WebhookServer not initialized');
    }
    const payload = task.payload as Record<string, unknown>;
    try {
      switch (task.type) {
        case 'webhook.status': {
          const status = this.webhookServer.getStatus();
          const finishedAt = new Date().toISOString();
          return createSuccessResult(task.id, startedAt, finishedAt, JSON.stringify(status, null, 2), 0);
        }
        case 'webhook.start': {
          await this.webhookServer.start();
          const finishedAt = new Date().toISOString();
          return createSuccessResult(task.id, startedAt, finishedAt, 'Webhook server started', 0);
        }
        case 'webhook.stop': {
          await this.webhookServer.stop();
          const finishedAt = new Date().toISOString();
          return createSuccessResult(task.id, startedAt, finishedAt, 'Webhook server stopped', 0);
        }
        case 'webhook.list': {
          const endpoints = this.webhookServer.listEndpoints();
          const finishedAt = new Date().toISOString();
          return createSuccessResult(task.id, startedAt, finishedAt, JSON.stringify(endpoints, null, 2), 0);
        }
        case 'webhook.register': {
          const path = String(payload['path'] ?? '');
          const eventType = String(payload['eventType'] ?? '');
          const allowedSources = (payload['allowedSources'] as string[]) ?? [];
          const requiredAuth = Boolean(payload['requiredAuth']);
          this.webhookServer.registerEndpoint({ path, eventType, allowedSources, requiredAuth });
          const finishedAt = new Date().toISOString();
          return createSuccessResult(task.id, startedAt, finishedAt, 'Endpoint registered', 0);
        }
        case 'webhook.unregister': {
          const path = String(payload['path'] ?? '');
          const success = this.webhookServer.unregisterEndpoint(path);
          const finishedAt = new Date().toISOString();
          if (success) {
            return createSuccessResult(task.id, startedAt, finishedAt, 'Endpoint unregistered', 0);
          }
          return createFailureResult(task.id, startedAt, finishedAt, 'Endpoint not found');
        }
        default: {
          const finishedAt = new Date().toISOString();
          return createFailureResult(task.id, startedAt, finishedAt, `Unknown webhook task: ${task.type}`);
        }
      }
    } catch (err) {
      const finishedAt = new Date().toISOString();
      const message = err instanceof Error ? err.message : String(err);
      return createFailureResult(task.id, startedAt, finishedAt, message);
    }
  }

  private async routePluginTask(task: Task): Promise<TaskResult> {
    const startedAt = new Date().toISOString();
    if (!this.pluginManager) {
      const finishedAt = new Date().toISOString();
      return createFailureResult(task.id, startedAt, finishedAt, 'PluginManager not initialized');
    }
    const payload = task.payload as Record<string, unknown>;
    try {
      switch (task.type) {
        case 'plugin.list': {
          const plugins = this.pluginManager.listPlugins();
          const finishedAt = new Date().toISOString();
          return createSuccessResult(task.id, startedAt, finishedAt, JSON.stringify(plugins, null, 2), 0);
        }
        case 'plugin.info': {
          const pluginId = String(payload['id'] ?? '');
          const plugin = this.pluginManager.getPlugin(pluginId);
          const finishedAt = new Date().toISOString();
          if (plugin) {
            return createSuccessResult(task.id, startedAt, finishedAt, JSON.stringify(plugin, null, 2), 0);
          }
          return createFailureResult(task.id, startedAt, finishedAt, 'Plugin not found');
        }
        case 'plugin.enable': {
          const pluginId = String(payload['id'] ?? '');
          const success = await this.pluginManager.enablePlugin(pluginId);
          const finishedAt = new Date().toISOString();
          if (success) {
            return createSuccessResult(task.id, startedAt, finishedAt, 'Plugin enabled', 0);
          }
          return createFailureResult(task.id, startedAt, finishedAt, 'Failed to enable plugin');
        }
        case 'plugin.disable': {
          const pluginId = String(payload['id'] ?? '');
          const success = await this.pluginManager.disablePlugin(pluginId);
          const finishedAt = new Date().toISOString();
          if (success) {
            return createSuccessResult(task.id, startedAt, finishedAt, 'Plugin disabled', 0);
          }
          return createFailureResult(task.id, startedAt, finishedAt, 'Failed to disable plugin');
        }
        case 'plugin.load': {
          const pluginPath = String(payload['path'] ?? '');
          const plugin = await this.pluginManager.loadPlugin(pluginPath);
          const finishedAt = new Date().toISOString();
          if (plugin) {
            return createSuccessResult(task.id, startedAt, finishedAt, JSON.stringify(plugin, null, 2), 0);
          }
          return createFailureResult(task.id, startedAt, finishedAt, 'Failed to load plugin');
        }
        case 'plugin.unload': {
          const pluginId = String(payload['id'] ?? '');
          const success = await this.pluginManager.removePlugin(pluginId);
          const finishedAt = new Date().toISOString();
          if (success) {
            return createSuccessResult(task.id, startedAt, finishedAt, 'Plugin removed', 0);
          }
          return createFailureResult(task.id, startedAt, finishedAt, 'Failed to remove plugin');
        }
        default: {
          const finishedAt = new Date().toISOString();
          return createFailureResult(task.id, startedAt, finishedAt, `Unknown plugin task: ${task.type}`);
        }
      }
    } catch (err) {
      const finishedAt = new Date().toISOString();
      const message = err instanceof Error ? err.message : String(err);
      return createFailureResult(task.id, startedAt, finishedAt, message);
    }
  }

  private async routeRemoteTask(task: Task): Promise<TaskResult> {
    const startedAt = new Date().toISOString();
    if (!this.remoteWorkspaceManager) {
      const finishedAt = new Date().toISOString();
      return createFailureResult(task.id, startedAt, finishedAt, 'RemoteWorkspaceManager not initialized');
    }
    const payload = task.payload as Record<string, unknown>;
    try {
      switch (task.type) {
        case 'remote.connect': {
          const config = {
            type: String(payload['type'] ?? 'local') as 'local' | 'ssh' | 'wsl',
            name: String(payload['name'] ?? ''),
            host: payload['host'] as string | undefined,
            port: payload['port'] as number | undefined,
            user: payload['user'] as string | undefined,
            keyPath: payload['keyPath'] as string | undefined,
            distribution: payload['distribution'] as string | undefined,
            path: String(payload['path'] ?? ''),
          };
          await this.remoteWorkspaceManager.connect(config);
          const finishedAt = new Date().toISOString();
          return createSuccessResult(task.id, startedAt, finishedAt, 'Workspace connected', 0);
        }
        case 'remote.disconnect': {
          await this.remoteWorkspaceManager.disconnect();
          const finishedAt = new Date().toISOString();
          return createSuccessResult(task.id, startedAt, finishedAt, 'Workspace disconnected', 0);
        }
        case 'remote.status': {
          const provider = this.remoteWorkspaceManager.getActiveProvider();
          const config = this.remoteWorkspaceManager.getActiveConfig();
          const finishedAt = new Date().toISOString();
          return createSuccessResult(task.id, startedAt, finishedAt, JSON.stringify({
            connected: this.remoteWorkspaceManager.isConnected(),
            provider: provider ? { type: provider.type, name: provider.name } : null,
            config: config ? { type: config.type, name: config.name, path: config.path } : null,
          }, null, 2), 0);
        }
        case 'remote.providers': {
          const providers = this.remoteWorkspaceManager.listProviders();
          const finishedAt = new Date().toISOString();
          return createSuccessResult(task.id, startedAt, finishedAt, JSON.stringify(providers.map(p => ({ type: p.type, name: p.name })), null, 2), 0);
        }
        default: {
          const finishedAt = new Date().toISOString();
          return createFailureResult(task.id, startedAt, finishedAt, `Unknown remote task: ${task.type}`);
        }
      }
    } catch (err) {
      const finishedAt = new Date().toISOString();
      const message = err instanceof Error ? err.message : String(err);
      return createFailureResult(task.id, startedAt, finishedAt, message);
    }
  }
}
