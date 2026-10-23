import { LoggerService } from '@nestjs/common';
import pino, { Logger as PinoLogger } from 'pino';

/**
 * Nest LoggerService backed by pino JSON logs.
 *
 * Secrets are redacted so conversation cookies, Authorization headers,
 * passwords, and API keys never land in production log streams.
 */
export class StructuredLogger implements LoggerService {
  private readonly logger: PinoLogger;

  constructor() {
    this.logger = pino({
      level:
        process.env.LOG_LEVEL ||
        (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'password',
          'passwordHash',
          'apiKey',
          'token',
          '*.password',
          '*.token',
          '*.apiKey',
          '*.authorization',
        ],
        censor: '[REDACTED]',
      },
      base: {
        service: 'ai-customer-support-backend',
      },
    });
  }

  log(message: unknown, ...optionalParams: unknown[]) {
    this.logger.info({ context: optionalParams[0] }, this.stringify(message));
  }

  error(message: unknown, ...optionalParams: unknown[]) {
    this.logger.error(
      { context: optionalParams[1] ?? optionalParams[0] },
      this.stringify(message),
    );
  }

  warn(message: unknown, ...optionalParams: unknown[]) {
    this.logger.warn({ context: optionalParams[0] }, this.stringify(message));
  }

  debug?(message: unknown, ...optionalParams: unknown[]) {
    this.logger.debug({ context: optionalParams[0] }, this.stringify(message));
  }

  verbose?(message: unknown, ...optionalParams: unknown[]) {
    this.logger.trace({ context: optionalParams[0] }, this.stringify(message));
  }

  private stringify(message: unknown): string {
    if (typeof message === 'string') {
      return message;
    }
    try {
      return JSON.stringify(message);
    } catch {
      return String(message);
    }
  }
}
