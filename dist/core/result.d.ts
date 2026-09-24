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
export declare function createSuccessResult(taskId: string, startedAt: string, finishedAt: string, output: string, exitCode: number): TaskResult;
export declare function createFailureResult(taskId: string, startedAt: string, finishedAt: string, error: string, exitCode?: number): TaskResult;
//# sourceMappingURL=result.d.ts.map