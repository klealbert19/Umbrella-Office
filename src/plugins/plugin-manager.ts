/**
 * Plugin Manager do Umbrella Office V0.4.
 *
 * Gerencia descoberta, carregamento, validação e lifecycle de plugins.
 */
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../logging/logger';
import { TaskRouter } from '../core/task-router';
import { PermissionManager } from '../execution/permission-manager';
import { ConfigManager } from '../config/config-manager';
import { PluginManifest, PluginCapability, PluginInstance, PluginContext } from './plugin-types';

export class PluginManager {
  private readonly logger: Logger;
  private taskRouter: TaskRouter;
  private readonly permissionManager: PermissionManager;
  private readonly configManager: ConfigManager;
  private readonly pluginsDir: string;
  private plugins: Map<string, PluginInstance> = new Map();
  private isInitialized: boolean = false;

  constructor(
    logger: Logger,
    taskRouter: TaskRouter,
    permissionManager: PermissionManager,
    configManager: ConfigManager,
    baseDir?: string
  ) {
    this.logger = logger;
    this.taskRouter = taskRouter;
    this.permissionManager = permissionManager;
    this.configManager = configManager;
    this.pluginsDir = path.join(baseDir ?? path.join(require('os').homedir(), '.umbrella'), 'plugins');
  }

  set taskRouterRef(router: TaskRouter) {
    this.taskRouter = router;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Garantir que o diretório de plugins existe
    if (!fs.existsSync(this.pluginsDir)) {
      fs.mkdirSync(this.pluginsDir, { recursive: true });
      this.logger.info('Created plugins directory', { path: this.pluginsDir });
    }

    // Carregar plugins habilitados
    await this.loadEnabledPlugins();

    this.isInitialized = true;
    this.logger.info('PluginManager initialized', { pluginCount: this.plugins.size });
  }

  async shutdown(): Promise<void> {
    for (const [id, plugin] of this.plugins) {
      if (plugin.enabled) {
        await this.disablePlugin(id);
      }
    }
    this.plugins.clear();
    this.isInitialized = false;
    this.logger.info('PluginManager shutdown');
  }

  private async loadEnabledPlugins(): Promise<void> {
    const config = this.configManager.getConfig();
    const enabledPlugins = (config as any).plugins?.enabled ?? [];

    for (const pluginId of enabledPlugins) {
      try {
        await this.loadPlugin(pluginId);
      } catch (err) {
        this.logger.error('Failed to load plugin', { pluginId, error: String(err) });
      }
    }
  }

  async loadPlugin(pluginId: string): Promise<PluginInstance | null> {
    const pluginPath = path.join(this.pluginsDir, pluginId);
    const manifestPath = path.join(pluginPath, 'manifest.json');

    if (!fs.existsSync(manifestPath)) {
      throw new Error(`Plugin manifest not found: ${manifestPath}`);
    }

    // Ler manifest
    const manifestContent = await fs.promises.readFile(manifestPath, 'utf-8');
    const manifest: PluginManifest = JSON.parse(manifestContent);

    // Validar manifest
    this.validateManifest(manifest);

    // Verificar se já está carregado
    if (this.plugins.has(manifest.id)) {
      this.logger.warn('Plugin already loaded', { pluginId: manifest.id });
      return this.plugins.get(manifest.id)!;
    }

    // Carregar entry point
    const entryPointPath = path.join(pluginPath, manifest.entryPoint);
    if (!fs.existsSync(entryPointPath)) {
      throw new Error(`Plugin entry point not found: ${entryPointPath}`);
    }

    let pluginInstance: unknown;
    try {
      // Carregar módulo do plugin
      const pluginModule = require(entryPointPath);
      pluginInstance = pluginModule.default ?? pluginModule;
    } catch (err) {
      throw new Error(`Failed to load plugin module: ${String(err)}`);
    }

    // Criar contexto para o plugin
    const context: PluginContext = {
      logger: this.logger,
      taskRouter: this.taskRouter,
      permissionManager: this.permissionManager,
      configManager: this.configManager,
    };

    // Inicializar plugin se tiver método initialize
    if (pluginInstance && typeof pluginInstance === 'object' && 'initialize' in pluginInstance && typeof (pluginInstance as Record<string, unknown>).initialize === 'function') {
      try {
        await (pluginInstance as { initialize: (context: PluginContext) => Promise<void> }).initialize(context);
      } catch (err) {
        throw new Error(`Plugin initialization failed: ${String(err)}`);
      }
    }

    // Registrar capabilities
    for (const capability of manifest.capabilities) {
      this.registerCapability(manifest.id, capability);
    }

    const instance: PluginInstance = {
      manifest,
      instance: pluginInstance,
      enabled: true,
      loadedAt: new Date().toISOString(),
    };

    this.plugins.set(manifest.id, instance);
    this.logger.info('Plugin loaded', { pluginId: manifest.id, name: manifest.name, version: manifest.version });

    return instance;
  }

