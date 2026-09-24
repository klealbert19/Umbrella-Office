/**
 * Engine de filesystem do Umbrella Office V0.2.
 *
 * Fornece operações de leitura, escrita, edição, exclusão e listagem de diretórios
 * utilizando as APIs nativas do Node.js (fs/promises, path, os).
 *
 * Todas as operações são protegidas pelo FilesystemSecurity para garantir que
 * permaneçam dentro do workspace ativo.
 */
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path';
import { Logger } from '../logging/logger';
import { FilesystemSecurity } from './filesystem-security';
import {
  FileReadResult,
  FileWriteResult,
  FileEditResult,
  FileDeleteResult,
  DirectoryEntry,
  DirectoryListResult,
  DirectoryCreateResult,
} from './filesystem-types';

export class FilesystemEngine {
  private readonly logger: Logger;
  private readonly security: FilesystemSecurity;

  constructor(logger: Logger, security: FilesystemSecurity) {
    this.logger = logger;
    this.security = security;
  }

  /**
   * Lê o conteúdo de um arquivo.
   */
  async readFile(filePath: string): Promise<FileReadResult> {
    try {
      const safePath = this.security.checkRead(filePath);
      const stats = await fsPromises.stat(safePath);
      const content = await fsPromises.readFile(safePath, 'utf-8');
      this.logger.info('Arquivo lido', { path: safePath, size: content.length });
      return {
        success: true,
        file: {
          path: safePath,
          content,
          size: content.length,
          encoding: 'utf-8',
          modifiedAt: stats.mtime.toISOString(),
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error('Falha ao ler arquivo', { path: filePath, error: message });
      return { success: false, error: message, code: 'READ_ERROR' };
    }
  }

  /**
   * Escreve conteúdo em um arquivo.
   */
  async writeFile(filePath: string, content: string): Promise<FileWriteResult> {
    try {
      const safePath = this.security.checkWrite(filePath);
      const dir = path.dirname(safePath);
      await fsPromises.mkdir(dir, { recursive: true });
      await fsPromises.writeFile(safePath, content, 'utf-8');
      const bytes = Buffer.byteLength(content, 'utf-8');
      this.logger.info('Arquivo escrito', { path: safePath, bytesWritten: bytes });
      return { success: true, bytesWritten: bytes };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error('Falha ao escrever arquivo', { path: filePath, error: message });
      return { success: false, error: message, code: 'WRITE_ERROR' };
    }
  }

  /**
   * Edita um arquivo substituindo oldText por newText.
   */
  async editFile(
    filePath: string,
    oldText: string,
    newText: string,
    replaceAll: boolean = false
  ): Promise<FileEditResult> {
    try {
      const safePath = this.security.checkEdit(filePath);
      const content = await fsPromises.readFile(safePath, 'utf-8');
      let replacements = 0;
      let newContent: string;
      if (replaceAll) {
        replacements = (content.match(new RegExp(oldText, 'g')) || []).length;
        newContent = content.split(oldText).join(newText);
      } else {
        if (!content.includes(oldText)) {
          return { success: false, error: 'oldText não encontrado', code: 'EDIT_NOT_FOUND' };
        }
        replacements = 1;
        newContent = content.replace(oldText, newText);
      }
      await fsPromises.writeFile(safePath, newContent, 'utf-8');
      this.logger.info('Arquivo editado', {
        path: safePath,
        replacements,
        oldTextLength: oldText.length,
        newTextLength: newText.length,
      });
      return { success: true, replacements };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error('Falha ao editar arquivo', { path: filePath, error: message });
      return { success: false, error: message, code: 'EDIT_ERROR' };
    }
  }

  /**
   * Exclui um arquivo (não diretórios).
   */
  async deleteFile(filePath: string): Promise<FileDeleteResult> {
    try {
      const safePath = this.security.checkDelete(filePath);
      const stats = await fsPromises.stat(safePath);
      if (!stats.isFile()) {
        return { success: false, error: 'Não é um arquivo', code: 'DELETE_NOT_FILE' };
      }
      await fsPromises.unlink(safePath);
      this.logger.info('Arquivo excluído', { path: safePath });
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error('Falha ao excluir arquivo', { path: filePath, error: message });
      return { success: false, error: message, code: 'DELETE_ERROR' };
    }
  }

  /**
   * Lista entradas em um diretório.
   */
  async listDirectory(dirPath: string): Promise<DirectoryListResult> {
    try {
      const safePath = this.security.checkList(dirPath);
      const entries = await fsPromises.readdir(safePath, { withFileTypes: true });
      const results: DirectoryEntry[] = [];
      for (const entry of entries) {
        const fullPath = path.join(safePath, entry.name);
        let stats: fs.Stats;
        try {
          stats = await fsPromises.stat(fullPath);
        } catch {
          continue;
        }
        results.push({
          name: entry.name,
          relativePath: path.relative(safePath, fullPath),
          type: entry.isDirectory() ? 'directory' : 'file',
          size: stats.size,
          modifiedAt: stats.mtime.toISOString(),
        });
      }
      this.logger.info('Diretório listado', { path: safePath, count: results.length });
      return { success: true, entries: results };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error('Falha ao listar diretório', { path: dirPath, error: message });
      return { success: false, error: message, code: 'LIST_ERROR' };
    }
  }

  /**
   * Cria um diretório (não recursivo, já que mkdir com recursive=true é usado internamente).
   */
  async createDirectory(dirPath: string): Promise<DirectoryCreateResult> {
    try {
      const safePath = this.security.ensureDirectoryWithinWorkspace(dirPath);
      await fsPromises.mkdir(safePath, { recursive: true });
      this.logger.info('Diretório criado', { path: safePath });
      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error('Falha ao criar diretório', { path: dirPath, error: message });
      return { success: false, error: message, code: 'CREATE_ERROR' };
    }
  }
}
