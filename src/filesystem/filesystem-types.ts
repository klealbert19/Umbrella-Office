/**
 * Tipos para operações de filesystem do Umbrella Office V0.2.
 */
export interface FileInfo {
  path: string;
  content: string;
  size: number;
  encoding?: string;
  modifiedAt?: string;
}

export interface FileResult {
  success: boolean;
  error?: string;
  code?: string;
}

export interface FileReadResult extends FileResult {
  file?: FileInfo;
}

export interface FileWriteResult extends FileResult {
  bytesWritten?: number;
}

export interface FileEditResult extends FileResult {
  replacements?: number;
}

export interface FileDeleteResult extends FileResult {}

export interface DirectoryEntry {
  name: string;
  relativePath: string;
  type: 'file' | 'directory';
  size: number;
  modifiedAt: string;
}

export interface DirectoryListResult extends FileResult {
  entries?: DirectoryEntry[];
}

export interface DirectoryCreateResult extends FileResult {}

export interface WorkspaceInfo {
  id: string;
  name: string;
  path: string;
  openedAt: string;
}

export interface WorkspaceResult extends FileResult {
  workspace?: WorkspaceInfo;
}

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

export interface ProjectScanResult extends FileResult {
  project?: ProjectInfo;
}

export interface SecurityCheckResult extends FileResult {
  allowed: boolean;
  reason?: string;
}
