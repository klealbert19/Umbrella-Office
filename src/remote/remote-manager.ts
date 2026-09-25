/**
 * Remote Workspace Manager do Umbrella Office V0.4.
 *
 * Gerencia múltiplos providers de workspace (local, SSH, WSL).
 */
import { Logger } from '../logging/logger';
import { WorkspaceProvider, RemoteWorkspaceConfig, RemoteWorkspaceType } from './remote-types';
import { LocalWorkspaceProvider } from './local-provider';
import { SshWorkspaceProvider } from './ssh-provider';
import { WslWorkspaceProvider } from './wsl-provider';

export class RemoteWorkspaceManager {
  private readonly logger: Logger;
  private providers: Map<RemoteWorkspaceType, WorkspaceProvider> = new Map();
  private activeProvider: WorkspaceProvider | null = null;
  private activeConfig: RemoteWorkspaceConfig | null = null;

  constructor(logger: Logger) {
    this.logger = logger;

    // Registrar providers padrão
    this.registerProvider(new LocalWorkspaceProvider(logger));
    this.registerProvider(new SshWorkspaceProvider(logger));
    this.registerProvider(new WslWorkspaceProvider(logger));
  }

  registerProvider(provider: WorkspaceProvider): void {
    this.providers.set(provider.type, provider);
    this.logger.info('Workspace provider registered', { type: provider.type, name: provider.name });
  }

  getProvider(type: RemoteWorkspaceType): WorkspaceProvider | undefined {
    return this.providers.get(type);
  }

  listProviders(): WorkspaceProvider[] {
    return Array.from(this.providers.values());
  }

  async connect(config: RemoteWorkspaceConfig): Promise<void> {
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

  async disconnect(): Promise<void> {
    if (this.activeProvider) {
      await this.activeProvider.disconnect();
      this.activeProvider = null;
      this.activeConfig = null;
      this.logger.info('Workspace disconnected');
    }
  }

  getActiveProvider(): WorkspaceProvider | null {
    return this.activeProvider;
  }

  getActiveConfig(): RemoteWorkspaceConfig | null {
    return this.activeConfig;
  }

  isConnected(): boolean {
    return this.activeProvider !== null && this.activeProvider.isConnected();
  }

  // Delegar operações para o provider ativo
  async executeCommand(command: string, args: string[], cwd?: string) {
    if (!this.activeProvider) {
      throw new Error('No active workspace');
    }
    return this.activeProvider.executeCommand(command, args, cwd);
  }

  async readFile(filePath: string) {
    if (!this.activeProvider) {
      throw new Error('No active workspace');
    }
    return this.activeProvider.readFile(filePath);
  }

  async writeFile(filePath: string, content: string) {
    if (!this.activeProvider) {
      throw new Error('No active workspace');
    }
    return this.activeProvider.writeFile(filePath, content);
  }

  async listDirectory(dirPath: string) {
    if (!this.activeProvider) {
      throw new Error('No active workspace');
    }
    return this.activeProvider.listDirectory(dirPath);
  }

  async fileExists(filePath: string) {
    if (!this.activeProvider) {
      throw new Error('No active workspace');
    }
    return this.activeProvider.fileExists(filePath);
  }
}