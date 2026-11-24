import { buffersMatch, type CursorPosition } from './text';
import { modName, type Platform } from './platform';

export type Zone = 'explorer' | 'editor' | 'terminal' | 'quickOpen' | 'palette';

export interface FsNode {
  name: string;
  kind: 'file' | 'dir';
  content?: string;
  children?: FsNode[];
}

export interface ExplorerPrompt {
  mode: 'create' | 'rename';
  /** Directory the new file is created in, or the parent of the renamed node. */
  dir: string;
  /** Existing path when renaming. */
  targetPath?: string;
  value: string;
}

export interface WorkspaceInit {
  projectName?: string;
  children: FsNode[];
  expanded?: string[];
  openTabs?: string[];
  activePath?: string | null;
  cwd?: string;
  sidebarVisible?: boolean;
  terminalVisible?: boolean;
  focus?: Zone;
  explorerIndex?: number;
}

export interface WorkspaceState {
  projectName: string;
  children: FsNode[];
  expanded: string[];
  explorerIndex: number;
  openTabs: string[];
  activePath: string | null;
  buffers: Record<string, string>;
  cwd: string;
  sidebarVisible: boolean;
  terminalVisible: boolean;
  focus: Zone;
  focusReturn: Zone;
  terminalLines: string[];
  terminalDraft: string;
  lastCommand: string | null;
  quickQuery: string;
  quickIndex: number;
  paletteQuery: string;
  paletteIndex: number;
  prompt: ExplorerPrompt | null;
  written: string[];
  openedVia: 'explorer' | 'quickOpen' | 'tab' | 'init';
  message: string;
}

export interface WorkspaceGoal {
  focus?: Zone;
  sidebarVisible?: boolean;
  terminalVisible?: boolean;
  activePath?: string | null;
  cwd?: string;
  lastCommand?: string;
  /** Substring of the terminal transcript. */
  terminalHas?: string;
  openedVia?: WorkspaceState['openedVia'];
  fileExists?: string;
  fileMissing?: string;
  /** Exact tab list, in order. */
  openTabs?: string[];
  /** `true` means any successful :w; a string means that path was written. */
  written?: string | true;
  /** Active editor buffer, compared the same way drill buffers are. */
  buffer?: string;
  cursor?: CursorPosition;
}

export interface WorkspaceSpec extends WorkspaceInit {
  goal: WorkspaceGoal;
}

export interface ExplorerRow {
  path: string;
  name: string;
  kind: 'file' | 'dir';
  depth: number;
  expanded: boolean;
}

export interface KeyInput {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
}

export interface KeyResult {
  state: WorkspaceState;
  handled: boolean;
}

export interface PaletteCommand {
  id:
    | 'toggleSidebar'
    | 'focusExplorer'
    | 'toggleTerminal'
    | 'focusTerminal'
    | 'focusEditor'
    | 'quickOpen'
    | 'closeEditor'
    | 'nextEditor'
    | 'prevEditor';
  title: string;
}

/**
 * Order is part of the contract: the command palette keeps this order, so a
 * short query like "term" selects "View: Toggle Terminal" and not the later
 * "Terminal: Focus Terminal".
 */
export const PALETTE_COMMANDS: PaletteCommand[] = [
  { id: 'toggleSidebar', title: 'View: Toggle Side Bar' },
  { id: 'focusExplorer', title: 'Explorer: Focus on Files Explorer' },
  { id: 'toggleTerminal', title: 'View: Toggle Terminal' },
  { id: 'focusTerminal', title: 'Terminal: Focus Terminal' },
  { id: 'focusEditor', title: 'View: Focus Active Editor Group' },
  { id: 'quickOpen', title: 'Go to File...' },
  { id: 'closeEditor', title: 'View: Close Editor' },
  { id: 'nextEditor', title: 'View: Next Editor' },
  { id: 'prevEditor', title: 'View: Previous Editor' },
];

export interface ShortcutLabels {
  mod: 'Cmd' | 'Ctrl';
  toggleSidebar: string;
  focusExplorer: string;
  toggleTerminal: string;
  focusEditor: string;
  quickOpen: string;
  palette: string;
  nextTab: string;
  prevTab: string;
  closeTab: string;
}

