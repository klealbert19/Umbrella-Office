export interface OfficeConfig {
    name: string;
}
export interface OrchestratorConfig {
    enabled: boolean;
    endpoint: string | null;
}
export interface SchedulerConfig {
    enabled: boolean;
}
export interface WebhookConfig {
    enabled: boolean;
    port: number;
    host: string;
    authToken: string | null;
    allowedEvents: string[];
    maxPayloadSize: number;
}
export interface PluginsConfig {
    enabled: string[];
    directory: string;
}
export interface RemoteConfig {
    defaultProvider: 'local' | 'ssh' | 'wsl';
}
export interface UmbrellaConfig {
    configVersion: string;
    office: OfficeConfig;
    orchestrator: OrchestratorConfig;
    scheduler: SchedulerConfig;
    webhook: WebhookConfig;
    plugins: PluginsConfig;
    remote: RemoteConfig;
}
export declare function createDefaultConfig(): UmbrellaConfig;
export declare function isConfigVersionSupported(configVersion: string): boolean;
/**
 * Normaliza uma configuração bruta contra os defaults atuais.
 * Preenche campos ausentes recursivamente, preservando valores existentes.
 */
export declare function normalizeConfig(raw: Partial<UmbrellaConfig>): UmbrellaConfig;
//# sourceMappingURL=config-schema.d.ts.map