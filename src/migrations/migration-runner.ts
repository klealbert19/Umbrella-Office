/**
 * Runner de migrações de configuração.
 *
 * Na V0.1 apenas a infraestrutura existe. Futuras versões adicionarão
 * migrações reais aqui.
 */
import { UmbrellaConfig } from '../config/config-schema';
import { Logger } from '../logging/logger';

export type { UmbrellaConfig };

export async function runMigrations(
  config: UmbrellaConfig,
  logger: Logger
): Promise<UmbrellaConfig> {
  // Na V0.1 não há migrações reais.
  // Apenas retorna a configuração como está.
  // Futuras versões implementarão:
  // if (config.configVersion === '1') { return migrateV1toV2(config); }
  logger.debug('No migrations needed for current config version', {
    version: config.configVersion,
  });
  return config;
}