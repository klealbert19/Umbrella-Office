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
exports.FilesystemSecurity = void 0;
/**
 * Segurança do filesystem do Umbrella Office V0.2.
 *
 * Garante que todas as operações permaneçam dentro do workspace ativo.
 * Normaliza caminhos, resolve symlinks e previne path traversal.
 */
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class FilesystemSecurity {
    logger;
    activeWorkspace = null;
    constructor(logger) {
        this.logger = logger;
    }
    setActiveWorkspace(workspacePath) {
        this.activeWorkspace = path.resolve(workspacePath);
        this.logger.info('Workspace de filesystem definido', { workspace: this.activeWorkspace });
    }
    clearActiveWorkspace() {
        this.logger.info('Workspace de filesystem limpo');
        this.activeWorkspace = null;
    }
    /**
     * Retorna o workspace ativo.
     */
    getActiveWorkspace() {
        return this.activeWorkspace;
    }
    /**
     * Verifica se um caminho está dentro do workspace ativo.
     */
    isWithinWorkspace(targetPath) {
        if (!this.activeWorkspace) {
            return true; // Sem workspace ativo, permite tudo
        }
        try {
            const resolved = path.resolve(targetPath);
            const normalized = path.normalize(resolved);
            let realActive;
            try {
                realActive = fs.realpathSync(this.activeWorkspace);
            }
            catch {
                realActive = this.activeWorkspace;
            }
            let realTarget;
            try {
                realTarget = fs.realpathSync(normalized);
            }
            catch {
                realTarget = normalized;
            }
            return realTarget.startsWith(realActive + path.sep) || realTarget === realActive;
        }
        catch {
            return false;
        }
    }
    /**
     * Normaliza um caminho e verifica se ele está dentro do workspace ativo.
     * Lança erro se o caminho tentar escapar.
     */
    ensureWithinWorkspace(filePath) {
        if (!this.activeWorkspace) {
            throw new Error('Nenhum workspace ativo definido');
        }
        const resolved = path.resolve(filePath);
        const normalized = path.normalize(resolved);
        // Resolver symlinks para o diretório ativo
        let realActive;
        try {
            realActive = fs.realpathSync(this.activeWorkspace);
        }
        catch {
            realActive = this.activeWorkspace;
        }
        // Resolver symlinks para o caminho de destino (se ele existir)
        let realTarget;
        try {
            realTarget = fs.realpathSync(normalized);
        }
        catch {
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
    ensureDirectoryWithinWorkspace(dirPath) {
        if (!this.activeWorkspace) {
            throw new Error('Nenhum workspace ativo definido');
        }
        const resolved = path.resolve(dirPath);
        const normalized = path.normalize(resolved);
        let realActive;
        try {
            realActive = fs.realpathSync(this.activeWorkspace);
        }
        catch {
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
    checkRead(path) {
        return this.ensureWithinWorkspace(path);
    }
    /**
     * Verifica se um caminho é seguro para ser escrito.
     */
    checkWrite(path) {
        return this.ensureWithinWorkspace(path);
    }
    /**
     * Verifica se um caminho é seguro para ser editado.
     */
    checkEdit(path) {
        return this.ensureWithinWorkspace(path);
    }
    /**
     * Verifica se um caminho é seguro para ser excluído.
     */
    checkDelete(path) {
        return this.ensureWithinWorkspace(path);
    }
    /**
     * Verifica se um caminho é seguro para listagem.
     */
    checkList(path) {
        return this.ensureWithinWorkspace(path);
    }
}
exports.FilesystemSecurity = FilesystemSecurity;
//# sourceMappingURL=filesystem-security.js.map