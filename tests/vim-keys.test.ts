import { beforeEach, describe, expect, it } from 'vitest';
import { EditorView } from '@codemirror/view';
import { CodeMirror, getCM } from '@replit/codemirror-vim';
import { createDrillSession, type DrillSession } from '../src/engine/session';
import { keyFromToken } from '../src/engine/workspace';

let mounted: DrillSession[] = [];

function press(view: EditorView, token: string) {
  const input = keyFromToken(token);
  view.contentDOM.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: input.key,
      ctrlKey: Boolean(input.ctrlKey),
      shiftKey: Boolean(input.shiftKey),
      altKey: Boolean(input.altKey),
      metaKey: Boolean(input.metaKey),
      bubbles: true,
      cancelable: true,
    }),
  );
}

function play(
  buffer: string,
  keys: string[],
  extra: Partial<Parameters<typeof createDrillSession>[1]> = {},
) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const session = createDrillSession(host, { ...extra, buffer });
  mounted.push(session);
  for (const key of keys) press(session.view, key);
  return session;
}

beforeEach(() => {
  for (const session of mounted) session.destroy();
  mounted = [];
  document.body.replaceChildren();
});

describe('normal-mode commands the core lessons use', () => {
  it('deletes a character, a word, and three words', () => {
    expect(play('abXcd', ['l', 'l', 'x']).text()).toBe('abcd');
    expect(play('drop keep', ['d', 'w']).text()).toBe('keep');
    expect(play('one two three four', ['d', '3', 'w']).text()).toBe('four');
  });

  it('replaces, yanks, and deletes a visual selection', () => {
    expect(play('cot', ['l', 'r', 'a']).text()).toBe('cat');
    expect(play('----', ['R', 'a', 'b', 'c', 'd', 'Escape']).text()).toBe('abcd');
    expect(play('keep', ['y', 'y', 'p']).text()).toBe('keep\nkeep');
    expect(play('remove KEEP', ['v', 'e', 'l', 'd']).text()).toBe('KEEP');
  });

  it('undoes and redoes', () => {
    expect(play('one two', ['d', 'w', 'u']).text()).toBe('one two');
    expect(play('one two', ['d', 'w', 'u', 'Control+r']).text()).toBe('two');
  });

  it('solves undo only after the line is deleted and restored', () => {
    let solves = 0;
    const session = play('one two', ['d', 'w'], {
      buffer: 'one two',
      target: 'one two',
      checkpoints: ['two', 'one two'],
      onSolved: () => {
        solves += 1;
      },
    });
    expect(solves).toBe(0);
    press(session.view, 'u');
    expect(solves).toBe(1);
    expect(session.text()).toBe('one two');
  });

  it('does not treat the first matching cursor as the end of a stop list', () => {
    let solves = 0;
    const session = play('xx red\nyy red', [], {
      buffer: 'xx red\nyy red',
      cursorTarget: { line: 0, ch: 3 },
      cursorStops: [
        { line: 1, ch: 3 },
        { line: 0, ch: 3 },
      ],
      onSolved: () => {
        solves += 1;
      },
    });
    session.view.dispatch({ selection: { anchor: 3 } });
    expect(solves).toBe(0);
    session.view.dispatch({ selection: { anchor: session.view.state.doc.line(2).from + 3 } });
    expect(solves).toBe(0);
    session.view.dispatch({ selection: { anchor: 3 } });
    expect(solves).toBe(1);
  });

  it('solves a write drill only after :w once the text matches', () => {
    let solves = 0;
    const session = play('hello', [], {
      buffer: 'hello',
      target: 'hello',
      requiresWrite: true,
      onSolved: () => {
        solves += 1;
      },
    });
    expect(solves).toBe(0);
    const cm = getCM(session.view);
    CodeMirror.commands.save(cm);
    expect(solves).toBe(1);
    expect(session.isSolved()).toBe(true);
  });
});
