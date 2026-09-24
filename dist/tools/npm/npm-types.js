"use strict";
/**
 * Tipos para operações NPM do Umbrella Office V0.3.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNpmTask = createNpmTask;
function createNpmTask(type, payload) {
    return {
        id: crypto.randomUUID(),
        type,
        payload,
        createdAt: new Date().toISOString(),
    };
}
//# sourceMappingURL=npm-types.js.map