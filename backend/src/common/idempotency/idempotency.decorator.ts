import { SetMetadata } from '@nestjs/common';

export const IDEMPOTENCY_METADATA_KEY = 'idempotent_endpoint';

/** Mark a handler so IdempotencyInterceptor honors Idempotency-Key. */
export const Idempotent = () => SetMetadata(IDEMPOTENCY_METADATA_KEY, true);