export function shortcutLabels(platform: Platform): ShortcutLabels {
  const mod = modName(platform);
  return {
    mod,
    toggleSidebar: `${mod}+B`,
    focusExplorer: `${mod}+Shift+E`,
    toggleTerminal: 'Ctrl+`',
    focusEditor: `${mod}+1`,
    quickOpen: `${mod}+P`,
    palette: `${mod}+Shift+P`,
    nextTab: 'Alt+]',
    prevTab: 'Alt+[',
    closeTab: 'Alt+W',
  };
}

export interface ReservedShortcut {
  binding: string;
  /** Why the browser takes the key before the page can see it. */
  reason: string;
  /** What to press in this trainer instead. */
  alternate: string;
}

/**
 * Chromium does not deliver these to the page, so preventDefault cannot help.
 * Ctrl+PageDown / Ctrl+PageUp are delivered in some browsers and stolen in
 * others; the trainer binds them when they arrive, and lessons teach Alt+] / Alt+[
 * which always arrive.
 */
export function reservedShortcuts(platform: Platform): ReservedShortcut[] {
  const mod = modName(platform);
  return [
    {
      binding: `${mod}+W`,
      reason: 'closes the browser tab',
      alternate: 'Alt+W closes the editor tab',
    },
    {
      binding: `${mod}+T`,
      reason: 'opens a new browser tab',
      alternate: 'open a file from the explorer or with quick open',
    },
    {
      binding: `${mod}+N`,
      reason: 'opens a new browser window',
      alternate: 'press a in the explorer to create a file',
    },
    {
      binding: 'Ctrl+Tab',
      reason: 'switches browser tabs and is not delivered to the page',
      alternate: 'Alt+] and Alt+[ switch editor tabs (Ctrl+PageDown when the browser allows it)',
    },
  ];
}

