/**
 * Fronteira de segurança do Umbrella Office.
 *
 * Na V0.1 apenas a permissão `process.execute` existe, habilitada por padrão
 * para execução local da própria CLI. A arquitetura permite futuras
 * permissões (filesystem.read, git.execute, etc.) sem reescrever o fluxo.
 */
import { Logger } from '../logging/logger';

export type PermissionName =
  | 'process.execute'
  | 'process.spawn'
  | 'npm.execute'
  | 'npm.install'
  | 'npm.run'
  | 'npm.test'
  | 'npm.build'
  | 'npm.exec'
  | 'git.read'
  | 'git.write'
  | 'filesystem.read'
  | 'filesystem.write'
  | 'filesystem.edit'
  | 'filesystem.delete'
  | 'directory.list'
  | 'directory.create'
  | 'workspace.open'
  | 'workspace.close'
  | 'workspace.read'
  | 'workspace.scan'
  | 'scheduler.create'
  | 'scheduler.list'
  | 'scheduler.info'
  | 'scheduler.run'
  | 'scheduler.pause'
  | 'scheduler.resume'
  | 'scheduler.remove'
  | 'webhook.status'
  | 'webhook.start'
  | 'webhook.stop'
  | 'webhook.list'
  | 'webhook.register'
  | 'webhook.unregister'
  | 'plugin.list'
  | 'plugin.info'
  | 'plugin.enable'
  | 'plugin.disable'
  | 'plugin.load'
  | 'plugin.unload'
  | 'remote.connect'
  | 'remote.disconnect'
  | 'remote.status'
  | 'remote.providers'
  // Futuras permissões:
  // | 'docker.execute'
  // | 'browser.control'
  // | 'network.request'
  ;

export class PermissionManager {
  private readonly permissions: Map<PermissionName, boolean>;
  private readonly logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
    this.permissions = new Map<PermissionName, boolean>([
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

  isAllowed(permission: PermissionName): boolean {
    return this.permissions.get(permission) ?? false;
  }

  grant(permission: PermissionName): void {
    this.permissions.set(permission, true);
    this.logger.info('Permission granted', { permission });
  }

  revoke(permission: PermissionName): void {
    this.permissions.set(permission, false);
    this.logger.info('Permission revoked', { permission });
  }

  /**
   * Verifica se uma tarefa pode ser executada conforme seu tipo.
   * Mapeia tipo de task → permissão exigida. Lança erro se negada.
   */
  checkTaskPermission(taskType: string): void {
    const required = this.permissionForTaskType(taskType);
    if (!required) return;
    if (!this.isAllowed(required)) {
      this.logger.warn('Permission denied for task', { taskType });
      throw new Error(`Permission denied: ${required} is not granted`);
    }
  }

  private permissionForTaskType(taskType: string): PermissionName | null {
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
      case 'scheduler.create':
        return 'scheduler.create';
      case 'scheduler.list':
        return 'scheduler.list';
      case 'scheduler.info':
        return 'scheduler.info';
      case 'scheduler.run':
        return 'scheduler.run';
      case 'scheduler.pause':
        return 'scheduler.pause';
      case 'scheduler.resume':
        return 'scheduler.resume';
      case 'scheduler.remove':
        return 'scheduler.remove';
      case 'webhook.status':
        return 'webhook.status';
      case 'webhook.start':
        return 'webhook.start';
      case 'webhook.stop':
        return 'webhook.stop';
      case 'webhook.list':
        return 'webhook.list';
      case 'webhook.register':
        return 'webhook.register';
      case 'webhook.unregister':
        return 'webhook.unregister';
      case 'plugin.list':
        return 'plugin.list';
      case 'plugin.info':
        return 'plugin.info';
      case 'plugin.enable':
        return 'plugin.enable';
      case 'plugin.disable':
        return 'plugin.disable';
      case 'plugin.load':
        return 'plugin.load';
      case 'plugin.unload':
        return 'plugin.unload';
      case 'remote.connect':
        return 'remote.connect';
      case 'remote.disconnect':
        return 'remote.disconnect';
      case 'remote.status':
        return 'remote.status';
      case 'remote.providers':
        return 'remote.providers';
      default:
        return null;
    }
  }
}
