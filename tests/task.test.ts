/**
 * Testes de Task e TaskResult.
 */
import { createTask, createLocalCommandTask, isLocalCommandPayload } from '../src/core/task';
import { createSuccessResult, createFailureResult } from '../src/core/result';

describe('task', () => {
  it('should create a task with id and timestamp', () => {
    const task = createTask('local.command', { command: 'node', args: ['--version'] });
    expect(task.id).toBeTruthy();
    expect(task.type).toBe('local.command');
    expect(task.createdAt).toBeTruthy();
    expect(new Date(task.createdAt).toString()).not.toBe('Invalid Date');
  });

  it('should create unique ids', () => {
    const a = createTask('local.command', {});
    const b = createTask('local.command', {});
    expect(a.id).not.toBe(b.id);
  });

  it('should create local command task', () => {
    const task = createLocalCommandTask('node', ['--version']);
    expect(task.type).toBe('local.command');
    expect(isLocalCommandPayload(task.payload)).toBe(true);
  });

  it('should validate local command payload', () => {
    expect(isLocalCommandPayload({ command: 'node', args: ['--version'] })).toBe(true);
    expect(isLocalCommandPayload({ command: 'node' })).toBe(false);
    expect(isLocalCommandPayload(null)).toBe(false);
    expect(isLocalCommandPayload('string')).toBe(false);
  });
});

describe('result', () => {
  it('should create success result', () => {
    const r = createSuccessResult('id-1', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:01.000Z', 'ok', 0);
    expect(r.success).toBe(true);
    expect(r.taskId).toBe('id-1');
    expect(r.output).toBe('ok');
    expect(r.durationMs).toBe(1000);
  });

  it('should create failure result', () => {
    const r = createFailureResult('id-1', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:01.000Z', 'boom', 1);
    expect(r.success).toBe(false);
    expect(r.error).toBe('boom');
    expect(r.exitCode).toBe(1);
  });
});
