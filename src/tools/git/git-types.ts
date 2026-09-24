/**
 * Tipos para operações Git do Umbrella Office V0.3.
 */

export type GitOperationType = 
  | 'git.status'
  | 'git.diff'
  | 'git.log'
  | 'git.branch'
  | 'git.remote'
  | 'git.add'
  | 'git.commit'
  | 'git.checkout';

export interface GitStatusPayload {
  cwd?: string;
  timeout?: number;
}

export interface GitDiffPayload {
  args?: string[];
  cwd?: string;
  timeout?: number;
}

export interface GitLogPayload {
  args?: string[];
  cwd?: string;
  timeout?: number;
}

export interface GitBranchPayload {
  cwd?: string;
  timeout?: number;
}

export interface GitRemotePayload {
  cwd?: string;
  timeout?: number;
}

export interface GitAddPayload {
  paths: string[];
  cwd?: string;
  timeout?: number;
}

export interface GitCommitPayload {
  message: string;
  cwd?: string;
  timeout?: number;
}

export interface GitCheckoutPayload {
  branch: string;
  cwd?: string;
  timeout?: number;
}

export type GitPayload = 
  | GitStatusPayload 
  | GitDiffPayload 
  | GitLogPayload 
  | GitBranchPayload 
  | GitRemotePayload 
  | GitAddPayload 
  | GitCommitPayload 
  | GitCheckoutPayload;

export interface GitTask {
  id: string;
  type: GitOperationType;
  payload: GitPayload;
  createdAt: string;
}

export interface GitResult {
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

export function createGitTask(type: GitOperationType, payload: GitPayload): GitTask {
  return {
    id: crypto.randomUUID(),
    type,
    payload,
    createdAt: new Date().toISOString(),
  };
}