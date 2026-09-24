/**
 * Tipos de tarefas para operações de filesystem e workspace do Umbrella Office V0.2.
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

export type TaskV2 = FilesystemTask | WorkspaceTask;

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

export function isFilesystemTask(task: { type: string }): task is FilesystemTask {
  return task.type.startsWith('filesystem.') || task.type.startsWith('directory.');
}

export function isWorkspaceTask(task: { type: string }): task is WorkspaceTask {
  return task.type.startsWith('workspace.');
}
