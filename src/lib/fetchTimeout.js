// A stalled connection never answers, and the browser's fetch has no time limit, so a save could sit on
// "Saving…" forever. Every request gets a limit: 30 s for database calls, longer where a slow answer is normal.
export const REQUEST_TIMEOUT_MS = 30000;
export const STORAGE_TIMEOUT_MS = 5 * 60 * 1000; // file uploads: a big plan set on a slow line
export const AUTH_TIMEOUT_MS    = 60000;          // login refresh: aborting a slow-but-working refresh would lose the new token

function limitFor(url, ms) {
  if (url.includes('/functions/v1/')) return null; // server functions (AI reads, email) stay unlimited
  if (url.includes('/storage/v1/')) return STORAGE_TIMEOUT_MS;
  if (url.includes('/auth/v1/')) return Math.max(ms, AUTH_TIMEOUT_MS);
  return ms;
}

export function timedFetch(fetchImpl = (...a) => fetch(...a), ms = REQUEST_TIMEOUT_MS) {
  return (input, init = {}) => {
    const url = typeof input === 'string' ? input : input?.url || String(input);
    const limit = limitFor(url, ms);
    if (init.signal || limit == null) return fetchImpl(input, init);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), limit);
    return fetchImpl(input, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(timer));
  };
}

// True when an error message means the connection dropped or timed out, not that the data was refused.
// Kept narrow: Postgres "current transaction is aborted" or "statement timeout" means the server answered
// (and rolled back), so it must not read as a dropped connection.
export function isNetworkError(message) {
  return /failed to fetch|networkerror|network request failed|load failed|aborterror|signal is aborted|operation was aborted|fetch is aborted|timed out/i.test(message || '');
}

export const CONNECTION_DROPPED_SAVE_MSG =
  "The connection dropped while saving. Check your internet, then open Purchase Requests to see whether the PR was saved before trying again.";
