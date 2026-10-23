import {
  isTransientError,
  retryTransient,
  TimeoutError,
  withTimeout,
} from './retry';

describe('retry utilities', () => {
  describe('isTransientError', () => {
    it('treats 429 and 5xx as transient', () => {
      expect(isTransientError({ status: 429, message: 'rate' })).toBe(true);
      expect(isTransientError({ statusCode: 503, message: 'unavailable' })).toBe(
        true,
      );
    });

    it('treats 400 validation errors as permanent', () => {
      expect(isTransientError({ status: 400, message: 'bad request' })).toBe(
        false,
      );
    });
  });

  describe('withTimeout', () => {
    it('resolves when the work finishes in time', async () => {
      const result = await withTimeout(
        Promise.resolve('ok'),
        50,
        'fast-call',
      );
      expect(result).toBe('ok');
    });

    it('rejects with TimeoutError when the work exceeds the budget', async () => {
      await expect(
        withTimeout(
          new Promise((resolve) => setTimeout(() => resolve('late'), 80)),
          10,
          'slow-call',
        ),
      ).rejects.toBeInstanceOf(TimeoutError);
    });
  });

  describe('retryTransient', () => {
    it('retries a transient failure then succeeds', async () => {
      let calls = 0;
      const result = await retryTransient(
        async () => {
          calls += 1;
          if (calls === 1) {
            throw { status: 429, message: 'rate limited' };
          }
          return 'recovered';
        },
        { attempts: 3, delayMs: 1, label: 'llm' },
      );

      expect(result).toBe('recovered');
      expect(calls).toBe(2);
    });

    it('does not retry permanent errors', async () => {
      let calls = 0;
      await expect(
        retryTransient(
          async () => {
            calls += 1;
            throw { status: 400, message: 'invalid json' };
          },
          { attempts: 3, delayMs: 1, label: 'llm' },
        ),
      ).rejects.toEqual({ status: 400, message: 'invalid json' });
      expect(calls).toBe(1);
    });
  });
});
