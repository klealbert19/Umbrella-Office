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
exports.WorkspaceManager = void 0;
/**
 * Workspace Manager do Umbrella Office V0.2.
 *
 * Gerencia o workspace ativo, persistência e operações de segurança.
 * Fornece operações para abrir, fechar, ler informações e escanear projetos.
 */
const path = __importStar(require("path"));
const fsPromises = __importStar(require("fs/promises"));
const crypto_1 = require("crypto");
class WorkspaceManager {
    logger;
    security;
    scanner;
    configManager;
    activeWorkspacePath = null;
    constructor(logger, security, scanner, configManager) {
        this.logger = logger;
        this.security = security;
        this.scanner = scanner;
        this.configManager = configManager;
    }
    /**
     * Abre um workspace no caminho especificado.
     */
    async openWorkspace(workspacePath) {
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
                    id: (0, crypto_1.randomUUID)(),
                    name: path.basename(normalizedPath),
                    path: normalizedPath,
                    openedAt: new Date().toISOString(),
                },
            };
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error('Falha ao abrir workspace', { path: workspacePath, error: message });
            return { success: false, error: message, code: 'OPEN_ERROR' };
        }
    }
    /**
     * Fecha o workspace ativo.
     */
    async closeWorkspace() {
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
                    id: (0, crypto_1.randomUUID)(),
                    name: path.basename(workspacePath),
                    path: workspacePath,
                    openedAt: new Date().toISOString(),
                },
            };
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error('Falha ao fechar workspace', { error: message });
            return { success: false, error: message, code: 'CLOSE_ERROR' };
        }
    }
    /**
     * Retorna informações sobre o workspace ativo.
     */
    async getWorkspaceInfo() {
        try {
            if (!this.activeWorkspacePath) {
                return { success: false, error: 'Nenhum workspace ativo', code: 'NO_ACTIVE_WORKSPACE' };
            }
            const workspacePath = this.activeWorkspacePath;
            this.logger.info('Informações do workspace solicitadas', { path: workspacePath });
            return {
                success: true,
                workspace: {
                    id: (0, crypto_1.randomUUID)(),
                    name: path.basename(workspacePath),
                    path: workspacePath,
                    openedAt: new Date().toISOString(),
                },
            };
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error('Falha ao obter informações do workspace', { error: message });
            return { success: false, error: message, code: 'INFO_ERROR' };
        }
    }
    /**
     * Escaneia o workspace atual ou um caminho especificado para tipo de projeto.
     */
    async scanWorkspace(scanPath) {
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
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error('Falha ao escanear workspace', { error: message });
            return { success: false, error: message, code: 'SCAN_ERROR' };
        }
    }
    /**
     * Retorna o caminho do workspace ativo.
     */
    getActiveWorkspacePath() {
        return this.activeWorkspacePath;
    }
}
exports.WorkspaceManager = WorkspaceManager;
//# sourceMappingURL=workspace-manager.js.map