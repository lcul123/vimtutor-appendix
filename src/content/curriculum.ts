import type { Lesson } from '../engine/types';
import { lessons as appendixLessons } from './lessons';
import { coreLessons } from './coreLessons';
import { vscodeLessons } from './vscodeLessons';

export interface LessonSection {
  id: 'core' | 'appendix' | 'vscode';
  title: string;
  blurb: string;
  lessons: Lesson[];
}

export const sections: LessonSection[] = [
  {
    id: 'core',
    title: 'Vimtutor',
    blurb: 'The core hour: move, insert, delete, change, undo, yank, search, and save.',
    lessons: coreLessons,
  },
  {
    id: 'appendix',
    title: 'Beyond vimtutor',
    blurb: 'The commands vimtutor leaves out: text objects, the dot command, macros, and the rest.',
    lessons: appendixLessons,
  },
  {
    id: 'vscode',
    title: 'VS Code + Vim',
    blurb: 'The editor, the file explorer, and the integrated terminal, by keyboard only.',
    lessons: vscodeLessons,
  },
];

/** Lessons in curriculum order, numbered for display. */
export function placedLessons(): Lesson[] {
  let number = 0;
  return sections.flatMap((section) =>
    section.lessons.map((lesson) => ({
      ...lesson,
      number: ++number,
      section: section.id,
      sectionTitle: section.title,
    })),
  );
}

export function placedSections(): LessonSection[] {
  const flat = placedLessons();
  let cursor = 0;
  return sections.map((section) => {
    const lessons = flat.slice(cursor, cursor + section.lessons.length);
    cursor += section.lessons.length;
    return { ...section, lessons };
  });
}
