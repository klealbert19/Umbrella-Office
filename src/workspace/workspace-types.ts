/**
 * Tipos para o Workspace Manager do Umbrella Office V0.2.
 */
export interface WorkspaceInfo {
  id: string;
  name: string;
  path: string;
  openedAt: string;
}

export interface WorkspaceResult {
  success: boolean;
  error?: string;
  code?: string;
  workspace?: WorkspaceInfo;
}

export interface WorkspaceListResult {
  success: boolean;
  error?: string;
  code?: string;
  workspaces?: WorkspaceInfo[];
}

export interface WorkspaceOpenResult extends WorkspaceResult {}

export interface WorkspaceCloseResult extends WorkspaceResult {}

export interface WorkspaceScanResult {
  success: boolean;
  error?: string;
  code?: string;
  scan?: {
    path: string;
    scannedAt: string;
    projectTypes: string[];
    packageManager?: string;
    hasGit: boolean;
    filesCount: number;
    directoriesCount: number;
  };
}
