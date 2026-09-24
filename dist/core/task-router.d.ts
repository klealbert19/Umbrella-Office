/**
 * Roteador de tarefas do Umbrella Office.
 *
 * Fluxo V0.3:
 *   CLI → Task → TaskRouter → PermissionManager → (LocalExecutor | FilesystemEngine | WorkspaceManager | ProcessTool | NpmTool | GitTool) → TaskResult
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
export declare class TaskRouter {
    private readonly localExecutor;
    private readonly permissionManager;
    private readonly logger;
    private readonly filesystemEngine?;
    private readonly workspaceManager?;
    private readonly processTool?;
    private readonly npmTool?;
    private readonly gitTool?;
    constructor(localExecutor: LocalExecutor, permissionManager: PermissionManager, logger: Logger, filesystemEngine?: FilesystemEngine, workspaceManager?: WorkspaceManager, processTool?: ProcessTool, npmTool?: NpmTool, gitTool?: GitTool);
    getWorkspaceManager(): WorkspaceManager | undefined;
    getFilesystemEngine(): FilesystemEngine | undefined;
    getProcessTool(): ProcessTool | undefined;
    getNpmTool(): NpmTool | undefined;
    getGitTool(): GitTool | undefined;
    route(task: Task): Promise<TaskResult>;
    private routeProcessTask;
    private routeNpmTask;
    private routeGitTask;
    private routeFilesystemTask;
    private routeWorkspaceTask;
}
//# sourceMappingURL=task-router.d.ts.map