/**
 * Testes para Git Tool (V0.3).
 */
import { GitTool } from '../src/tools/git/git-tool';
import { ProcessTool } from '../src/tools/process/process-tool';
import { FilesystemSecurity } from '../src/filesystem/filesystem-security';
import { Logger } from '../src/logging/logger';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

function makeLogger(): Logger {
  const logDir = path.join(os.tmpdir(), 'umbrella-test-logs');
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  return new Logger(path.join(logDir, 'git-test.log'));
}

function makeSecurity(): FilesystemSecurity {
  return new FilesystemSecurity(makeLogger());
}

function makeProcessTool(): ProcessTool {
  return new ProcessTool(makeLogger(), makeSecurity());
}

async function initGitRepo(dir: string): Promise<void> {
  const { spawn } = await import('child_process');
  return new Promise((resolve, reject) => {
    const child = spawn('git', ['init'], { cwd: dir, shell: false });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`git init failed with code ${code}`));
    });
    child.on('error', reject);
  });
}

async function gitConfig(dir: string): Promise<void> {
  const { spawn } = await import('child_process');
  return new Promise((resolve, reject) => {
    const child = spawn('git', ['config', 'user.email', 'test@test.com'], { cwd: dir, shell: false });
    child.on('close', () => {
      const child2 = spawn('git', ['config', 'user.name', 'Test User'], { cwd: dir, shell: false });
      child2.on('close', () => resolve());
      child2.on('error', reject);
    });
    child.on('error', reject);
  });
}

describe('GitTool', () => {
  let tool: GitTool;
  let security: FilesystemSecurity;
  let processTool: ProcessTool;
  let testRepoDir: string;

  beforeEach(async () => {
    security = makeSecurity();
    processTool = makeProcessTool();
    tool = new GitTool(makeLogger(), security, processTool);
    
    // Create a temporary git repo
    testRepoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'umbrella-git-test-'));
    await initGitRepo(testRepoDir);
    await gitConfig(testRepoDir);
    
    // Create initial commit
    fs.writeFileSync(path.join(testRepoDir, 'README.md'), '# Test Repo');
    const { spawn } = await import('child_process');
    await new Promise<void>((resolve, reject) => {
      const child = spawn('git', ['add', 'README.md'], { cwd: testRepoDir, shell: false });
      child.on('close', () => {
        const child2 = spawn('git', ['commit', '-m', 'Initial commit'], { cwd: testRepoDir, shell: false });
        child2.on('close', () => resolve());
        child2.on('error', reject);
      });
      child.on('error', reject);
    });
  });

  afterEach(() => {
    try {
      fs.rmSync(testRepoDir, { recursive: true, force: true });
    } catch {}
  });

  it('should get git status', async () => {
    const result = await tool.status({ cwd: testRepoDir });
    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
  });

  it('should get git diff', async () => {
    fs.writeFileSync(path.join(testRepoDir, 'README.md'), '# Test Repo\n\nModified');
    const result = await tool.diff({ cwd: testRepoDir });
    expect(result.success).toBe(true);
    expect(result.stdout).toContain('Modified');
  });

  it('should get git log', async () => {
    const result = await tool.log({ cwd: testRepoDir });
    expect(result.success).toBe(true);
    expect(result.stdout).toContain('Initial commit');
  });

  it('should get git branch', async () => {
    const result = await tool.branch({ cwd: testRepoDir });
    expect(result.success).toBe(true);
    expect(result.stdout).toContain('*');
  });

  it('should get git remote', async () => {
    const result = await tool.remote({ cwd: testRepoDir });
    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
  });

  it('should add files', async () => {
    fs.writeFileSync(path.join(testRepoDir, 'new-file.txt'), 'new content');
    const result = await tool.add({ paths: ['new-file.txt'], cwd: testRepoDir });
    expect(result.success).toBe(true);
  });

  it('should commit changes', async () => {
    fs.writeFileSync(path.join(testRepoDir, 'commit-test.txt'), 'commit content');
    await tool.add({ paths: ['commit-test.txt'], cwd: testRepoDir });
    const result = await tool.commit({ message: 'Test commit', cwd: testRepoDir });
    expect(result.success).toBe(true);
  });

  it('should reject empty commit message', async () => {
    const result = await tool.commit({ message: '', cwd: testRepoDir });
    expect(result.success).toBe(false);
    expect(result.stderr).toContain('não pode ser vazia');
  });

  it('should checkout branch', async () => {
    // Create a new branch
    const { spawn } = await import('child_process');
    await new Promise<void>((resolve, reject) => {
      const child = spawn('git', ['checkout', '-b', 'feature-branch'], { cwd: testRepoDir, shell: false });
      child.on('close', () => resolve());
      child.on('error', reject);
    });
    
    // Switch back to main
    const result = await tool.checkout({ branch: 'master', cwd: testRepoDir });
    expect(result.success).toBe(true);
  });

  it('should reject empty branch name for checkout', async () => {
    const result = await tool.checkout({ branch: '', cwd: testRepoDir });
    expect(result.success).toBe(false);
    expect(result.stderr).toContain('não pode ser vazio');
  });

  it('should validate paths within workspace', async () => {
    const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'umbrella-ws-'));
    const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'umbrella-outside-'));
    await initGitRepo(outsideDir);
    await gitConfig(outsideDir);
    fs.writeFileSync(path.join(outsideDir, 'outside.txt'), 'outside');
    
    security.setActiveWorkspace(workspaceDir);
    
    const result = await tool.add({ paths: [path.join(outsideDir, 'outside.txt')], cwd: outsideDir });
    expect(result.success).toBe(false);
    expect(result.stderr).toContain('fora do workspace ativo');
    
    fs.rmSync(outsideDir, { recursive: true, force: true });
    fs.rmSync(workspaceDir, { recursive: true, force: true });
  });

  it('should use workspace as default cwd', async () => {
    security.setActiveWorkspace(testRepoDir);
    
    const result = await tool.status({});
    expect(result.success).toBe(true);
  });
});