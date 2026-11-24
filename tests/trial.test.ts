import { describe, expect, it } from 'vitest';
import { trialChallenges } from '../src/content/trialChallenges';
import {
  bestTime,
  createTrialStore,
  estimateExpert,
  latestOnDay,
  localDay,
  recentAttempts,
  recordAttempt,
  type TrialAttempt,
} from '../src/engine/trial';

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(key: string) {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  key(index: number) {
    return Array.from(this.map.keys())[index] ?? null;
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
}

describe('expert estimate', () => {
  const estimate = estimateExpert(trialChallenges);

  it('lands between two and three minutes', () => {
    expect(estimate.ms).toBeGreaterThanOrEqual(2 * 60 * 1000);
    expect(estimate.ms).toBeLessThanOrEqual(3 * 60 * 1000);
  });

  it('counts every reference key and every challenge', () => {
    const keys = trialChallenges.reduce((sum, challenge) => sum + challenge.solution.length, 0);
    expect(estimate.keys).toBe(keys);
    expect(estimate.challenges).toBe(trialChallenges.length);
    expect(estimate.ms).toBe(keys * 280 + trialChallenges.length * 4_000);
  });
});

describe('trial completion shape', () => {
  it('gives every challenge a goal the initial state does not already meet', () => {
    for (const challenge of trialChallenges) {
      expect(challenge.solution.length, challenge.id).toBeGreaterThan(0);
      expect(challenge.goal.length, challenge.id).toBeGreaterThan(10);
      if (challenge.kind === 'vim') {
        const started = challenge.buffer ?? '';
        if (challenge.checkpoints) {
          expect(challenge.checkpoints[0]).not.toBe(started);
        } else if (challenge.cursor) {
          const start = challenge.cursorStart ?? { line: 0, ch: 0 };
          expect(start).not.toEqual(challenge.cursor);
        } else if (challenge.target) {
          expect(started).not.toBe(challenge.target);
        }
      }
    }
  });
});

describe('trial history', () => {
  const noon = (day: number) => Date.UTC(2026, 10, day, 12, 0, 0);

  function attempt(timeMs: number, day: number, splits = [timeMs]): TrialAttempt {
    return { timeMs, splitsMs: splits, completedAt: noon(day) };
  }

  it('keeps the best time, the latest run today, and recent history', () => {
    const attempts = [
      attempt(180_000, 23),
      attempt(150_000, 24),
      { ...attempt(140_000, 24, [40_000, 140_000]), completedAt: noon(24) + 60_000 },
    ];
    expect(bestTime(attempts)).toBe(140_000);
    expect(bestTime([])).toBeNull();
    const today = localDay(noon(24));
    expect(latestOnDay(attempts, today)?.timeMs).toBe(140_000);
    expect(latestOnDay(attempts, localDay(noon(1)))).toBeNull();
    expect(recentAttempts(attempts, 2).map((item) => item.timeMs)).toEqual([140_000, 150_000]);
  });

  it('appends an attempt and drops the oldest past the cap', () => {
    const stored = recordAttempt(
      Array.from({ length: 40 }, (_, index) => attempt(index + 1, 1)),
      attempt(99, 2),
      40,
    );
    expect(stored).toHaveLength(40);
    expect(stored[0]?.timeMs).toBe(2);
    expect(stored.at(-1)?.timeMs).toBe(99);
  });

  it('round-trips through storage and recovers from corrupt data', () => {
    const storage = new MemoryStorage();
    const store = createTrialStore(storage);
    expect(store.load()).toEqual([]);
    store.save([attempt(12_000, 24, [4_000, 12_000])]);
    expect(createTrialStore(storage).load()).toEqual([attempt(12_000, 24, [4_000, 12_000])]);

    storage.setItem('vimtutor-appendix:trial:v1', '{');
    expect(createTrialStore(storage).load()).toEqual([]);
    storage.setItem(
      'vimtutor-appendix:trial:v1',
      JSON.stringify([{ timeMs: 10, splitsMs: [10, 'nope', -1], completedAt: 5 }, { timeMs: 'x' }]),
    );
    expect(createTrialStore(storage).load()).toEqual([{ timeMs: 10, splitsMs: [10], completedAt: 5 }]);
  });
});
