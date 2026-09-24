/**
 * Esquema de configuração do Umbrella Office.
 *
 * Define a forma da configuração persistida em ~/.umbrella/config.json.
 * A `configVersion` permite futuras migrações sem destruir a configuração.
 */
import { CONFIG_VERSION } from '../core/version';

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

export function createDefaultConfig(): UmbrellaConfig {
  return {
    configVersion: CONFIG_VERSION,
    office: {
      name: 'Umbrella Office',
    },
    orchestrator: {
      enabled: false,
      endpoint: null,
    },
  };
}

export function isConfigVersionSupported(configVersion: string): boolean {
  return configVersion === CONFIG_VERSION;
}