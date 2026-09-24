"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFilesystemTask = createFilesystemTask;
exports.createWorkspaceTask = createWorkspaceTask;
exports.createProcessTask = createProcessTask;
exports.createNpmTask = createNpmTask;
exports.createGitTask = createGitTask;
exports.isFilesystemTask = isFilesystemTask;
exports.isWorkspaceTask = isWorkspaceTask;
exports.isProcessTask = isProcessTask;
exports.isNpmTask = isNpmTask;
exports.isGitTask = isGitTask;
/**
 * Tipos de tarefas para operações de filesystem, workspace, process, npm e git do Umbrella Office V0.3.
 */
const crypto_1 = require("crypto");
function createFilesystemTask(type, payload) {
    return {
        id: (0, crypto_1.randomUUID)(),
        type,
        payload,
        createdAt: new Date().toISOString(),
    };
}
function createWorkspaceTask(type, payload) {
    return {
        id: (0, crypto_1.randomUUID)(),
        type,
        payload,
        createdAt: new Date().toISOString(),
    };
}
function createProcessTask(payload) {
    return {
        id: (0, crypto_1.randomUUID)(),
        type: 'process.execute',
        payload,
        createdAt: new Date().toISOString(),
    };
}
function createNpmTask(type, payload) {
    return {
        id: (0, crypto_1.randomUUID)(),
        type,
        payload,
        createdAt: new Date().toISOString(),
    };
}
function createGitTask(type, payload) {
    return {
        id: (0, crypto_1.randomUUID)(),
        type,
        payload,
        createdAt: new Date().toISOString(),
    };
}
function isFilesystemTask(task) {
    return task.type.startsWith('filesystem.') || task.type.startsWith('directory.');
}
function isWorkspaceTask(task) {
    return task.type.startsWith('workspace.');
}
function isProcessTask(task) {
    return task.type === 'process.execute';
}
function isNpmTask(task) {
    return task.type.startsWith('npm.');
}
function isGitTask(task) {
    return task.type.startsWith('git.');
}
//# sourceMappingURL=task-v2.js.map