export function normalizePath(path: string): string {
  const parts: string[] = [];
  for (const part of path.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return parts.join('/');
}

export function resolvePath(cwd: string, input: string): string {
  if (input.startsWith('/')) return normalizePath(input.slice(1));
  return normalizePath(cwd ? `${cwd}/${input}` : input);
}

export function filePaths(nodes: FsNode[], dir = ''): string[] {
  const out: string[] = [];
  for (const node of nodes) {
    const path = dir ? `${dir}/${node.name}` : node.name;
    if (node.kind === 'file') out.push(path);
    else out.push(...filePaths(node.children ?? [], path));
  }
  return out;
}

export function parentDir(path: string): string {
  const index = path.lastIndexOf('/');
  return index === -1 ? '' : path.slice(0, index);
}

function baseName(path: string): string {
  const index = path.lastIndexOf('/');
  return index === -1 ? path : path.slice(index + 1);
}

function getNode(nodes: FsNode[], path: string): FsNode | null {
  if (!path) return { name: '', kind: 'dir', children: nodes };
  let current: FsNode[] = nodes;
  let found: FsNode | null = null;
  for (const part of path.split('/')) {
    found = current.find((node) => node.name === part) ?? null;
    if (!found) return null;
    current = found.children ?? [];
  }
  return found;
}

function readDisk(nodes: FsNode[], path: string): string | null {
  const node = getNode(nodes, path);
  if (!node || node.kind !== 'file') return null;
  return node.content ?? '';
}

export function explorerRows(state: WorkspaceState): ExplorerRow[] {
  const rows: ExplorerRow[] = [];
  const walk = (nodes: FsNode[], dir: string, depth: number) => {
    for (const node of nodes) {
      const path = dir ? `${dir}/${node.name}` : node.name;
      const expanded = node.kind === 'dir' && state.expanded.includes(path);
      rows.push({ path, name: node.name, kind: node.kind, depth, expanded });
      if (expanded) walk(node.children ?? [], path, depth + 1);
    }
  };
  walk(state.children, '', 0);
  return rows;
}

function clampIndex(state: WorkspaceState): WorkspaceState {
  const rows = explorerRows(state);
  const max = Math.max(0, rows.length - 1);
  const explorerIndex = Math.min(Math.max(0, state.explorerIndex), max);
  return explorerIndex === state.explorerIndex ? state : { ...state, explorerIndex };
}

export function createWorkspace(init: WorkspaceInit): WorkspaceState {
  const openTabs = [...(init.openTabs ?? (init.activePath ? [init.activePath] : []))];
  const activePath = init.activePath === undefined ? (openTabs[0] ?? null) : init.activePath;
  if (activePath && !openTabs.includes(activePath)) openTabs.push(activePath);
  const buffers: Record<string, string> = {};
  for (const path of filePaths(init.children)) {
    buffers[path] = readDisk(init.children, path) ?? '';
  }
  return clampIndex({
    projectName: init.projectName ?? 'project',
    children: init.children,
    expanded: [...(init.expanded ?? [])],
    explorerIndex: init.explorerIndex ?? 0,
    openTabs,
    activePath,
    buffers,
    cwd: init.cwd ?? '',
    sidebarVisible: init.sidebarVisible ?? true,
    terminalVisible: init.terminalVisible ?? false,
    focus: init.focus ?? 'editor',
    focusReturn: 'editor',
    terminalLines: [],
    terminalDraft: '',
    lastCommand: null,
    quickQuery: '',
    quickIndex: 0,
    paletteQuery: '',
    paletteIndex: 0,
    prompt: null,
    written: [],
    openedVia: 'init',
    message: '',
  });
}

export function promptLabel(cwd: string): string {
  return cwd ? `/${cwd} $` : '/ $';
}

function shellLines(state: WorkspaceState, command: string, output: string[]): string[] {
  return [...state.terminalLines, `${promptLabel(state.cwd)} ${command}`, ...output];
}

export function runCommand(state: WorkspaceState, raw: string): WorkspaceState {
  const command = raw.trim();
  if (!command) {
    return { ...state, terminalDraft: '', terminalLines: [...state.terminalLines, promptLabel(state.cwd)] };
  }
  const [name, ...rest] = command.split(/\s+/);
  const arg = rest.join(' ');
  let output: string[] = [];
  let cwd = state.cwd;
  if (name === 'help') {
    output = ['ls', 'cd', 'pwd', 'cat', 'clear', 'echo', 'help'];
  } else if (name === 'pwd') {
    output = [state.cwd ? `/${state.cwd}` : '/'];
  } else if (name === 'ls') {
    const path = arg ? resolvePath(state.cwd, arg) : state.cwd;
    const node = getNode(state.children, path);
    if (!node || node.kind !== 'dir') output = [`ls: ${arg || path || '/'}: not a directory`];
    else {
      const children = path ? (node.children ?? []) : state.children;
      output = children.map((child) => (child.kind === 'dir' ? `${child.name}/` : child.name));
      if (output.length === 0) output = [''];
    }
  } else if (name === 'cd') {
    const path = !arg || arg === '~' ? '' : resolvePath(state.cwd, arg);
    const node = getNode(state.children, path);
    if (!node || node.kind !== 'dir') output = [`cd: ${arg || '/'}: not a directory`];
    else cwd = path;
  } else if (name === 'cat') {
    if (!arg) output = ['cat: missing file'];
    else {
      const path = resolvePath(state.cwd, arg);
      const text = readDisk(state.children, path);
      output = text === null ? [`cat: ${arg}: no such file`] : text.split('\n');
    }
  } else if (name === 'echo') {
    output = [arg];
  } else if (name === 'clear') {
    return { ...state, terminalDraft: '', terminalLines: [], lastCommand: command, message: '' };
  } else {
    output = [`${name}: command not found`];
  }
  return {
    ...state,
    cwd,
    terminalDraft: '',
    terminalLines: shellLines(state, command, output),
    lastCommand: command,
    message: '',
  };
}

function shiftPath(path: string, from: string, to: string): string {
  if (path === from) return to;
  if (path.startsWith(`${from}/`)) return to + path.slice(from.length);
  return path;
}

function shiftRecord(record: Record<string, string>, from: string, to: string): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) next[shiftPath(key, from, to)] = value;
  return next;
}

