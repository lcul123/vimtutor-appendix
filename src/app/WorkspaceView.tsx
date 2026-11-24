import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { attachStatusSlot, createDrillSession, type DrillSession } from '../engine/session';
import { detectPlatform } from '../engine/platform';
import {
  applyKey,
  createWorkspace,
  explorerRows,
  goalMet,
  paletteMatches,
  promptLabel,
  quickOpenMatches,
  withEditorBuffer,
  type WorkspaceSpec,
  type WorkspaceState,
  type Zone,
} from '../engine/workspace';
import type { CursorPosition } from '../engine/text';
import { StatusLine } from './StatusLine';

interface Props {
  spec: WorkspaceSpec;
  /** Changes when the drill should remount, for example a retry. */
  refreshKey: string;
  canSolve(): boolean;
  onSolved(): void;
}

export function WorkspaceView({ spec, refreshKey, canSolve, onSolved }: Props) {
  const platform = useMemo(() => detectPlatform(), []);
  const specRef = useRef(spec);
  specRef.current = spec;
  const canSolveRef = useRef(canSolve);
  canSolveRef.current = canSolve;
  const onSolvedRef = useRef(onSolved);
  onSolvedRef.current = onSolved;

  const [state, setState] = useState(() => createWorkspace(spec));
  const stateRef = useRef(state);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const sessionRef = useRef<DrillSession | null>(null);
  const explorerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<HTMLInputElement | null>(null);
  const quickRef = useRef<HTMLInputElement | null>(null);
  const paletteRef = useRef<HTMLInputElement | null>(null);
  const promptRef = useRef<HTMLInputElement | null>(null);
  const solvedRef = useRef(false);
  const [mode, setMode] = useState('normal');
  const [cursor, setCursor] = useState<CursorPosition>({ line: 0, ch: 0 });
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  const commit = (next: WorkspaceState) => {
    stateRef.current = next;
    setState(next);
  };

  const maybeSolve = (next: WorkspaceState, pos: CursorPosition, fromKey: boolean) => {
    if (solvedRef.current) return;
    if (!fromKey && !canSolveRef.current()) return;
    if (!goalMet(next, specRef.current.goal, pos)) return;
    solvedRef.current = true;
    onSolvedRef.current();
  };

  const focusZone = (zone: Zone, prompt: WorkspaceState['prompt']) => {
    if (prompt) return;
    if (zone === 'terminal') termRef.current?.focus();
    else if (zone === 'explorer') explorerRef.current?.focus();
    else if (zone === 'quickOpen') quickRef.current?.focus();
    else if (zone === 'palette') paletteRef.current?.focus();
    else sessionRef.current?.view.focus();
  };

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const initial = createWorkspace(specRef.current);
    solvedRef.current = false;
    commit(initial);
    const text = initial.activePath ? (initial.buffers[initial.activePath] ?? '') : '';
    const session = createDrillSession(host, {
      buffer: text,
      onUpdate: ({ text: next, cursor: pos }) => {
        setCursor(pos);
        const merged = withEditorBuffer(stateRef.current, next);
        if (merged !== stateRef.current) commit(merged);
        maybeSolve(merged, pos, false);
      },
    });
    sessionRef.current = session;
    setCursor(session.cursor());
    const offMode = session.onModeChange(setMode);
    setSlot(attachStatusSlot(host));
    session.view.focus();
    return () => {
      offMode();
      session.destroy();
      sessionRef.current = null;
      setSlot(null);
    };
    // refreshKey is the remount signal; the spec is read from a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  useEffect(() => {
    const session = sessionRef.current;
    if (!session) return;
    const desired = state.activePath ? (state.buffers[state.activePath] ?? '') : '';
    if (session.text() === desired) return;
    session.view.dispatch({
      changes: { from: 0, to: session.view.state.doc.length, insert: desired },
      selection: { anchor: 0 },
    });
  }, [state.activePath]);

  useEffect(() => {
    if (state.prompt) promptRef.current?.focus();
    else focusZone(state.focus, null);
  }, [state.focus, state.prompt]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        event.preventDefault();
        return;
      }
      if (solvedRef.current) return;
      const result = applyKey(stateRef.current, event, platform);
      if (!result.handled) return;
      event.preventDefault();
      event.stopPropagation();
      commit(result.state);
      focusZone(result.state.focus, result.state.prompt);
      maybeSolve(result.state, sessionRef.current?.cursor() ?? { line: 0, ch: 0 }, true);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [platform]);

  const rows = explorerRows(state);
  const files = quickOpenMatches(state);
  const commands = paletteMatches(state);
  const fileName = state.activePath ?? '[No Name]';

  const selectRow = (index: number, open: boolean) => {
    const row = rows[index];
    if (!row) return;
    if (!open) {
      commit({ ...stateRef.current, explorerIndex: index, focus: 'explorer' });
      return;
    }
    if (row.kind === 'dir') {
      const expanded = row.expanded
        ? state.expanded.filter((path) => path !== row.path)
        : [...state.expanded, row.path];
      commit({ ...stateRef.current, explorerIndex: index, expanded, focus: 'explorer' });
      return;
    }
    const openTabs = state.openTabs.includes(row.path) ? state.openTabs : [...state.openTabs, row.path];
    commit({
      ...stateRef.current,
      explorerIndex: index,
      openTabs,
      activePath: row.path,
      focus: 'editor',
      openedVia: 'explorer',
    });
  };

  return (
    <div className={`vscode${state.focus === 'explorer' ? ' vscode--explorer' : ''}`} data-testid="vscode">
      <div className="vscode__body">
        {state.sidebarVisible && (
          <aside className="explorer" ref={explorerRef} tabIndex={-1} data-testid="explorer" aria-label="Explorer">
            <div className="explorer__title">{state.projectName}</div>
            {rows.map((row, index) => (
              <button
                key={row.path}
                type="button"
                className={`explorer__row${index === state.explorerIndex ? ' explorer__row--active' : ''}`}
                style={{ paddingLeft: 8 + row.depth * 14 }}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectRow(index, true)}
              >
                <span className="explorer__mark" aria-hidden>
                  {row.kind === 'dir' ? (row.expanded ? '▾' : '▸') : ' '}
                </span>
                {row.name}
              </button>
            ))}
            {state.prompt && (
              <label className="explorer__prompt">
                {state.prompt.mode === 'create' ? 'new file' : 'rename'}
                <input
                  ref={promptRef}
                  data-testid="explorer-prompt"
                  aria-label={state.prompt.mode === 'create' ? 'New file name' : 'New name'}
                  value={state.prompt.value}
                  onChange={() => {}}
                  placeholder={state.prompt.mode === 'rename' ? 'new name' : 'filename'}
                />
              </label>
            )}
            {state.message && <p className="explorer__message">{state.message}</p>}
          </aside>
        )}
        <div className="vscode__main">
          <div className="tabs" role="tablist" aria-label="Open editors" data-testid="tabs">
            {state.openTabs.map((path) => (
              <button
                key={path}
                type="button"
                role="tab"
                aria-selected={path === state.activePath}
                className={`tab${path === state.activePath ? ' tab--active' : ''}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() =>
                  commit({ ...stateRef.current, activePath: path, focus: 'editor', openedVia: 'tab' })
                }
              >
                {path.split('/').pop()}
              </button>
            ))}
            {state.openTabs.length === 0 && <span className="tab tab--empty">no editor open</span>}
          </div>
          <div className="editor-host" ref={hostRef} data-testid="editor" />
          {state.terminalVisible && (
            <section className="terminal" data-testid="terminal" aria-label="Terminal">
              <div className="terminal__bar">terminal</div>
              <pre className="terminal__out">{state.terminalLines.join('\n')}</pre>
              <label className="terminal__line">
                <span>{promptLabel(state.cwd)}</span>
                <input
                  ref={termRef}
                  data-testid="terminal-input"
                  aria-label="Terminal input"
                  value={state.terminalDraft}
                  onChange={() => {}}
                  spellCheck={false}
                />
              </label>
            </section>
          )}
        </div>
      </div>
      {state.focus === 'quickOpen' && (
        <div className="palette" data-testid="quick-open" role="dialog" aria-label="Quick open">
          <input
            ref={quickRef}
            aria-label="File name"
            value={state.quickQuery}
            onChange={() => {}}
            placeholder="Go to file"
            spellCheck={false}
          />
          <ul>
            {files.map((path, index) => (
              <li key={path} className={index === state.quickIndex ? 'palette__active' : ''}>
                {path}
              </li>
            ))}
            {files.length === 0 && <li className="palette__empty">no matching file</li>}
          </ul>
        </div>
      )}
      {state.focus === 'palette' && (
        <div className="palette" data-testid="command-palette" role="dialog" aria-label="Command palette">
          <input
            ref={paletteRef}
            aria-label="Command"
            value={state.paletteQuery}
            onChange={() => {}}
            placeholder="Type a command"
            spellCheck={false}
          />
          <ul>
            {commands.map((command, index) => (
              <li key={command.id} className={index === state.paletteIndex ? 'palette__active' : ''}>
                {command.title}
              </li>
            ))}
            {commands.length === 0 && <li className="palette__empty">no matching command</li>}
          </ul>
        </div>
      )}
      {slot &&
        createPortal(
          <StatusLine mode={mode} fileName={fileName} line={cursor.line} ch={cursor.ch} />,
          slot,
        )}
    </div>
  );
}
