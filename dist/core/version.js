"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONFIG_VERSION = exports.PROTOCOL_VERSION = exports.VERSION = exports.OFFICE_NAME = void 0;
exports.getVersionInfo = getVersionInfo;
/**
 * Informações de versão centralizadas do Umbrella Office.
 *
 * Nenhuma string de versão deve ser espalhada pelo código.
 * Consulte sempre este módulo.
 */
exports.OFFICE_NAME = 'Umbrella Office';
exports.VERSION = '0.4.0';
exports.PROTOCOL_VERSION = '1';
exports.CONFIG_VERSION = '1';
function getVersionInfo() {
    return {
        name: exports.OFFICE_NAME,
        version: exports.VERSION,
        protocolVersion: exports.PROTOCOL_VERSION,
        configVersion: exports.CONFIG_VERSION,
    };
}
//# sourceMappingURL=version.js.map