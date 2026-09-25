import { Logger } from '../logging/logger';
import { TaskRouter } from '../core/task-router';
import { PermissionManager } from '../execution/permission-manager';
import { ConfigManager } from '../config/config-manager';
import { PluginInstance } from './plugin-types';
export declare class PluginManager {
    private readonly logger;
    private taskRouter;
    private readonly permissionManager;
    private readonly configManager;
    private readonly pluginsDir;
    private plugins;
    private isInitialized;
    constructor(logger: Logger, taskRouter: TaskRouter, permissionManager: PermissionManager, configManager: ConfigManager, baseDir?: string);
    set taskRouterRef(router: TaskRouter);
    initialize(): Promise<void>;
    shutdown(): Promise<void>;
    private loadEnabledPlugins;
    loadPlugin(pluginId: string): Promise<PluginInstance | null>;
    private validateManifest;
    private registerCapability;
    enablePlugin(pluginId: string): Promise<boolean>;
    disablePlugin(pluginId: string): Promise<boolean>;
    removePlugin(pluginId: string): Promise<boolean>;
    getPlugin(pluginId: string): PluginInstance | undefined;
    listPlugins(): PluginInstance[];
    isPluginEnabled(pluginId: string): boolean;
}
//# sourceMappingURL=plugin-manager.d.ts.map