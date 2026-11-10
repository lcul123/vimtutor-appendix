import { useEffect, useRef, useState } from 'react';
import { createDrillSession, type DrillSession } from '../engine/session';
import { diffBuffers } from '../engine/text';
import { formatDuration } from '../engine/format';
import type { Drill, Lesson } from '../engine/types';
import type { RecordOutcome, DrillRecord } from '../engine/records';

interface Props {
  lesson: Lesson;
  drill: Drill;
  drillNumber: number;
  drillCount: number;
  best?: DrillRecord;
  onSubmit(result: { timeMs: number; keys: number }): RecordOutcome;
  onNext(): void;
  onPrev(): void;
  onOverview(): void;
}

const MODIFIERS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Dead']);

export function DrillView({
  lesson,
  drill,
  drillNumber,
  drillCount,
  best,
  onSubmit,
  onNext,
  onPrev,
  onOverview,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const keyCountRef = useRef(0);
  const [state, setState] = useState({ keys: 0, elapsed: 0 });
  const [result, setResult] = useState<{
    timeMs: number;
    keys: number;
    outcome: RecordOutcome;
  } | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [mode, setMode] = useState('normal');
  const [snapshot, setSnapshot] = useState(drill.buffer);
  const [attempt, setAttempt] = useState(0);

  const finished = result !== null;

  // The submit handler is recreated on every render by the parent, so keep it in
  // a ref. Otherwise the editor would be torn down and rebuilt on each keystroke.
  const submitRef = useRef(onSubmit);
  submitRef.current = onSubmit;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    setResult(null);
    setShowHint(false);
    setMode('normal');
    setSnapshot(drill.buffer);
    keyCountRef.current = 0;
    startedAtRef.current = null;
    setState({ keys: 0, elapsed: 0 });

    const session: DrillSession = createDrillSession(host, {
      buffer: drill.buffer,
      target: drill.target,
      cursorTarget: drill.cursor,
      cursorStart: drill.cursorStart,
      onSolved: () => {
        const start = startedAtRef.current ?? performance.now();
        const timeMs = Math.max(0, performance.now() - start);
        const usedKeys = keyCountRef.current;
        setSnapshot(session.text());
        const outcome = submitRef.current({ timeMs, keys: usedKeys });
        setResult({ timeMs, keys: usedKeys, outcome });
      },
    });

    const offMode = session.onModeChange((next) => setMode(next));

    return () => {
      offMode();
      session.destroy();
    };
    // A new attempt remounts the editor, which is the simplest correct reset.
  }, [drill, attempt]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || finished) return;

    const onKey = (event: KeyboardEvent) => {
      if (MODIFIERS.has(event.key)) return;
      keyCountRef.current += 1;
      if (startedAtRef.current === null) startedAtRef.current = performance.now();
      setState((s) => ({ ...s, keys: keyCountRef.current }));
    };
    // 10 fps is plenty for a clock and keeps React out of the keystroke path.
    const timer = window.setInterval(() => {
      if (startedAtRef.current === null) return;
      const elapsed = performance.now() - startedAtRef.current;
      setState((s) => (s.elapsed === elapsed ? s : { ...s, elapsed }));
    }, 100);

    host.addEventListener('keydown', onKey, true);
    return () => {
      window.clearInterval(timer);
      host.removeEventListener('keydown', onKey, true);
    };
  }, [drill.id, attempt, finished]);

  const retry = () => setAttempt((n) => n + 1);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key !== 'Enter') return;
      event.preventDefault();
      if (event.shiftKey) onNext();
      else retry();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const diff = drill.target !== undefined ? diffBuffers(snapshot, drill.target) : null;
  const bestLabel = best ? `${formatDuration(best.bestTimeMs)} · ${best.bestKeys} keys` : 'none yet';
  const anyRecord = result ? result.outcome.timeRecord || result.outcome.keysRecord : false;

  return (
    <div className="drill-view">
      <div className="crumbs">
        <button onClick={onOverview}>All lessons</button>
        <span aria-hidden>/</span>
        <span>
          Lesson {lesson.number} · {lesson.title}
        </span>
        <span aria-hidden>/</span>
        <span>
          Drill {drillNumber} of {drillCount}
        </span>
      </div>

      <div className="drill-head">
        <div>
          <h1>{drill.title}</h1>
          <p className="drill-goal">{drill.goal}</p>
        </div>
        <div className="hud">
          <div className="hud__box">
            <span className="hud__label">Time</span>
            <span
              className={`hud__value${
                state.elapsed > 0 && !finished ? ' hud__value--live' : ''
              }`}
              data-testid="hud-time"
            >
              {formatDuration(finished ? result!.timeMs : state.elapsed)}
            </span>
          </div>
          <div className="hud__box">
            <span className="hud__label">Keys</span>
            <span className="hud__value" data-testid="hud-keys">
              {finished ? result!.keys : state.keys}
            </span>
          </div>
          <div className="hud__box">
            <span className="hud__label">Par</span>
            <span className="hud__value">{drill.par}</span>
          </div>
          <div className="hud__box">
            <span className="hud__label">Best</span>
            <span className="hud__value hud__value--sub" data-testid="hud-best">
              {bestLabel}
            </span>
          </div>
        </div>
      </div>

      <div className="panels">
        <div className="panel">
          <div className="panel__head">
            <span>Your buffer</span>
            <span className={`mode-pill mode-pill--${mode}`}>{mode}</span>
          </div>
          <div className="editor-host" ref={hostRef} data-testid="editor" />
        </div>
        <div className="panel">
          <div className="panel__head">
            <span>{drill.target !== undefined ? 'Target' : 'Cursor target'}</span>
            <span className="mono">
              {drill.target !== undefined ? 'match exactly' : `line ${(drill.cursor?.line ?? 0) + 1}`}
            </span>
          </div>
          <TargetPanel drill={drill} diff={diff} />
        </div>
      </div>

      <div className="toolbar">
        <div className="toolbar__hint">
          {finished ? (
            <span>Solved. Retry to beat your best, or move on.</span>
          ) : (
            <span>The timer starts on your first keystroke. Esc returns to normal mode.</span>
          )}
        </div>
        <button className="btn btn--small" onClick={() => setShowHint((v) => !v)} aria-expanded={showHint}>
          {showHint ? 'Hide hint' : 'Hint'}
        </button>
        <button className="btn btn--small" onClick={retry}>
          Retry
        </button>
        {drillNumber > 1 && (
          <button className="btn btn--small btn--ghost" onClick={onPrev}>
            Previous
          </button>
        )}
        <button className="btn btn--small btn--primary" onClick={onNext}>
          Next drill
        </button>
      </div>

      {showHint && drill.hint && <div className="hint-box">{drill.hint}</div>}

      {result && (
        <div className="solved" role="status" data-testid="solved">
          <div className="solved__main">
            <p className="solved__title">
              {result.outcome.perfect
                ? 'New best time and fewest keys'
                : anyRecord
                  ? 'New personal best'
                  : 'Solved'}
              {result.outcome.timeRecord && <span className="solved__badge">time</span>}
              {result.outcome.keysRecord && <span className="solved__badge">keys</span>}
            </p>
            <p className="solved__detail">
              {formatDuration(result.timeMs)} · {result.keys} keys · par {drill.par}
            </p>
          </div>
          <div className="solved__actions">
            <span className="kbd-note">
              <kbd>Ctrl</kbd>+<kbd>Enter</kbd> retry · <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Enter</kbd> next
            </span>
          </div>
        </div>
      )}

      {drill.note && <p className="note">{drill.note}</p>}
    </div>
  );
}

function TargetPanel({
  drill,
  diff,
}: {
  drill: Drill;
  diff: ReturnType<typeof diffBuffers> | null;
}) {
  if (drill.target !== undefined && diff) {
    return (
      <div className="target-host" data-testid="target">
        {diff.expected.map((line, i) => (
          <div key={i} className={`target-line${line.changed ? ' target-line--changed' : ''}`}>
            <span className="target-line__num">{i + 1}</span>
            <span className="target-line__text">{line.text === '' ? ' ' : line.text}</span>
          </div>
        ))}
      </div>
    );
  }

  const cursor = drill.cursor ?? { line: 0, ch: 0 };
  return (
    <div className="target-host" data-testid="target">
      <p className="target-empty">
        Land the cursor on <code>line {cursor.line + 1}</code>, column{' '}
        <code>{cursor.ch + 1}</code>.
      </p>
      {drill.buffer.replace(/\n$/, '').split('\n').map((line, i) => (
        <div key={i} className={`target-line${i === cursor.line ? ' target-line--changed' : ''}`}>
          <span className="target-line__num">{i + 1}</span>
          <span className="target-line__text">{line === '' ? ' ' : line}</span>
        </div>
      ))}
    </div>
  );
}