function shiftState(state: WorkspaceState, from: string, to: string): WorkspaceState {
  return {
    ...state,
    expanded: state.expanded.map((path) => shiftPath(path, from, to)),
    openTabs: state.openTabs.map((path) => shiftPath(path, from, to)),
    activePath: state.activePath ? shiftPath(state.activePath, from, to) : null,
    buffers: shiftRecord(state.buffers, from, to),
    cwd: state.cwd === from || state.cwd.startsWith(`${from}/`) ? shiftPath(state.cwd, from, to) : state.cwd,
    written: state.written.map((path) => shiftPath(path, from, to)),
  };
}

function addChild(nodes: FsNode[], dir: string, child: FsNode): FsNode[] | null {
  if (!dir) {
    if (nodes.some((node) => node.name === child.name)) return null;
    return [...nodes, child];
  }
  const slash = dir.indexOf('/');
  const head = slash === -1 ? dir : dir.slice(0, slash);
  const rest = slash === -1 ? '' : dir.slice(slash + 1);
  let changed = false;
  const next = nodes.map((node) => {
    if (node.name !== head || node.kind !== 'dir') return node;
    const children = addChild(node.children ?? [], rest, child);
    if (!children) return node;
    changed = true;
    return { ...node, children };
  });
  return changed ? next : null;
}

function renameNode(nodes: FsNode[], path: string, newName: string): FsNode[] | null {
  const slash = path.indexOf('/');
  if (slash === -1) {
    if (!nodes.some((node) => node.name === path)) return null;
    if (nodes.some((node) => node.name === newName)) return null;
    return nodes.map((node) => (node.name === path ? { ...node, name: newName } : node));
  }
  const head = path.slice(0, slash);
  const rest = path.slice(slash + 1);
  let changed = false;
  const next = nodes.map((node) => {
    if (node.name !== head || node.kind !== 'dir') return node;
    const children = renameNode(node.children ?? [], rest, newName);
    if (!children) return node;
    changed = true;
    return { ...node, children };
  });
  return changed ? next : null;
}

function writeDisk(nodes: FsNode[], path: string, content: string): FsNode[] {
  const slash = path.indexOf('/');
  if (slash === -1) {
    return nodes.map((node) => (node.name === path && node.kind === 'file' ? { ...node, content } : node));
  }
  const head = path.slice(0, slash);
  const rest = path.slice(slash + 1);
  return nodes.map((node) =>
    node.name === head && node.kind === 'dir'
      ? { ...node, children: writeDisk(node.children ?? [], rest, content) }
      : node,
  );
}

export function markWritten(state: WorkspaceState, path: string, text: string): WorkspaceState {
  return {
    ...state,
    children: writeDisk(state.children, path, text),
    buffers: { ...state.buffers, [path]: text },
    written: state.written.includes(path) ? state.written : [...state.written, path],
    message: `"${path}" written`,
  };
}

export function withEditorBuffer(state: WorkspaceState, text: string): WorkspaceState {
  if (!state.activePath) return state;
  if (state.buffers[state.activePath] === text) return state;
  return { ...state, buffers: { ...state.buffers, [state.activePath]: text } };
}

function closeOverlay(state: WorkspaceState): WorkspaceState {
  const focus = state.focusReturn === 'quickOpen' || state.focusReturn === 'palette' ? 'editor' : state.focusReturn;
  return { ...state, focus, quickQuery: '', paletteQuery: '', quickIndex: 0, paletteIndex: 0, prompt: null };
}

function openFile(state: WorkspaceState, path: string, via: 'explorer' | 'quickOpen' | 'tab'): WorkspaceState {
  const openTabs = state.openTabs.includes(path) ? state.openTabs : [...state.openTabs, path];
  const buffers = path in state.buffers ? state.buffers : { ...state.buffers, [path]: readDisk(state.children, path) ?? '' };
  return {
    ...state,
    openTabs,
    activePath: path,
    buffers,
    focus: 'editor',
    openedVia: via,
    quickQuery: '',
    paletteQuery: '',
    prompt: null,
    message: '',
  };
}

function closeTab(state: WorkspaceState): WorkspaceState {
  if (!state.activePath) return state;
  const index = state.openTabs.indexOf(state.activePath);
  const openTabs = state.openTabs.filter((path) => path !== state.activePath);
  const next = openTabs[Math.min(index, openTabs.length - 1)] ?? null;
  return { ...state, openTabs, activePath: next, focus: 'editor', message: '' };
}

