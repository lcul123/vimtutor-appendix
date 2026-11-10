/**
 * A stopwatch that starts on the first key and freezes on the solve.
 *
 * The clock source is injectable so timing behaviour can be tested without
 * sleeping, which keeps the tests fast and deterministic.
 */
export interface Stopwatch {
  /** Start the clock if it is not already running. Safe to call repeatedly. */
  start(): void;
  /** Freeze the clock and return the elapsed milliseconds. */
  stop(): number;
  /** Elapsed milliseconds: frozen value once stopped, live value otherwise. */
  elapsed(): number;
  /** True once `start()` has been called. */
  readonly started: boolean;
  readonly stopped: boolean;
  reset(): void;
}

export function createStopwatch(now: () => number = () => performance.now()): Stopwatch {
  let startedAt: number | null = null;
  let stoppedAt: number | null = null;

  return {
    start() {
      if (startedAt !== null) return;
      startedAt = now();
    },
    stop() {
      if (stoppedAt !== null) return stoppedAt - (startedAt ?? stoppedAt);
      if (startedAt === null) return 0;
      stoppedAt = now();
      return Math.max(0, stoppedAt - startedAt);
    },
    elapsed() {
      if (startedAt === null) return 0;
      const end = stoppedAt ?? now();
      return Math.max(0, end - startedAt);
    },
    get started() {
      return startedAt !== null;
    },
    get stopped() {
      return stoppedAt !== null;
    },
    reset() {
      startedAt = null;
      stoppedAt = null;
    },
  };
}
