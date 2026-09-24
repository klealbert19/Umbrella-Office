/**
 * Testes de configuração: criação de ~/.umbrella, config padrão,
 * leitura e preservação de configuração existente.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ConfigManager } from '../src/config/config-manager';
import { Logger } from '../src/logging/logger';

function makeTempBase(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'umbrella-test-'));
}

function makeLogger(base: string): Logger {
  return new Logger(path.join(base, 'logs', 'office.log'));
}

describe('config', () => {
  it('should create base dir, default config, state and logs', async () => {
    const base = makeTempBase();
    const target = path.join(base, '.umbrella');
    const manager = new ConfigManager(makeLogger(target), target);
    await manager.init();

    expect(fs.existsSync(target)).toBe(true);
    expect(fs.existsSync(path.join(target, 'config.json'))).toBe(true);
    expect(fs.existsSync(path.join(target, 'logs', 'office.log'))).toBe(true);

    const config = manager.getConfig();
    expect(config.office.name).toBe('Umbrella Office');
    expect(config.orchestrator.enabled).toBe(false);
    expect(config.orchestrator.endpoint).toBeNull();
  });

  it('should read existing config', async () => {
    const base = makeTempBase();
    const target = path.join(base, '.umbrella');
    const first = new ConfigManager(makeLogger(target), target);
    await first.init();

    const second = new ConfigManager(makeLogger(target), target);
    await second.init();
    expect(second.getConfig().office.name).toBe('Umbrella Office');
  });

  it('should preserve existing config (not overwrite)', async () => {
    const base = makeTempBase();
    const target = path.join(base, '.umbrella');
    const first = new ConfigManager(makeLogger(target), target);
    await first.init();

    // Modifica o config.json manualmente
    const configPath = path.join(target, 'config.json');
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as Record<string, unknown>;
    (raw['office'] as Record<string, unknown>)['name'] = 'Custom Office';
    fs.writeFileSync(configPath, JSON.stringify(raw, null, 2));

    const second = new ConfigManager(makeLogger(target), target);
    await second.init();
    expect(second.getConfig().office.name).toBe('Custom Office');
  });

  it('should track state timestamps', async () => {
    const base = makeTempBase();
    const target = path.join(base, '.umbrella');
    const manager = new ConfigManager(makeLogger(target), target);
    await manager.init();
    await manager.markStarted();
    await manager.markShutdown('0.1.0');

    const state = manager.getState();
    expect(state.lastStartedAt).toBeTruthy();
    expect(state.lastShutdownAt).toBeTruthy();
    expect(state.lastVersion).toBe('0.1.0');
    expect(fs.existsSync(path.join(target, 'state.json'))).toBe(true);
  });
});
