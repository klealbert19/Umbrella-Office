/**
 * Tipos para operações de processo do Umbrella Office V0.3.
 */

export interface ProcessExecutePayload {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
}

export interface ProcessExecuteResult {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number;
  timedOut: boolean;
  command: string;
  args: string[];
  cwd: string;
}

export interface ProcessTask {
  id: string;
  type: 'process.execute';
  payload: ProcessExecutePayload;
  createdAt: string;
}

export function createProcessTask(payload: ProcessExecutePayload): ProcessTask {
  return {
    id: crypto.randomUUID(),
    type: 'process.execute',
    payload,
    createdAt: new Date().toISOString(),
  };
}