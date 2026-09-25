/**
 * Gerencia o diretório de configuração do usuário (~/.umbrella/) e a
 * persistência de configuração (config.json) e estado (state.json).
 *
 * Nunca sobrescreve configuração existente sem necessidade.
 * Preparado para migrações futuras via configVersion.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { CONFIG_VERSION } from '../core/version';
import {
  UmbrellaConfig,
  createDefaultConfig,
  isConfigVersionSupported,
  normalizeConfig,
} from './config-schema';
import { runMigrations } from '../migrations/migration-runner';
import { Logger } from '../logging/logger';

export interface AppState {
  lastVersion: string;
  lastStartedAt: string | null;
  lastShutdownAt: string | null;
  activeWorkspace: string | null;
}

export class ConfigManager {
  private readonly baseDir: string;
  private readonly configPath: string;
  private readonly statePath: string;
  private readonly logDir: string;
  private readonly logger: Logger;

  private config: UmbrellaConfig;
  private state: AppState;

  constructor(logger: Logger, baseDir?: string) {
    this.logger = logger;
    this.baseDir = baseDir ?? path.join(os.homedir(), '.umbrella');
    this.configPath = path.join(this.baseDir, 'config.json');
    this.statePath = path.join(this.baseDir, 'state.json');
    this.logDir = path.join(this.baseDir, 'logs');
    this.config = createDefaultConfig();
    this.state = this.defaultState();
  }

  get homeDir(): string {
    return this.baseDir;
  }

  get logFilePath(): string {
    return path.join(this.logDir, 'office.log');
  }

  async init(): Promise<void> {
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

  getConfig(): UmbrellaConfig {
    return this.config;
  }

  getState(): AppState {
    return this.state;
  }

  getActiveWorkspace(): string | null {
    return this.state.activeWorkspace;
  }

  async setActiveWorkspace(workspacePath: string | null): Promise<void> {
    this.state.activeWorkspace = workspacePath;
    await this.saveState();
  }

  async markStarted(): Promise<void> {
    this.state.lastStartedAt = new Date().toISOString();
    await this.saveState();
  }

  async markShutdown(currentVersion: string): Promise<void> {
    this.state.lastVersion = currentVersion;
    this.state.lastShutdownAt = new Date().toISOString();
    await this.saveState();
  }

  private defaultState(): AppState {
    return {
      lastVersion: CONFIG_VERSION === '1' ? '0.1.0' : '0.0.0',
      lastStartedAt: null,
      lastShutdownAt: null,
      activeWorkspace: null,
    };
  }

  private ensureDirectory(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      this.logger.info('Created directory', { dir });
    }
  }

  private async loadOrCreateConfig(): Promise<UmbrellaConfig> {
    if (!fs.existsSync(this.configPath)) {
      const fresh = createDefaultConfig();
      await this.writeJson(this.configPath, fresh);
      this.logger.info('Created default configuration', {
        path: this.configPath,
      });
      return fresh;
    }

    const raw = await this.readJson<Partial<UmbrellaConfig>>(this.configPath);

    // Aplica migrações se a configuração for de uma versão anterior.
    let config: UmbrellaConfig;
    const configVersion = raw.configVersion ?? '';
    if (!isConfigVersionSupported(configVersion)) {
      const migrated = await runMigrations(raw as UmbrellaConfig, this.logger);
      config = migrated;
      this.logger.info('Configuration migrated', {
        from: configVersion,
        to: CONFIG_VERSION,
      });
    } else {
      config = raw as UmbrellaConfig;
    }

    // Normaliza a configuração contra os defaults atuais para preencher campos ausentes
    const normalized = normalizeConfig(config);

    // Se a normalização alterou a configuração, persistir a versão normalizada
    if (JSON.stringify(normalized) !== JSON.stringify(config)) {
      await this.writeJson(this.configPath, normalized);
      this.logger.info('Configuration normalized and persisted', {
        path: this.configPath,
      });
    }

    return normalized;
  }

  private async loadState(): Promise<AppState> {
    if (!fs.existsSync(this.statePath)) {
      return this.defaultState();
    }
    try {
      const raw = await this.readJson<Partial<AppState>>(this.statePath);
      return {
        lastVersion: raw.lastVersion ?? '0.1.0',
        lastStartedAt: raw.lastStartedAt ?? null,
        lastShutdownAt: raw.lastShutdownAt ?? null,
        activeWorkspace: raw.activeWorkspace ?? null,
      };
    } catch {
      this.logger.warn('Failed to read state file, using default state');
      return this.defaultState();
    }
  }

  private async saveState(): Promise<void> {
    await this.writeJson(this.statePath, this.state);
  }

  private async readJson<T>(filePath: string): Promise<T> {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  }

  private async writeJson(filePath: string, data: unknown): Promise<void> {
    const content = JSON.stringify(data, null, 2) + '\n';
    await fs.promises.writeFile(filePath, content, 'utf-8');
  }
}