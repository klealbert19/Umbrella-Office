import { Logger } from '../logging/logger';
import { FilesystemSecurity } from './filesystem-security';
import { FileReadResult, FileWriteResult, FileEditResult, FileDeleteResult, DirectoryListResult, DirectoryCreateResult } from './filesystem-types';
export declare class FilesystemEngine {
    private readonly logger;
    private readonly security;
    constructor(logger: Logger, security: FilesystemSecurity);
    /**
     * Lê o conteúdo de um arquivo.
     */
    readFile(filePath: string): Promise<FileReadResult>;
    /**
     * Escreve conteúdo em um arquivo.
     */
    writeFile(filePath: string, content: string): Promise<FileWriteResult>;
    /**
     * Edita um arquivo substituindo oldText por newText.
     */
    editFile(filePath: string, oldText: string, newText: string, replaceAll?: boolean): Promise<FileEditResult>;
    /**
     * Exclui um arquivo (não diretórios).
     */
    deleteFile(filePath: string): Promise<FileDeleteResult>;
    /**
     * Lista entradas em um diretório.
     */
    listDirectory(dirPath: string): Promise<DirectoryListResult>;
    /**
     * Cria um diretório (não recursivo, já que mkdir com recursive=true é usado internamente).
     */
    createDirectory(dirPath: string): Promise<DirectoryCreateResult>;
}
//# sourceMappingURL=filesystem-engine.d.ts.map