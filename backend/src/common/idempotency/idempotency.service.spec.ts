import { IdempotencyService } from './idempotency.service';

describe('IdempotencyService', () => {
  let service: IdempotencyService;

  beforeEach(() => {
    service = new IdempotencyService();
  });

  it('returns undefined for unknown keys', () => {
    expect(service.get('missing')).toBeUndefined();
  });

  it('stores and returns a payload', () => {
    service.set('k1', { id: 'ticket-1' });
    expect(service.get('k1')).toEqual({ id: 'ticket-1' });
  });

  it('expires entries after ttl', () => {
    jest.useFakeTimers();
    service.set('k1', { id: 'ticket-1' }, 1000);
    jest.advanceTimersByTime(1001);
    expect(service.get('k1')).toBeUndefined();
    jest.useRealTimers();
  });
});