function cycleTab(state: WorkspaceState, direction: 1 | -1): WorkspaceState {
  if (state.openTabs.length === 0) return { ...state, focus: 'editor' };
  const current = Math.max(0, state.openTabs.indexOf(state.activePath ?? ''));
  const index = (current + direction + state.openTabs.length) % state.openTabs.length;
  return openFile(state, state.openTabs[index], 'tab');
}

function matchingFiles(state: WorkspaceState): string[] {
  const query = state.quickQuery.toLowerCase();
  return filePaths(state.children)
    .slice()
    .sort((a, b) => a.localeCompare(b))
    .filter((path) => path.toLowerCase().includes(query));
}

function matchingCommands(state: WorkspaceState): PaletteCommand[] {
  const query = state.paletteQuery.toLowerCase();
  return PALETTE_COMMANDS.filter((command) => command.title.toLowerCase().includes(query));
}

export function quickOpenMatches(state: WorkspaceState): string[] {
  return matchingFiles(state);
}

export function paletteMatches(state: WorkspaceState): PaletteCommand[] {
  return matchingCommands(state);
}

function actionForCommand(id: PaletteCommand['id']): Action {
  if (id === 'closeEditor') return 'closeTab';
  if (id === 'nextEditor') return 'nextTab';
  if (id === 'prevEditor') return 'prevTab';
  return id;
}

type Action =
  | 'toggleSidebar'
  | 'focusExplorer'
  | 'toggleTerminal'
  | 'focusTerminal'
  | 'focusEditor'
  | 'quickOpen'
  | 'palette'
  | 'nextTab'
  | 'prevTab'
  | 'closeTab';

function shortcutAction(input: KeyInput, platform: Platform): Action | null {
  const key = input.key.length === 1 ? input.key.toLowerCase() : input.key;
  const ctrl = Boolean(input.ctrlKey);
  const meta = Boolean(input.metaKey);
  const shift = Boolean(input.shiftKey);
  const alt = Boolean(input.altKey);
  const mod = platform === 'mac' ? meta : ctrl;

  if (alt && !ctrl && !meta && !shift && key === ']') return 'nextTab';
  if (alt && !ctrl && !meta && !shift && key === '[') return 'prevTab';
  if (alt && !ctrl && !meta && !shift && key === 'w') return 'closeTab';
  if (ctrl && !meta && !alt && !shift && (key === '`' || key === 'backquote')) return 'toggleTerminal';
  if (ctrl && !meta && !alt && !shift && key === 'PageDown') return 'nextTab';
  if (ctrl && !meta && !alt && !shift && key === 'PageUp') return 'prevTab';
  if (!mod || alt) return null;
  if (shift && key === 'e') return 'focusExplorer';
  if (shift && key === 'p') return 'palette';
  if (!shift && key === 'p') return 'quickOpen';
  if (!shift && key === 'b') return 'toggleSidebar';
  if (!shift && key === '1') return 'focusEditor';
  return null;
}

function runAction(state: WorkspaceState, action: Action): WorkspaceState {
  switch (action) {
    case 'toggleSidebar': {
      const sidebarVisible = !state.sidebarVisible;
      const focus = !sidebarVisible && state.focus === 'explorer' ? 'editor' : state.focus;
      return { ...state, sidebarVisible, focus, message: '' };
    }
    case 'focusExplorer':
      return { ...closeOverlay(state), sidebarVisible: true, focus: 'explorer', focusReturn: 'editor' };
    case 'toggleTerminal':
      if (!state.terminalVisible) return { ...closeOverlay(state), terminalVisible: true, focus: 'terminal' };
      if (state.focus === 'terminal') return { ...state, terminalVisible: false, focus: 'editor' };
      return { ...closeOverlay(state), focus: 'terminal' };
    case 'focusTerminal':
      return { ...closeOverlay(state), terminalVisible: true, focus: 'terminal' };
    case 'focusEditor':
      return { ...closeOverlay(state), focus: 'editor' };
    case 'quickOpen':
      if (state.focus === 'quickOpen') return closeOverlay(state);
      return {
        ...state,
        focus: 'quickOpen',
        focusReturn: state.focus === 'palette' ? state.focusReturn : state.focus,
        quickQuery: '',
        quickIndex: 0,
        prompt: null,
      };
    case 'palette':
      if (state.focus === 'palette') return closeOverlay(state);
      return {
        ...state,
        focus: 'palette',
        focusReturn: state.focus === 'quickOpen' ? state.focusReturn : state.focus,
        paletteQuery: '',
        paletteIndex: 0,
        prompt: null,
      };
    case 'nextTab':
      return cycleTab(closeOverlay(state), 1);
    case 'prevTab':
      return cycleTab(closeOverlay(state), -1);
    case 'closeTab':
      return closeTab(closeOverlay(state));
    default:
      return state;
  }
}

