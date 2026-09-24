"use strict";
/**
 * Tipos para operações Git do Umbrella Office V0.3.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGitTask = createGitTask;
function createGitTask(type, payload) {
    return {
        id: crypto.randomUUID(),
        type,
        payload,
        createdAt: new Date().toISOString(),
    };
}
//# sourceMappingURL=git-types.js.map