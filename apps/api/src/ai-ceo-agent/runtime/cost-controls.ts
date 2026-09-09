export type RunControls = { maxRunsPerDay: number; maxBatchesPerRun: number; maxConcurrentRuns: number; failureThreshold: number; cooldownMs: number };
// Pre-run controls must be measurable without inventing USD pricing. Provider-reported
// usage.cost is the only source of truth for money and is persisted after each call.
export const DEFAULT_RUN_CONTROLS: RunControls = { maxRunsPerDay: 4, maxBatchesPerRun: 8, maxConcurrentRuns: 1, failureThreshold: 3, cooldownMs: 15 * 60_000 };
export const sanitizeControls = (input: Partial<RunControls> = {}): RunControls => ({
  maxRunsPerDay: Math.min(24, Math.max(1, Math.floor(Number(input.maxRunsPerDay ?? DEFAULT_RUN_CONTROLS.maxRunsPerDay)))),
  maxBatchesPerRun: Math.min(100, Math.max(1, Math.floor(Number(input.maxBatchesPerRun ?? DEFAULT_RUN_CONTROLS.maxBatchesPerRun)))),
  maxConcurrentRuns: Math.min(5, Math.max(1, Math.floor(Number(input.maxConcurrentRuns ?? DEFAULT_RUN_CONTROLS.maxConcurrentRuns)))),
  failureThreshold: Math.min(10, Math.max(1, Math.floor(Number(input.failureThreshold ?? DEFAULT_RUN_CONTROLS.failureThreshold)))),
  cooldownMs: Math.min(86_400_000, Math.max(60_000, Math.floor(Number(input.cooldownMs ?? DEFAULT_RUN_CONTROLS.cooldownMs)))),
});
export const assertRunControls = (input: { batches: number; runsToday: number; activeRuns: number; controls: RunControls }) => {
  const { batches, runsToday, activeRuns, controls } = input;
  if (activeRuns >= controls.maxConcurrentRuns) throw new Error(`AI CEO concurrent-run limit reached (${controls.maxConcurrentRuns})`);
  if (runsToday >= controls.maxRunsPerDay) throw new Error(`AI CEO daily run limit reached (${controls.maxRunsPerDay})`);
  if (batches > controls.maxBatchesPerRun) throw new Error(`AI CEO batch limit exceeded (${batches}/${controls.maxBatchesPerRun})`);
};
export type CircuitState = { failures: number; openedUntil?: number };
export const circuitAllows = (state: CircuitState, now = Date.now()) => !state.openedUntil || state.openedUntil <= now;
export const circuitSuccess = (): CircuitState => ({ failures: 0 });
export const circuitFailure = (state: CircuitState, controls: RunControls, now = Date.now()): CircuitState => { const failures = state.failures + 1; return failures >= controls.failureThreshold ? { failures, openedUntil: now + controls.cooldownMs } : { failures }; };
