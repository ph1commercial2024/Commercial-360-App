import { describe, it, expect, vi, afterEach } from 'vitest';
import { timedFetch, isNetworkError, REQUEST_TIMEOUT_MS, STORAGE_TIMEOUT_MS, AUTH_TIMEOUT_MS } from '../lib/fetchTimeout.js';

afterEach(() => vi.useRealTimers());

// A fetch that never answers unless its signal aborts
const hangingFetch = () => vi.fn((_url, init = {}) => new Promise((_res, rej) => {
  init.signal?.addEventListener('abort', () => rej(new DOMException('The operation was aborted.', 'AbortError')));
}));

describe('timedFetch', () => {
  it('aborts a database request that hangs past the limit', async () => {
    vi.useFakeTimers();
    const f = timedFetch(hangingFetch(), 1000);
    const p = f('https://x.supabase.co/rest/v1/purchase_requests?select=*', {});
    const caught = p.catch(e => e);
    await vi.advanceTimersByTimeAsync(1001);
    expect((await caught).name).toBe('AbortError');
  });

  it('passes a quick answer through untouched', async () => {
    const ok = { ok: true };
    const f = timedFetch(vi.fn(async () => ok), 1000);
    expect(await f('https://x.supabase.co/rest/v1/projects', {})).toBe(ok);
  });

  it('never times out server functions (an AI read can be slow)', async () => {
    vi.useFakeTimers();
    const inner = hangingFetch();
    let settled = false;
    timedFetch(inner, 1000)('https://x.supabase.co/functions/v1/send-email', {}).finally(() => { settled = true; }).catch(() => {});
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
    expect(settled).toBe(false);
    expect(inner.mock.calls[0][1]?.signal).toBeUndefined();
  });

  it('gives file uploads 5 minutes, not the normal limit', async () => {
    vi.useFakeTimers();
    let err = null;
    timedFetch(hangingFetch(), 1000)('https://x.supabase.co/storage/v1/object/pr-documents/a.pdf', {}).catch(e => { err = e; });
    await vi.advanceTimersByTimeAsync(STORAGE_TIMEOUT_MS - 1);
    expect(err).toBeNull();
    await vi.advanceTimersByTimeAsync(2);
    expect(err?.name).toBe('AbortError');
    expect(STORAGE_TIMEOUT_MS).toBe(5 * 60 * 1000);
  });

  it('gives a login refresh 60 seconds, so a slow but working refresh is not thrown away', async () => {
    vi.useFakeTimers();
    let err = null;
    timedFetch(hangingFetch())('https://x.supabase.co/auth/v1/token?grant_type=refresh_token', {}).catch(e => { err = e; });
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS + 1);
    expect(err).toBeNull();
    await vi.advanceTimersByTimeAsync(AUTH_TIMEOUT_MS - REQUEST_TIMEOUT_MS);
    expect(err?.name).toBe('AbortError');
    expect(AUTH_TIMEOUT_MS).toBe(60000);
  });

  it('leaves a caller-supplied abort signal alone', async () => {
    const inner = vi.fn(async () => 'r');
    const ctrl = new AbortController();
    await timedFetch(inner, 1000)('https://x.supabase.co/rest/v1/x', { signal: ctrl.signal });
    expect(inner.mock.calls[0][1].signal).toBe(ctrl.signal);
  });

  it('accepts a Request object as input', async () => {
    const inner = vi.fn(async () => 'r');
    await timedFetch(inner, 1000)(new Request('https://x.supabase.co/rest/v1/x'), {});
    expect(inner.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it('defaults to 30 seconds', () => expect(REQUEST_TIMEOUT_MS).toBe(30000));
});

describe('isNetworkError', () => {
  it('recognises dropped-connection and timeout messages', () => {
    for (const m of ['TypeError: Failed to fetch', 'AbortError: The operation was aborted.', 'signal is aborted without reason', 'Fetch is aborted', 'NetworkError when attempting to fetch resource.', 'Load failed', 'network request failed'])
      expect(isNetworkError(m)).toBe(true);
  });
  it('does not flag ordinary database errors', () => {
    for (const m of ['new row violates check constraint "purchase_requests_status_check"', 'duplicate key value', 'current transaction is aborted, commands ignored until end of transaction block', 'canceling statement due to statement timeout', 'canceling statement due to lock timeout', '', undefined])
      expect(isNetworkError(m)).toBe(false);
  });
});
