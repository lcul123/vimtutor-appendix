import type { CursorPosition } from '../engine/text';
import type { FsNode, WorkspaceSpec } from '../engine/workspace';

const esc = 'Escape';
const cr = 'Enter';

export interface TrialChallenge {
  id: string;
  title: string;
  goal: string;
  /** Minimal key sequence. Its length feeds the expert-time estimate. */
  solution: string[];
  kind: 'vim' | 'workspace';
  buffer?: string;
  target?: string;
  cursor?: CursorPosition;
  cursorStart?: CursorPosition;
  checkpoints?: string[];
  cursorStops?: CursorPosition[];
  requiresWrite?: boolean;
  workspace?: WorkspaceSpec;
}

function project(app = 'export const title = "helo";'): FsNode[] {
  return [
    {
      name: 'src',
      kind: 'dir',
      children: [
        { name: 'app.ts', kind: 'file', content: app },
        { name: 'util.ts', kind: 'file', content: 'export const name = "old";' },
      ],
    },
    { name: 'readme.md', kind: 'file', content: 'hello' },
  ];
}

function ws(partial: Omit<WorkspaceSpec, 'children' | 'projectName'> & { app?: string }): WorkspaceSpec {
  return {
    projectName: 'trial',
    children: project(partial.app),
    openTabs: partial.openTabs ?? ['src/app.ts'],
    activePath: partial.activePath === undefined ? 'src/app.ts' : partial.activePath,
    sidebarVisible: partial.sidebarVisible ?? true,
    terminalVisible: partial.terminalVisible ?? false,
    focus: partial.focus ?? 'editor',
    expanded: partial.expanded,
    cwd: partial.cwd,
    goal: partial.goal,
  };
}

/**
 * One fixed daily sequence. Vim challenges use the terminal-styled editor.
 * Workspace challenges use the explorer, the editor, and the integrated terminal.
 * Key counts are the minimal solutions; see `estimateExpert` for the 2–3 minute pace.
 */
