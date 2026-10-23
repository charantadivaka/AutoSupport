import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Observable } from 'rxjs';

/**
 * Assigns a correlation id to every HTTP request.
 * Clients may send X-Request-Id; otherwise a UUID is generated.
 * The same value is returned on the response for support debugging.
 */
@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();

    const incoming = req.headers['x-request-id'];
    const requestId =
      typeof incoming === 'string' && incoming.length > 0 && incoming.length < 128
        ? incoming
        : randomUUID();

    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);

    return next.handle();
  }
}
