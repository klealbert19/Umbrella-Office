/**
 * Testes automatizados de instalação do Umbrella Office (V0.2).
 *
 * Valida pré-requisitos, manifestos, dependências instaladas,
 * configuração de build e artefatos gerados. 100% local, sem rede.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');
const PKG_PATH = path.join(ROOT, 'package.json');
const TSCONFIG_PATH = path.join(ROOT, 'tsconfig.json');
const JEST_CONFIG_PATH = path.join(ROOT, 'jest.config.js');
const README_PATH = path.join(ROOT, 'README.md');
const MAIN_SRC = path.join(ROOT, 'src', 'main.ts');
const MAIN_DIST = path.join(ROOT, 'dist', 'main.js');
const NODE_MODULES = path.join(ROOT, 'node_modules');

function readJson(filePath: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, unknown>;
}

describe('instalação: pré-requisitos', () => {
  it('node >= 18', () => {
    const major = Number(process.versions.node.split('.')[0]);
    expect(major).toBeGreaterThanOrEqual(18);
  });

  it('package.json existe e é válido', () => {
    expect(fs.existsSync(PKG_PATH)).toBe(true);
    const pkg = readJson(PKG_PATH);
    expect(pkg['name']).toBe('umbrella-office');
    expect(typeof pkg['version']).toBe('string');
  });

  it('versão do pacote é 0.3.1', () => {
    const pkg = readJson(PKG_PATH);
    expect(pkg['version']).toBe('0.3.1');
  });

  it('engines exige node >= 18', () => {
    const pkg = readJson(PKG_PATH) as { engines?: { node?: string } };
    expect(pkg.engines?.node).toMatch(/18/);
  });
});

describe('instalação: scripts e bin', () => {
  it('scripts obrigatórios existem', () => {
    const pkg = readJson(PKG_PATH) as { scripts?: Record<string, string> };
    for (const script of ['build', 'start', 'test', 'typecheck']) {
      expect(pkg.scripts?.[script]).toBeTruthy();
    }
  });

  it('bin aponta para dist/main.js', () => {
    const pkg = readJson(PKG_PATH) as { bin?: Record<string, string> };
    expect(pkg.bin?.['umbrella']).toBe('dist/main.js');
  });

  it('main aponta para dist/main.js', () => {
    const pkg = readJson(PKG_PATH);
    expect(pkg['main']).toBe('dist/main.js');
  });
});

describe('instalação: dependências', () => {
  it('node_modules existe (npm install executado)', () => {
    expect(fs.existsSync(NODE_MODULES)).toBe(true);
  });

  it('typescript instalado', () => {
    expect(() => require.resolve('typescript', { paths: [ROOT] })).not.toThrow();
  });

  it('jest + ts-jest instalados', () => {
    expect(() => require.resolve('jest', { paths: [ROOT] })).not.toThrow();
    expect(() => require.resolve('ts-jest', { paths: [ROOT] })).not.toThrow();
  });

  it('@types/node + @types/jest instalados', () => {
    expect(fs.existsSync(path.join(NODE_MODULES, '@types', 'node'))).toBe(true);
    expect(fs.existsSync(path.join(NODE_MODULES, '@types', 'jest'))).toBe(true);
  });
});

describe('instalação: configuração de build', () => {
  it('tsconfig.json existe com strict + outDir dist + rootDir src', () => {
    expect(fs.existsSync(TSCONFIG_PATH)).toBe(true);
    const tsconfig = readJson(TSCONFIG_PATH) as {
      compilerOptions?: Record<string, unknown>;
      include?: unknown;
      exclude?: unknown;
    };
    expect(tsconfig.compilerOptions?.['strict']).toBe(true);
    expect(tsconfig.compilerOptions?.['outDir']).toBe('./dist');
    expect(tsconfig.compilerOptions?.['rootDir']).toBe('./src');
  });

  it('jest.config.js existe', () => {
    expect(fs.existsSync(JEST_CONFIG_PATH)).toBe(true);
  });

  it('src/main.ts existe', () => {
    expect(fs.existsSync(MAIN_SRC)).toBe(true);
  });

  it('README.md existe', () => {
    expect(fs.existsSync(README_PATH)).toBe(true);
  });

  it('migrations/ existe', () => {
    expect(fs.existsSync(path.join(ROOT, 'migrations'))).toBe(true);
  });

  it('.gitignore ignora node_modules', () => {
    const gitignorePath = path.join(ROOT, '.gitignore');
    expect(fs.existsSync(gitignorePath)).toBe(true);
    const content = fs.readFileSync(gitignorePath, 'utf-8');
    expect(content).toMatch(/node_modules/);
    // dist/ não é mais ignorado para permitir instalação via GitHub
  });
});

describe('instalação: artefatos de build', () => {
  it('dist/main.js existe (npm run build executado)', () => {
    expect(fs.existsSync(MAIN_DIST)).toBe(true);
  });

  it('dist/main.js é executável via node (shebang ou js válido)', () => {
    const content = fs.readFileSync(MAIN_DIST, 'utf-8');
    expect(content.length).toBeGreaterThan(0);
    expect(content).toMatch(/OfficeRuntime|main/);
  });

  it('dist contém módulos core (version, task-router, office-runtime)', () => {
    for (const rel of [
      path.join('core', 'version.js'),
      path.join('core', 'task-router.js'),
      path.join('core', 'office-runtime.js'),
      path.join('cli', 'cli-interface.js'),
      path.join('filesystem', 'filesystem-engine.js'),
      path.join('workspace', 'workspace-manager.js'),
      path.join('scanner', 'project-scanner.js'),
    ]) {
      expect(fs.existsSync(path.join(ROOT, 'dist', rel))).toBe(true);
    }
  });
});
