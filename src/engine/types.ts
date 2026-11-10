import type { CursorPosition } from './text';

export interface Drill {
  id: string;
  title: string;
  /** What the learner is asked to do, in one line. */
  goal: string;
  /** Initial buffer text. */
  buffer: string;
  /** Target buffer, when the drill is a buffer transformation. */
  target?: string;
  /** Target cursor, when the drill is a navigation drill. */
  cursor?: CursorPosition;
  /** Where the cursor starts, when it matters. Defaults to the very start. */
  cursorStart?: CursorPosition;
  /** Keystroke budget for an efficient solution. */
  par: number;
  hint?: string;
  /** Reference key sequence, replayed by the test suite to prove solvability. */
  solution: string[];
  /** Optional note for a drill whose emulator quirks matter. */
  note?: string;
}

export interface Lesson {
  id: string;
  number: number;
  title: string;
  /** Two or three short sentences: what the command does and why it pays off. */
  summary: string;
  /** The command(s) demonstrated, shown as a compact chip row. */
  commands: string[];
  drills: Drill[];
}

export function drillById(lessons: Lesson[], id: string): { lesson: Lesson; drill: Drill; index: number } | null {
  for (const lesson of lessons) {
    const index = lesson.drills.findIndex((d) => d.id === id);
    if (index !== -1) return { lesson, drill: lesson.drills[index], index };
  }
  return null;
}

export function allDrills(lessons: Lesson[]): Array<{ lesson: Lesson; drill: Drill; index: number }> {
  return lessons.flatMap((lesson) =>
    lesson.drills.map((drill, index) => ({ lesson, drill, index })),
  );
}
