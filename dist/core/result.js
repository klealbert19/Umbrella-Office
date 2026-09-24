"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSuccessResult = createSuccessResult;
exports.createFailureResult = createFailureResult;
function createSuccessResult(taskId, startedAt, finishedAt, output, exitCode) {
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
function createFailureResult(taskId, startedAt, finishedAt, error, exitCode) {
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
//# sourceMappingURL=result.js.map