/**
 * Fronteira de segurança do Umbrella Office.
 *
 * Na V0.1 apenas a permissão `process.execute` existe, habilitada por padrão
 * para execução local da própria CLI. A arquitetura permite futuras
 * permissões (filesystem.read, git.execute, etc.) sem reescrever o fluxo.
 */
import { Logger } from '../logging/logger';
export type PermissionName = 'process.execute' | 'process.spawn' | 'npm.execute' | 'npm.install' | 'npm.run' | 'npm.test' | 'npm.build' | 'npm.exec' | 'git.read' | 'git.write' | 'filesystem.read' | 'filesystem.write' | 'filesystem.edit' | 'filesystem.delete' | 'directory.list' | 'directory.create' | 'workspace.open' | 'workspace.close' | 'workspace.read' | 'workspace.scan' | 'scheduler.create' | 'scheduler.list' | 'scheduler.info' | 'scheduler.run' | 'scheduler.pause' | 'scheduler.resume' | 'scheduler.remove' | 'webhook.status' | 'webhook.start' | 'webhook.stop' | 'webhook.list' | 'webhook.register' | 'webhook.unregister' | 'plugin.list' | 'plugin.info' | 'plugin.enable' | 'plugin.disable' | 'plugin.load' | 'plugin.unload' | 'remote.connect' | 'remote.disconnect' | 'remote.status' | 'remote.providers';
export declare class PermissionManager {
    private readonly permissions;
    private readonly logger;
    constructor(logger: Logger);
    isAllowed(permission: PermissionName): boolean;
    grant(permission: PermissionName): void;
    revoke(permission: PermissionName): void;
    /**
     * Verifica se uma tarefa pode ser executada conforme seu tipo.
     * Mapeia tipo de task → permissão exigida. Lança erro se negada.
     */
    checkTaskPermission(taskType: string): void;
    private permissionForTaskType;
}
//# sourceMappingURL=permission-manager.d.ts.map