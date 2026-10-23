import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

/**
 * Structured access log: method, path, status, duration, requestId.
 * Intentionally does not log request bodies or message content.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();
    const started = Date.now();
    const method = req.method;
    const path = req.originalUrl || req.url;
    const requestId = req.requestId;

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.log(
            JSON.stringify({
              event: 'http_request',
              method,
              path,
              statusCode: res.statusCode,
              durationMs: Date.now() - started,
              requestId,
            }),
          );
        },
        error: () => {
          this.logger.warn(
            JSON.stringify({
              event: 'http_request_error',
              method,
              path,
              statusCode: res.statusCode,
              durationMs: Date.now() - started,
              requestId,
            }),
          );
        },
      }),
    );
  }
}
