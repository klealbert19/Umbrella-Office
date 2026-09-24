/**
 * Roteador de tarefas do Umbrella Office.
 *
 * Fluxo V0.2:
 *   CLI → Task → TaskRouter → PermissionManager → (LocalExecutor | FilesystemEngine | WorkspaceManager) → TaskResult
 *
 * Preparado para futuramente possuir:
 *   TaskRouter
 *    ├── LocalExecutor
 *    ├── FilesystemEngine
 *    ├── WorkspaceManager
 *    └── TunnelExecutor (não implementado na V0.2)
 */
import { Task } from './task';
import { TaskResult, createFailureResult, createSuccessResult } from './result';
import { LocalExecutor } from '../execution/local-executor';
import { PermissionManager } from '../execution/permission-manager';
import { Logger } from '../logging/logger';
import { isFilesystemTask, isWorkspaceTask } from './task-v2';
import { FilesystemEngine } from '../filesystem/filesystem-engine';
import { WorkspaceManager } from '../workspace/workspace-manager';

export class TaskRouter {
  private readonly localExecutor: LocalExecutor;
  private readonly permissionManager: PermissionManager;
  private readonly logger: Logger;
  private readonly filesystemEngine?: FilesystemEngine;
  private readonly workspaceManager?: WorkspaceManager;

  constructor(
    localExecutor: LocalExecutor,
    permissionManager: PermissionManager,
    logger: Logger,
    filesystemEngine?: FilesystemEngine,
    workspaceManager?: WorkspaceManager
  ) {
    this.localExecutor = localExecutor;
    this.permissionManager = permissionManager;
    this.logger = logger;
    this.filesystemEngine = filesystemEngine;
    this.workspaceManager = workspaceManager;
  }

  getWorkspaceManager(): WorkspaceManager | undefined {
    return this.workspaceManager;
  }

  getFilesystemEngine(): FilesystemEngine | undefined {
    return this.filesystemEngine;
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

    // Tipos futuros (ex.: remote.*) serão roteados para o TunnelExecutor.
    const finishedAt = new Date().toISOString();
    this.logger.warn('Unknown task type', { taskId: task.id, type: task.type });
    return createFailureResult(task.id, startedAt, finishedAt, `Unknown task type: ${task.type}`);
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
}
