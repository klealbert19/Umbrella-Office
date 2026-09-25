/**
 * Tipos para o Plugin System do Umbrella Office V0.4.
 */
import { randomUUID } from 'crypto';

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  capabilities: PluginCapability[];
  entryPoint: string; // Caminho relativo ao arquivo principal do plugin
}

export interface PluginCapability {
  type: string; // ex: 'tool', 'command', 'event-handler'
  name: string;
  description: string;
  // Metadados específicos da capability
  metadata?: Record<string, unknown>;
}

export interface PluginInstance {
  manifest: PluginManifest;
  instance: unknown; // Instância do plugin carregado
  enabled: boolean;
  loadedAt: string;
  error?: string;
}

export interface PluginContext {
  logger: any; // Logger
  taskRouter: any; // TaskRouter
  permissionManager: any; // PermissionManager
  configManager: any; // ConfigManager
}

export function createPluginManifest(
  id: string,
  name: string,
  version: string,
  description: string,
  capabilities: PluginCapability[],
  entryPoint: string
): PluginManifest {
  return {
    id,
    name,
    version,
    description,
    capabilities,
    entryPoint,
  };
}