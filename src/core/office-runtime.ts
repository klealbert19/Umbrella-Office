/**
 * Runtime principal do Umbrella Office.
 *
 * Responsável por iniciar/encerrar todos os componentes:
 * configuração, logger, permissões, executor local, roteador,
 * túnel, gerenciador de atualização, scheduler, webhook, plugins e remote workspace.
 */
import * as os from 'os';
import * as path from 'path';
import * as fsPromises from 'fs/promises';
import { VERSION, PROTOCOL_VERSION, CONFIG_VERSION, OFFICE_NAME } from './version';
import { TaskRouter } from './task-router';
import { ConfigManager } from '../config/config-manager';
import { LocalExecutor } from '../execution/local-executor';
import { PermissionManager } from '../execution/permission-manager';
import { TunnelClient } from '../tunnel/tunnel-client';
import { UpdateManager } from '../update/update-manager';
import { Logger } from '../logging/logger';
import { createWorkspaceTask } from './task-v2';
import { FilesystemSecurity } from '../filesystem/filesystem-security';
import { FilesystemEngine } from '../filesystem/filesystem-engine';
import { ProjectScanner } from '../scanner/project-scanner';
import { WorkspaceManager } from '../workspace/workspace-manager';
import { TaskResult } from './result';
import { ProcessTool } from '../tools/process/process-tool';
import { NpmTool } from '../tools/npm/npm-tool';
import { GitTool } from '../tools/git/git-tool';
import { Scheduler } from '../scheduler/scheduler';
import { WebhookServer } from '../webhook/webhook-server';
import { PluginManager } from '../plugins/plugin-manager';
import { RemoteWorkspaceManager } from '../remote/remote-manager';

export type RuntimeState = 'STARTING' | 'ONLINE' | 'STOPPING' | 'STOPPED' | 'ERROR';
export type RuntimeMode = 'LOCAL' | 'REMOTE';

export class OfficeRuntime {
  private state: RuntimeState = 'STOPPED';
  private mode: RuntimeMode = 'LOCAL';

  private logger!: Logger;
  private configManager!: ConfigManager;
  private permissionManager!: PermissionManager;
  private localExecutor!: LocalExecutor;
  private taskRouter!: TaskRouter;
  private tunnelClient!: TunnelClient;
  private updateManager!: UpdateManager;
  private filesystemSecurity!: FilesystemSecurity;
  private filesystemEngine!: FilesystemEngine;
  private projectScanner!: ProjectScanner;
  private workspaceManager!: WorkspaceManager;
  private processTool!: ProcessTool;
  private npmTool!: NpmTool;
  private gitTool!: GitTool;
  private scheduler!: Scheduler;
  private webhookServer!: WebhookServer;
  private pluginManager!: PluginManager;
  private remoteWorkspaceManager!: RemoteWorkspaceManager;

  getState(): RuntimeState {
    return this.state;
  }

  getMode(): RuntimeMode {
    return this.mode;
  }

  getConfigManager(): ConfigManager {
    return this.configManager;
  }

  getTaskRouter(): TaskRouter {
    return this.taskRouter;
  }

  getTunnelClient(): TunnelClient {
    return this.tunnelClient;
  }

  getUpdateManager(): UpdateManager {
    return this.updateManager;
  }

  getPermissionManager(): PermissionManager {
    return this.permissionManager;
  }

  getLogger(): Logger {
    return this.logger;
  }

  getProcessTool(): ProcessTool {
    return this.processTool;
  }

  getNpmTool(): NpmTool {
    return this.npmTool;
  }

  getGitTool(): GitTool {
    return this.gitTool;
  }

  getScheduler(): Scheduler {
    return this.scheduler;
  }

  getWebhookServer(): WebhookServer {
    return this.webhookServer;
  }

  getPluginManager(): PluginManager {
    return this.pluginManager;
  }

  getRemoteWorkspaceManager(): RemoteWorkspaceManager {
    return this.remoteWorkspaceManager;
  }

