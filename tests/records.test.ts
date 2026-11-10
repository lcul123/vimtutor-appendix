import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyResult,
  createRecordStore,
  totalCompleted,
  type Records,
} from '../src/engine/records';
import { formatDuration, formatKeys } from '../src/engine/format';

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

describe('applyResult', () => {
  it('records a first run as both a time and key best', () => {
    const { records, outcome } = applyResult({}, 'd1', { timeMs: 4200, keys: 12 });
    expect(outcome.timeRecord).toBe(true);
    expect(outcome.keysRecord).toBe(true);
    expect(outcome.perfect).toBe(true);
    expect(records.d1).toMatchObject({ bestTimeMs: 4200, bestKeys: 12, runs: 1 });
  });

  it('keeps the faster time and the lower key count independently', () => {
    let records: Records = {};
    ({ records } = applyResult(records, 'd1', { timeMs: 5000, keys: 20 }));
    const second = applyResult(records, 'd1', { timeMs: 4000, keys: 25 });
    expect(second.outcome.timeRecord).toBe(true);
    expect(second.outcome.keysRecord).toBe(false);
    expect(second.outcome.perfect).toBe(false);
    expect(second.records.d1).toMatchObject({ bestTimeMs: 4000, bestKeys: 20, runs: 2 });

    const third = applyResult(second.records, 'd1', { timeMs: 6000, keys: 15 });
    expect(third.outcome.timeRecord).toBe(false);
    expect(third.outcome.keysRecord).toBe(true);
    expect(third.records.d1).toMatchObject({ bestTimeMs: 4000, bestKeys: 15, runs: 3 });
  });

  it('does not report a record on an equal or worse run', () => {
    const first = applyResult({}, 'd1', { timeMs: 3000, keys: 10 });
    const same = applyResult(first.records, 'd1', { timeMs: 3000, keys: 10 });
    expect(same.outcome.timeRecord).toBe(false);
    expect(same.outcome.keysRecord).toBe(false);
    expect(same.records.d1.runs).toBe(2);
    expect(same.records.d1.bestTimeMs).toBe(3000);
  });

  it('rounds and clamps odd inputs', () => {
    const { records } = applyResult({}, 'd1', { timeMs: -5, keys: 9.6 });
    expect(records.d1.bestTimeMs).toBe(0);
    expect(records.d1.bestKeys).toBe(10);
  });

  it('does not mutate the input record book', () => {
    const original: Records = {};
    applyResult(original, 'd1', { timeMs: 100, keys: 3 });
    expect(original).toEqual({});
  });
});

describe('createRecordStore', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it('round-trips records through storage', () => {
    const store = createRecordStore(storage);
    const { records } = applyResult({}, 'd1', { timeMs: 1234, keys: 7 }, 999);
    store.save(records);
    expect(store.load()).toEqual(records);
  });

  it('returns an empty book when nothing is stored', () => {
    expect(createRecordStore(storage).load()).toEqual({});
  });

  it('recovers from corrupted JSON', () => {
    storage.setItem('vimtutor-appendix:records:v1', '{not json');
    expect(createRecordStore(storage).load()).toEqual({});
  });

  it('drops malformed entries but keeps valid ones', () => {
    storage.setItem(
      'vimtutor-appendix:records:v1',
      JSON.stringify({
        good: { bestTimeMs: 100, bestKeys: 5, runs: 2, updatedAt: 1 },
        badType: { bestTimeMs: 'fast', bestKeys: 5 },
        missing: { bestTimeMs: 10 },
        infinite: { bestTimeMs: Infinity, bestKeys: 1 },
        nullish: null,
      }),
    );
    expect(createRecordStore(storage).load()).toEqual({
      good: { bestTimeMs: 100, bestKeys: 5, runs: 2, updatedAt: 1 },
    });
  });

  it('keeps working when storage throws (private mode, quota)', () => {
    const hostile: Storage = {
      ...new MemoryStorage(),
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
      clear: () => {},
      key: () => null,
      removeItem: () => {},
      length: 0,
    };
    const store = createRecordStore(hostile);
    const records = { d1: { bestTimeMs: 1, bestKeys: 1, runs: 1, updatedAt: 0 } };
    expect(() => store.save(records)).not.toThrow();
    // Writes fall back to memory, so the session still tracks progress.
    expect(store.load()).toEqual(records);
  });

  it('returns an empty book when storage cannot even be read', () => {
    const unreadable: Storage = {
      ...new MemoryStorage(),
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {},
      clear: () => {},
      key: () => null,
      removeItem: () => {},
      length: 0,
    };
    expect(createRecordStore(unreadable).load()).toEqual({});
  });

  it('defaults runs to 1 for legacy entries', () => {
    storage.setItem(
      'vimtutor-appendix:records:v1',
      JSON.stringify({ d1: { bestTimeMs: 10, bestKeys: 2 } }),
    );
    expect(createRecordStore(storage).load().d1.runs).toBe(1);
  });

  it('shares one storage key across store instances', () => {
    const a = createRecordStore(storage);
    a.save({ d1: { bestTimeMs: 5, bestKeys: 1, runs: 1, updatedAt: 0 } });
    expect(createRecordStore(storage).load().d1.bestTimeMs).toBe(5);
  });

  it('falls back to memory when no storage is available', () => {
    const store = createRecordStore(null);
    store.save({ d1: { bestTimeMs: 5, bestKeys: 1, runs: 1, updatedAt: 0 } });
    expect(store.load().d1.bestTimeMs).toBe(5);
  });
});

describe('totalCompleted', () => {
  it('sums runs across drills', () => {
    let records: Records = {};
    ({ records } = applyResult(records, 'a', { timeMs: 10, keys: 1 }));
    ({ records } = applyResult(records, 'a', { timeMs: 9, keys: 1 }));
    ({ records } = applyResult(records, 'b', { timeMs: 20, keys: 2 }));
    expect(totalCompleted(records)).toBe(3);
  });
});

describe('formatting', () => {
  it('formats sub-minute times with decimals', () => {
    expect(formatDuration(0)).toBe('0.00s');
    expect(formatDuration(1234)).toBe('1.23s');
    expect(formatDuration(12345)).toBe('12.3s');
  });

  it('formats longer times as minutes and seconds', () => {
    expect(formatDuration(65_000)).toBe('1m 05s');
    expect(formatDuration(125_000)).toBe('2m 05s');
  });

  it('formats missing values', () => {
    expect(formatDuration(Number.NaN)).toBe('—');
    expect(formatKeys(undefined)).toBe('—');
    expect(formatKeys(1)).toBe('1 key');
    expect(formatKeys(4)).toBe('4 keys');
  });
});

describe('localStorage default path', () => {
  it('uses window.localStorage when no storage is passed', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem');
    const store = createRecordStore();
    store.save({ d1: { bestTimeMs: 1, bestKeys: 1, runs: 1, updatedAt: 0 } });
    expect(spy).toHaveBeenCalled();
    expect(store.load().d1.bestTimeMs).toBe(1);
    spy.mockRestore();
    window.localStorage.clear();
  });
});
