// Must exceed the provider request ceiling so a legitimate slow completion is not
// requeued while its HTTP request is still in flight.
export const ASYNC_RUN_STALE_AFTER_MS = 90_000;
export const ASYNC_ERROR = {
  RECOVERED_AFTER_STALE_WORKER: 'RECOVERED_AFTER_STALE_WORKER',
  STALE_RETRY_EXHAUSTED: 'STALE_RETRY_EXHAUSTED',
  RETRY_EXHAUSTED: 'RETRY_EXHAUSTED',
} as const;

export type RecoverableRun = {
  id: string;
  status: string;
  heartbeatAt?: Date | null;
  startedAt: Date;
};

const ACTIVE_STATUSES = new Set(['SNAPSHOTTING', 'PLANNING', 'INVESTIGATING', 'ANALYZING', 'VERIFYING', 'SUMMARIZING', 'RUNNING']);

export function staleBefore(now = new Date(), staleAfterMs = ASYNC_RUN_STALE_AFTER_MS) {
  return new Date(now.getTime() - staleAfterMs);
}

export function shouldRecoverRun(run: RecoverableRun, now = new Date(), staleAfterMs = ASYNC_RUN_STALE_AFTER_MS) {
  if (!ACTIVE_STATUSES.has(run.status)) return false;
  const lastSignal = run.heartbeatAt ?? run.startedAt;
  return lastSignal.getTime() <= staleBefore(now, staleAfterMs).getTime();
}

export function batchError(code: keyof typeof ASYNC_ERROR, detail?: string) {
  return detail ? `${ASYNC_ERROR[code]}: ${detail.slice(0, 1900)}` : ASYNC_ERROR[code];
}

export function isProviderCircuitOpen(error: unknown) {
  return String((error as any)?.message || error || '').includes('AI provider circuit breaker is open');
}

export function retryDisposition(retryCount: number, maxAttempts = 3) {
  if (!Number.isInteger(retryCount) || retryCount < 0) throw new Error('retryCount must be a non-negative integer');
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) throw new Error('maxAttempts must be >= 1');
  return retryCount + 1 < maxAttempts ? 'REQUEUE' : 'FAIL';
}
