export interface DrillRecord {
  bestTimeMs: number;
  bestKeys: number;
  /** Number of successful completions. */
  runs: number;
  updatedAt: number;
}

export type Records = Record<string, DrillRecord>;

export interface SolveResult {
  timeMs: number;
  keys: number;
}

export interface RecordOutcome {
  /** New personal best for time. */
  timeRecord: boolean;
  /** New personal best for keystrokes (lower is better). */
  keysRecord: boolean;
  /** True when this run also produced a best time with no wasted keys. */
  perfect: boolean;
  record: DrillRecord;
  previous?: DrillRecord;
}

const STORAGE_KEY = 'vimtutor-appendix:records:v1';

export interface RecordStore {
  load(): Records;
  save(records: Records): void;
}

/** localStorage-backed store that degrades to an in-memory store. */
export function createRecordStore(storage?: Storage | null): RecordStore {
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
      if (!raw) return {};
      try {
        return sanitizeRecords(JSON.parse(raw));
      } catch {
        return {};
      }
    },
    save(records) {
      const payload = JSON.stringify(records);
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

function sanitizeRecords(value: unknown): Records {
  if (!value || typeof value !== 'object') return {};
  const out: Records = {};
  for (const [id, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!entry || typeof entry !== 'object') continue;
    const record = entry as Partial<DrillRecord>;
    if (
      typeof record.bestTimeMs !== 'number' ||
      typeof record.bestKeys !== 'number' ||
      !Number.isFinite(record.bestTimeMs) ||
      !Number.isFinite(record.bestKeys)
    ) {
      continue;
    }
    out[id] = {
      bestTimeMs: Math.max(0, record.bestTimeMs),
      bestKeys: Math.max(0, Math.round(record.bestKeys)),
      runs: typeof record.runs === 'number' && record.runs > 0 ? Math.round(record.runs) : 1,
      updatedAt: typeof record.updatedAt === 'number' ? record.updatedAt : 0,
    };
  }
  return out;
}

/**
 * Merges a completed run into the record book. Time and keystroke bests are
 * tracked independently so a careful slow run can still set a key best and a
 * frantic fast run can still set a time best.
 */
export function applyResult(
  records: Records,
  drillId: string,
  result: SolveResult,
  now = Date.now(),
): { records: Records; outcome: RecordOutcome } {
  const previous = records[drillId];
  const time = Math.max(0, Math.round(result.timeMs));
  const keys = Math.max(0, Math.round(result.keys));
  const timeRecord = !previous || time < previous.bestTimeMs;
  const keysRecord = !previous || keys < previous.bestKeys;

  const record: DrillRecord = {
    bestTimeMs: timeRecord ? time : previous.bestTimeMs,
    bestKeys: keysRecord ? keys : previous.bestKeys,
    runs: (previous?.runs ?? 0) + 1,
    updatedAt: now,
  };

  return {
    records: { ...records, [drillId]: record },
    outcome: {
      timeRecord,
      keysRecord,
      perfect: timeRecord && keysRecord,
      record,
      previous,
    },
  };
}

/** Best time across every drill, used for the overview header. */
export function totalCompleted(records: Records): number {
  return Object.values(records).reduce((sum, r) => sum + r.runs, 0);
}
