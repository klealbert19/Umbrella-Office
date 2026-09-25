"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RemoteWorkspaceManager = void 0;
const local_provider_1 = require("./local-provider");
const ssh_provider_1 = require("./ssh-provider");
const wsl_provider_1 = require("./wsl-provider");
class RemoteWorkspaceManager {
    logger;
    providers = new Map();
    activeProvider = null;
    activeConfig = null;
    constructor(logger) {
        this.logger = logger;
        // Registrar providers padrão
        this.registerProvider(new local_provider_1.LocalWorkspaceProvider(logger));
        this.registerProvider(new ssh_provider_1.SshWorkspaceProvider(logger));
        this.registerProvider(new wsl_provider_1.WslWorkspaceProvider(logger));
    }
    registerProvider(provider) {
        this.providers.set(provider.type, provider);
        this.logger.info('Workspace provider registered', { type: provider.type, name: provider.name });
    }
    getProvider(type) {
        return this.providers.get(type);
    }
    listProviders() {
        return Array.from(this.providers.values());
    }
    async connect(config) {
        const provider = this.providers.get(config.type);
        if (!provider) {
            throw new Error(`No provider for workspace type: ${config.type}`);
        }
        // Desconectar provider atual se houver
        if (this.activeProvider) {
            await this.activeProvider.disconnect();
        }
        await provider.connect(config);
        this.activeProvider = provider;
        this.activeConfig = config;
        this.logger.info('Workspace connected', { type: config.type, name: config.name });
    }
    async disconnect() {
        if (this.activeProvider) {
            await this.activeProvider.disconnect();
            this.activeProvider = null;
            this.activeConfig = null;
            this.logger.info('Workspace disconnected');
        }
    }
    getActiveProvider() {
        return this.activeProvider;
    }
    getActiveConfig() {
        return this.activeConfig;
    }
    isConnected() {
        return this.activeProvider !== null && this.activeProvider.isConnected();
    }
    // Delegar operações para o provider ativo
    async executeCommand(command, args, cwd) {
        if (!this.activeProvider) {
            throw new Error('No active workspace');
        }
        return this.activeProvider.executeCommand(command, args, cwd);
    }
    async readFile(filePath) {
        if (!this.activeProvider) {
            throw new Error('No active workspace');
        }
        return this.activeProvider.readFile(filePath);
    }
    async writeFile(filePath, content) {
        if (!this.activeProvider) {
            throw new Error('No active workspace');
        }
        return this.activeProvider.writeFile(filePath, content);
    }
    async listDirectory(dirPath) {
        if (!this.activeProvider) {
            throw new Error('No active workspace');
        }
        return this.activeProvider.listDirectory(dirPath);
    }
    async fileExists(filePath) {
        if (!this.activeProvider) {
            throw new Error('No active workspace');
        }
        return this.activeProvider.fileExists(filePath);
    }
}
exports.RemoteWorkspaceManager = RemoteWorkspaceManager;
//# sourceMappingURL=remote-manager.js.map