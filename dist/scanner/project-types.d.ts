/**
 * Tipos para o Project Scanner do Umbrella Office V0.2.
 */
export interface ProjectInfo {
    root: string;
    projectTypes: string[];
    packageManager?: string;
    git: boolean;
    filesCount: number;
    directoriesCount: number;
    excludedDirectories: string[];
    files: string[];
}
export interface ProjectScanResult {
    success: boolean;
    error?: string;
    project?: ProjectInfo;
}
//# sourceMappingURL=project-types.d.ts.map