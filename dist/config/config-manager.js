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
exports.ConfigManager = void 0;
/**
 * Gerencia o diretório de configuração do usuário (~/.umbrella/) e a
 * persistência de configuração (config.json) e estado (state.json).
 *
 * Nunca sobrescreve configuração existente sem necessidade.
 * Preparado para migrações futuras via configVersion.
 */
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const version_1 = require("../core/version");
const config_schema_1 = require("./config-schema");
const migration_runner_1 = require("../migrations/migration-runner");
class ConfigManager {
    baseDir;
    configPath;
    statePath;
    logDir;
    logger;
    config;
    state;
    constructor(logger, baseDir) {
        this.logger = logger;
        this.baseDir = baseDir ?? path.join(os.homedir(), '.umbrella');
        this.configPath = path.join(this.baseDir, 'config.json');
        this.statePath = path.join(this.baseDir, 'state.json');
        this.logDir = path.join(this.baseDir, 'logs');
        this.config = (0, config_schema_1.createDefaultConfig)();
        this.state = this.defaultState();
    }
    get homeDir() {
        return this.baseDir;
    }
    get logFilePath() {
        return path.join(this.logDir, 'office.log');
    }
    async init() {
        this.ensureDirectory(this.baseDir);
        this.ensureDirectory(this.logDir);
        this.config = await this.loadOrCreateConfig();
        this.state = await this.loadState();
        this.logger.info('Configuration loaded', {
            configVersion: this.config.configVersion,
            officeName: this.config.office.name,
            orchestratorEnabled: this.config.orchestrator.enabled,
        });
    }
    getConfig() {
        return this.config;
    }
    getState() {
        return this.state;
    }
    getActiveWorkspace() {
        return this.state.activeWorkspace;
    }
    async setActiveWorkspace(workspacePath) {
        this.state.activeWorkspace = workspacePath;
        await this.saveState();
    }
    async markStarted() {
        this.state.lastStartedAt = new Date().toISOString();
        await this.saveState();
    }
    async markShutdown(currentVersion) {
        this.state.lastVersion = currentVersion;
        this.state.lastShutdownAt = new Date().toISOString();
        await this.saveState();
    }
    defaultState() {
        return {
            lastVersion: version_1.CONFIG_VERSION === '1' ? '0.1.0' : '0.0.0',
            lastStartedAt: null,
            lastShutdownAt: null,
            activeWorkspace: null,
        };
    }
    ensureDirectory(dir) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            this.logger.info('Created directory', { dir });
        }
    }
    async loadOrCreateConfig() {
        if (!fs.existsSync(this.configPath)) {
            const fresh = (0, config_schema_1.createDefaultConfig)();
            await this.writeJson(this.configPath, fresh);
            this.logger.info('Created default configuration', {
                path: this.configPath,
            });
            return fresh;
        }
        const raw = await this.readJson(this.configPath);
        // Aplica migrações se a configuração for de uma versão anterior.
        if (!(0, config_schema_1.isConfigVersionSupported)(raw.configVersion)) {
            const migrated = await (0, migration_runner_1.runMigrations)(raw, this.logger);
            await this.writeJson(this.configPath, migrated);
            this.logger.info('Configuration migrated', {
                from: raw.configVersion,
                to: version_1.CONFIG_VERSION,
            });
            return migrated;
        }
        return raw;
    }
    async loadState() {
        if (!fs.existsSync(this.statePath)) {
            return this.defaultState();
        }
        try {
            const raw = await this.readJson(this.statePath);
            return {
                lastVersion: raw.lastVersion ?? '0.1.0',
                lastStartedAt: raw.lastStartedAt ?? null,
                lastShutdownAt: raw.lastShutdownAt ?? null,
                activeWorkspace: raw.activeWorkspace ?? null,
            };
        }
        catch {
            this.logger.warn('Failed to read state file, using default state');
            return this.defaultState();
        }
    }
    async saveState() {
        await this.writeJson(this.statePath, this.state);
    }
    async readJson(filePath) {
        const content = await fs.promises.readFile(filePath, 'utf-8');
        return JSON.parse(content);
    }
    async writeJson(filePath, data) {
        const content = JSON.stringify(data, null, 2) + '\n';
        await fs.promises.writeFile(filePath, content, 'utf-8');
    }
}
exports.ConfigManager = ConfigManager;
//# sourceMappingURL=config-manager.js.map