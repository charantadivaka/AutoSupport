import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';

interface CacheEntry {
  expiresAt: number;
  body: unknown;
}

const DEFAULT_TTL_MS = 10 * 60 * 1000;    // 10 minutes
const EVICTION_INTERVAL_MS = 5 * 60 * 1000; // sweep every 5 minutes

/**
 * In-memory replay cache for POST endpoints that must not duplicate work
 * when a client retries with the same Idempotency-Key.
 *
 * A Redis-backed store can replace this later without changing callers.
 *
 * Bug #17 fix: Added a periodic eviction sweep so expired entries do not
 * accumulate in memory indefinitely. The sweep runs every 5 minutes.
 */
@Injectable()
export class IdempotencyService implements OnModuleInit, OnModuleDestroy {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly logger = new Logger(IdempotencyService.name);
  private evictionTimer: NodeJS.Timeout | null = null;

  onModuleInit() {
    this.evictionTimer = setInterval(() => this.evictExpired(), EVICTION_INTERVAL_MS);
    // Allow the process to exit even if this timer is still pending
    if (this.evictionTimer.unref) {
      this.evictionTimer.unref();
    }
  }

  onModuleDestroy() {
    if (this.evictionTimer) {
      clearInterval(this.evictionTimer);
      this.evictionTimer = null;
    }
  }

  private evictExpired(): void {
    const now = Date.now();
    let evicted = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        evicted++;
      }
    }
    if (evicted > 0) {
      this.logger.debug(`Idempotency cache eviction: removed ${evicted} expired entries (${this.cache.size} remaining)`);
    }
  }

  get(key: string): unknown | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      return undefined;
    }
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.body;
  }

  set(key: string, body: unknown, ttlMs = DEFAULT_TTL_MS): void {
    this.cache.set(key, {
      body,
      expiresAt: Date.now() + ttlMs,
    });
  }

  clear(): void {
    this.cache.clear();
  }
}
