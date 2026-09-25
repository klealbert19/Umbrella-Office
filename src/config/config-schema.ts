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
    scheduler: {
      enabled: true,
    },
    webhook: {
      enabled: false,
      port: 3456,
      host: '127.0.0.1',
      authToken: null,
      allowedEvents: [],
      maxPayloadSize: 1048576, // 1MB
    },
    plugins: {
      enabled: [],
      directory: 'plugins',
    },
    remote: {
      defaultProvider: 'local',
    },
  };
}

export function isConfigVersionSupported(configVersion: string): boolean {
  return configVersion === CONFIG_VERSION;
}

/**
 * Normaliza uma configuração bruta contra os defaults atuais.
 * Preenche campos ausentes recursivamente, preservando valores existentes.
 */
export function normalizeConfig(raw: Partial<UmbrellaConfig>): UmbrellaConfig {
  const defaults = createDefaultConfig();

  return deepMerge(defaults, raw);
}

/**
 * Merge profundo que preserva valores existentes e preenche ausentes.
 * Arrays são substituídos (não mesclados) para evitar duplicatas.
 */
function deepMerge<T extends object>(target: T, source: Partial<T>): T {
  const result = { ...target } as T;

  for (const key of Object.keys(source) as Array<keyof T>) {
    const sourceValue = source[key];
    const targetValue = target[key];

    if (sourceValue === undefined || sourceValue === null) {
      // Manter o valor do target (default) se source for undefined/null
      continue;
    }

    if (
      typeof sourceValue === 'object' &&
      typeof targetValue === 'object' &&
      sourceValue !== null &&
      targetValue !== null &&
      !Array.isArray(sourceValue) &&
      !Array.isArray(targetValue)
    ) {
      // Merge recursivo para objetos
      result[key] = deepMerge(
        targetValue as object,
        sourceValue as object
      ) as T[keyof T];
    } else {
      // Valor primitivo ou array: usar o valor do source
      result[key] = sourceValue as T[keyof T];
    }
  }

  return result;
}