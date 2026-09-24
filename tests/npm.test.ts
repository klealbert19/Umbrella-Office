/**
 * Testes para NPM Tool (V0.3).
 */
import { NpmTool } from '../src/tools/npm/npm-tool';
import { ProcessTool } from '../src/tools/process/process-tool';
import { FilesystemSecurity } from '../src/filesystem/filesystem-security';
import { Logger } from '../src/logging/logger';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

function makeLogger(): Logger {
  const logDir = path.join(os.tmpdir(), 'umbrella-test-logs');
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  return new Logger(path.join(logDir, 'npm-test.log'));
}

function makeSecurity(): FilesystemSecurity {
  return new FilesystemSecurity(makeLogger());
}

function makeProcessTool(): ProcessTool {
  return new ProcessTool(makeLogger(), makeSecurity());
}

describe('NpmTool', () => {
  let tool: NpmTool;
  let security: FilesystemSecurity;
  let processTool: ProcessTool;
  let testProjectDir: string;

  beforeEach(() => {
    security = makeSecurity();
    processTool = makeProcessTool();
    tool = new NpmTool(makeLogger(), security, processTool);
    
    // Create a temporary npm project
    testProjectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'umbrella-npm-test-'));
    const packageJson = {
      name: 'test-project',
      version: '1.0.0',
      scripts: {
        test: 'echo "test passed"',
        build: 'echo "build completed"',
        custom: 'echo "custom script"'
      },
      dependencies: {},
      devDependencies: {}
    };
    fs.writeFileSync(path.join(testProjectDir, 'package.json'), JSON.stringify(packageJson, null, 2));
    fs.writeFileSync(path.join(testProjectDir, 'package-lock.json'), '{}');
  });

  afterEach(() => {
    // Cleanup
    try {
      fs.rmSync(testProjectDir, { recursive: true, force: true });
    } catch {}
  });

  it('should detect npm as package manager', async () => {
    const manager = await tool.detectPackageManager(testProjectDir);
    expect(manager).toBe('npm');
  });

  it('should run npm install', async () => {
    const result = await tool.install({ cwd: testProjectDir, timeout: 120000 });
    // npm install should succeed (even if no deps)
    expect(result.exitCode).toBe(0);
  });

  it('should run npm run script', async () => {
    const result = await tool.run({ script: 'test', cwd: testProjectDir, timeout: 60000 });
    expect(result.success).toBe(true);
    expect(result.stdout).toContain('test passed');
  });

  it('should run npm test', async () => {
    const result = await tool.test({ cwd: testProjectDir, timeout: 60000 });
    expect(result.success).toBe(true);
    expect(result.stdout).toContain('test passed');
  });

  it('should run npm build', async () => {
    const result = await tool.build({ cwd: testProjectDir, timeout: 60000 });
    expect(result.success).toBe(true);
    expect(result.stdout).toContain('build completed');
  });

  it('should run npm exec', async () => {
    const result = await tool.exec({ args: ['--version'], cwd: testProjectDir, timeout: 60000 });
    expect(result.success).toBe(true);
    expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
  });

  it('should fail for non-existent script', async () => {
    const result = await tool.run({ script: 'nonexistent', cwd: testProjectDir });
    expect(result.success).toBe(false);
    expect(result.stderr).toContain('não encontrado');
  });

  it('should fail for build when script does not exist', async () => {
    // Create project without build script
    const noBuildDir = fs.mkdtempSync(path.join(os.tmpdir(), 'umbrella-no-build-'));
    fs.writeFileSync(path.join(noBuildDir, 'package.json'), JSON.stringify({
      name: 'no-build',
      version: '1.0.0',
      scripts: { test: 'echo test' }
    }, null, 2));
    fs.writeFileSync(path.join(noBuildDir, 'package-lock.json'), '{}');

    const result = await tool.build({ cwd: noBuildDir });
    expect(result.success).toBe(false);
    expect(result.stderr).toContain('não encontrado');

    fs.rmSync(noBuildDir, { recursive: true, force: true });
  });

  it('should reject unsupported package manager (pnpm)', async () => {
    const pnpmDir = fs.mkdtempSync(path.join(os.tmpdir(), 'umbrella-pnpm-'));
    fs.writeFileSync(path.join(pnpmDir, 'package.json'), JSON.stringify({
      name: 'pnpm-project',
      version: '1.0.0'
    }, null, 2));
    fs.writeFileSync(path.join(pnpmDir, 'pnpm-lock.yaml'), 'lockfile');

    const result = await tool.install({ cwd: pnpmDir });
    expect(result.success).toBe(false);
    expect(result.stderr).toContain('não suportado');

    fs.rmSync(pnpmDir, { recursive: true, force: true });
  });

  it('should reject unsupported package manager (yarn)', async () => {
    const yarnDir = fs.mkdtempSync(path.join(os.tmpdir(), 'umbrella-yarn-'));
    fs.writeFileSync(path.join(yarnDir, 'package.json'), JSON.stringify({
      name: 'yarn-project',
      version: '1.0.0'
    }, null, 2));
    fs.writeFileSync(path.join(yarnDir, 'yarn.lock'), 'lockfile');

    const result = await tool.install({ cwd: yarnDir });
    expect(result.success).toBe(false);
    expect(result.stderr).toContain('não suportado');

    fs.rmSync(yarnDir, { recursive: true, force: true });
  });

  it('should use workspace as default cwd', async () => {
    security.setActiveWorkspace(testProjectDir);
    
    const result = await tool.run({ script: 'test', timeout: 60000 });
    expect(result.success).toBe(true);
    expect(result.stdout).toContain('test passed');
  });
});