  async start(baseDir?: string): Promise<void> {
    this.state = 'STARTING';

    // Logger temporário antes da configuração estar pronta.
    const tempLogPath = path.join(
      baseDir ?? path.join(os.homedir(), '.umbrella'),
      'logs',
      'office.log'
    );
    this.logger = new Logger(tempLogPath);

    try {
      this.logger.info('Office starting', { version: VERSION });

      this.configManager = new ConfigManager(this.logger, baseDir);
      await this.configManager.init();

      // Recria o logger apontando para o caminho real (pode ser baseDir customizado em testes).
      this.logger = new Logger(this.configManager.logFilePath);
      this.logger.info('Office starting', { version: VERSION });

      await this.configManager.markStarted();

      this.permissionManager = new PermissionManager(this.logger);
      this.localExecutor = new LocalExecutor(this.logger);
      this.filesystemSecurity = new FilesystemSecurity(this.logger);
      this.filesystemEngine = new FilesystemEngine(this.logger, this.filesystemSecurity);
      this.projectScanner = new ProjectScanner(this.logger, this.filesystemEngine);
      this.workspaceManager = new WorkspaceManager(this.logger, this.filesystemSecurity, this.projectScanner, this.configManager);

      // Inicializa as ferramentas V0.3
      this.processTool = new ProcessTool(this.logger, this.filesystemSecurity);
      this.npmTool = new NpmTool(this.logger, this.filesystemSecurity, this.processTool);
      this.gitTool = new GitTool(this.logger, this.filesystemSecurity, this.processTool);

      // Inicializa os novos módulos V0.4 (com taskRouter placeholder, será atualizado depois)
      this.scheduler = new Scheduler(this.logger, undefined as any, baseDir);
      this.webhookServer = new WebhookServer(this.logger, undefined as any, this.configManager.getConfig().webhook);
      this.pluginManager = new PluginManager(this.logger, undefined as any, this.permissionManager, this.configManager, baseDir);
      this.remoteWorkspaceManager = new RemoteWorkspaceManager(this.logger);

      // Restaura workspace ativo do estado, se existir e for válido
      const savedWorkspace = this.configManager.getActiveWorkspace();
      if (savedWorkspace) {
        try {
          const stats = await fsPromises.stat(savedWorkspace);
          if (stats.isDirectory()) {
            await this.workspaceManager.openWorkspace(savedWorkspace);
            this.logger.info('Workspace restaurado do estado', { path: savedWorkspace });
          } else {
            this.logger.warn('Workspace salvo não é mais um diretório válido, limpando estado', { path: savedWorkspace });
            await this.configManager.setActiveWorkspace(null);
          }
        } catch {
          this.logger.warn('Workspace salvo não existe mais, limpando estado', { path: savedWorkspace });
          await this.configManager.setActiveWorkspace(null);
        }
      }

      this.taskRouter = new TaskRouter(
        this.localExecutor,
        this.permissionManager,
        this.logger,
        this.filesystemEngine,
        this.workspaceManager,
        this.processTool,
        this.npmTool,
        this.gitTool,
        this.scheduler,
        this.webhookServer,
        this.pluginManager,
        this.remoteWorkspaceManager
      );

      // Atualizar referências no scheduler, webhook server e plugin manager
      this.scheduler.taskRouterRef = this.taskRouter;
      this.webhookServer.taskRouterRef = this.taskRouter;
      this.pluginManager.taskRouterRef = this.taskRouter;

      const orchConfig = this.configManager.getConfig().orchestrator;
      this.tunnelClient = new TunnelClient(this.logger, {
        enabled: orchConfig.enabled,
        endpoint: orchConfig.endpoint,
      });
      await this.tunnelClient.start();

      this.updateManager = new UpdateManager(this.logger);

      // Inicializar módulos V0.4 (agora com taskRouter disponível)
      await this.scheduler.start();
      await this.pluginManager.initialize();

      // Iniciar webhook server se habilitado
      if (this.configManager.getConfig().webhook.enabled) {
        await this.webhookServer.start();
      }

      // Modo: LOCAL enquanto o orchestrator estiver desabilitado.
      this.mode = orchConfig.enabled && orchConfig.endpoint ? 'REMOTE' : 'LOCAL';

      this.state = 'ONLINE';
      this.logger.info('Runtime online', {
        version: VERSION,
        mode: this.mode,
        tunnel: this.tunnelClient.getState(),
      });
    } catch (err) {
      this.state = 'ERROR';
      const message = err instanceof Error ? err.message : String(err);
      try {
        this.logger.error('Office failed to start', { error: message });
      } catch {
        // ignora
      }
      throw err;
    }
  }

  async stop(): Promise<void> {
    if (this.state === 'STOPPED' || this.state === 'STOPPING') return;
    this.state = 'STOPPING';
    this.logger.info('Office stopping');

    try {
      // Parar módulos V0.4
      if (this.scheduler) {
        await this.scheduler.stop();
      }
      if (this.webhookServer) {
        await this.webhookServer.stop();
      }
      if (this.pluginManager) {
        await this.pluginManager.shutdown();
      }
      if (this.remoteWorkspaceManager) {
        await this.remoteWorkspaceManager.disconnect();
      }

      if (this.tunnelClient) {
        await this.tunnelClient.stop();
      }
      if (this.configManager) {
        await this.configManager.markShutdown(VERSION);
      }
    } finally {
      this.state = 'STOPPED';
      try {
        this.logger.info('Office stopped');
      } catch {
        // ignora
      }
    }
  }

  getBanner(): string {
    const orchestrator = this.mode === 'REMOTE' ? 'ONLINE' : 'OFFLINE';
    return [
      '',
      `☂️ ${OFFICE_NAME}`,
      '',
      `Version: ${VERSION}`,
      `Status: ${this.mode}`,
      `Orchestrator: ${orchestrator}`,
      '',
    ].join('\n');
  }

  getStatusLines(): string[] {
    return [
      `Runtime: ${this.state}`,
      `Mode: ${this.mode}`,
      `Tunnel: ${this.tunnelClient ? this.tunnelClient.getState() : 'DISCONNECTED'}`,
      `Version: ${VERSION}`,
    ];
  }

  getVersionLines(): string[] {
    return [
      OFFICE_NAME,
      `Version: ${VERSION}`,
      `Protocol: ${PROTOCOL_VERSION}`,
      `Config: ${CONFIG_VERSION}`,
    ];
  }

  getWorkspaceManager(): WorkspaceManager {
    return this.workspaceManager;
  }

  getFilesystemEngine(): FilesystemEngine {
    return this.filesystemEngine;
  }

  getFilesystemSecurity(): FilesystemSecurity {
    return this.filesystemSecurity;
  }

  getProjectScanner(): ProjectScanner {
    return this.projectScanner;
  }

  async openWorkspace(workspacePath: string): Promise<TaskResult> {
    const task = createWorkspaceTask('workspace.open', { path: workspacePath });
    return this.getTaskRouter().route(task);
  }

  async closeWorkspace(): Promise<TaskResult> {
    const task = createWorkspaceTask('workspace.close', {});
    return this.getTaskRouter().route(task);
  }

  async scanWorkspace(scanPath?: string): Promise<TaskResult> {
    const task = createWorkspaceTask('workspace.scan', { path: scanPath });
    return this.getTaskRouter().route(task);
  }
}
