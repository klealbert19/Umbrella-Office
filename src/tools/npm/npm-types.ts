/**
 * Tipos para operações NPM do Umbrella Office V0.3.
 */

export type NpmOperationType = 
  | 'npm.install'
  | 'npm.run'
  | 'npm.test'
  | 'npm.build'
  | 'npm.exec';

export interface NpmInstallPayload {
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
}

export interface NpmRunPayload {
  script: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
}

export interface NpmTestPayload {
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
}

export interface NpmBuildPayload {
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
}

export interface NpmExecPayload {
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
}

export type NpmPayload = 
  | NpmInstallPayload 
  | NpmRunPayload 
  | NpmTestPayload 
  | NpmBuildPayload 
  | NpmExecPayload;

export interface NpmTask {
  id: string;
  type: NpmOperationType;
  payload: NpmPayload;
  createdAt: string;
}

export interface NpmResult {
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

export function createNpmTask(type: NpmOperationType, payload: NpmPayload): NpmTask {
  return {
    id: crypto.randomUUID(),
    type,
    payload,
    createdAt: new Date().toISOString(),
  };
}