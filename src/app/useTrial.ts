import { useCallback, useMemo, useState } from 'react';
import {
  bestTime,
  createTrialStore,
  latestOnDay,
  localDay,
  recentAttempts,
  recordAttempt,
  type TrialAttempt,
} from '../engine/trial';

const store = createTrialStore();

export function useTrial() {
  const [attempts, setAttempts] = useState<TrialAttempt[]>(() => store.load());

  const record = useCallback((attempt: TrialAttempt) => {
    setAttempts((current) => {
      const next = recordAttempt(current, attempt);
      store.save(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    store.save([]);
    setAttempts([]);
  }, []);

  const today = localDay(Date.now());
  return useMemo(
    () => ({
      attempts,
      best: bestTime(attempts),
      today: latestOnDay(attempts, today),
      recent: recentAttempts(attempts),
      record,
      reset,
    }),
    [attempts, today, record, reset],
  );
}
