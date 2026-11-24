import { EditorSelection, EditorState } from '@codemirror/state';
import { EditorView, lineNumbers } from '@codemirror/view';
import { history } from '@codemirror/commands';
import { CodeMirror, getCM, vim } from '@replit/codemirror-vim';
import { buffersMatch, normalizeBuffer, type CursorPosition } from './text';

export interface DrillSessionOptions {
  buffer: string;
  target?: string;
  cursorTarget?: CursorPosition;
  /** Where the cursor should start. Defaults to the start of the buffer. */
  cursorStart?: CursorPosition;
  /**
   * Whether the drill is allowed to complete. Checked every time the buffer or
   * cursor reaches the goal, so a state that is reached without the learner
   * doing anything (clicking the target line, for instance) does not count.
   */
  canSolve?: () => boolean;
  /**
   * Buffer states that must be observed in order. While this list is unfinished
   * the drill does not solve, even if `target` already matches an intermediate
   * state (undo, then redo).
   */
  checkpoints?: string[];
  /** Cursor positions that must be visited in order. */
  cursorStops?: CursorPosition[];
  /** Require :w before the drill can solve. */
  requiresWrite?: boolean;
  onWrite?: () => void;
  onUpdate?: (snapshot: { text: string; cursor: CursorPosition }) => void;
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
    lineNumbers(),
    history(),
    vim({ status: true }),
  ];
}

/**
 * :w calls `CodeMirror.commands.save`. One hook fans that out to the editor
 * instance that ran the command, as a `vim-write` signal.
 */
let writeHooked = false;
export function installVimWriteHook(): void {
  if (writeHooked) return;
  writeHooked = true;
  CodeMirror.commands.save = (cm: { signal?: (type: string) => void }) => {
    cm?.signal?.('vim-write');
  };
}

installVimWriteHook();

/** Place a slot immediately above Vim's command-line panel. */
export function attachStatusSlot(host: HTMLElement): HTMLElement {
  const slot = document.createElement('div');
  slot.className = 'statusline-slot';
  const panel = host.querySelector('.cm-vim-panel');
  if (panel?.parentElement) {
    panel.parentElement.insertBefore(slot, panel);
    return slot;
  }
  const editor = host.querySelector('.cm-editor');
  (editor ?? host).appendChild(slot);
  return slot;
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
  let wrote = false;
  let checkpointAt = 0;
  let cursorStopAt = 0;
  let lastNorm = normalizeBuffer(options.buffer);

  const progress = (state: EditorState) => {
    if (options.checkpoints) {
      const norm = normalizeBuffer(state.doc.toString());
      const next = options.checkpoints[checkpointAt];
      if (next !== undefined && norm !== lastNorm && normalizeBuffer(next) === norm) checkpointAt += 1;
      lastNorm = norm;
    }
    if (options.cursorStops) {
      const pos = cursorOf(state);
      const next = options.cursorStops[cursorStopAt];
      if (next && pos.line === next.line && pos.ch === next.ch) cursorStopAt += 1;
    }
  };

  const ready = (state: EditorState) => {
    if (options.checkpoints && checkpointAt < options.checkpoints.length) return false;
    if (options.cursorStops && cursorStopAt < options.cursorStops.length) return false;
    const hasBufferGoal = options.target !== undefined || options.cursorTarget !== undefined;
    if (hasBufferGoal && !isSolvedState(state, options.target, options.cursorTarget)) return false;
    if (options.requiresWrite && !wrote) return false;
    return Boolean(options.checkpoints || options.cursorStops || hasBufferGoal || options.requiresWrite);
  };

  const consider = (state: EditorState) => {
    options.onUpdate?.({ text: state.doc.toString(), cursor: cursorOf(state) });
    if (solved) return;
    if (options.canSolve && !options.canSolve()) return;
    progress(state);
    if (!ready(state)) return;
    solved = true;
    options.onSolved?.();
  };

  const updateListener = EditorView.updateListener.of((update) => {
    if (!update.docChanged && !update.selectionSet) return;
    consider(update.state);
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
  const onWrite = () => {
    wrote = true;
    options.onWrite?.();
    consider(view.state);
  };
  cm?.on?.('vim-write', onWrite);

  const session: DrillSession = {
    view,
    reset() {
      solved = false;
      wrote = false;
      checkpointAt = 0;
      cursorStopAt = 0;
      lastNorm = normalizeBuffer(options.buffer);
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: options.buffer },
        selection: EditorSelection.cursor(offsetOf(view.state, options.cursorStart ?? { line: 0, ch: 0 })),
        scrollIntoView: true,
      });
    },
    destroy() {
      cm?.off?.('vim-mode-change', onModeChange);
      cm?.off?.('vim-write', onWrite);
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

  if (!solved && (!options.canSolve || options.canSolve()) && ready(view.state)) {
    solved = true;
    options.onSolved?.();
  }

  return session;
}
