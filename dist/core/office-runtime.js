"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.OfficeRuntime = void 0;
/**
 * Runtime principal do Umbrella Office.
 *
 * Responsável por iniciar/encerrar todos os componentes:
 * configuração, logger, permissões, executor local, roteador,
 * túnel, gerenciador de atualização, scheduler, webhook, plugins e remote workspace.
 */
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const fsPromises = __importStar(require("fs/promises"));
const version_1 = require("./version");
const task_router_1 = require("./task-router");
const config_manager_1 = require("../config/config-manager");
const local_executor_1 = require("../execution/local-executor");
const permission_manager_1 = require("../execution/permission-manager");
const tunnel_client_1 = require("../tunnel/tunnel-client");
const update_manager_1 = require("../update/update-manager");
const logger_1 = require("../logging/logger");
const task_v2_1 = require("./task-v2");
const filesystem_security_1 = require("../filesystem/filesystem-security");
const filesystem_engine_1 = require("../filesystem/filesystem-engine");
const project_scanner_1 = require("../scanner/project-scanner");
const workspace_manager_1 = require("../workspace/workspace-manager");
const process_tool_1 = require("../tools/process/process-tool");
const npm_tool_1 = require("../tools/npm/npm-tool");
const git_tool_1 = require("../tools/git/git-tool");
const scheduler_1 = require("../scheduler/scheduler");
const webhook_server_1 = require("../webhook/webhook-server");
const plugin_manager_1 = require("../plugins/plugin-manager");
const remote_manager_1 = require("../remote/remote-manager");
class OfficeRuntime {
    state = 'STOPPED';
    mode = 'LOCAL';
    logger;
    configManager;
    permissionManager;
    localExecutor;
    taskRouter;
    tunnelClient;
    updateManager;
    filesystemSecurity;
    filesystemEngine;
    projectScanner;
    workspaceManager;
    processTool;
    npmTool;
    gitTool;
    scheduler;
    webhookServer;
    pluginManager;
    remoteWorkspaceManager;
    getState() {
        return this.state;
    }
    getMode() {
        return this.mode;
    }
    getConfigManager() {
        return this.configManager;
    }
    getTaskRouter() {
        return this.taskRouter;
    }
    getTunnelClient() {
        return this.tunnelClient;
    }
    getUpdateManager() {
        return this.updateManager;
    }
    getPermissionManager() {
        return this.permissionManager;
    }
    getLogger() {
        return this.logger;
    }
    getProcessTool() {
        return this.processTool;
    }
    getNpmTool() {
        return this.npmTool;
    }
    getGitTool() {
        return this.gitTool;
    }
    getScheduler() {
        return this.scheduler;
    }
    getWebhookServer() {
        return this.webhookServer;
    }
    getPluginManager() {
        return this.pluginManager;
    }
    getRemoteWorkspaceManager() {
        return this.remoteWorkspaceManager;
    }
    async start(baseDir) {
        this.state = 'STARTING';
        // Logger temporário antes da configuração estar pronta.
        const tempLogPath = path.join(baseDir ?? path.join(os.homedir(), '.umbrella'), 'logs', 'office.log');
        this.logger = new logger_1.Logger(tempLogPath);
        try {
            this.logger.info('Office starting', { version: version_1.VERSION });
            this.configManager = new config_manager_1.ConfigManager(this.logger, baseDir);
            await this.configManager.init();
            // Recria o logger apontando para o caminho real (pode ser baseDir customizado em testes).
            this.logger = new logger_1.Logger(this.configManager.logFilePath);
            this.logger.info('Office starting', { version: version_1.VERSION });
            await this.configManager.markStarted();
            this.permissionManager = new permission_manager_1.PermissionManager(this.logger);
            this.localExecutor = new local_executor_1.LocalExecutor(this.logger);
            this.filesystemSecurity = new filesystem_security_1.FilesystemSecurity(this.logger);
            this.filesystemEngine = new filesystem_engine_1.FilesystemEngine(this.logger, this.filesystemSecurity);
            this.projectScanner = new project_scanner_1.ProjectScanner(this.logger, this.filesystemEngine);
            this.workspaceManager = new workspace_manager_1.WorkspaceManager(this.logger, this.filesystemSecurity, this.projectScanner, this.configManager);
            // Inicializa as ferramentas V0.3
            this.processTool = new process_tool_1.ProcessTool(this.logger, this.filesystemSecurity);
            this.npmTool = new npm_tool_1.NpmTool(this.logger, this.filesystemSecurity, this.processTool);
            this.gitTool = new git_tool_1.GitTool(this.logger, this.filesystemSecurity, this.processTool);
            // Inicializa os novos módulos V0.4 (com taskRouter placeholder, será atualizado depois)
            this.scheduler = new scheduler_1.Scheduler(this.logger, undefined, baseDir);
            this.webhookServer = new webhook_server_1.WebhookServer(this.logger, undefined, this.configManager.getConfig().webhook);
            this.pluginManager = new plugin_manager_1.PluginManager(this.logger, undefined, this.permissionManager, this.configManager, baseDir);
            this.remoteWorkspaceManager = new remote_manager_1.RemoteWorkspaceManager(this.logger);
            // Restaura workspace ativo do estado, se existir e for válido
            const savedWorkspace = this.configManager.getActiveWorkspace();
            if (savedWorkspace) {
                try {
                    const stats = await fsPromises.stat(savedWorkspace);
                    if (stats.isDirectory()) {
                        await this.workspaceManager.openWorkspace(savedWorkspace);
                        this.logger.info('Workspace restaurado do estado', { path: savedWorkspace });
                    }
                    else {
                        this.logger.warn('Workspace salvo não é mais um diretório válido, limpando estado', { path: savedWorkspace });
                        await this.configManager.setActiveWorkspace(null);
                    }
                }
                catch {
                    this.logger.warn('Workspace salvo não existe mais, limpando estado', { path: savedWorkspace });
                    await this.configManager.setActiveWorkspace(null);
                }
            }
            this.taskRouter = new task_router_1.TaskRouter(this.localExecutor, this.permissionManager, this.logger, this.filesystemEngine, this.workspaceManager, this.processTool, this.npmTool, this.gitTool, this.scheduler, this.webhookServer, this.pluginManager, this.remoteWorkspaceManager);
            // Atualizar referências no scheduler, webhook server e plugin manager
            this.scheduler.taskRouterRef = this.taskRouter;
            this.webhookServer.taskRouterRef = this.taskRouter;
            this.pluginManager.taskRouterRef = this.taskRouter;
            const orchConfig = this.configManager.getConfig().orchestrator;
            this.tunnelClient = new tunnel_client_1.TunnelClient(this.logger, {
                enabled: orchConfig.enabled,
                endpoint: orchConfig.endpoint,
            });
            await this.tunnelClient.start();
            this.updateManager = new update_manager_1.UpdateManager(this.logger);
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
                version: version_1.VERSION,
                mode: this.mode,
                tunnel: this.tunnelClient.getState(),
            });
        }
        catch (err) {
            this.state = 'ERROR';
            const message = err instanceof Error ? err.message : String(err);
            try {
                this.logger.error('Office failed to start', { error: message });
            }
            catch {
                // ignora
            }
            throw err;
        }
    }
    async stop() {
        if (this.state === 'STOPPED' || this.state === 'STOPPING')
            return;
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
                await this.configManager.markShutdown(version_1.VERSION);
            }
        }
        finally {
            this.state = 'STOPPED';
            try {
                this.logger.info('Office stopped');
            }
            catch {
                // ignora
            }
        }
    }
    getBanner() {
        const orchestrator = this.mode === 'REMOTE' ? 'ONLINE' : 'OFFLINE';
        return [
            '',
            `☂️ ${version_1.OFFICE_NAME}`,
            '',
            `Version: ${version_1.VERSION}`,
            `Status: ${this.mode}`,
            `Orchestrator: ${orchestrator}`,
            '',
        ].join('\n');
    }
    getStatusLines() {
        return [
            `Runtime: ${this.state}`,
            `Mode: ${this.mode}`,
            `Tunnel: ${this.tunnelClient ? this.tunnelClient.getState() : 'DISCONNECTED'}`,
            `Version: ${version_1.VERSION}`,
        ];
    }
    getVersionLines() {
        return [
            version_1.OFFICE_NAME,
            `Version: ${version_1.VERSION}`,
            `Protocol: ${version_1.PROTOCOL_VERSION}`,
            `Config: ${version_1.CONFIG_VERSION}`,
        ];
    }
    getWorkspaceManager() {
        return this.workspaceManager;
    }
    getFilesystemEngine() {
        return this.filesystemEngine;
    }
    getFilesystemSecurity() {
        return this.filesystemSecurity;
    }
    getProjectScanner() {
        return this.projectScanner;
    }
    async openWorkspace(workspacePath) {
        const task = (0, task_v2_1.createWorkspaceTask)('workspace.open', { path: workspacePath });
        return this.getTaskRouter().route(task);
    }
    async closeWorkspace() {
        const task = (0, task_v2_1.createWorkspaceTask)('workspace.close', {});
        return this.getTaskRouter().route(task);
    }
    async scanWorkspace(scanPath) {
        const task = (0, task_v2_1.createWorkspaceTask)('workspace.scan', { path: scanPath });
        return this.getTaskRouter().route(task);
    }
}
exports.OfficeRuntime = OfficeRuntime;
//# sourceMappingURL=office-runtime.js.map