"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionManager = void 0;
class PermissionManager {
    permissions;
    logger;
    constructor(logger) {
        this.logger = logger;
        this.permissions = new Map([
            ['process.execute', true],
            ['process.spawn', true],
            ['npm.execute', true],
            ['npm.install', true],
            ['npm.run', true],
            ['npm.test', true],
            ['npm.build', true],
            ['npm.exec', true],
            ['git.read', true],
            ['git.write', true],
            ['filesystem.read', true],
            ['filesystem.write', true],
            ['filesystem.edit', true],
            ['filesystem.delete', true],
            ['directory.list', true],
            ['directory.create', true],
            ['workspace.open', true],
            ['workspace.close', true],
            ['workspace.read', true],
            ['workspace.scan', true],
        ]);
    }
    isAllowed(permission) {
        return this.permissions.get(permission) ?? false;
    }
    grant(permission) {
        this.permissions.set(permission, true);
        this.logger.info('Permission granted', { permission });
    }
    revoke(permission) {
        this.permissions.set(permission, false);
        this.logger.info('Permission revoked', { permission });
    }
    /**
     * Verifica se uma tarefa pode ser executada conforme seu tipo.
     * Mapeia tipo de task → permissão exigida. Lança erro se negada.
     */
    checkTaskPermission(taskType) {
        const required = this.permissionForTaskType(taskType);
        if (!required)
            return;
        if (!this.isAllowed(required)) {
            this.logger.warn('Permission denied for task', { taskType });
            throw new Error(`Permission denied: ${required} is not granted`);
        }
    }
    permissionForTaskType(taskType) {
        switch (taskType) {
            case 'local.command':
                return 'process.execute';
            case 'process.execute':
                return 'process.spawn';
            case 'npm.install':
                return 'npm.install';
            case 'npm.run':
                return 'npm.run';
            case 'npm.test':
                return 'npm.test';
            case 'npm.build':
                return 'npm.build';
            case 'npm.exec':
                return 'npm.exec';
            case 'git.status':
            case 'git.diff':
            case 'git.log':
            case 'git.branch':
            case 'git.remote':
                return 'git.read';
            case 'git.add':
            case 'git.commit':
            case 'git.checkout':
                return 'git.write';
            case 'filesystem.read':
                return 'filesystem.read';
            case 'filesystem.write':
                return 'filesystem.write';
            case 'filesystem.edit':
                return 'filesystem.edit';
            case 'filesystem.delete':
                return 'filesystem.delete';
            case 'directory.list':
                return 'directory.list';
            case 'directory.create':
                return 'directory.create';
            case 'workspace.open':
                return 'workspace.open';
            case 'workspace.close':
                return 'workspace.close';
            case 'workspace.read':
                return 'workspace.read';
            case 'workspace.scan':
                return 'workspace.scan';
            default:
                return null;
        }
    }
}
exports.PermissionManager = PermissionManager;
//# sourceMappingURL=permission-manager.js.map