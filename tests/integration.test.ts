/**
 * Teste de integração real (V0.3).
 *
 * Fluxo completo:
 * workspace.open → project.scan → npm.install → npm.test → npm.build → git.status → file.edit → npm.test → git.diff → git.add → git.commit → git.log
 */
import { OfficeRuntime } from '../src/core/office-runtime';
import { createWorkspaceTask, createFilesystemTask, createNpmTask, createGitTask } from '../src/core/task-v2';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

function makeTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

describe('Integração real V0.3', () => {
  let runtime: OfficeRuntime;
  let testProjectDir: string;

  beforeAll(async () => {
    runtime = new OfficeRuntime();
    await runtime.start();
  });

  afterAll(async () => {
    await runtime.stop();
  });

  beforeEach(async () => {
    // Create a fresh test project for each test
    testProjectDir = makeTempDir('umbrella-integration-');
    
    // Create package.json with test and build scripts
    const packageJson = {
      name: 'integration-test',
      version: '1.0.0',
      scripts: {
        test: 'node -e "console.log(\\"test passed\\")"',
        build: 'node -e "console.log(\\"build completed\\")"'
      },
      dependencies: {},
      devDependencies: {}
    };
    fs.writeFileSync(path.join(testProjectDir, 'package.json'), JSON.stringify(packageJson, null, 2));
    fs.writeFileSync(path.join(testProjectDir, 'package-lock.json'), '{}');
    
    // Create a source file
    const srcDir = path.join(testProjectDir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(path.join(srcDir, 'index.ts'), 'export const hello = () => "world";');
    
    // Initialize git repo
    const { spawn } = require('child_process');
    const runGit = (args: string[]) => new Promise<void>((resolve, reject) => {
      const child = spawn('git', args, { cwd: testProjectDir, shell: false, windowsHide: true });
      child.on('close', (code: number) => code === 0 ? resolve() : reject(new Error(`git ${args.join(' ')} failed with code ${code}`)));
      child.on('error', reject);
    });
    
    // Run git init and config synchronously
    await runGit(['init']);
    await runGit(['config', 'user.email', 'test@test.com']);
    await runGit(['config', 'user.name', 'Test User']);
    await runGit(['add', '.']);
    await runGit(['commit', '-m', 'Initial commit']);
  });

  afterEach(() => {
    try {
      fs.rmSync(testProjectDir, { recursive: true, force: true });
    } catch {}
  });

  it('should execute full integration flow', async () => {
    const router = runtime.getTaskRouter();
    
    // 1. workspace.open
    console.log('1. Opening workspace...');
    let result = await router.route(createWorkspaceTask('workspace.open', { path: testProjectDir }));
    expect(result.success).toBe(true);
    console.log('   ✓ Workspace opened');

    // 2. project.scan (via workspace.scan)
    console.log('2. Scanning workspace...');
    result = await router.route(createWorkspaceTask('workspace.scan', { path: testProjectDir }));
    expect(result.success).toBe(true);
    const scanOutput = JSON.parse(result.output!);
    expect(scanOutput.projectTypes).toContain('nodejs');
    expect(scanOutput.packageManager).toBe('npm');
    expect(scanOutput.hasGit).toBe(true);
    console.log('   ✓ Workspace scanned:', scanOutput.projectTypes, scanOutput.packageManager);

    // 3. npm.install
    console.log('3. Running npm install...');
    result = await router.route(createNpmTask('npm.install', { cwd: testProjectDir, timeout: 120000 }));
    expect(result.success).toBe(true);
    console.log('   ✓ npm install completed');

    // 4. npm.test
    console.log('4. Running npm test...');
    result = await router.route(createNpmTask('npm.test', { cwd: testProjectDir, timeout: 60000 }));
    expect(result.success).toBe(true);
    const testOutput = JSON.parse(result.output!);
    expect(testOutput.stdout).toContain('test passed');
    console.log('   ✓ npm test passed');

    // 5. npm.build
    console.log('5. Running npm build...');
    result = await router.route(createNpmTask('npm.build', { cwd: testProjectDir, timeout: 60000 }));
    expect(result.success).toBe(true);
    const buildOutput = JSON.parse(result.output!);
    expect(buildOutput.stdout).toContain('build completed');
    console.log('   ✓ npm build completed');

    // 6. git.status
    console.log('6. Running git status...');
    result = await router.route(createGitTask('git.status', { cwd: testProjectDir }));
    expect(result.success).toBe(true);
    console.log('   ✓ git status completed');

    // 7. file.edit (modify a file)
    console.log('7. Editing file...');
    const indexFile = path.join(testProjectDir, 'src', 'index.ts');
    result = await router.route(createFilesystemTask('filesystem.edit', {
      path: indexFile,
      oldText: 'export const hello = () => "world";',
      newText: 'export const hello = () => "world modified";',
    }));
    expect(result.success).toBe(true);
    console.log('   ✓ File edited');

    // 8. npm.test again (should still pass)
    console.log('8. Running npm test again...');
    result = await router.route(createNpmTask('npm.test', { cwd: testProjectDir, timeout: 60000 }));
    expect(result.success).toBe(true);
    console.log('   ✓ npm test passed again');

    // 9. git.diff
    console.log('9. Running git diff...');
    result = await router.route(createGitTask('git.diff', { cwd: testProjectDir }));
    expect(result.success).toBe(true);
    const diffOutput = JSON.parse(result.output!);
    expect(diffOutput.stdout).toContain('world modified');
    console.log('   ✓ git diff shows changes');

    // 10. git.add
    console.log('10. Running git add...');
    result = await router.route(createGitTask('git.add', { paths: ['src/index.ts'], cwd: testProjectDir }));
    expect(result.success).toBe(true);
    console.log('   ✓ git add completed');

    // 11. git.commit
    console.log('11. Running git commit...');
    result = await router.route(createGitTask('git.commit', { message: 'Modified hello function', cwd: testProjectDir }));
    expect(result.success).toBe(true);
    console.log('   ✓ git commit completed');

    // 12. git.log
    console.log('12. Running git log...');
    result = await router.route(createGitTask('git.log', { cwd: testProjectDir }));
    expect(result.success).toBe(true);
    const logOutput = JSON.parse(result.output!);
    expect(logOutput.stdout).toContain('Modified hello function');
    expect(logOutput.stdout).toContain('Initial commit');
    console.log('   ✓ git log shows both commits');

    console.log('\n✅ Full integration flow completed successfully!');
  }, 180000); // 3 minutes timeout for full integration test
});