/**
 * Testes de versionamento.
 */
import { VERSION, PROTOCOL_VERSION, CONFIG_VERSION, getVersionInfo } from '../src/core/version';

describe('version', () => {
  it('should have correct version', () => {
    expect(VERSION).toBe('0.3.1');
  });

  it('should have correct protocol version', () => {
    expect(PROTOCOL_VERSION).toBe('1');
  });

  it('should have correct config version', () => {
    expect(CONFIG_VERSION).toBe('1');
  });

  it('should return version info', () => {
    const info = getVersionInfo();
    expect(info.version).toBe('0.3.1');
    expect(info.protocolVersion).toBe('1');
    expect(info.configVersion).toBe('1');
    expect(info.name).toBe('Umbrella Office');
  });
});
