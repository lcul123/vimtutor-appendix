import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  applyResult,
  createRecordStore,
  type RecordOutcome,
  type Records,
} from '../engine/records';

const store = createRecordStore();

export interface RecordsApi {
  records: Records;
  submit(drillId: string, result: { timeMs: number; keys: number }): RecordOutcome;
  resetAll(): void;
}

export function useRecords(): RecordsApi {
  const [records, setRecords] = useState<Records>(() => store.load());
  const recordsRef = useRef(records);

  const commit = useCallback((next: Records) => {
    recordsRef.current = next;
    setRecords(next);
    store.save(next);
  }, []);

  const submit = useCallback(
    (drillId: string, result: { timeMs: number; keys: number }) => {
      const { records: next, outcome } = applyResult(recordsRef.current, drillId, result);
      commit(next);
      return outcome;
    },
    [commit],
  );

  const resetAll = useCallback(() => commit({}), [commit]);

  useEffect(() => {
    recordsRef.current = records;
  }, [records]);

  return useMemo(() => ({ records, submit, resetAll }), [records, submit, resetAll]);
}
