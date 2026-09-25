/**
 * Tipos de tarefas para operações de filesystem, workspace, process, npm, git, scheduler, webhook, plugin e remote do Umbrella Office V0.4.
 */
import { randomUUID } from 'crypto';

export interface FilesystemTask {
  id: string;
  type: 'filesystem.read' | 'filesystem.write' | 'filesystem.edit' | 'filesystem.delete' | 'directory.list' | 'directory.create';
  payload: unknown;
  createdAt: string;
}

export interface WorkspaceTask {
  id: string;
  type: 'workspace.open' | 'workspace.close' | 'workspace.scan' | 'workspace.read';
  payload: unknown;
  createdAt: string;
}

export interface ProcessTask {
  id: string;
  type: 'process.execute';
  payload: {
    command: string;
    args?: string[];
    cwd?: string;
    env?: Record<string, string>;
    timeout?: number;
  };
  createdAt: string;
}

export interface NpmTask {
  id: string;
  type: 'npm.install' | 'npm.run' | 'npm.test' | 'npm.build' | 'npm.exec';
  payload: {
    args?: string[];
    script?: string;
    cwd?: string;
    env?: Record<string, string>;
    timeout?: number;
  };
  createdAt: string;
}

export interface GitTask {
  id: string;
  type: 'git.status' | 'git.diff' | 'git.log' | 'git.branch' | 'git.remote' | 'git.add' | 'git.commit' | 'git.checkout';
  payload: {
    args?: string[];
    paths?: string[];
    message?: string;
    branch?: string;
    cwd?: string;
    timeout?: number;
  };
  createdAt: string;
}

export interface SchedulerTask {
  id: string;
  type: 'scheduler.create' | 'scheduler.list' | 'scheduler.info' | 'scheduler.run' | 'scheduler.pause' | 'scheduler.resume' | 'scheduler.remove';
  payload: {
    id?: string;
    name?: string;
    task?: { type: string; payload: unknown };
    schedule?: { type: 'once' | 'interval' | 'cron'; value: string | number };
    enabled?: boolean;
  };
  createdAt: string;
}

export interface WebhookTask {
  id: string;
  type: 'webhook.status' | 'webhook.start' | 'webhook.stop' | 'webhook.list' | 'webhook.register' | 'webhook.unregister';
  payload: {
    path?: string;
    eventType?: string;
    allowedSources?: string[];
    requiredAuth?: boolean;
  };
  createdAt: string;
}

export interface PluginTask {
  id: string;
  type: 'plugin.list' | 'plugin.info' | 'plugin.enable' | 'plugin.disable' | 'plugin.load' | 'plugin.unload';
  payload: {
    id?: string;
    path?: string;
  };
  createdAt: string;
}

export interface RemoteTask {
  id: string;
  type: 'remote.connect' | 'remote.disconnect' | 'remote.status' | 'remote.providers';
  payload: {
    type?: 'local' | 'ssh' | 'wsl';
    name?: string;
    host?: string;
    port?: number;
    user?: string;
    keyPath?: string;
    distribution?: string;
    path?: string;
  };
  createdAt: string;
}

export type TaskV2 = FilesystemTask | WorkspaceTask | ProcessTask | NpmTask | GitTask | SchedulerTask | WebhookTask | PluginTask | RemoteTask;

export function createFilesystemTask(type: FilesystemTask['type'], payload: unknown): FilesystemTask {
  return {
    id: randomUUID(),
    type,
    payload,
    createdAt: new Date().toISOString(),
  };
}

export function createWorkspaceTask(type: WorkspaceTask['type'], payload: unknown): WorkspaceTask {
  return {
    id: randomUUID(),
    type,
    payload,
    createdAt: new Date().toISOString(),
  };
}

export function createProcessTask(payload: ProcessTask['payload']): ProcessTask {
  return {
    id: randomUUID(),
    type: 'process.execute',
    payload,
    createdAt: new Date().toISOString(),
  };
}

export function createNpmTask(type: NpmTask['type'], payload: NpmTask['payload']): NpmTask {
  return {
    id: randomUUID(),
    type,
    payload,
    createdAt: new Date().toISOString(),
  };
}

export function createGitTask(type: GitTask['type'], payload: GitTask['payload']): GitTask {
  return {
    id: randomUUID(),
    type,
    payload,
    createdAt: new Date().toISOString(),
  };
}

export function createSchedulerTask(type: SchedulerTask['type'], payload: SchedulerTask['payload']): SchedulerTask {
  return {
    id: randomUUID(),
    type,
    payload,
    createdAt: new Date().toISOString(),
  };
}

export function createWebhookTask(type: WebhookTask['type'], payload: WebhookTask['payload']): WebhookTask {
  return {
    id: randomUUID(),
    type,
    payload,
    createdAt: new Date().toISOString(),
  };
}

export function createPluginTask(type: PluginTask['type'], payload: PluginTask['payload']): PluginTask {
  return {
    id: randomUUID(),
    type,
    payload,
    createdAt: new Date().toISOString(),
  };
}

export function createRemoteTask(type: RemoteTask['type'], payload: RemoteTask['payload']): RemoteTask {
  return {
    id: randomUUID(),
    type,
    payload,
    createdAt: new Date().toISOString(),
  };
}

export function isFilesystemTask(task: { type: string }): task is FilesystemTask {
  return task.type.startsWith('filesystem.') || task.type.startsWith('directory.');
}

export function isWorkspaceTask(task: { type: string }): task is WorkspaceTask {
  return task.type.startsWith('workspace.');
}

export function isProcessTask(task: { type: string }): task is ProcessTask {
  return task.type === 'process.execute';
}

export function isNpmTask(task: { type: string }): task is NpmTask {
  return task.type.startsWith('npm.');
}

export function isGitTask(task: { type: string }): task is GitTask {
  return task.type.startsWith('git.');
}

export function isSchedulerTask(task: { type: string }): task is SchedulerTask {
  return task.type.startsWith('scheduler.');
}

export function isWebhookTask(task: { type: string }): task is WebhookTask {
  return task.type.startsWith('webhook.');
}

export function isPluginTask(task: { type: string }): task is PluginTask {
  return task.type.startsWith('plugin.');
}

export function isRemoteTask(task: { type: string }): task is RemoteTask {
  return task.type.startsWith('remote.');
}