function plain(input: KeyInput): boolean {
  return !input.ctrlKey && !input.metaKey && !input.altKey;
}

function handleExplorer(state: WorkspaceState, input: KeyInput): KeyResult {
  if (!plain(input)) return { state, handled: false };
  const key = input.key;
  const rows = explorerRows(state);
  const row = rows[state.explorerIndex];
  if (state.prompt) return handlePrompt(state, input);
  if (!row && key !== 'a') return { state, handled: key.length === 1 || key === 'Enter' || key.startsWith('Arrow') };

  const move = (index: number): WorkspaceState => ({ ...state, explorerIndex: index, message: '' });

  if (key === 'j' || key === 'ArrowDown') {
    return { state: move(Math.min(state.explorerIndex + 1, Math.max(0, rows.length - 1))), handled: true };
  }
  if (key === 'k' || key === 'ArrowUp') {
    return { state: move(Math.max(0, state.explorerIndex - 1)), handled: true };
  }
  if ((key === 'l' || key === 'ArrowRight') && row) {
    if (row.kind === 'dir' && !row.expanded) {
      return { state: { ...state, expanded: [...state.expanded, row.path], message: '' }, handled: true };
    }
    if (row.kind === 'dir') return { state: move(Math.min(state.explorerIndex + 1, rows.length - 1)), handled: true };
    return { state: openFile(state, row.path, 'explorer'), handled: true };
  }
  if ((key === 'h' || key === 'ArrowLeft') && row) {
    if (row.kind === 'dir' && row.expanded) {
      return { state: { ...state, expanded: state.expanded.filter((path) => path !== row.path), message: '' }, handled: true };
    }
    const parent = parentDir(row.path);
    const index = rows.findIndex((item) => item.path === parent);
    return { state: index === -1 ? state : move(index), handled: true };
  }
  if (key === 'Enter' && row) {
    if (row.kind === 'dir') {
      const expanded = row.expanded
        ? state.expanded.filter((path) => path !== row.path)
        : [...state.expanded, row.path];
      return { state: { ...state, expanded, message: '' }, handled: true };
    }
    return { state: openFile(state, row.path, 'explorer'), handled: true };
  }
  if (key === 'a' && row) {
    const dir = row.kind === 'dir' ? row.path : parentDir(row.path);
    return { state: { ...state, prompt: { mode: 'create', dir, value: '' }, message: '' }, handled: true };
  }
  if (key === 'r' && row) {
    return {
      state: {
        ...state,
        prompt: { mode: 'rename', dir: parentDir(row.path), targetPath: row.path, value: '' },
        message: '',
      },
      handled: true,
    };
  }
  if (key.length === 1 || key === 'Backspace') return { state, handled: true };
  return { state, handled: false };
}

function validName(value: string): boolean {
  return value.length > 0 && !value.includes('/') && value !== '.' && value !== '..';
}

