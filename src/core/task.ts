/**
 * Abstração de tarefa do Umbrella Office.
 *
 * Toda execução local passa pelo conceito de Task.
 */
import { randomUUID } from 'crypto';

export interface Task {
  id: string;
  type: string;
  payload: unknown;
  createdAt: string;
}

export interface LocalCommandPayload {
  command: string;
  args: string[];
}

export function createTask(type: string, payload: unknown): Task {
  return {
    id: randomUUID(),
    type,
    payload,
    createdAt: new Date().toISOString(),
  };
}

export function createLocalCommandTask(command: string, args: string[]): Task {
  const payload: LocalCommandPayload = { command, args };
  return createTask('local.command', payload);
}

export function isLocalCommandPayload(payload: unknown): payload is LocalCommandPayload {
  if (typeof payload !== 'object' || payload === null) return false;
  const p = payload as Record<string, unknown>;
  return (
    typeof p['command'] === 'string' &&
    Array.isArray(p['args']) &&
    (p['args'] as unknown[]).every((a) => typeof a === 'string')
  );
}
