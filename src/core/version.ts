/**
 * Informações de versão centralizadas do Umbrella Office.
 *
 * Nenhuma string de versão deve ser espalhada pelo código.
 * Consulte sempre este módulo.
 */
export const OFFICE_NAME = 'Umbrella Office';

export const VERSION = '0.4.0';
export const PROTOCOL_VERSION = '1';
export const CONFIG_VERSION = '1';

export interface VersionInfo {
  name: string;
  version: string;
  protocolVersion: string;
  configVersion: string;
}

export function getVersionInfo(): VersionInfo {
  return {
    name: OFFICE_NAME,
    version: VERSION,
    protocolVersion: PROTOCOL_VERSION,
    configVersion: CONFIG_VERSION,
  };
}