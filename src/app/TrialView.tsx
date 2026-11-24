import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { trialChallenges, type TrialChallenge } from '../content/trialChallenges';
import { attachStatusSlot, createDrillSession, type DrillSession } from '../engine/session';
import { createStopwatch } from '../engine/stopwatch';
import { estimateExpert, type TrialAttempt } from '../engine/trial';
import { formatClock, formatDuration } from '../engine/format';
import { WorkspaceView } from './WorkspaceView';
import { StatusLine } from './StatusLine';

const MODIFIERS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Dead']);
const estimate = estimateExpert(trialChallenges);

interface Props {
  best: number | null;
  today: TrialAttempt | null;
  recent: TrialAttempt[];
  /** Start directly at this challenge. A partial run is not recorded. */
  startIndex?: number;
  onRecord(attempt: TrialAttempt): void;
  onExit(): void;
  onReset(): void;
}

export function TrialView({ best, today, recent, startIndex = 0, onRecord, onExit, onReset }: Props) {
  const fullRun = startIndex <= 0;
  const [phase, setPhase] = useState<'ready' | 'run' | 'done'>(fullRun ? 'ready' : 'run');
  const [index, setIndex] = useState(Math.min(startIndex, trialChallenges.length - 1));
  const [elapsed, setElapsed] = useState(0);
  const [splits, setSplits] = useState<number[]>([]);
  const [finalTime, setFinalTime] = useState<number | null>(null);
  const watchRef = useRef(createStopwatch());
  const startedRef = useRef(false);
  const indexRef = useRef(index);
  const splitsRef = useRef<number[]>([]);
  const phaseRef = useRef(phase);
  indexRef.current = index;
  phaseRef.current = phase;

  const challenge = trialChallenges[index];

  const begin = () => {
    watchRef.current.reset();
    startedRef.current = false;
    splitsRef.current = [];
    setSplits([]);
    setElapsed(0);
    setFinalTime(null);
    setIndex(0);
    setPhase('run');
  };

  const finishChallenge = () => {
    if (phaseRef.current !== 'run') return;
    if (!startedRef.current) {
      startedRef.current = true;
      watchRef.current.start();
    }
    const at = watchRef.current.elapsed();
    const nextSplits = [...splitsRef.current, at];
    splitsRef.current = nextSplits;
    setSplits(nextSplits);
    const current = indexRef.current;
    if (current >= trialChallenges.length - 1) {
      const total = watchRef.current.stop();
      setFinalTime(total);
      setElapsed(total);
      setPhase('done');
      if (fullRun) onRecord({ timeMs: total, splitsMs: nextSplits, completedAt: Date.now() });
      return;
    }
    setIndex(current + 1);
  };

  useLayoutEffect(() => {
    if (phase !== 'run') return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        event.preventDefault();
        return;
      }
      if (MODIFIERS.has(event.key)) return;
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') return;
      if (!startedRef.current) {
        startedRef.current = true;
        watchRef.current.start();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'run') return;
    const timer = window.setInterval(() => {
      const watch = watchRef.current;
      if (!watch.started || watch.stopped) return;
      setElapsed(watch.elapsed());
    }, 100);
    return () => window.clearInterval(timer);
  }, [phase]);

  return (
    <div className="trial">
      <div className="crumbs">
        <button type="button" onClick={onExit}>
          All lessons
        </button>
        <span aria-hidden>/</span>
        <span>Daily trial</span>
      </div>

      {phase === 'ready' && (
        <TrialReady
          best={best}
          today={today}
          recent={recent}
          onStart={begin}
          onReset={onReset}
        />
      )}

      {phase === 'run' && challenge && (
        <div className="trial-run">
          <div className="trial-run__head">
            <div>
              <p className="trial-kicker">
                Challenge {index + 1} / {trialChallenges.length}
              </p>
              <h1>{challenge.title}</h1>
              <p className="drill-goal">{challenge.goal}</p>
            </div>
            <div className="hud__box">
              <span className="hud__label">Time</span>
              <span className={`hud__value${startedRef.current ? ' hud__value--live' : ''}`} data-testid="trial-time">
                {formatClock(elapsed)}
              </span>
            </div>
          </div>
          <ChallengeStage key={challenge.id} challenge={challenge} onSolved={finishChallenge} />
          <SplitRow splits={splits} />
          <div className="toolbar">
            <span className="toolbar__hint">The clock runs until the last challenge. It starts on your first key.</span>
            <button type="button" className="btn btn--small btn--ghost" onClick={() => setPhase('ready')}>
              Give up
            </button>
          </div>
        </div>
      )}

      {phase === 'done' && finalTime !== null && (
        <TrialDone
          timeMs={finalTime}
          splits={splits}
          best={best}
          onAgain={begin}
          onExit={onExit}
        />
      )}
    </div>
  );
}

