import { useMemo, useState } from 'react';
import type { Lesson } from '../engine/types';
import type { DrillRecord, Records } from '../engine/records';
import { formatDuration, formatKeys } from '../engine/format';

interface Props {
  lessons: Lesson[];
  records: Records;
  onOpen(lessonId: string, drillIndex: number): void;
  onResetRecords(): void;
}

export function Overview({ lessons, records, onOpen, onResetRecords }: Props) {
  const [openLesson, setOpenLesson] = useState<string | null>(lessons[0]?.id ?? null);

  const stats = useMemo(() => {
    const drills = lessons.flatMap((l) => l.drills);
    const done = drills.filter((d) => records[d.id]).length;
    const times = Object.values(records).map((r) => r.bestTimeMs);
    const totalRuns = Object.values(records).reduce((sum, r) => sum + r.runs, 0);
    return {
      total: drills.length,
      done,
      totalRuns,
      fastest: times.length ? Math.min(...times) : undefined,
      lessons: lessons.length,
    };
  }, [lessons, records]);

  const nextUnfinished = useMemo(() => {
    for (const lesson of lessons) {
      const index = lesson.drills.findIndex((d) => !records[d.id]);
      if (index !== -1) return { lesson, index };
    }
    return null;
  }, [lessons, records]);

  const start = () => {
    if (nextUnfinished) onOpen(nextUnfinished.lesson.id, nextUnfinished.index);
    else onOpen(lessons[0].id, 0);
  };

  return (
    <div className="overview">
      <section className="hero">
        <div>
          <h1>Vim, the part they leave out.</h1>
          <p>
            vimtutor teaches you to move and edit. It barely touches the commands that save you the
            most time every day: text objects, the dot command, substitutions, block edits and
            macros. Ten lessons, thirty-seven short drills, one tiny Vim in your browser.
          </p>
          <p style={{ marginTop: 12, fontSize: 14, color: 'var(--ink-faint)' }}>
            Learn by doing. Every drill is timed, every keystroke counted, and your bests are kept
            on this device.
          </p>
        </div>
        <aside className="hero__panel">
          <h2>Your progress</h2>
          <div className="hero__rows">
            <div className="hero__row">
              <span>Drills solved</span>
              <span>
                {stats.done} / {stats.total}
              </span>
            </div>
            <div className="hero__row">
              <span>Total runs</span>
              <span>{stats.totalRuns}</span>
            </div>
            <div className="hero__row">
              <span>Fastest solve</span>
              <span>{stats.fastest !== undefined ? formatDuration(stats.fastest) : '—'}</span>
            </div>
            <div className="hero__row">
              <span>Lessons</span>
              <span>{stats.lessons}</span>
            </div>
          </div>
          <div className="hero__actions">
            <button className="btn btn--primary" onClick={start}>
              {stats.done === 0 ? 'Start drilling' : nextUnfinished ? 'Continue' : 'Practise again'}
            </button>
            {stats.done > 0 && (
              <button className="btn btn--ghost btn--small" onClick={onResetRecords}>
                Clear bests
              </button>
            )}
          </div>
        </aside>
      </section>

      <div className="section-label">
        <h2>The curriculum</h2>
        <p>Click a lesson to see its drills and your bests.</p>
      </div>

      <div className="lesson-list">
        {lessons.map((lesson) => {
          const solvedCount = lesson.drills.filter((d) => records[d.id]).length;
          const open = openLesson === lesson.id;
          return (
            <section key={lesson.id} className={`lesson-card${open ? ' lesson-card--open' : ''}`}>
              <button
                className="lesson-card__head"
                onClick={() => setOpenLesson(open ? null : lesson.id)}
                aria-expanded={open}
              >
                <span className="lesson-card__num">{String(lesson.number).padStart(2, '0')}</span>
                <span className="lesson-card__body">
                  <span className="lesson-card__title" style={{ display: 'block' }}>
                    {lesson.title}
                  </span>
                  <p className="lesson-card__summary">{lesson.summary}</p>
                  <span className="chips">
                    {lesson.commands.map((c) => (
                      <span className="chip" key={c}>
                        {c}
                      </span>
                    ))}
                  </span>
                </span>
                <span className="lesson-card__meta">
                  <span className="progress-dots" aria-label={`${solvedCount} of ${lesson.drills.length} solved`}>
                    {lesson.drills.map((d) => (
                      <span key={d.id} className={`dot${records[d.id] ? ' dot--done' : ''}`} />
                    ))}
                  </span>
                  <span className="lesson-card__chev" aria-hidden>
                    ▶
                  </span>
                </span>
              </button>
              {open && (
                <div className="drill-table">
                  <div className="drill-row drill-row--head" aria-hidden>
                    <span>Drill</span>
                    <span>Best</span>
                    <span>Pars</span>
                    <span />
                  </div>
                  {lesson.drills.map((drill, index) => (
                    <DrillRow
                      key={drill.id}
                      drill={drill}
                      record={records[drill.id]}
                      onOpen={() => onOpen(lesson.id, index)}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function DrillRow({
  drill,
  record,
  onOpen,
}: {
  drill: { id: string; title: string; goal: string; par: number };
  record?: DrillRecord;
  onOpen(): void;
}) {
  return (
    <div className="drill-row">
      <button
        onClick={onOpen}
        style={{
          background: 'none',
          border: 0,
          padding: 0,
          textAlign: 'left',
          cursor: 'pointer',
          font: 'inherit',
        }}
      >
        <span style={{ fontWeight: 550 }}>{drill.title}</span>
        {record && <span className="record-badge">solved</span>}
        <span className="drill-row__goal" style={{ display: 'block' }}>
          {drill.goal}
        </span>
      </button>
      <span className={`drill-row__best${record ? '' : ' drill-row__best--empty'}`}>
        {record ? formatDuration(record.bestTimeMs) : '—'}
        <br />
        <span style={{ color: 'var(--ink-faint)' }}>{record ? formatKeys(record.bestKeys) : 'not yet'}</span>
      </span>
      <span className="drill-row__best" style={{ color: 'var(--ink-faint)' }}>
        {drill.par}
      </span>
      <button className="btn btn--small" onClick={onOpen}>
        Open
      </button>
    </div>
  );
}
