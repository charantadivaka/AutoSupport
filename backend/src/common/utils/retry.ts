export interface RetryOptions {
  attempts: number;
  delayMs: number;
  label: string;
}

export class TimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`${label} timed out after ${ms}ms`);
    this.name = 'TimeoutError';
  }
}

export function isTransientError(error: unknown): boolean {
  const status =
    (error as { status?: number; statusCode?: number })?.status ||
    (error as { statusCode?: number })?.statusCode;
  const message = String(
    (error as { message?: string })?.message || error,
  ).toLowerCase();

  if (status === 429 || (typeof status === 'number' && status >= 500)) {
    return true;
  }

  return (
    message.includes('timeout') ||
    message.includes('econnreset') ||
    message.includes('econnrefused') ||
    message.includes('429') ||
    message.includes('rate limit') ||
    message.includes('temporar') ||
    message.includes('unavailable') ||
    message.includes('fetch failed')
  );
}

export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export async function retryTransient<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= options.attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const retryable =
        isTransientError(error) && attempt < options.attempts;
      if (!retryable) {
        throw error;
      }
      const wait = options.delayMs * attempt;
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }

  throw lastError;
}
