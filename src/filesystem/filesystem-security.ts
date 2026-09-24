/**
 * Segurança do filesystem do Umbrella Office V0.2.
 *
 * Garante que todas as operações permaneçam dentro do workspace ativo.
 * Normaliza caminhos, resolve symlinks e previne path traversal.
 */
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../logging/logger';

export class FilesystemSecurity {
  private readonly logger: Logger;
  private activeWorkspace: string | null = null;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  setActiveWorkspace(workspacePath: string): void {
    this.activeWorkspace = path.resolve(workspacePath);
    this.logger.info('Workspace de filesystem definido', { workspace: this.activeWorkspace });
  }

  clearActiveWorkspace(): void {
    this.logger.info('Workspace de filesystem limpo');
    this.activeWorkspace = null;
  }

  /**
   * Normaliza um caminho e verifica se ele está dentro do workspace ativo.
   * Lança erro se o caminho tentar escapar.
   */
  private ensureWithinWorkspace(filePath: string): string {
    if (!this.activeWorkspace) {
      throw new Error('Nenhum workspace ativo definido');
    }
    const resolved = path.resolve(filePath);
    const normalized = path.normalize(resolved);

    // Resolver symlinks para o diretório ativo
    let realActive: string;
    try {
      realActive = fs.realpathSync(this.activeWorkspace);
    } catch {
      realActive = this.activeWorkspace;
    }

    // Resolver symlinks para o caminho de destino (se ele existir)
    let realTarget: string;
    try {
      realTarget = fs.realpathSync(normalized);
    } catch {
      realTarget = normalized;
    }

    if (!realTarget.startsWith(realActive + path.sep) && realTarget !== realActive) {
      this.logger.warn('Tentativa de acesso fora do workspace bloqueada', {
        requested: filePath,
        resolved: normalized,
        realTarget,
        workspace: realActive,
      });
      throw new Error(`Acesso negado: caminho fora do workspace ativo`);
    }
    return normalized;
  }

  /**
   * Verifica se um diretório é seguro para ser criado dentro do workspace ativo.
   */
  ensureDirectoryWithinWorkspace(dirPath: string): string {
    if (!this.activeWorkspace) {
      throw new Error('Nenhum workspace ativo definido');
    }
    const resolved = path.resolve(dirPath);
    const normalized = path.normalize(resolved);

    let realActive: string;
    try {
      realActive = fs.realpathSync(this.activeWorkspace);
    } catch {
      realActive = this.activeWorkspace;
    }

    if (!normalized.startsWith(realActive + path.sep) && normalized !== realActive) {
      throw new Error(`A criação do diretório está fora do workspace ativo`);
    }
    return normalized;
  }

  /**
   * Verifica se um caminho é seguro para ser lido.
   */
  checkRead(path: string): string {
    return this.ensureWithinWorkspace(path);
  }

  /**
   * Verifica se um caminho é seguro para ser escrito.
   */
  checkWrite(path: string): string {
    return this.ensureWithinWorkspace(path);
  }

  /**
   * Verifica se um caminho é seguro para ser editado.
   */
  checkEdit(path: string): string {
    return this.ensureWithinWorkspace(path);
  }

  /**
   * Verifica se um caminho é seguro para ser excluído.
   */
  checkDelete(path: string): string {
    return this.ensureWithinWorkspace(path);
  }

  /**
   * Verifica se um caminho é seguro para listagem.
   */
  checkList(path: string): string {
    return this.ensureWithinWorkspace(path);
  }
}
