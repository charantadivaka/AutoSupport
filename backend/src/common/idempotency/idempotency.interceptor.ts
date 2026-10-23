import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { IDEMPOTENCY_METADATA_KEY } from './idempotency.decorator';
import { IdempotencyService } from './idempotency.service';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly store: IdempotencyService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const isIdempotent = this.reflector.get<boolean>(
      IDEMPOTENCY_METADATA_KEY,
      context.getHandler(),
    );
    if (!isIdempotent) {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();
    const header = req.headers['idempotency-key'];
    if (typeof header !== 'string' || header.trim().length === 0) {
      return next.handle();
    }

    const userId = req.user?.id || 'anonymous';
    const cacheKey = `${req.method}:${req.originalUrl || req.url}:${userId}:${header.trim()}`;
    const cached = this.store.get(cacheKey);
    if (cached !== undefined) {
      res.setHeader('X-Idempotency-Replayed', 'true');
      return of(cached);
    }

    return next.handle().pipe(
      tap((body) => {
        this.store.set(cacheKey, body);
      }),
    );
  }
}