function ChallengeStage({ challenge, onSolved }: { challenge: TrialChallenge; onSolved(): void }) {
  if (challenge.kind === 'workspace' && challenge.workspace) {
    return (
      <WorkspaceView
        spec={challenge.workspace}
        refreshKey={challenge.id}
        canSolve={() => true}
        onSolved={onSolved}
      />
    );
  }
  return <VimChallenge challenge={challenge} onSolved={onSolved} />;
}

function VimChallenge({ challenge, onSolved }: { challenge: TrialChallenge; onSolved(): void }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [mode, setMode] = useState('normal');
  const [cursor, setCursor] = useState({ line: 0, ch: 0 });
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const onSolvedRef = useRef(onSolved);
  onSolvedRef.current = onSolved;

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const session: DrillSession = createDrillSession(host, {
      buffer: challenge.buffer ?? '',
      target: challenge.target,
      cursorTarget: challenge.cursor,
      cursorStart: challenge.cursorStart,
      checkpoints: challenge.checkpoints,
      cursorStops: challenge.cursorStops,
      requiresWrite: challenge.requiresWrite,
      canSolve: () => true,
      onUpdate: ({ cursor: pos }) => setCursor(pos),
      onSolved: () => onSolvedRef.current(),
    });
    const off = session.onModeChange(setMode);
    setCursor(session.cursor());
    setSlot(attachStatusSlot(host));
    return () => {
      off();
      session.destroy();
      setSlot(null);
    };
  }, [challenge]);

  return (
    <div className="editor-frame">
      <div className="editor-host" ref={hostRef} data-testid="editor" />
      {slot &&
        createPortal(
          <StatusLine mode={mode} fileName="trial.txt" line={cursor.line} ch={cursor.ch} />,
          slot,
        )}
    </div>
  );
}

function SplitRow({ splits }: { splits: number[] }) {
  if (splits.length === 0) return null;
  return (
    <ol className="splits">
      {splits.map((split, index) => {
        const delta = split - (splits[index - 1] ?? 0);
        return (
          <li key={trialChallenges[index]?.id ?? index}>
            <span>{index + 1}</span>
            {formatClock(delta)}
          </li>
        );
      })}
    </ol>
  );
}

function TrialReady({
  best,
  today,
  recent,
  onStart,
  onReset,
}: {
  best: number | null;
  today: TrialAttempt | null;
  recent: TrialAttempt[];
  onStart(): void;
  onReset(): void;
}) {
  return (
    <div className="trial-ready">
      <h1>Daily time trial</h1>
      <p className="drill-goal">
        {trialChallenges.length} challenges, in order: core Vim editing, then the explorer, the
        terminal, and the editor. An expert who reads each goal and types the short solution without
        a mistake takes about {formatDuration(estimate.ms)}. A first run takes longer.
      </p>
      <div className="trial-stats">
        <div className="hud__box">
          <span className="hud__label">Best</span>
          <span className="hud__value" data-testid="trial-best">
            {best === null ? '—' : formatDuration(best)}
          </span>
        </div>
        <div className="hud__box">
          <span className="hud__label">Today</span>
          <span className="hud__value" data-testid="trial-today">
            {today ? formatDuration(today.timeMs) : '—'}
          </span>
        </div>
        <div className="hud__box">
          <span className="hud__label">Expert</span>
          <span className="hud__value">{formatDuration(estimate.ms)}</span>
        </div>
      </div>
      <div className="toolbar">
        <button type="button" className="btn btn--primary" onClick={onStart}>
          Start trial
        </button>
        {recent.length > 0 && (
          <button type="button" className="btn btn--small btn--ghost" onClick={onReset}>
            Clear trial history
          </button>
        )}
      </div>
      {recent.length > 0 && (
        <ol className="trial-history" data-testid="trial-history">
          {recent.map((attempt) => (
            <li key={attempt.completedAt}>
              <span>{new Date(attempt.completedAt).toLocaleDateString()}</span>
              <span>{formatDuration(attempt.timeMs)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function TrialDone({
  timeMs,
  splits,
  best,
  onAgain,
  onExit,
}: {
  timeMs: number;
  splits: number[];
  best: number | null;
  onAgain(): void;
  onExit(): void;
}) {
  const record = best !== null && timeMs <= best;
  return (
    <div className="trial-done" data-testid="trial-done">
      <h1>{record ? 'New best' : 'Trial complete'}</h1>
      <p className="trial-done__time">{formatClock(timeMs)}</p>
      <p className="drill-goal">
        {best === null ? 'Saved on this device.' : `Best is ${formatDuration(Math.min(best, timeMs))}.`}
      </p>
      <SplitRow splits={splits} />
      <div className="toolbar">
        <button type="button" className="btn btn--primary" onClick={onAgain}>
          Run again
        </button>
        <button type="button" className="btn btn--small" onClick={onExit}>
          Back to lessons
        </button>
      </div>
    </div>
  );
}
