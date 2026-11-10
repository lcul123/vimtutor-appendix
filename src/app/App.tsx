import { useCallback, useEffect, useState } from 'react';
import { lessons } from '../content/lessons';
import { allDrills } from '../engine/types';
import { useRecords } from './useRecords';
import { Overview } from './Overview';
import { DrillView } from './DrillView';
import { formatDuration } from '../engine/format';

interface Location {
  lessonId: string;
  drillIndex: number;
}

function readLocation(): Location | null {
  const hash = window.location.hash.replace(/^#\/?/, '');
  if (!hash) return null;
  const [lessonId, indexPart] = hash.split('/');
  const index = Number(indexPart ?? '0');
  const lesson = lessons.find((l) => l.id === lessonId);
  if (!lesson) return null;
  const clamped = Number.isFinite(index) ? Math.min(Math.max(0, Math.trunc(index)), lesson.drills.length - 1) : 0;
  return { lessonId: lesson.id, drillIndex: clamped };
}

export function App() {
  const [location, setLocation] = useState<Location | null>(() => readLocation());
  const { records, submit, resetAll } = useRecords();

  useEffect(() => {
    const onHash = () => setLocation(readLocation());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = useCallback((next: Location | null) => {
    if (!next) {
      history.pushState(null, '', window.location.pathname);
      setLocation(null);
      return;
    }
    window.location.hash = `#/${next.lessonId}/${next.drillIndex}`;
  }, []);

  const openDrill = useCallback(
    (lessonId: string, drillIndex: number) => navigate({ lessonId, drillIndex }),
    [navigate],
  );

  const lesson = location ? lessons.find((l) => l.id === location.lessonId) : undefined;
  const drill = lesson && location ? lesson.drills[location.drillIndex] : undefined;

  const goNext = useCallback(() => {
    if (!lesson || !location) return;
    if (location.drillIndex < lesson.drills.length - 1) {
      openDrill(lesson.id, location.drillIndex + 1);
      return;
    }
    const lessonIndex = lessons.findIndex((l) => l.id === lesson.id);
    const nextLesson = lessons[lessonIndex + 1];
    if (nextLesson) openDrill(nextLesson.id, 0);
    else navigate(null);
  }, [lesson, location, openDrill, navigate]);

  const goPrev = useCallback(() => {
    if (!lesson || !location) return;
    if (location.drillIndex > 0) {
      openDrill(lesson.id, location.drillIndex - 1);
      return;
    }
    const lessonIndex = lessons.findIndex((l) => l.id === lesson.id);
    const prevLesson = lessons[lessonIndex - 1];
    if (prevLesson) openDrill(prevLesson.id, prevLesson.drills.length - 1);
  }, [lesson, location, openDrill, navigate]);

  const solvedTotal = Object.keys(records).length;
  const fastest = Object.values(records).reduce<number | undefined>(
    (best, r) => (best === undefined ? r.bestTimeMs : Math.min(best, r.bestTimeMs)),
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
        onHome={() => navigate(null)}
      />
      <main>
        {lesson && drill && location ? (
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
            onOpen={openDrill}
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
  onHome,
}: {
  solved: number;
  total: number;
  fastest: number | undefined;
  onHome(): void;
}) {
  return (
    <header className="topbar">
      <button className="brand" onClick={onHome} aria-label="Vimtutor Appendix home">
        <span className="brand__mark">~$</span>
        <span>
          <span className="brand__name">Vimtutor Appendix</span>{' '}
          <span className="brand__sub">the 20% vimtutor skips</span>
        </span>
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
      <button className="btn btn--small" onClick={onHome}>
        Lessons
      </button>
    </header>
  );
}
