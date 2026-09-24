import { Logger } from '../logging/logger';
export declare class FilesystemSecurity {
    private readonly logger;
    private activeWorkspace;
    constructor(logger: Logger);
    setActiveWorkspace(workspacePath: string): void;
    clearActiveWorkspace(): void;
    /**
     * Retorna o workspace ativo.
     */
    getActiveWorkspace(): string | null;
    /**
     * Verifica se um caminho está dentro do workspace ativo.
     */
    isWithinWorkspace(targetPath: string): boolean;
    /**
     * Normaliza um caminho e verifica se ele está dentro do workspace ativo.
     * Lança erro se o caminho tentar escapar.
     */
    private ensureWithinWorkspace;
    /**
     * Verifica se um diretório é seguro para ser criado dentro do workspace ativo.
     */
    ensureDirectoryWithinWorkspace(dirPath: string): string;
    /**
     * Verifica se um caminho é seguro para ser lido.
     */
    checkRead(path: string): string;
    /**
     * Verifica se um caminho é seguro para ser escrito.
     */
    checkWrite(path: string): string;
    /**
     * Verifica se um caminho é seguro para ser editado.
     */
    checkEdit(path: string): string;
    /**
     * Verifica se um caminho é seguro para ser excluído.
     */
    checkDelete(path: string): string;
    /**
     * Verifica se um caminho é seguro para listagem.
     */
    checkList(path: string): string;
}
//# sourceMappingURL=filesystem-security.d.ts.map