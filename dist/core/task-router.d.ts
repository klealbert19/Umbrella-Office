/**
 * Roteador de tarefas do Umbrella Office.
 *
 * Fluxo V0.4:
 *   CLI → Task → TaskRouter → PermissionManager → (LocalExecutor | FilesystemEngine | WorkspaceManager | ProcessTool | NpmTool | GitTool | Scheduler | WebhookServer | PluginManager | RemoteWorkspaceManager) → TaskResult
 */
import { Task } from './task';
import { TaskResult } from './result';
import { LocalExecutor } from '../execution/local-executor';
import { PermissionManager } from '../execution/permission-manager';
import { Logger } from '../logging/logger';
import { FilesystemEngine } from '../filesystem/filesystem-engine';
import { WorkspaceManager } from '../workspace/workspace-manager';
import { ProcessTool } from '../tools/process/process-tool';
import { NpmTool } from '../tools/npm/npm-tool';
import { GitTool } from '../tools/git/git-tool';
import { Scheduler } from '../scheduler/scheduler';
import { WebhookServer } from '../webhook/webhook-server';
import { PluginManager } from '../plugins/plugin-manager';
import { RemoteWorkspaceManager } from '../remote/remote-manager';
export declare class TaskRouter {
    private readonly localExecutor;
    private readonly permissionManager;
    private readonly logger;
    private readonly filesystemEngine?;
    private readonly workspaceManager?;
    private readonly processTool?;
    private readonly npmTool?;
    private readonly gitTool?;
    private readonly scheduler?;
    private readonly webhookServer?;
    private readonly pluginManager?;
    private readonly remoteWorkspaceManager?;
    constructor(localExecutor: LocalExecutor, permissionManager: PermissionManager, logger: Logger, filesystemEngine?: FilesystemEngine, workspaceManager?: WorkspaceManager, processTool?: ProcessTool, npmTool?: NpmTool, gitTool?: GitTool, scheduler?: Scheduler, webhookServer?: WebhookServer, pluginManager?: PluginManager, remoteWorkspaceManager?: RemoteWorkspaceManager);
    getWorkspaceManager(): WorkspaceManager | undefined;
    getFilesystemEngine(): FilesystemEngine | undefined;
    getProcessTool(): ProcessTool | undefined;
    getNpmTool(): NpmTool | undefined;
    getGitTool(): GitTool | undefined;
    getScheduler(): Scheduler | undefined;
    getWebhookServer(): WebhookServer | undefined;
    getPluginManager(): PluginManager | undefined;
    getRemoteWorkspaceManager(): RemoteWorkspaceManager | undefined;
    route(task: Task): Promise<TaskResult>;
    private routeProcessTask;
    private routeNpmTask;
    private routeGitTask;
    private routeFilesystemTask;
    private routeWorkspaceTask;
    private routeSchedulerTask;
    private routeWebhookTask;
    private routePluginTask;
    private routeRemoteTask;
}
//# sourceMappingURL=task-router.d.ts.map