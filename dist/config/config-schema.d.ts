export interface OfficeConfig {
    name: string;
}
export interface OrchestratorConfig {
    enabled: boolean;
    endpoint: string | null;
}
export interface UmbrellaConfig {
    configVersion: string;
    office: OfficeConfig;
    orchestrator: OrchestratorConfig;
}
export declare function createDefaultConfig(): UmbrellaConfig;
export declare function isConfigVersionSupported(configVersion: string): boolean;
//# sourceMappingURL=config-schema.d.ts.map