export const trialChallenges: TrialChallenge[] = [
  {
    id: 't-hjkl',
    title: 'Move to the mark',
    goal: 'Put the cursor on the X.',
    kind: 'vim',
    buffer: '....\n..X.',
    cursor: { line: 1, ch: 2 },
    solution: ['j', 'l', 'l'],
  },
  {
    id: 't-cw',
    title: 'Change a word',
    goal: 'Change blue into red.',
    kind: 'vim',
    buffer: 'blue sky',
    target: 'red sky',
    solution: ['c', 'w', 'r', 'e', 'd', esc],
  },
  {
    id: 't-append',
    title: 'Append',
    goal: 'Add a semicolon at the end of the line.',
    kind: 'vim',
    buffer: 'return 1',
    target: 'return 1;',
    solution: ['A', ';', esc],
  },
  {
    id: 't-open',
    title: 'Open a line',
    goal: 'Open a line below the brace and write return, indented two spaces.',
    kind: 'vim',
    buffer: 'function run() {\n}',
    target: 'function run() {\n  return\n}',
    solution: ['o', ' ', ' ', 'r', 'e', 't', 'u', 'r', 'n', esc],
  },
  {
    id: 't-d3w',
    title: 'Delete three words',
    goal: 'Delete the first three words.',
    kind: 'vim',
    buffer: 'one two three four',
    target: 'four',
    solution: ['d', '3', 'w'],
  },
  {
    id: 't-replace',
    title: 'Replace a character',
    goal: 'Change the o into an a.',
    kind: 'vim',
    buffer: 'cot',
    target: 'cat',
    solution: ['l', 'r', 'a'],
  },
  {
    id: 't-overwrite',
    title: 'Replace mode',
    goal: 'Overwrite note with done.',
    kind: 'vim',
    buffer: 'note',
    target: 'done',
    solution: ['R', 'd', 'o', 'n', 'e', esc],
  },
  {
    id: 't-ce',
    title: 'Change to the end',
    goal: 'Change alpha to x.',
    kind: 'vim',
    buffer: 'alpha beta',
    target: 'x beta',
    solution: ['c', 'e', 'x', esc],
  },
  {
    id: 't-undo',
    title: 'Undo',
    goal: 'Delete the first word, then undo so the line is unchanged.',
    kind: 'vim',
    buffer: 'one two',
    target: 'one two',
    checkpoints: ['two', 'one two'],
    solution: ['d', 'w', 'u'],
  },
  {
    id: 't-redo',
    title: 'Redo',
    goal: 'Delete the first word, undo that, then redo it.',
    kind: 'vim',
    buffer: 'one two',
    target: 'two',
    checkpoints: ['two', 'one two', 'two'],
    solution: ['d', 'w', 'u', 'Control+r'],
  },
  {
    id: 't-yank',
    title: 'Yank and put',
    goal: 'Duplicate the line below itself.',
    kind: 'vim',
    buffer: 'keep',
    target: 'keep\nkeep',
    solution: ['y', 'y', 'p'],
  },
  {
    id: 't-visual',
    title: 'Visual delete',
    goal: 'Visually delete "remove " and leave KEEP.',
    kind: 'vim',
    buffer: 'remove KEEP',
    target: 'KEEP',
    solution: ['v', 'e', 'l', 'd'],
  },
  {
    id: 't-search',
    title: 'Search',
    goal: 'Search forward for gamma.',
    kind: 'vim',
    buffer: 'alpha\nbeta\ngamma',
    cursor: { line: 2, ch: 0 },
    solution: ['/', 'g', 'a', 'm', 'm', 'a', cr],
  },
  {
    id: 't-next',
    title: 'Next match',
    goal: 'Jump to the second red.',
    kind: 'vim',
    buffer: 'xx red\nyy red',
    cursor: { line: 1, ch: 3 },
    solution: ['/', 'r', 'e', 'd', cr, 'n'],
  },
  {
    id: 't-back',
    title: 'Search backward',
    goal: 'From the last line, search backward for red.',
    kind: 'vim',
    buffer: 'red\nblue\ngreen',
    cursorStart: { line: 2, ch: 0 },
    cursor: { line: 0, ch: 0 },
    solution: ['?', 'r', 'e', 'd', cr],
  },
  {
    id: 't-sub',
    title: 'Substitute',
    goal: 'Replace yes with no.',
    kind: 'vim',
    buffer: 'yes',
    target: 'no',
    solution: [':', 's', '/', 'y', 'e', 's', '/', 'n', 'o', '/', cr],
  },
  {
    id: 't-percent',
    title: 'Match a bracket',
    goal: 'Delete the parenthesised arguments.',
    kind: 'vim',
    buffer: 'call(a, b) + tail',
    target: 'call + tail',
    solution: ['f', '(', 'd', '%'],
  },
  {
    id: 't-write',
    title: 'Write the file',
    goal: 'Change helo into hello, then save with :w.',
    kind: 'vim',
    buffer: 'helo',
    target: 'hello',
    requiresWrite: true,
    solution: ['l', 'a', 'l', esc, ':', 'w', cr],
  },
  {
    id: 't-bottom',
    title: 'Last line',
    goal: 'Replace the last line with DONE.',
    kind: 'vim',
    buffer: 'line 1\nline 2\nTODO',
    target: 'line 1\nline 2\nDONE',
    solution: ['G', 'R', 'D', 'O', 'N', 'E', esc],
  },
  {
    id: 't-sidebar',
    title: 'Hide the sidebar',
    goal: 'Hide the file explorer.',
    kind: 'workspace',
    solution: ['Control+b'],
    workspace: ws({ goal: { sidebarVisible: false } }),
  },
  {
    id: 't-explorer',
    title: 'Open a nested file',
    goal: 'From the explorer, open src/util.ts.',
    kind: 'workspace',
    solution: ['Control+Shift+E', 'l', 'j', 'j', cr],
    workspace: ws({
      goal: { activePath: 'src/util.ts', openedVia: 'explorer', focus: 'editor' },
    }),
  },
  {
    id: 't-create',
    title: 'Create a file',
    goal: 'Create notes.txt in the project root.',
    kind: 'workspace',
    solution: ['Control+Shift+E', 'j', 'a', 'n', 'o', 't', 'e', 's', '.', 't', 'x', 't', cr],
    workspace: ws({
      goal: { fileExists: 'notes.txt', activePath: 'notes.txt', openedVia: 'explorer' },
    }),
  },
  {
    id: 't-shell',
    title: 'cd and ls',
    goal: 'Open the terminal, cd into src, and run ls.',
    kind: 'workspace',
    solution: ['Control+Backquote', 'c', 'd', 'Space', 's', 'r', 'c', cr, 'l', 's', cr],
    workspace: ws({
      goal: { cwd: 'src', lastCommand: 'ls', terminalHas: 'app.ts', focus: 'terminal' },
    }),
  },
  {
    id: 't-roundtrip',
    title: 'Back to the editor',
    goal: 'Run pwd, focus the editor, and change helo into hello.',
    kind: 'workspace',
    solution: ['Control+Backquote', 'p', 'w', 'd', cr, 'Control+Digit1', 'l', 'a', 'l', esc],
    workspace: ws({
      goal: { focus: 'editor', lastCommand: 'pwd', buffer: 'hello' },
      app: 'helo',
    }),
  },
  {
    id: 't-quick',
    title: 'Quick open',
    goal: 'Quick-open src/util.ts.',
    kind: 'workspace',
    solution: ['Control+p', 'u', 't', 'i', 'l', cr],
    workspace: ws({
      activePath: 'readme.md',
      openTabs: ['readme.md'],
      goal: { activePath: 'src/util.ts', openedVia: 'quickOpen', focus: 'editor' },
    }),
  },
  {
    id: 't-palette',
    title: 'Command palette',
    goal: 'Open the terminal from the command palette.',
    kind: 'workspace',
    solution: ['Control+Shift+P', 't', 'e', 'r', 'm', cr],
    workspace: ws({ goal: { terminalVisible: true, focus: 'terminal' } }),
  },
  {
    id: 't-tabs',
    title: 'Switch tabs',
    goal: 'Switch to app.ts and change on into off.',
    kind: 'workspace',
    solution: ['Alt+BracketRight', 'f', 'o', 'c', 'w', 'o', 'f', 'f', esc],
    workspace: ws({
      app: 'status = on',
      openTabs: ['readme.md', 'src/app.ts'],
      activePath: 'readme.md',
      goal: { activePath: 'src/app.ts', focus: 'editor', buffer: 'status = off' },
    }),
  },
  {
    id: 't-close',
    title: 'Close a tab',
    goal: 'Close the current tab so only app.ts stays open.',
    kind: 'workspace',
    solution: ['Alt+w'],
    workspace: ws({
      openTabs: ['readme.md', 'src/app.ts'],
      activePath: 'readme.md',
      goal: { activePath: 'src/app.ts', openTabs: ['src/app.ts'] },
    }),
  },
];
