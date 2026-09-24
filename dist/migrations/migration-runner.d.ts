/**
 * Runner de migrações de configuração.
 *
 * Na V0.1 apenas a infraestrutura existe. Futuras versões adicionarão
 * migrações reais aqui.
 */
import { UmbrellaConfig } from '../config/config-schema';
import { Logger } from '../logging/logger';
export type { UmbrellaConfig };
export declare function runMigrations(config: UmbrellaConfig, logger: Logger): Promise<UmbrellaConfig>;
//# sourceMappingURL=migration-runner.d.ts.map