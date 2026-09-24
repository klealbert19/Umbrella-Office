"use strict";
/**
 * Tipos para operações de processo do Umbrella Office V0.3.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProcessTask = createProcessTask;
function createProcessTask(payload) {
    return {
        id: crypto.randomUUID(),
        type: 'process.execute',
        payload,
        createdAt: new Date().toISOString(),
    };
}
//# sourceMappingURL=process-types.js.map