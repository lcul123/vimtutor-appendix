import { useCallback, useEffect, useState } from 'react';
import { placedLessons } from '../content/curriculum';
import { allDrills } from '../engine/types';
import { formatDuration } from '../engine/format';
import { useRecords } from './useRecords';
import { useTrial } from './useTrial';
import { Overview } from './Overview';
import { DrillView } from './DrillView';
import { TrialView } from './TrialView';

const lessons = placedLessons();

interface DrillLocation {
  page: 'drill';
  lessonId: string;
  drillIndex: number;
}

interface TrialLocation {
  page: 'trial';
  startIndex: number;
}

type Location = DrillLocation | TrialLocation | null;

function readLocation(): Location {
  const hash = window.location.hash.replace(/^#\/?/, '');
  if (!hash) return null;
  const [page, indexPart] = hash.split('/');
  if (page === 'trial') {
    const index = Number(indexPart ?? '0');
    return { page: 'trial', startIndex: Number.isFinite(index) ? Math.max(0, Math.trunc(index)) : 0 };
  }
  const index = Number(indexPart ?? '0');
  const lesson = lessons.find((item) => item.id === page);
  if (!lesson) return null;
  const clamped = Number.isFinite(index)
    ? Math.min(Math.max(0, Math.trunc(index)), lesson.drills.length - 1)
    : 0;
  return { page: 'drill', lessonId: lesson.id, drillIndex: clamped };
}

const BLOCKED_WITH_MODIFIER = new Set(['p', 's', 'b', 'd', 'w', 't', 'n']);

export function App() {
  const [location, setLocation] = useState<Location>(() => readLocation());
  const { records, submit, resetAll } = useRecords();
  const trial = useTrial();

  useEffect(() => {
    const onHash = () => setLocation(readLocation());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      // Ctrl-r is Vim's redo. preventDefault before CodeMirror sees the event
      // makes CodeMirror ignore it, so only block the reload when the key is
      // not going to the editor. Vim preventDefaults the redo itself.
      if (key === 'r') {
        const vimRedo = event.ctrlKey && !event.metaKey && !event.shiftKey;
        const inEditor = event.target instanceof Element && Boolean(event.target.closest('.cm-editor'));
        if (vimRedo && inEditor) return;
        event.preventDefault();
        return;
      }
      if (!BLOCKED_WITH_MODIFIER.has(key)) return;
      // Print, save, bookmarks, and new-tab keys. preventDefault works for
      // several of them. Ctrl/Cmd+W, T, and N are still stolen on Chromium;
      // the lessons document Alt+W and the explorer instead.
      event.preventDefault();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  const navigate = useCallback((next: Location) => {
    if (!next) {
      history.pushState(null, '', window.location.pathname + window.location.search);
      setLocation(null);
      return;
    }
    if (next.page === 'trial') {
      window.location.hash = next.startIndex > 0 ? `#/trial/${next.startIndex}` : '#/trial';
      return;
    }
    window.location.hash = `#/${next.lessonId}/${next.drillIndex}`;
  }, []);

  const openDrill = useCallback(
    (lessonId: string, drillIndex: number) => navigate({ page: 'drill', lessonId, drillIndex }),
    [navigate],
  );

  const lesson = location?.page === 'drill' ? lessons.find((item) => item.id === location.lessonId) : undefined;
  const drill = lesson && location?.page === 'drill' ? lesson.drills[location.drillIndex] : undefined;

  const goNext = useCallback(() => {
    if (!lesson || location?.page !== 'drill') return;
    if (location.drillIndex < lesson.drills.length - 1) {
      openDrill(lesson.id, location.drillIndex + 1);
      return;
    }
    const lessonIndex = lessons.findIndex((item) => item.id === lesson.id);
    const nextLesson = lessons[lessonIndex + 1];
    if (nextLesson) openDrill(nextLesson.id, 0);
    else navigate(null);
  }, [lesson, location, openDrill, navigate]);

  const goPrev = useCallback(() => {
    if (!lesson || location?.page !== 'drill') return;
    if (location.drillIndex > 0) {
      openDrill(lesson.id, location.drillIndex - 1);
      return;
    }
    const lessonIndex = lessons.findIndex((item) => item.id === lesson.id);
    const prevLesson = lessons[lessonIndex - 1];
    if (prevLesson) openDrill(prevLesson.id, prevLesson.drills.length - 1);
  }, [lesson, location, openDrill]);

  const solvedTotal = Object.keys(records).length;
  const fastest = Object.values(records).reduce<number | undefined>(
    (best, record) => (best === undefined ? record.bestTimeMs : Math.min(best, record.bestTimeMs)),
    undefined,
  );

  const handleReset = useCallback(() => {
    if (window.confirm('Clear every personal best on this device?')) resetAll();
  }, [resetAll]);

  return (
    <div className="app">
      <Header
        solved={solvedTotal}
        total={allDrills(lessons).length}
        fastest={fastest}
        trialBest={trial.best}
        onHome={() => navigate(null)}
        onTrial={() => navigate({ page: 'trial', startIndex: 0 })}
      />
      <main>
        {location?.page === 'trial' ? (
          <TrialView
            key={location.startIndex}
            best={trial.best}
            today={trial.today}
            recent={trial.recent}
            startIndex={location.startIndex}
            onRecord={trial.record}
            onReset={trial.reset}
            onExit={() => navigate(null)}
          />
        ) : lesson && drill && location?.page === 'drill' ? (
          <DrillView
            key={drill.id}
            lesson={lesson}
            drill={drill}
            drillNumber={location.drillIndex + 1}
            drillCount={lesson.drills.length}
            best={records[drill.id]}
            onSubmit={(result) => submit(drill.id, result)}
            onNext={goNext}
            onPrev={goPrev}
            onOverview={() => navigate(null)}
          />
        ) : (
          <Overview
            lessons={lessons}
            records={records}
            trialBest={trial.best}
            trialToday={trial.today?.timeMs}
            onOpen={openDrill}
            onTrial={() => navigate({ page: 'trial', startIndex: 0 })}
            onResetRecords={handleReset}
          />
        )}
      </main>
    </div>
  );
}

function Header({
  solved,
  total,
  fastest,
  trialBest,
  onHome,
  onTrial,
}: {
  solved: number;
  total: number;
  fastest: number | undefined;
  trialBest: number | null;
  onHome(): void;
  onTrial(): void;
}) {
  return (
    <header className="topbar">
      <button type="button" className="brand" onClick={onHome} aria-label="Vimtutor Appendix home">
        <span className="brand__mark">~/</span>
        <span className="brand__name">vimtutor</span>
      </button>
      <button type="button" className="btn btn--small btn--ghost" onClick={onHome}>
        lessons
      </button>
      <button type="button" className="btn btn--small btn--ghost" onClick={onTrial}>
        trial
      </button>
      <div className="topbar__spacer" />
      <div className="topbar__stat">
        <span>solved</span>
        <strong>
          {solved}/{total}
        </strong>
      </div>
      {fastest !== undefined && (
        <div className="topbar__stat">
          <span>fastest</span>
          <strong>{formatDuration(fastest)}</strong>
        </div>
      )}
      {trialBest !== null && (
        <div className="topbar__stat">
          <span>trial</span>
          <strong>{formatDuration(trialBest)}</strong>
        </div>
      )}
    </header>
  );
}
