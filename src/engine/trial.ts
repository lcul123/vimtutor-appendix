/**
 * Expert-time model for the daily trial.
 *
 * A fluent user reads the one-line goal, finds the spot, and types the
 * reference solution with no mistakes and no pauses inside a command:
 *
 *   aim:  4.0s per challenge   (read the goal, look at the buffer, choose the command)
 *   keys: 280ms per keystroke  (about 3.6 keys/second once the command is chosen)
 *
 * Beginners spend most of the attempt remembering which command to use, so the
 * same fixed sequence takes several times longer. Personal bests can beat this
 * estimate once the sequence is familiar; it is a pace, not a floor.
 *
 * The current list is 28 challenges and 161 reference keystrokes:
 *   161 * 280ms + 28 * 4.0s = 157.1s (2m 37s).
 * A unit test fails if a future edit pushes that product outside 2–3 minutes.
 */
export const EXPERT_MS_PER_KEY = 280;
export const EXPERT_AIM_MS = 4_000;

export interface ExpertEstimate {
  challenges: number;
  keys: number;
  /** Aim time plus key time, in milliseconds. */
  ms: number;
}

export function estimateExpert(challenges: { solution: string[] }[]): ExpertEstimate {
  const keys = challenges.reduce((sum, challenge) => sum + challenge.solution.length, 0);
  return {
    challenges: challenges.length,
    keys,
    ms: keys * EXPERT_MS_PER_KEY + challenges.length * EXPERT_AIM_MS,
  };
}

export interface TrialAttempt {
  /** Total time from the first key to the last challenge. */
  timeMs: number;
  /** Elapsed time at the moment each challenge completed, in order. */
  splitsMs: number[];
  completedAt: number;
}

const STORAGE_KEY = 'vimtutor-appendix:trial:v1';
const ATTEMPT_LIMIT = 40;

export function localDay(timestamp: number): string {
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function bestTime(attempts: TrialAttempt[]): number | null {
  if (attempts.length === 0) return null;
  return attempts.reduce((best, attempt) => Math.min(best, attempt.timeMs), Number.POSITIVE_INFINITY);
}

export function attemptsOnDay(attempts: TrialAttempt[], day: string): TrialAttempt[] {
  return attempts.filter((attempt) => localDay(attempt.completedAt) === day);
}

export function latestOnDay(attempts: TrialAttempt[], day: string): TrialAttempt | null {
  const todays = attemptsOnDay(attempts, day);
  if (todays.length === 0) return null;
  return todays.reduce((latest, attempt) => (attempt.completedAt >= latest.completedAt ? attempt : latest));
}

export function recentAttempts(attempts: TrialAttempt[], limit = 8): TrialAttempt[] {
  return attempts
    .slice()
    .sort((a, b) => b.completedAt - a.completedAt)
    .slice(0, limit);
}

export function recordAttempt(attempts: TrialAttempt[], attempt: TrialAttempt, limit = ATTEMPT_LIMIT): TrialAttempt[] {
  return [...attempts, attempt].slice(-limit);
}

export interface TrialStore {
  load(): TrialAttempt[];
  save(attempts: TrialAttempt[]): void;
}

export function createTrialStore(storage?: Storage | null): TrialStore {
  const fallback = new Map<string, string>();
  const backing: Pick<Storage, 'getItem' | 'setItem'> | null =
    storage ??
    (typeof localStorage !== 'undefined' &&
    typeof localStorage.getItem === 'function' &&
    typeof localStorage.setItem === 'function'
      ? localStorage
      : null);

  return {
    load() {
      let raw: string | null | undefined;
      try {
        raw = backing ? backing.getItem(STORAGE_KEY) : fallback.get(STORAGE_KEY);
      } catch {
        raw = fallback.get(STORAGE_KEY);
      }
      if (!raw) return [];
      try {
        return sanitizeAttempts(JSON.parse(raw));
      } catch {
        return [];
      }
    },
    save(attempts) {
      const payload = JSON.stringify(attempts);
      if (backing) {
        try {
          backing.setItem(STORAGE_KEY, payload);
        } catch {
          fallback.set(STORAGE_KEY, payload);
        }
      } else {
        fallback.set(STORAGE_KEY, payload);
      }
    },
  };
}

function sanitizeAttempts(value: unknown): TrialAttempt[] {
  if (!Array.isArray(value)) return [];
  const out: TrialAttempt[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const attempt = entry as Partial<TrialAttempt>;
    if (typeof attempt.timeMs !== 'number' || !Number.isFinite(attempt.timeMs)) continue;
    const splits = Array.isArray(attempt.splitsMs)
      ? attempt.splitsMs.filter((split) => typeof split === 'number' && Number.isFinite(split) && split >= 0)
      : [];
    out.push({
      timeMs: Math.max(0, Math.round(attempt.timeMs)),
      splitsMs: splits.map((split) => Math.round(split)),
      completedAt: typeof attempt.completedAt === 'number' && Number.isFinite(attempt.completedAt) ? attempt.completedAt : 0,
    });
  }
  return out.slice(-ATTEMPT_LIMIT);
}
