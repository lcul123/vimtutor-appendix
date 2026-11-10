import { beforeEach, describe, expect, it } from 'vitest';
import { EditorSelection } from '@codemirror/state';
import {
  createDrillSession,
  cursorOf,
  isSolvedState,
  type DrillSession,
} from '../src/engine/session';
import { buffersMatch } from '../src/engine/text';
import { lessons } from '../src/content/lessons';
import { drillById, allDrills } from '../src/engine/types';

let mounted: DrillSession[] = [];

function mount(buffer: string, opts: { target?: string; cursorTarget?: { line: number; ch: number } } = {}) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const session = createDrillSession(host, { buffer, ...opts });
  mounted.push(session);
  return session;
}

beforeEach(() => {
  for (const s of mounted) s.destroy();
  mounted = [];
  document.body.replaceChildren();
});

describe('lesson catalogue', () => {
  it('has 8-10 lessons, numbered consecutively', () => {
    expect(lessons.length).toBeGreaterThanOrEqual(8);
    expect(lessons.length).toBeLessThanOrEqual(10);
    lessons.forEach((lesson, i) => expect(lesson.number).toBe(i + 1));
  });

  it('gives every lesson 2-4 drills and a short summary', () => {
    for (const lesson of lessons) {
      expect(lesson.drills.length).toBeGreaterThanOrEqual(2);
      expect(lesson.drills.length).toBeLessThanOrEqual(4);
      expect(lesson.summary.length).toBeLessThan(260);
      expect(lesson.commands.length).toBeGreaterThan(0);
    }
  });

  it('keeps lesson and drill ids unique', () => {
    const lessonIds = lessons.map((l) => l.id);
    const drillIds = lessons.flatMap((l) => l.drills.map((d) => d.id));
    expect(new Set(lessonIds).size).toBe(lessonIds.length);
    expect(new Set(drillIds).size).toBe(drillIds.length);
  });

  it('gives every drill a goal, a target, a hint and a reference solution', () => {
    for (const lesson of lessons) {
      for (const drill of lesson.drills) {
        expect(Boolean(drill.target) || Boolean(drill.cursor), `${drill.id} needs a target`).toBe(true);
        expect(drill.goal.length, `${drill.id} goal`).toBeGreaterThan(10);
        expect(drill.hint, `${drill.id} hint`).toBeTruthy();
        expect(drill.solution.length, `${drill.id} solution`).toBeGreaterThan(0);
      }
    }
  });

  it('sets par to an honest keystroke budget', () => {
    for (const lesson of lessons) {
      for (const drill of lesson.drills) {
        // Par is the keystroke count of the reference solution, so it is an
        // honest budget: never unreachable, and tight enough to mean something.
        expect(drill.par, `${drill.id} par vs solution length`).toBeGreaterThanOrEqual(
          drill.solution.length,
        );
        expect(drill.par, `${drill.id} par is sane`).toBeLessThanOrEqual(drill.solution.length + 3);
      }
    }
  });

  it('never starts a drill already solved', () => {
    for (const { drill } of allDrills(lessons)) {
      expect(buffersMatch(drill.buffer, drill.target ?? '\u0000'), `${drill.id}`).toBe(false);
    }
  });

  it('uses the emulator-safe subset documented in the README', () => {
    const banned = new Set(['&', 'g&']);
    for (const { drill } of allDrills(lessons)) {
      for (const key of drill.solution) {
        expect(banned.has(key), `${drill.id} uses unsupported ${key}`).toBe(false);
      }
    }
  });

  it('looks drills up by id', () => {
    const found = drillById(lessons, 'macros' in {} ? '' : lessons[0].drills[0].id);
    expect(found?.lesson.id).toBe(lessons[0].id);
    expect(drillById(lessons, 'nope')).toBeNull();
  });
});

