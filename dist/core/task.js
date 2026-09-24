"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTask = createTask;
exports.createLocalCommandTask = createLocalCommandTask;
exports.isLocalCommandPayload = isLocalCommandPayload;
/**
 * Abstração de tarefa do Umbrella Office.
 *
 * Toda execução local passa pelo conceito de Task.
 */
const crypto_1 = require("crypto");
function createTask(type, payload) {
    return {
        id: (0, crypto_1.randomUUID)(),
        type,
        payload,
        createdAt: new Date().toISOString(),
    };
}
function createLocalCommandTask(command, args) {
    const payload = { command, args };
    return createTask('local.command', payload);
}
function isLocalCommandPayload(payload) {
    if (typeof payload !== 'object' || payload === null)
        return false;
    const p = payload;
    return (typeof p['command'] === 'string' &&
        Array.isArray(p['args']) &&
        p['args'].every((a) => typeof a === 'string'));
}
//# sourceMappingURL=task.js.map