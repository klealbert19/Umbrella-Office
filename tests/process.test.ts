/**
 * Testes para Process Tool (V0.3).
 */
import { ProcessTool } from '../src/tools/process/process-tool';
import { FilesystemSecurity } from '../src/filesystem/filesystem-security';
import { Logger } from '../src/logging/logger';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

function makeLogger(): Logger {
  const logDir = path.join(os.tmpdir(), 'umbrella-test-logs');
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  return new Logger(path.join(logDir, 'process-test.log'));
}

function makeSecurity(): FilesystemSecurity {
  return new FilesystemSecurity(makeLogger());
}

// Helper to get a command that works on both Windows and Unix
function getEchoCommand(): { command: string; args: string[] } {
  if (process.platform === 'win32') {
    return { command: 'cmd', args: ['/c', 'echo', 'hello world'] };
  }
  return { command: 'echo', args: ['hello world'] };
}

describe('ProcessTool', () => {
  let tool: ProcessTool;
  let security: FilesystemSecurity;

  beforeEach(() => {
    security = makeSecurity();
    tool = new ProcessTool(makeLogger(), security);
  });

  it('should execute simple command (echo)', async () => {
    const { command, args } = getEchoCommand();
    const result = await tool.execute({ command, args });
    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('hello world');
    expect(result.stderr).toBe('');
    expect(result.timedOut).toBe(false);
    expect(result.duration).toBeGreaterThan(0);
  });

  it('should capture stdout and stderr separately', async () => {
    const result = await tool.execute({
      command: process.execPath,
      args: ['-e', 'console.log("stdout"); console.error("stderr")'],
    });
    expect(result.success).toBe(true);
    expect(result.stdout).toContain('stdout');
    expect(result.stderr).toContain('stderr');
  });

  it('should return non-zero exit code for failing command', async () => {
    const result = await tool.execute({
      command: process.execPath,
      args: ['-e', 'process.exit(42)'],
    });
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(42);
  });

  it('should respect cwd parameter', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'umbrella-cwd-'));
    const testFile = path.join(tempDir, 'test.txt');
    fs.writeFileSync(testFile, 'content');

    const result = await tool.execute({
      command: process.execPath,
      args: ['-e', `console.log(require('fs').readFileSync('test.txt', 'utf-8'))`],
      cwd: tempDir,
    });
    expect(result.success).toBe(true);
    expect(result.stdout).toContain('content');
  });

  it('should respect timeout and kill process', async () => {
    const result = await tool.execute({
      command: process.execPath,
      args: ['-e', 'setTimeout(() => {}, 10000)'],
      timeout: 100,
    });
    expect(result.success).toBe(false);
    expect(result.timedOut).toBe(true);
    expect(result.exitCode).not.toBe(0);
  });

  it('should merge custom env with process.env', async () => {
    const result = await tool.execute({
      command: process.execPath,
      args: ['-e', 'console.log(process.env.CUSTOM_VAR)'],
      env: { CUSTOM_VAR: 'test-value' },
    });
    expect(result.success).toBe(true);
    expect(result.stdout).toContain('test-value');
  });

  it('should handle non-existent command', async () => {
    const result = await tool.execute({
      command: 'non-existent-command-xyz-123',
      args: [],
    });
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(-1);
  });

  it('should validate cwd within workspace when workspace is set', async () => {
    const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'umbrella-ws-'));
    const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'umbrella-outside-'));
    
    security.setActiveWorkspace(workspaceDir);
    
    const result = await tool.execute({
      command: 'echo',
      args: ['test'],
      cwd: outsideDir,
    });
    
    expect(result.success).toBe(false);
    expect(result.stderr).toContain('fora do workspace ativo');
  });

  it('should allow cwd within workspace', async () => {
    const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'umbrella-ws-'));
    const subDir = path.join(workspaceDir, 'sub');
    fs.mkdirSync(subDir);
    
    security.setActiveWorkspace(workspaceDir);
    
    const { command, args } = getEchoCommand();
    const result = await tool.execute({
      command,
      args,
      cwd: subDir,
    });
    
    expect(result.success).toBe(true);
  });

  it('should use workspace as default cwd when not provided', async () => {
    const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'umbrella-ws-'));
    const testFile = path.join(workspaceDir, 'test.txt');
    fs.writeFileSync(testFile, 'workspace-content');
    
    security.setActiveWorkspace(workspaceDir);
    
    const result = await tool.execute({
      command: process.execPath,
      args: ['-e', `console.log(require('fs').readFileSync('test.txt', 'utf-8'))`],
    });
    
    expect(result.success).toBe(true);
    expect(result.stdout).toContain('workspace-content');
  });
});