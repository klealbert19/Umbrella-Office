/**
 * Testes de Task V0.2 (filesystem + workspace).
 */
import {
  createFilesystemTask,
  createWorkspaceTask,
  isFilesystemTask,
  isWorkspaceTask,
} from '../src/core/task-v2';

describe('task-v2', () => {
  it('should create filesystem tasks with id and timestamp', () => {
    const task = createFilesystemTask('filesystem.read', { path: '/tmp/a.txt' });
    expect(task.id).toBeTruthy();
    expect(task.type).toBe('filesystem.read');
    expect(task.createdAt).toBeTruthy();
    expect(new Date(task.createdAt).toString()).not.toBe('Invalid Date');
  });

  it('should create workspace tasks with id and timestamp', () => {
    const task = createWorkspaceTask('workspace.open', { path: '/tmp/ws' });
    expect(task.id).toBeTruthy();
    expect(task.type).toBe('workspace.open');
    expect(task.createdAt).toBeTruthy();
  });

  it('should create unique ids', () => {
    const a = createFilesystemTask('filesystem.read', {});
    const b = createFilesystemTask('filesystem.read', {});
    expect(a.id).not.toBe(b.id);
  });

  it('should guard filesystem tasks', () => {
    expect(isFilesystemTask({ type: 'filesystem.read' })).toBe(true);
    expect(isFilesystemTask({ type: 'filesystem.write' })).toBe(true);
    expect(isFilesystemTask({ type: 'directory.list' })).toBe(true);
    expect(isFilesystemTask({ type: 'directory.create' })).toBe(true);
    expect(isFilesystemTask({ type: 'workspace.open' })).toBe(false);
    expect(isFilesystemTask({ type: 'local.command' })).toBe(false);
  });

  it('should guard workspace tasks', () => {
    expect(isWorkspaceTask({ type: 'workspace.open' })).toBe(true);
    expect(isWorkspaceTask({ type: 'workspace.close' })).toBe(true);
    expect(isWorkspaceTask({ type: 'workspace.scan' })).toBe(true);
    expect(isWorkspaceTask({ type: 'workspace.read' })).toBe(true);
    expect(isWorkspaceTask({ type: 'filesystem.read' })).toBe(false);
    expect(isWorkspaceTask({ type: 'local.command' })).toBe(false);
  });
});
