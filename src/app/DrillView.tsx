import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { attachStatusSlot, createDrillSession, type DrillSession } from '../engine/session';
import { createStopwatch } from '../engine/stopwatch';
import { diffBuffers } from '../engine/text';
import { formatDuration } from '../engine/format';
import { detectPlatform } from '../engine/platform';
import { reservedShortcuts, shortcutLabels } from '../engine/workspace';
import type { Drill, Lesson } from '../engine/types';
import type { RecordOutcome, DrillRecord } from '../engine/records';
import { StatusLine } from './StatusLine';
import { WorkspaceView } from './WorkspaceView';

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
  const watchRef = useRef(createStopwatch());
  const keyCountRef = useRef(0);
  const finishedRef = useRef(false);
  const [state, setState] = useState({ keys: 0, elapsed: 0 });
  const [result, setResult] = useState<{
    timeMs: number;
    keys: number;
    outcome: RecordOutcome;
  } | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [mode, setMode] = useState('normal');
  const [cursor, setCursor] = useState({ line: 0, ch: 0 });
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [snapshot, setSnapshot] = useState(drill.buffer);
  const [attempt, setAttempt] = useState(0);
  const platform = detectPlatform();

  const finished = result !== null;

  const submitRef = useRef(onSubmit);
  submitRef.current = onSubmit;

  const finish = (text?: string) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const timeMs = watchRef.current.stop();
    const usedKeys = keyCountRef.current;
    if (text !== undefined) setSnapshot(text);
    const outcome = submitRef.current({ timeMs, keys: usedKeys });
    setResult({ timeMs, keys: usedKeys, outcome });
  };

  useLayoutEffect(() => {
    setResult(null);
    setShowHint(false);
    setMode('normal');
    setSnapshot(drill.buffer);
    finishedRef.current = false;
    keyCountRef.current = 0;
    watchRef.current.reset();
    setState({ keys: 0, elapsed: 0 });
    setSlot(null);

    if (drill.workspace) return;

    const host = hostRef.current;
    if (!host) return;

    const session: DrillSession = createDrillSession(host, {
      buffer: drill.buffer,
      target: drill.target,
      cursorTarget: drill.cursor,
      cursorStart: drill.cursorStart,
      checkpoints: drill.checkpoints,
      cursorStops: drill.cursorStops,
      requiresWrite: drill.requiresWrite,
      canSolve: () => keyCountRef.current > 0,
      onUpdate: ({ cursor: pos }) => setCursor(pos),
      onSolved: () => finish(session.text()),
    });
    setCursor(session.cursor());
    const offMode = session.onModeChange((next) => setMode(next));
    setSlot(attachStatusSlot(host));

    return () => {
      offMode();
      session.destroy();
      setSlot(null);
    };
    // finish is stable enough for a remount: the effect re-reads refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drill, attempt]);

  useLayoutEffect(() => {
    if (finished) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        event.preventDefault();
        return;
      }
      if (MODIFIERS.has(event.key)) return;
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') return;
      const watch = watchRef.current;
      if (!watch.started) watch.start();
      keyCountRef.current += 1;
      setState((current) => ({ ...current, keys: keyCountRef.current }));
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [drill.id, attempt, finished]);

  useEffect(() => {
    if (finished) return;
    const timer = window.setInterval(() => {
      const watch = watchRef.current;
      if (!watch.started || watch.stopped) return;
      const elapsed = watch.elapsed();
      setState((current) => (current.elapsed === elapsed ? current : { ...current, elapsed }));
    }, 100);
    return () => window.clearInterval(timer);
  }, [drill.id, attempt, finished]);

  const retry = () => setAttempt((n) => n + 1);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key !== 'Enter') return;
      event.preventDefault();
      event.stopPropagation();
      if (event.shiftKey) onNext();
      else retry();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  const keepFocus = (event: React.MouseEvent) => event.preventDefault();

  const diff = drill.target !== undefined ? diffBuffers(snapshot, drill.target) : null;
  const bestLabel = best ? `${formatDuration(best.bestTimeMs)} · ${best.bestKeys} keys` : 'none yet';
  const anyRecord = result ? result.outcome.timeRecord || result.outcome.keysRecord : false;
  const labels = shortcutLabels(platform);
  const fileName = drill.workspace?.activePath ?? 'buffer.txt';

  return (
    <div className="drill-view">
      <div className="crumbs">
        <button type="button" onClick={onOverview}>
          All lessons
        </button>
        <span aria-hidden>/</span>
        <span>
          {lesson.sectionTitle ? `${lesson.sectionTitle} · ` : ''}Lesson {lesson.number} · {lesson.title}
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
              className={`hud__value${state.elapsed > 0 && !finished ? ' hud__value--live' : ''}`}
              data-testid="hud-time"
            >
              {formatDuration(finished ? result.timeMs : state.elapsed)}
            </span>
          </div>
          <div className="hud__box">
            <span className="hud__label">Keys</span>
            <span className="hud__value" data-testid="hud-keys">
              {finished ? result.keys : state.keys}
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

      {drill.workspace ? (
        <WorkspaceView
          spec={drill.workspace}
          refreshKey={`${drill.id}:${attempt}`}
          canSolve={() => keyCountRef.current > 0}
          onSolved={() => finish()}
        />
      ) : (
        <div className="panels">
          <div className="panel">
            <div className="panel__head">
              <span>{fileName}</span>
              <span className="mono">vim</span>
            </div>
            <div className="editor-frame">
              <div className="editor-host" ref={hostRef} data-testid="editor" />
              {slot &&
                createPortal(
                  <StatusLine mode={mode} fileName={fileName} line={cursor.line} ch={cursor.ch} />,
                  slot,
                )}
            </div>
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
      )}

      <div className="toolbar">
        <div className="toolbar__hint">
          {finished ? (
            <span>Solved. Retry to beat your best, or move on.</span>
          ) : (
            <span>The timer starts on your first keystroke. Esc returns to normal mode.</span>
          )}
        </div>
        <button
          type="button"
          className="btn btn--small"
          onMouseDown={keepFocus}
          onClick={() => setShowHint((value) => !value)}
          aria-expanded={showHint}
        >
          {showHint ? 'Hide hint' : 'Hint'}
        </button>
        <button type="button" className="btn btn--small" onMouseDown={keepFocus} onClick={retry}>
          Retry
        </button>
        {drillNumber > 1 && (
          <button type="button" className="btn btn--small btn--ghost" onMouseDown={keepFocus} onClick={onPrev}>
            Previous
          </button>
        )}
        <button type="button" className="btn btn--small btn--primary" onMouseDown={keepFocus} onClick={onNext}>
          Next drill
        </button>
      </div>

      {showHint && drill.hint && <div className="hint-box">{drill.hint}</div>}

      {lesson.detail && <p className="note">{lesson.detail}</p>}

      {drill.workspace && (
        <p className="note shortcut-note">
          {labels.toggleSidebar} sidebar · {labels.focusExplorer} explorer · {labels.toggleTerminal}{' '}
          terminal · {labels.focusEditor} editor · {labels.quickOpen} quick open · {labels.palette}{' '}
          palette · {labels.nextTab}/{labels.prevTab} tabs · {labels.closeTab} close tab
        </p>
      )}

      {drill.workspace && (
        <ul className="reserved">
          {reservedShortcuts(platform).map((item) => (
            <li key={item.binding}>
              <kbd>{item.binding}</kbd> {item.reason}. Instead, {item.alternate}.
            </li>
          ))}
        </ul>
      )}

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
        {diff.expected.map((line, index) => (
          <div key={index} className={`target-line${line.changed ? ' target-line--changed' : ''}`}>
            <span className="target-line__num">{index + 1}</span>
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
        Land the cursor on <code>line {cursor.line + 1}</code>, column <code>{cursor.ch + 1}</code>.
      </p>
      {drill.buffer.replace(/\n$/, '').split('\n').map((line, index) => (
        <div key={index} className={`target-line${index === cursor.line ? ' target-line--changed' : ''}`}>
          <span className="target-line__num">{index + 1}</span>
          <span className="target-line__text">{line === '' ? ' ' : line}</span>
        </div>
      ))}
    </div>
  );
}