  private validateManifest(manifest: PluginManifest): void {
    if (!manifest.id || !manifest.name || !manifest.version || !manifest.entryPoint) {
      throw new Error('Invalid plugin manifest: missing required fields');
    }

    if (!Array.isArray(manifest.capabilities)) {
      throw new Error('Invalid plugin manifest: capabilities must be an array');
    }

    for (const cap of manifest.capabilities) {
      if (!cap.type || !cap.name) {
        throw new Error('Invalid plugin capability: missing type or name');
      }
    }
  }

  private registerCapability(pluginId: string, capability: PluginCapability): void {
    // Registrar capability no TaskRouter ou PermissionManager conforme necessário
    // Por enquanto, apenas log
    this.logger.info('Plugin capability registered', { pluginId, capability: capability.name, type: capability.type });
  }

  async enablePlugin(pluginId: string): Promise<boolean> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      // Tentar carregar primeiro
      await this.loadPlugin(pluginId);
      return this.enablePlugin(pluginId);
    }

    if (plugin.enabled) return true;

    plugin.enabled = true;

    // Adicionar à configuração
    const config = this.configManager.getConfig();
    const pluginsConfig = (config as any).plugins ?? { enabled: [] };
    if (!pluginsConfig.enabled.includes(pluginId)) {
      pluginsConfig.enabled.push(pluginId);
      // Nota: em uma implementação completa, salvaríamos a config
    }

    // Re-inicializar se necessário
    if (plugin.instance && typeof plugin.instance === 'object' && 'initialize' in plugin.instance && typeof (plugin.instance as Record<string, unknown>).initialize === 'function') {
      const context: PluginContext = {
        logger: this.logger,
        taskRouter: this.taskRouter,
        permissionManager: this.permissionManager,
        configManager: this.configManager,
      };
      try {
        await (plugin.instance as { initialize: (context: PluginContext) => Promise<void> }).initialize(context);
      } catch (err) {
        plugin.enabled = false;
        plugin.error = String(err);
        this.logger.error('Failed to re-initialize plugin', { pluginId, error: String(err) });
        return false;
      }
    }

    this.logger.info('Plugin enabled', { pluginId });
    return true;
  }

  async disablePlugin(pluginId: string): Promise<boolean> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return false;

    if (!plugin.enabled) return true;

    // Chamar shutdown se existir
    if (plugin.instance && typeof plugin.instance === 'object' && 'shutdown' in plugin.instance && typeof (plugin.instance as Record<string, unknown>).shutdown === 'function') {
      try {
        await (plugin.instance as { shutdown: () => Promise<void> }).shutdown();
      } catch (err) {
        this.logger.warn('Plugin shutdown error', { pluginId, error: String(err) });
      }
    }

    plugin.enabled = false;

    // Remover da configuração
    const config = this.configManager.getConfig();
    const pluginsConfig = (config as any).plugins ?? { enabled: [] };
    pluginsConfig.enabled = pluginsConfig.enabled.filter((id: string) => id !== pluginId);

    this.logger.info('Plugin disabled', { pluginId });
    return true;
  }

  async removePlugin(pluginId: string): Promise<boolean> {
    await this.disablePlugin(pluginId);
    this.plugins.delete(pluginId);

    // Remover diretório do plugin
    const pluginPath = path.join(this.pluginsDir, pluginId);
    if (fs.existsSync(pluginPath)) {
      fs.rmSync(pluginPath, { recursive: true, force: true });
    }

    this.logger.info('Plugin removed', { pluginId });
    return true;
  }

  getPlugin(pluginId: string): PluginInstance | undefined {
    return this.plugins.get(pluginId);
  }

  listPlugins(): PluginInstance[] {
    return Array.from(this.plugins.values());
  }

  isPluginEnabled(pluginId: string): boolean {
    const plugin = this.plugins.get(pluginId);
    return plugin?.enabled ?? false;
  }
}