function handlePrompt(state: WorkspaceState, input: KeyInput): KeyResult {
  const prompt = state.prompt;
  if (!prompt || !plain(input)) return { state, handled: false };
  const key = input.key;
  if (key === 'Escape') return { state: { ...state, prompt: null }, handled: true };
  if (key === 'Backspace') {
    return { state: { ...state, prompt: { ...prompt, value: prompt.value.slice(0, -1) } }, handled: true };
  }
  if (key === 'Enter') {
    const name = prompt.value.trim();
    if (!validName(name)) return { state: { ...state, message: 'invalid name' }, handled: true };
    if (prompt.mode === 'create') {
      const children = addChild(state.children, prompt.dir, { name, kind: 'file', content: '' });
      if (!children) return { state: { ...state, message: 'file exists' }, handled: true };
      const path = prompt.dir ? `${prompt.dir}/${name}` : name;
      return { state: openFile({ ...state, children, prompt: null }, path, 'explorer'), handled: true };
    }
    const target = prompt.targetPath;
    if (!target || name === baseName(target)) return { state: { ...state, prompt: null }, handled: true };
    const children = renameNode(state.children, target, name);
    if (!children) return { state: { ...state, message: 'file exists' }, handled: true };
    const dir = parentDir(target);
    const to = dir ? `${dir}/${name}` : name;
    return {
      state: { ...shiftState({ ...state, children, prompt: null }, target, to), message: '' },
      handled: true,
    };
  }
  if (key.length === 1) {
    return { state: { ...state, prompt: { ...prompt, value: prompt.value + key } }, handled: true };
  }
  return { state, handled: false };
}

function handleQuickOpen(state: WorkspaceState, input: KeyInput): KeyResult {
  if (!plain(input)) return { state, handled: false };
  const matches = matchingFiles(state);
  if (input.key === 'Escape') return { state: closeOverlay(state), handled: true };
  if (input.key === 'ArrowDown') {
    return { state: { ...state, quickIndex: Math.min(state.quickIndex + 1, Math.max(0, matches.length - 1)) }, handled: true };
  }
  if (input.key === 'ArrowUp') {
    return { state: { ...state, quickIndex: Math.max(0, state.quickIndex - 1) }, handled: true };
  }
  if (input.key === 'Enter') {
    const path = matches[state.quickIndex];
    if (!path) return { state, handled: true };
    return { state: openFile(state, path, 'quickOpen'), handled: true };
  }
  if (input.key === 'Backspace') {
    return { state: { ...state, quickQuery: state.quickQuery.slice(0, -1), quickIndex: 0 }, handled: true };
  }
  if (input.key.length === 1) {
    return { state: { ...state, quickQuery: state.quickQuery + input.key, quickIndex: 0 }, handled: true };
  }
  return { state, handled: false };
}

function handlePalette(state: WorkspaceState, input: KeyInput): KeyResult {
  if (!plain(input)) return { state, handled: false };
  const matches = matchingCommands(state);
  if (input.key === 'Escape') return { state: closeOverlay(state), handled: true };
  if (input.key === 'ArrowDown') {
    return {
      state: { ...state, paletteIndex: Math.min(state.paletteIndex + 1, Math.max(0, matches.length - 1)) },
      handled: true,
    };
  }
  if (input.key === 'ArrowUp') {
    return { state: { ...state, paletteIndex: Math.max(0, state.paletteIndex - 1) }, handled: true };
  }
    if (input.key === 'Enter') {
    const command = matches[state.paletteIndex];
    if (!command) return { state, handled: true };
    return { state: runAction(closeOverlay(state), actionForCommand(command.id)), handled: true };
  }
  if (input.key === 'Backspace') {
    return { state: { ...state, paletteQuery: state.paletteQuery.slice(0, -1), paletteIndex: 0 }, handled: true };
  }
  if (input.key.length === 1) {
    return { state: { ...state, paletteQuery: state.paletteQuery + input.key, paletteIndex: 0 }, handled: true };
  }
  return { state, handled: false };
}

function handleTerminal(state: WorkspaceState, input: KeyInput): KeyResult {
  if (!plain(input)) return { state, handled: false };
  if (input.key === 'Enter') return { state: runCommand(state, state.terminalDraft), handled: true };
  if (input.key === 'Backspace') {
    return { state: { ...state, terminalDraft: state.terminalDraft.slice(0, -1) }, handled: true };
  }
  if (input.key.length === 1) {
    return { state: { ...state, terminalDraft: state.terminalDraft + input.key }, handled: true };
  }
  return { state, handled: false };
}

