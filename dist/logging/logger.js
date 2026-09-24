"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
/**
 * Logger simples para o Umbrella Office.
 *
 * Escreve logs em ~/.umbrella/logs/office.log e também
 * imprime no console em modo de desenvolvimento.
 *
 * Nunca registra senhas, tokens ou informações sensíveis.
 */
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const LEVEL_PRIORITY = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
};
class Logger {
    logFilePath;
    minLevel;
    constructor(logFilePath, level = 'INFO') {
        this.logFilePath = logFilePath;
        this.minLevel = level;
    }
    debug(message, meta) {
        this.write('DEBUG', message, meta);
    }
    info(message, meta) {
        this.write('INFO', message, meta);
    }
    warn(message, meta) {
        this.write('WARN', message, meta);
    }
    error(message, meta) {
        this.write('ERROR', message, meta);
    }
    shouldLog(level) {
        return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[this.minLevel];
    }
    write(level, message, meta) {
        if (!this.shouldLog(level))
            return;
        const timestamp = new Date().toISOString();
        const metaStr = meta ? ' ' + JSON.stringify(meta) : '';
        const line = `[${timestamp}] [${level}] ${message}${metaStr}\n`;
        // Append ao arquivo de log
        try {
            const dir = path.dirname(this.logFilePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.appendFileSync(this.logFilePath, line, 'utf-8');
        }
        catch {
            // Se não puder escrever log, silenciosamente ignora
        }
    }
}
exports.Logger = Logger;
//# sourceMappingURL=logger.js.map