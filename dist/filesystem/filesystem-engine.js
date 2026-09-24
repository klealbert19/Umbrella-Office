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
exports.FilesystemEngine = void 0;
const fsPromises = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
class FilesystemEngine {
    logger;
    security;
    constructor(logger, security) {
        this.logger = logger;
        this.security = security;
    }
    /**
     * Lê o conteúdo de um arquivo.
     */
    async readFile(filePath) {
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
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error('Falha ao ler arquivo', { path: filePath, error: message });
            return { success: false, error: message, code: 'READ_ERROR' };
        }
    }
    /**
     * Escreve conteúdo em um arquivo.
     */
    async writeFile(filePath, content) {
        try {
            const safePath = this.security.checkWrite(filePath);
            const dir = path.dirname(safePath);
            await fsPromises.mkdir(dir, { recursive: true });
            await fsPromises.writeFile(safePath, content, 'utf-8');
            const bytes = Buffer.byteLength(content, 'utf-8');
            this.logger.info('Arquivo escrito', { path: safePath, bytesWritten: bytes });
            return { success: true, bytesWritten: bytes };
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error('Falha ao escrever arquivo', { path: filePath, error: message });
            return { success: false, error: message, code: 'WRITE_ERROR' };
        }
    }
    /**
     * Edita um arquivo substituindo oldText por newText.
     */
    async editFile(filePath, oldText, newText, replaceAll = false) {
        try {
            const safePath = this.security.checkEdit(filePath);
            const content = await fsPromises.readFile(safePath, 'utf-8');
            let replacements = 0;
            let newContent;
            if (replaceAll) {
                replacements = (content.match(new RegExp(oldText, 'g')) || []).length;
                newContent = content.split(oldText).join(newText);
            }
            else {
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
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error('Falha ao editar arquivo', { path: filePath, error: message });
            return { success: false, error: message, code: 'EDIT_ERROR' };
        }
    }
    /**
     * Exclui um arquivo (não diretórios).
     */
    async deleteFile(filePath) {
        try {
            const safePath = this.security.checkDelete(filePath);
            const stats = await fsPromises.stat(safePath);
            if (!stats.isFile()) {
                return { success: false, error: 'Não é um arquivo', code: 'DELETE_NOT_FILE' };
            }
            await fsPromises.unlink(safePath);
            this.logger.info('Arquivo excluído', { path: safePath });
            return { success: true };
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error('Falha ao excluir arquivo', { path: filePath, error: message });
            return { success: false, error: message, code: 'DELETE_ERROR' };
        }
    }
    /**
     * Lista entradas em um diretório.
     */
    async listDirectory(dirPath) {
        try {
            const safePath = this.security.checkList(dirPath);
            const entries = await fsPromises.readdir(safePath, { withFileTypes: true });
            const results = [];
            for (const entry of entries) {
                const fullPath = path.join(safePath, entry.name);
                let stats;
                try {
                    stats = await fsPromises.stat(fullPath);
                }
                catch {
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
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error('Falha ao listar diretório', { path: dirPath, error: message });
            return { success: false, error: message, code: 'LIST_ERROR' };
        }
    }
    /**
     * Cria um diretório (não recursivo, já que mkdir com recursive=true é usado internamente).
     */
    async createDirectory(dirPath) {
        try {
            const safePath = this.security.ensureDirectoryWithinWorkspace(dirPath);
            await fsPromises.mkdir(safePath, { recursive: true });
            this.logger.info('Diretório criado', { path: safePath });
            return { success: true };
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error('Falha ao criar diretório', { path: dirPath, error: message });
            return { success: false, error: message, code: 'CREATE_ERROR' };
        }
    }
}
exports.FilesystemEngine = FilesystemEngine;
//# sourceMappingURL=filesystem-engine.js.map