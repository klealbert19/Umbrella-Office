/**
 * Informações de versão centralizadas do Umbrella Office.
 *
 * Nenhuma string de versão deve ser espalhada pelo código.
 * Consulte sempre este módulo.
 */
export declare const OFFICE_NAME = "Umbrella Office";
export declare const VERSION = "0.4.0";
export declare const PROTOCOL_VERSION = "1";
export declare const CONFIG_VERSION = "1";
export interface VersionInfo {
    name: string;
    version: string;
    protocolVersion: string;
    configVersion: string;
}
export declare function getVersionInfo(): VersionInfo;
//# sourceMappingURL=version.d.ts.map