describe('drill session', () => {
  it('mounts exactly one CodeMirror instance into the host', () => {
    const session = mount('hello');
    expect(document.querySelectorAll('.cm-editor')).toHaveLength(1);
    expect(session.text()).toBe('hello');
  });

  it('enables multiple selections so Ctrl-v can work', () => {
    // The behavioural check: the state must keep more than one selection range.
    const session = mount('aa\nbb');
    session.view.dispatch({
      selection: EditorSelection.create([
        EditorSelection.range(0, 1),
        EditorSelection.range(3, 4),
      ]),
    });
    expect(session.view.state.selection.ranges).toHaveLength(2);
  });

  it('reports the cursor as line/ch', () => {
    const session = mount('abc\ndef');
    expect(session.cursor()).toEqual({ line: 0, ch: 0 });
    session.view.dispatch({ selection: EditorSelection.cursor(5) });
    expect(session.cursor()).toEqual({ line: 1, ch: 1 });
  });

  it('honours cursorStart', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const session = createDrillSession(host, {
      buffer: 'a\nb\nc\nd',
      cursorStart: { line: 2, ch: 0 },
    });
    mounted.push(session);
    expect(session.cursor()).toEqual({ line: 2, ch: 0 });
  });

  it('solves on a matching buffer and fires onSolved once', () => {
    let calls = 0;
    const host = document.createElement('div');
    document.body.appendChild(host);
    const solving = createDrillSession(host, {
      buffer: 'abd',
      target: 'abc',
      onSolved: () => {
        calls += 1;
      },
    });
    mounted.push(solving);

    expect(calls).toBe(0);
    solving.view.dispatch({ changes: { from: 2, to: 3, insert: 'c' } });
    expect(calls).toBe(1);
    expect(solving.isSolved()).toBe(true);

    // Further edits must not re-fire.
    solving.view.dispatch({ changes: { from: 3, insert: 'x' } });
    expect(calls).toBe(1);
  });

  it('solves on a cursor target without touching the buffer', () => {
    let calls = 0;
    const host = document.createElement('div');
    document.body.appendChild(host);
    const session = createDrillSession(host, {
      buffer: 'abcdef',
      cursorTarget: { line: 0, ch: 3 },
      onSolved: () => {
        calls += 1;
      },
    });
    mounted.push(session);
    expect(calls).toBe(0);
    session.view.dispatch({ selection: EditorSelection.cursor(3) });
    expect(calls).toBe(1);
    expect(cursorOf(session.view.state)).toEqual({ line: 0, ch: 3 });
  });

  it('resets the buffer and the solved flag', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const session = createDrillSession(host, { buffer: 'one', target: 'two' });
    mounted.push(session);
    session.view.dispatch({ changes: { from: 0, to: 3, insert: 'two' } });
    expect(session.isSolved()).toBe(true);
    session.reset();
    expect(session.text()).toBe('one');
    expect(session.isSolved()).toBe(false);
  });

  it('ignores trailing-newline differences when matching', () => {
    expect(isSolvedState(mount('abc').view.state, 'abc\n')).toBe(true);
    expect(isSolvedState(mount('abc ').view.state, 'abc')).toBe(false);
  });

  it('requires the cursor target to match as well as the buffer', () => {
    const session = mount('abc', { target: 'abc', cursorTarget: { line: 0, ch: 2 } });
    // Buffer already matches, but the cursor is at 0, so it is not solved.
    expect(session.isSolved()).toBe(false);
  });

  it('does not solve when canSolve says the learner has done nothing', () => {
    let typed = false;
    let solves = 0;
    const host = document.createElement('div');
    document.body.appendChild(host);
    const session = createDrillSession(host, {
      buffer: 'abc',
      cursorTarget: { line: 0, ch: 2 },
      canSolve: () => typed,
      onSolved: () => {
        solves += 1;
      },
    });
    mounted.push(session);

    // Clicking into the target position is not a solve: no key was pressed.
    session.view.dispatch({ selection: EditorSelection.cursor(2) });
    expect(solves).toBe(0);
    expect(session.isSolved()).toBe(false);

    // Once the learner has typed, the same position does count.
    typed = true;
    session.view.dispatch({ selection: EditorSelection.cursor(0) });
    session.view.dispatch({ selection: EditorSelection.cursor(2) });
    expect(solves).toBe(1);
    expect(session.isSolved()).toBe(true);
  });
});
