/**
 * Resultado de execução de uma Task.
 */
export interface TaskResult {
  taskId: string;
  success: boolean;
  output?: string;
  error?: string;
  exitCode?: number;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
}

export function createSuccessResult(
  taskId: string,
  startedAt: string,
  finishedAt: string,
  output: string,
  exitCode: number
): TaskResult {
  return {
    taskId,
    success: true,
    output,
    exitCode,
    startedAt,
    finishedAt,
    durationMs: new Date(finishedAt).getTime() - new Date(startedAt).getTime(),
  };
}

export function createFailureResult(
  taskId: string,
  startedAt: string,
  finishedAt: string,
  error: string,
  exitCode?: number
): TaskResult {
  return {
    taskId,
    success: false,
    error,
    exitCode,
    startedAt,
    finishedAt,
    durationMs: new Date(finishedAt).getTime() - new Date(startedAt).getTime(),
  };
}
