"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PluginManager = void 0;
/**
 * Plugin Manager do Umbrella Office V0.4.
 *
 * Gerencia descoberta, carregamento, validação e lifecycle de plugins.
 */
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class PluginManager {
    logger;
    taskRouter;
    permissionManager;
    configManager;
    pluginsDir;
    plugins = new Map();
    isInitialized = false;
    constructor(logger, taskRouter, permissionManager, configManager, baseDir) {
        this.logger = logger;
        this.taskRouter = taskRouter;
        this.permissionManager = permissionManager;
        this.configManager = configManager;
        this.pluginsDir = path.join(baseDir ?? path.join(require('os').homedir(), '.umbrella'), 'plugins');
    }
    set taskRouterRef(router) {
        this.taskRouter = router;
    }
    async initialize() {
        if (this.isInitialized)
            return;
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
    async shutdown() {
        for (const [id, plugin] of this.plugins) {
            if (plugin.enabled) {
                await this.disablePlugin(id);
            }
        }
        this.plugins.clear();
        this.isInitialized = false;
        this.logger.info('PluginManager shutdown');
    }
    async loadEnabledPlugins() {
        const config = this.configManager.getConfig();
        const enabledPlugins = config.plugins?.enabled ?? [];
        for (const pluginId of enabledPlugins) {
            try {
                await this.loadPlugin(pluginId);
            }
            catch (err) {
                this.logger.error('Failed to load plugin', { pluginId, error: String(err) });
            }
        }
    }
    async loadPlugin(pluginId) {
        const pluginPath = path.join(this.pluginsDir, pluginId);
        const manifestPath = path.join(pluginPath, 'manifest.json');
        if (!fs.existsSync(manifestPath)) {
            throw new Error(`Plugin manifest not found: ${manifestPath}`);
        }
        // Ler manifest
        const manifestContent = await fs.promises.readFile(manifestPath, 'utf-8');
        const manifest = JSON.parse(manifestContent);
        // Validar manifest
        this.validateManifest(manifest);
        // Verificar se já está carregado
        if (this.plugins.has(manifest.id)) {
            this.logger.warn('Plugin already loaded', { pluginId: manifest.id });
            return this.plugins.get(manifest.id);
        }
        // Carregar entry point
        const entryPointPath = path.join(pluginPath, manifest.entryPoint);
        if (!fs.existsSync(entryPointPath)) {
            throw new Error(`Plugin entry point not found: ${entryPointPath}`);
        }
        let pluginInstance;
        try {
            // Carregar módulo do plugin
            const pluginModule = require(entryPointPath);
            pluginInstance = pluginModule.default ?? pluginModule;
        }
        catch (err) {
            throw new Error(`Failed to load plugin module: ${String(err)}`);
        }
        // Criar contexto para o plugin
        const context = {
            logger: this.logger,
            taskRouter: this.taskRouter,
            permissionManager: this.permissionManager,
            configManager: this.configManager,
        };
        // Inicializar plugin se tiver método initialize
        if (pluginInstance && typeof pluginInstance === 'object' && 'initialize' in pluginInstance && typeof pluginInstance.initialize === 'function') {
            try {
                await pluginInstance.initialize(context);
            }
            catch (err) {
                throw new Error(`Plugin initialization failed: ${String(err)}`);
            }
        }
        // Registrar capabilities
        for (const capability of manifest.capabilities) {
            this.registerCapability(manifest.id, capability);
        }
        const instance = {
            manifest,
            instance: pluginInstance,
            enabled: true,
            loadedAt: new Date().toISOString(),
        };
        this.plugins.set(manifest.id, instance);
        this.logger.info('Plugin loaded', { pluginId: manifest.id, name: manifest.name, version: manifest.version });
        return instance;
    }
    validateManifest(manifest) {
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
    registerCapability(pluginId, capability) {
        // Registrar capability no TaskRouter ou PermissionManager conforme necessário
        // Por enquanto, apenas log
        this.logger.info('Plugin capability registered', { pluginId, capability: capability.name, type: capability.type });
    }
    async enablePlugin(pluginId) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) {
            // Tentar carregar primeiro
            await this.loadPlugin(pluginId);
            return this.enablePlugin(pluginId);
        }
        if (plugin.enabled)
            return true;
        plugin.enabled = true;
        // Adicionar à configuração
        const config = this.configManager.getConfig();
        const pluginsConfig = config.plugins ?? { enabled: [] };
        if (!pluginsConfig.enabled.includes(pluginId)) {
            pluginsConfig.enabled.push(pluginId);
            // Nota: em uma implementação completa, salvaríamos a config
        }
        // Re-inicializar se necessário
        if (plugin.instance && typeof plugin.instance === 'object' && 'initialize' in plugin.instance && typeof plugin.instance.initialize === 'function') {
            const context = {
                logger: this.logger,
                taskRouter: this.taskRouter,
                permissionManager: this.permissionManager,
                configManager: this.configManager,
            };
            try {
                await plugin.instance.initialize(context);
            }
            catch (err) {
                plugin.enabled = false;
                plugin.error = String(err);
                this.logger.error('Failed to re-initialize plugin', { pluginId, error: String(err) });
                return false;
            }
        }
        this.logger.info('Plugin enabled', { pluginId });
        return true;
    }
    async disablePlugin(pluginId) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin)
            return false;
        if (!plugin.enabled)
            return true;
        // Chamar shutdown se existir
        if (plugin.instance && typeof plugin.instance === 'object' && 'shutdown' in plugin.instance && typeof plugin.instance.shutdown === 'function') {
            try {
                await plugin.instance.shutdown();
            }
            catch (err) {
                this.logger.warn('Plugin shutdown error', { pluginId, error: String(err) });
            }
        }
        plugin.enabled = false;
        // Remover da configuração
        const config = this.configManager.getConfig();
        const pluginsConfig = config.plugins ?? { enabled: [] };
        pluginsConfig.enabled = pluginsConfig.enabled.filter((id) => id !== pluginId);
        this.logger.info('Plugin disabled', { pluginId });
        return true;
    }
    async removePlugin(pluginId) {
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
    getPlugin(pluginId) {
        return this.plugins.get(pluginId);
    }
    listPlugins() {
        return Array.from(this.plugins.values());
    }
    isPluginEnabled(pluginId) {
        const plugin = this.plugins.get(pluginId);
        return plugin?.enabled ?? false;
    }
}
exports.PluginManager = PluginManager;
//# sourceMappingURL=plugin-manager.js.map