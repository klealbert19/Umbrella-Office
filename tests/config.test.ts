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

  it('should normalize V0.3 config (missing V0.4 sections)', async () => {
    const base = makeTempBase();
    const target = path.join(base, '.umbrella');
    const first = new ConfigManager(makeLogger(target), target);
    await first.init();

    // Simula configuração V0.3 (sem scheduler, webhook, plugins, remote)
    const configPath = path.join(target, 'config.json');
    const v03Config = {
      configVersion: '1',
      office: { name: 'Umbrella Office' },
      orchestrator: { enabled: false, endpoint: null },
    };
    fs.writeFileSync(configPath, JSON.stringify(v03Config, null, 2));

    const second = new ConfigManager(makeLogger(target), target);
    await second.init();

    const config = second.getConfig();
    // Deve ter todas as seções V0.4 com defaults
    expect(config.scheduler).toBeDefined();
    expect(config.scheduler.enabled).toBe(true);
    expect(config.webhook).toBeDefined();
    expect(config.webhook.enabled).toBe(false);
    expect(config.webhook.port).toBe(3456);
    expect(config.plugins).toBeDefined();
    expect(config.plugins.enabled).toEqual([]);
    expect(config.remote).toBeDefined();
    expect(config.remote.defaultProvider).toBe('local');
    // Valor personalizado deve ser preservado
    expect(config.office.name).toBe('Umbrella Office');
  });

  it('should normalize partial V0.4 config (preserve custom values)', async () => {
    const base = makeTempBase();
    const target = path.join(base, '.umbrella');
    const first = new ConfigManager(makeLogger(target), target);
    await first.init();

    // Simula configuração V0.4 parcial (apenas webhook.enabled = true)
    const configPath = path.join(target, 'config.json');
    const partialConfig = {
      configVersion: '1',
      office: { name: 'Custom Office' },
      orchestrator: { enabled: false, endpoint: null },
      webhook: {
        enabled: true,
      },
    };
    fs.writeFileSync(configPath, JSON.stringify(partialConfig, null, 2));

    const second = new ConfigManager(makeLogger(target), target);
    await second.init();

    const config = second.getConfig();
    // webhook.enabled deve ser preservado
    expect(config.webhook.enabled).toBe(true);
    // Demais campos de webhook devem ter defaults
    expect(config.webhook.port).toBe(3456);
    expect(config.webhook.host).toBe('127.0.0.1');
    expect(config.webhook.authToken).toBeNull();
    expect(config.webhook.allowedEvents).toEqual([]);
    expect(config.webhook.maxPayloadSize).toBe(1048576);
    // Outras seções devem ter defaults
    expect(config.scheduler.enabled).toBe(true);
    expect(config.plugins.enabled).toEqual([]);
    expect(config.remote.defaultProvider).toBe('local');
    // Valor personalizado deve ser preservado
    expect(config.office.name).toBe('Custom Office');
  });

  it('should preserve custom values and not overwrite with defaults', async () => {
    const base = makeTempBase();
    const target = path.join(base, '.umbrella');
    const first = new ConfigManager(makeLogger(target), target);
    await first.init();

    // Configuração com valores personalizados
    const configPath = path.join(target, 'config.json');
    const customConfig = {
      configVersion: '1',
      office: { name: 'My Office' },
      orchestrator: { enabled: true, endpoint: 'https://custom.example.com' },
      scheduler: { enabled: false },
      webhook: {
        enabled: true,
        port: 8080,
        host: '0.0.0.0',
        authToken: 'secret-token',
        allowedEvents: ['push', 'pull_request'],
        maxPayloadSize: 2097152,
      },
      plugins: {
        enabled: ['plugin-a', 'plugin-b'],
        directory: 'my-plugins',
      },
      remote: {
        defaultProvider: 'ssh',
      },
    };
    fs.writeFileSync(configPath, JSON.stringify(customConfig, null, 2));

    const second = new ConfigManager(makeLogger(target), target);
    await second.init();

    const config = second.getConfig();
    // Todos os valores personalizados devem ser preservados
    expect(config.office.name).toBe('My Office');
    expect(config.orchestrator.enabled).toBe(true);
    expect(config.orchestrator.endpoint).toBe('https://custom.example.com');
    expect(config.scheduler.enabled).toBe(false);
    expect(config.webhook.enabled).toBe(true);
    expect(config.webhook.port).toBe(8080);
    expect(config.webhook.host).toBe('0.0.0.0');
    expect(config.webhook.authToken).toBe('secret-token');
    expect(config.webhook.allowedEvents).toEqual(['push', 'pull_request']);
    expect(config.webhook.maxPayloadSize).toBe(2097152);
    expect(config.plugins.enabled).toEqual(['plugin-a', 'plugin-b']);
    expect(config.plugins.directory).toBe('my-plugins');
    expect(config.remote.defaultProvider).toBe('ssh');
  });

  it('should persist normalized config and remain valid on reload', async () => {
    const base = makeTempBase();
    const target = path.join(base, '.umbrella');
    const first = new ConfigManager(makeLogger(target), target);
    await first.init();

    // Configuração V0.3
    const configPath = path.join(target, 'config.json');
    const v03Config = {
      configVersion: '1',
      office: { name: 'Test Office' },
      orchestrator: { enabled: false, endpoint: null },
    };
    fs.writeFileSync(configPath, JSON.stringify(v03Config, null, 2));

    // Primeira carga - deve normalizar e persistir
    const second = new ConfigManager(makeLogger(target), target);
    await second.init();
    const config1 = second.getConfig();
    expect(config1.webhook.enabled).toBe(false);
    expect(config1.scheduler.enabled).toBe(true);

    // Segunda carga - deve ler a configuração já normalizada
    const third = new ConfigManager(makeLogger(target), target);
    await third.init();
    const config2 = third.getConfig();
    expect(config2.webhook.enabled).toBe(false);
    expect(config2.scheduler.enabled).toBe(true);
    expect(config2.office.name).toBe('Test Office');
  });

  it('should handle invalid JSON gracefully', async () => {
    const base = makeTempBase();
    const target = path.join(base, '.umbrella');
    const first = new ConfigManager(makeLogger(target), target);
    await first.init();

    // Corrompe o config.json
    const configPath = path.join(target, 'config.json');
    fs.writeFileSync(configPath, '{ invalid json }');

    const second = new ConfigManager(makeLogger(target), target);
    // Deve falhar ao tentar ler JSON inválido
    await expect(second.init()).rejects.toThrow();
  });
});
