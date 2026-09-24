/**
 * Workspace Manager do Umbrella Office V0.2.
 *
 * Gerencia o workspace ativo, persistência e operações de segurança.
 * Fornece operações para abrir, fechar, ler informações e escanear projetos.
 */
import * as path from 'path';
import * as fsPromises from 'fs/promises';
import { randomUUID } from 'crypto';
import { Logger } from '../logging/logger';
import { FilesystemSecurity } from '../filesystem/filesystem-security';
import { ProjectScanner } from '../scanner/project-scanner';
import { ConfigManager } from '../config/config-manager';
import {
  WorkspaceOpenResult,
  WorkspaceCloseResult,
  WorkspaceScanResult,
} from './workspace-types';

export class WorkspaceManager {
  private readonly logger: Logger;
  private readonly security: FilesystemSecurity;
  private readonly scanner: ProjectScanner;
  private readonly configManager: ConfigManager;
  private activeWorkspacePath: string | null = null;

  constructor(
    logger: Logger,
    security: FilesystemSecurity,
    scanner: ProjectScanner,
    configManager: ConfigManager
  ) {
    this.logger = logger;
    this.security = security;
    this.scanner = scanner;
    this.configManager = configManager;
  }

  /**
   * Abre um workspace no caminho especificado.
   */
  async openWorkspace(workspacePath: string): Promise<WorkspaceOpenResult> {
    try {
      // Normaliza o caminho
      const normalizedPath = path.resolve(workspacePath);

      // Verifica se o caminho existe e é um diretório
      const stats = await fsPromises.stat(normalizedPath);
      if (!stats.isDirectory()) {
        return { success: false, error: 'Caminho não é um diretório', code: 'NOT_A_DIRECTORY' };
      }

      // Define como workspace ativo (segurança + memória)
      this.security.setActiveWorkspace(normalizedPath);
      this.activeWorkspacePath = normalizedPath;

      // Salva no estado via ConfigManager
      await this.configManager.setActiveWorkspace(normalizedPath);

      this.logger.info('Workspace aberto', { path: normalizedPath });
      return {
        success: true,
        workspace: {
          id: randomUUID(),
          name: path.basename(normalizedPath),
          path: normalizedPath,
          openedAt: new Date().toISOString(),
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error('Falha ao abrir workspace', { path: workspacePath, error: message });
      return { success: false, error: message, code: 'OPEN_ERROR' };
    }
  }

  /**
   * Fecha o workspace ativo.
   */
  async closeWorkspace(): Promise<WorkspaceCloseResult> {
    try {
      if (!this.activeWorkspacePath) {
        return { success: false, error: 'Nenhum workspace ativo', code: 'NO_ACTIVE_WORKSPACE' };
      }

      const workspacePath = this.activeWorkspacePath;
      this.activeWorkspacePath = null;
      this.security.clearActiveWorkspace();

      // Salva o estado (sem workspace ativo) via ConfigManager
      await this.configManager.setActiveWorkspace(null);

      this.logger.info('Workspace fechado', { path: workspacePath });
      return {
        success: true,
        workspace: {
          id: randomUUID(),
          name: path.basename(workspacePath),
          path: workspacePath,
          openedAt: new Date().toISOString(),
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error('Falha ao fechar workspace', { error: message });
      return { success: false, error: message, code: 'CLOSE_ERROR' };
    }
  }

  /**
   * Retorna informações sobre o workspace ativo.
   */
  async getWorkspaceInfo(): Promise<WorkspaceOpenResult> {
    try {
      if (!this.activeWorkspacePath) {
        return { success: false, error: 'Nenhum workspace ativo', code: 'NO_ACTIVE_WORKSPACE' };
      }

      const workspacePath = this.activeWorkspacePath;

      this.logger.info('Informações do workspace solicitadas', { path: workspacePath });
      return {
        success: true,
        workspace: {
          id: randomUUID(),
          name: path.basename(workspacePath),
          path: workspacePath,
          openedAt: new Date().toISOString(),
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error('Falha ao obter informações do workspace', { error: message });
      return { success: false, error: message, code: 'INFO_ERROR' };
    }
  }

  /**
   * Escaneia o workspace atual ou um caminho especificado para tipo de projeto.
   */
  async scanWorkspace(scanPath?: string): Promise<WorkspaceScanResult> {
    try {
      const targetPath = scanPath ? path.resolve(scanPath) : this.activeWorkspacePath;

      if (!targetPath) {
        return { success: false, error: 'Nenhum workspace ativo e nenhum caminho fornecido', code: 'NO_PATH_SPECIFIED' };
      }

      // Verifica se o caminho existe
      const stats = await fsPromises.stat(targetPath);
      if (!stats.isDirectory()) {
        return { success: false, error: 'Caminho não é um diretório', code: 'NOT_A_DIRECTORY' };
      }

      // Escaneia o projeto
      const scanResult = await this.scanner.scanProject(targetPath);
      if (!scanResult.success || !scanResult.project) {
        return { success: false, error: scanResult.error ?? 'Falha ao escanear projeto', code: 'SCAN_FAILED' };
      }

      const project = scanResult.project;
      this.logger.info('Workspace escaneado', { path: targetPath, types: project.projectTypes });
      return {
        success: true,
        scan: {
          path: targetPath,
          scannedAt: new Date().toISOString(),
          projectTypes: project.projectTypes,
          packageManager: project.packageManager,
          hasGit: project.git,
          filesCount: project.filesCount,
          directoriesCount: project.directoriesCount,
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error('Falha ao escanear workspace', { error: message });
      return { success: false, error: message, code: 'SCAN_ERROR' };
    }
  }

  /**
   * Retorna o caminho do workspace ativo.
   */
  getActiveWorkspacePath(): string | null {
    return this.activeWorkspacePath;
  }
}
