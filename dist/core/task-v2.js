"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFilesystemTask = createFilesystemTask;
exports.createWorkspaceTask = createWorkspaceTask;
exports.createProcessTask = createProcessTask;
exports.createNpmTask = createNpmTask;
exports.createGitTask = createGitTask;
exports.createSchedulerTask = createSchedulerTask;
exports.createWebhookTask = createWebhookTask;
exports.createPluginTask = createPluginTask;
exports.createRemoteTask = createRemoteTask;
exports.isFilesystemTask = isFilesystemTask;
exports.isWorkspaceTask = isWorkspaceTask;
exports.isProcessTask = isProcessTask;
exports.isNpmTask = isNpmTask;
exports.isGitTask = isGitTask;
exports.isSchedulerTask = isSchedulerTask;
exports.isWebhookTask = isWebhookTask;
exports.isPluginTask = isPluginTask;
exports.isRemoteTask = isRemoteTask;
/**
 * Tipos de tarefas para operações de filesystem, workspace, process, npm, git, scheduler, webhook, plugin e remote do Umbrella Office V0.4.
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
function createSchedulerTask(type, payload) {
    return {
        id: (0, crypto_1.randomUUID)(),
        type,
        payload,
        createdAt: new Date().toISOString(),
    };
}
function createWebhookTask(type, payload) {
    return {
        id: (0, crypto_1.randomUUID)(),
        type,
        payload,
        createdAt: new Date().toISOString(),
    };
}
function createPluginTask(type, payload) {
    return {
        id: (0, crypto_1.randomUUID)(),
        type,
        payload,
        createdAt: new Date().toISOString(),
    };
}
function createRemoteTask(type, payload) {
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
function isSchedulerTask(task) {
    return task.type.startsWith('scheduler.');
}
function isWebhookTask(task) {
    return task.type.startsWith('webhook.');
}
function isPluginTask(task) {
    return task.type.startsWith('plugin.');
}
function isRemoteTask(task) {
    return task.type.startsWith('remote.');
}
//# sourceMappingURL=task-v2.js.map