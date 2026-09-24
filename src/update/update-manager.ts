/**
 * Infraestrutura futura de atualização do Umbrella Office.
 *
 * Na V0.1 não há download real. checkForUpdates() informa
 * "Update system: NOT CONFIGURED".
 *
 * Fluxo futuro:
 *   Check → Download → Backup → Migration → Install → Restart
 *
 * A atualização nunca deve apagar ~/.umbrella/ sem migração explícita.
 */
import { VERSION } from '../core/version';
import { Logger } from '../logging/logger';

export type UpdateStatus = 'NOT_CONFIGURED' | 'UP_TO_DATE' | 'AVAILABLE' | 'ERROR';

export interface UpdateInfo {
  status: UpdateStatus;
  currentVersion: string;
  availableVersion: string | null;
  message: string;
}

export class UpdateManager {
  private readonly logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  getCurrentVersion(): string {
    return VERSION;
  }

  async checkForUpdates(): Promise<UpdateInfo> {
    this.logger.info('Checking for updates', { currentVersion: VERSION });
    return {
      status: 'NOT_CONFIGURED',
      currentVersion: VERSION,
      availableVersion: null,
      message: 'Update system: NOT CONFIGURED',
    };
  }

  getAvailableVersion(): string | null {
    return null;
  }

  async installUpdate(): Promise<void> {
    throw new Error('Update system: NOT CONFIGURED');
  }
}
