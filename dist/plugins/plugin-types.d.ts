export interface PluginManifest {
    id: string;
    name: string;
    version: string;
    description: string;
    capabilities: PluginCapability[];
    entryPoint: string;
}
export interface PluginCapability {
    type: string;
    name: string;
    description: string;
    metadata?: Record<string, unknown>;
}
export interface PluginInstance {
    manifest: PluginManifest;
    instance: unknown;
    enabled: boolean;
    loadedAt: string;
    error?: string;
}
export interface PluginContext {
    logger: any;
    taskRouter: any;
    permissionManager: any;
    configManager: any;
}
export declare function createPluginManifest(id: string, name: string, version: string, description: string, capabilities: PluginCapability[], entryPoint: string): PluginManifest;
//# sourceMappingURL=plugin-types.d.ts.map