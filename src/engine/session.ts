import { EditorSelection, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { history } from '@codemirror/commands';
import { html } from '@codemirror/lang-html';
import { getCM, vim } from '@replit/codemirror-vim';
import { buffersMatch, type CursorPosition } from './text';

export interface DrillSessionOptions {
  buffer: string;
  target?: string;
  cursorTarget?: CursorPosition;
  /** Where the cursor should start. Defaults to the start of the buffer. */
  cursorStart?: CursorPosition;
  /** Called once, the moment the drill reaches its goal. */
  onSolved?: () => void;
}

export interface DrillSession {
  view: EditorView;
  reset(): void;
  destroy(): void;
  text(): string;
  cursor(): CursorPosition;
  isSolved(): boolean;
  /** Subscribe to Vim mode changes; returns an unsubscribe function. */
  onModeChange(listener: (mode: string) => void): () => void;
}

/**
 * CodeMirror extensions shared by the drill editor and the tests.
 *
 * These are deliberately minimal, because each extra CodeMirror feature was
 * found to fight with the Vim emulator:
 *
 *  - `allowMultipleSelections` is required for Ctrl-v. The adapter models a
 *    blockwise selection as several selection ranges; without the facet
 *    CodeMirror keeps only the first one and block edits silently do nothing.
 *  - `html()` makes `cit` / `dit` work. The adapter resolves tags through the
 *    syntax tree, not by scanning for angle brackets.
 *  - `history()` gives Vim's undo its backing store.
 *  - No `defaultKeymap`: it binds Ctrl-a to `cursorLineStart`, which swallows
 *    Vim's Ctrl-a increment. Vim supplies its own normal/insert bindings.
 *  - No manual `Vim.enterVimMode()` call: the `vim()` extension already does
 *    it, and doing it twice breaks multi-character insert recording, so `.`
 *    and macros only replay the last character of an insert.
 */
export function drillExtensions() {
  return [
    EditorState.allowMultipleSelections.of(true),
    EditorView.lineWrapping,
    html(),
    history(),
    vim({ status: true }),
  ];
}

export function cursorOf(state: EditorState): CursorPosition {
  const head = state.selection.main.head;
  const line = state.doc.lineAt(head);
  return { line: line.number - 1, ch: head - line.from };
}

export function isSolvedState(
  state: EditorState,
  target?: string,
  cursorTarget?: CursorPosition,
): boolean {
  if (target !== undefined && !buffersMatch(state.doc.toString(), target)) return false;
  if (cursorTarget) {
    const pos = cursorOf(state);
    return pos.line === cursorTarget.line && pos.ch === cursorTarget.ch;
  }
  return target !== undefined;
}

function offsetOf(state: EditorState, pos: CursorPosition): number {
  const lineIndex = Math.min(Math.max(0, pos.line), state.doc.lines - 1);
  const line = state.doc.line(lineIndex + 1);
  return Math.min(line.from + Math.max(0, pos.ch), line.to);
}

export function createDrillSession(
  parent: HTMLElement,
  options: DrillSessionOptions,
): DrillSession {
  let solved = false;

  const updateListener = EditorView.updateListener.of((update) => {
    if (solved) return;
    if (isSolvedState(update.state, options.target, options.cursorTarget)) {
      solved = true;
      options.onSolved?.();
    }
  });

  const view = new EditorView({
    state: EditorState.create({
      doc: options.buffer,
      extensions: [...drillExtensions(), updateListener],
    }),
    parent,
  });

  if (options.cursorStart) {
    view.dispatch({ selection: EditorSelection.cursor(offsetOf(view.state, options.cursorStart)) });
  }
  view.focus();

  const cm = getCM(view);
  const modeListeners = new Set<(mode: string) => void>();
  const onModeChange = (payload?: { mode?: string }) => {
    const mode = payload?.mode ?? 'normal';
    for (const listener of modeListeners) listener(mode);
  };
  cm?.on?.('vim-mode-change', onModeChange);

  const session: DrillSession = {
    view,
    reset() {
      solved = false;
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: options.buffer },
        selection: EditorSelection.cursor(offsetOf(view.state, options.cursorStart ?? { line: 0, ch: 0 })),
        scrollIntoView: true,
      });
    },
    destroy() {
      cm?.off?.('vim-mode-change', onModeChange);
      modeListeners.clear();
      view.destroy();
      parent.replaceChildren();
    },
    text() {
      return view.state.doc.toString();
    },
    cursor() {
      return cursorOf(view.state);
    },
    isSolved() {
      return solved;
    },
    onModeChange(listener) {
      modeListeners.add(listener);
      return () => modeListeners.delete(listener);
    },
  };

  if (isSolvedState(view.state, options.target, options.cursorTarget)) {
    solved = true;
    options.onSolved?.();
  }

  return session;
}