export function applyKey(state: WorkspaceState, input: KeyInput, platform: Platform): KeyResult {
  if (input.key === 'Escape') {
    if (state.focus === 'quickOpen' || state.focus === 'palette' || state.prompt) {
      return { state: state.prompt ? { ...state, prompt: null } : closeOverlay(state), handled: true };
    }
    return { state, handled: false };
  }
  const action = shortcutAction(input, platform);
  if (action) return { state: clampIndex(runAction(state, action)), handled: true };
  let result: KeyResult = { state, handled: false };
  if (state.focus === 'quickOpen') result = handleQuickOpen(state, input);
  else if (state.focus === 'palette') result = handlePalette(state, input);
  else if (state.focus === 'explorer') result = handleExplorer(state, input);
  else if (state.focus === 'terminal') result = handleTerminal(state, input);
  return result.handled ? { state: clampIndex(result.state), handled: true } : result;
}

export function goalMet(
  state: WorkspaceState,
  goal: WorkspaceGoal,
  cursor?: CursorPosition | null,
): boolean {
  if (goal.focus !== undefined && state.focus !== goal.focus) return false;
  if (goal.sidebarVisible !== undefined && state.sidebarVisible !== goal.sidebarVisible) return false;
  if (goal.terminalVisible !== undefined && state.terminalVisible !== goal.terminalVisible) return false;
  if (goal.activePath !== undefined && state.activePath !== goal.activePath) return false;
  if (goal.cwd !== undefined && state.cwd !== goal.cwd) return false;
  if (goal.lastCommand !== undefined && state.lastCommand !== goal.lastCommand) return false;
  if (goal.terminalHas !== undefined && !state.terminalLines.join('\n').includes(goal.terminalHas)) return false;
  if (goal.openedVia !== undefined && state.openedVia !== goal.openedVia) return false;
  if (goal.fileExists !== undefined && !filePaths(state.children).includes(goal.fileExists)) return false;
  if (goal.fileMissing !== undefined && filePaths(state.children).includes(goal.fileMissing)) return false;
  if (goal.openTabs !== undefined) {
    if (goal.openTabs.length !== state.openTabs.length) return false;
    if (goal.openTabs.some((path, index) => state.openTabs[index] !== path)) return false;
  }
  if (goal.written === true && state.written.length === 0) return false;
  if (typeof goal.written === 'string' && !state.written.includes(goal.written)) return false;
  if (goal.buffer !== undefined) {
    const text = state.activePath ? (state.buffers[state.activePath] ?? '') : '';
    if (!buffersMatch(text, goal.buffer)) return false;
  }
  if (goal.cursor) {
    if (!cursor || cursor.line !== goal.cursor.line || cursor.ch !== goal.cursor.ch) return false;
  }
  return true;
}

/** Replay a reference solution of Playwright-style key tokens. Unhandled keys are ignored. */
export function replayKeys(state: WorkspaceState, tokens: string[], platform: Platform = 'other'): WorkspaceState {
  return tokens.reduce((current, token) => applyKey(current, keyFromToken(token), platform).state, state);
}

export function keyFromToken(token: string): KeyInput {
  switch (token) {
    case 'Enter':
    case 'Escape':
    case 'Backspace':
    case 'ArrowUp':
    case 'ArrowDown':
    case 'ArrowLeft':
    case 'ArrowRight':
      return { key: token };
    case 'Space':
      return { key: ' ' };
    case 'Control+Backquote':
      return { key: '`', ctrlKey: true };
    case 'Control+Digit1':
      return { key: '1', ctrlKey: true };
    case 'Control+PageDown':
      return { key: 'PageDown', ctrlKey: true };
    case 'Control+PageUp':
      return { key: 'PageUp', ctrlKey: true };
    case 'Alt+BracketRight':
      return { key: ']', altKey: true };
    case 'Alt+BracketLeft':
      return { key: '[', altKey: true };
    default: {
      const parts = token.split('+');
      if (parts.length > 1) {
        const key = parts[parts.length - 1];
        return {
          key: key.length === 1 ? key.toLowerCase() : key,
          ctrlKey: parts.includes('Control'),
          shiftKey: parts.includes('Shift'),
          altKey: parts.includes('Alt'),
          metaKey: parts.includes('Meta'),
        };
      }
      return { key: token };
    }
  }
}
