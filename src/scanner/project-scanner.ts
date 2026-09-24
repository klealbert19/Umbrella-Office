/**
 * Project Scanner do Umbrella Office V0.2.
 *
 * Analisa um workspace para detectar tipo de projeto, gerenciador de pacotes, Git e estrutura.
 * Não executa comandos externos, apenas lê arquivos e lista diretórios.
 */
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../logging/logger';
import { FilesystemEngine } from '../filesystem/filesystem-engine';
import { ProjectInfo, ProjectScanResult } from './project-types';

const EXCLUDED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.next',
  '.cache',
  '.dart_tool',
  '.idea',
  '.vscode',
]);

export class ProjectScanner {
  private readonly logger: Logger;
  private readonly engine: FilesystemEngine;

  constructor(logger: Logger, engine: FilesystemEngine) {
    this.logger = logger;
    this.engine = engine;
  }

  async scanProject(rootPath: string): Promise<ProjectScanResult> {
    try {
      const normalizedRoot = path.resolve(rootPath);
      const projectTypes: string[] = [];
      let packageManager: string | undefined;
      let git = false;
      let filesCount = 0;
      let directoriesCount = 0;
      const files: string[] = [];
      const excludedDirectories: string[] = [];

      // Detectar TypeScript
      const tsConfigPath = path.join(normalizedRoot, 'tsconfig.json');
      if (await this.fileExists(tsConfigPath)) {
        projectTypes.push('typescript');
      }

      // Detectar Node.js
      const packageJsonPath = path.join(normalizedRoot, 'package.json');
      if (await this.fileExists(packageJsonPath)) {
        projectTypes.push('nodejs');
        // Detectar gerenciador de pacotes
        packageManager = await this.detectPackageManager(normalizedRoot);
      }

      // Detectar Flutter
      const pubspecPath = path.join(normalizedRoot, 'pubspec.yaml');
      if (await this.fileExists(pubspecPath)) {
        projectTypes.push('flutter');
      }

      // Detectar Python
      const pyProjectPath = path.join(normalizedRoot, 'pyproject.toml');
      const requirementsPath = path.join(normalizedRoot, 'requirements.txt');
      if (await this.fileExists(pyProjectPath) || await this.fileExists(requirementsPath)) {
        projectTypes.push('python');
      }

      // Detectar Git
      const gitDir = path.join(normalizedRoot, '.git');
      if (await this.directoryExists(gitDir)) {
        git = true;
      }

      // Listar diretório recursivamente (limitado)
      const listResult = await this.engine.listDirectory(normalizedRoot);
      if (!listResult.success || !listResult.entries) {
        return { success: false, error: 'Falha ao listar diretório' };
      }

      for (const entry of listResult.entries) {
        if (EXCLUDED_DIRS.has(entry.name)) {
          excludedDirectories.push(entry.name);
          continue;
        }
        if (entry.type === 'file') {
          filesCount++;
          files.push(entry.relativePath);
        } else {
          directoriesCount++;
        }
      }

      // Limitar a quantidade de arquivos retornados para evitar sobrecarga
      const maxFiles = 1000;
      if (files.length > maxFiles) {
        files.splice(maxFiles);
      }

      const project: ProjectInfo = {
        root: normalizedRoot,
        projectTypes,
        packageManager,
        git,
        filesCount,
        directoriesCount,
        excludedDirectories,
        files,
      };

      this.logger.info('Projeto escaneado', {
        root: normalizedRoot,
        types: projectTypes,
        packageManager,
        git,
        filesCount,
        directoriesCount,
      });

      return { success: true, project };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error('Falha ao escanear projeto', { rootPath, error: message });
      return { success: false, error: message };
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async directoryExists(dirPath: string): Promise<boolean> {
    try {
      const stats = await fs.promises.stat(dirPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  private async detectPackageManager(root: string): Promise<string | undefined> {
    const lockFiles = [
      { path: path.join(root, 'package-lock.json'), manager: 'npm' },
      { path: path.join(root, 'pnpm-lock.yaml'), manager: 'pnpm' },
      { path: path.join(root, 'yarn.lock'), manager: 'yarn' },
      { path: path.join(root, 'bun.lockb'), manager: 'bun' },
      { path: path.join(root, 'bun.lock'), manager: 'bun' },
    ];
    for (const lock of lockFiles) {
      try {
        await fs.promises.access(lock.path);
        return lock.manager;
      } catch {
        // continua
      }
    }
    return undefined;
  }
}
