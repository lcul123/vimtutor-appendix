import type { Lesson } from '../engine/types';
import type { FsNode, WorkspaceSpec } from '../engine/workspace';

const esc = 'Escape';
const cr = 'Enter';

const detail =
  'The modifier is Ctrl on Windows and Linux and Cmd on Mac. Ctrl+` is Ctrl on every platform, matching VS Code. The browser does not deliver Ctrl/Cmd+W (close tab), Ctrl/Cmd+T (new tab), Ctrl/Cmd+N (new window), or Ctrl+Tab, so this trainer closes an editor with Alt+W, creates a file with a in the explorer, opens files from the explorer or quick open, and switches tabs with Alt+] and Alt+[. Ctrl+PageDown also switches tabs when the browser lets the page see it.';

function tree(app = 'export const title = "helo";'): FsNode[] {
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

function spec(partial: Omit<WorkspaceSpec, 'children'> & { children?: FsNode[]; app?: string }): WorkspaceSpec {
  return {
    projectName: 'workshop',
    children: partial.children ?? tree(partial.app),
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

export const vscodeLessons: Lesson[] = [
  {
    id: 'vscode-focus',
    number: 1,
    title: 'Sidebar, editor, and terminal',
    summary:
      'Ctrl/Cmd+B toggles the sidebar, Ctrl/Cmd+Shift+E focuses the explorer, Ctrl+` toggles the terminal, and Ctrl/Cmd+1 focuses the editor.',
    detail,
    commands: ['Ctrl/Cmd+B', 'Ctrl/Cmd+Shift+E', 'Ctrl+`', 'Ctrl/Cmd+1'],
    drills: [
      {
        id: 'vs-sidebar',
        title: 'Hide the sidebar',
        goal: 'Hide the file explorer with the sidebar shortcut.',
        buffer: '',
        par: 1,
        hint: 'Ctrl+B on Windows and Linux, Cmd+B on Mac.',
        solution: ['Control+b'],
        workspace: spec({ goal: { sidebarVisible: false } }),
      },
      {
        id: 'vs-explorer',
        title: 'Focus the explorer',
        goal: 'Show the sidebar and move focus into the file explorer.',
        buffer: '',
        par: 1,
        hint: 'Ctrl+Shift+E, or Cmd+Shift+E on Mac. It opens the sidebar if it was hidden.',
        solution: ['Control+Shift+E'],
        workspace: spec({
          sidebarVisible: false,
          goal: { focus: 'explorer', sidebarVisible: true },
        }),
      },
      {
        id: 'vs-terminal',
        title: 'Open the terminal',
        goal: 'Open the integrated terminal and focus it.',
        buffer: '',
        par: 1,
        hint: 'Ctrl+` toggles the terminal on every platform, including Mac.',
        solution: ['Control+Backquote'],
        workspace: spec({ goal: { focus: 'terminal', terminalVisible: true } }),
      },
      {
        id: 'vs-editor',
        title: 'Back to the editor',
        goal: 'Move focus from the terminal back to the editor.',
        buffer: '',
        par: 1,
        hint: 'Ctrl+1 focuses the first editor group. On Mac it is Cmd+1.',
        solution: ['Control+Digit1'],
        workspace: spec({
          focus: 'terminal',
          terminalVisible: true,
          goal: { focus: 'editor' },
        }),
      },
    ],
  },
  {
    id: 'vscode-explorer',
    number: 2,
    title: 'Navigate the explorer',
    summary:
      'With the explorer focused, j and k (or the arrows) move, l expands a folder, h collapses it, and Enter opens a file. a creates a file and r renames.',
    detail,
    commands: ['j', 'k', 'h', 'l', 'Enter', 'a', 'r'],
    drills: [
      {
        id: 'vs-open-file',
        title: 'Open a file',
        goal: 'From the explorer, open readme.md.',
        buffer: '',
        par: 3,
        hint: 'Ctrl+Shift+E focuses the explorer. j moves down. Enter opens the file.',
        solution: ['Control+Shift+E', 'j', cr],
        workspace: spec({
          goal: { activePath: 'readme.md', openedVia: 'explorer', focus: 'editor' },
        }),
      },
      {
        id: 'vs-nested',
        title: 'Open a nested file',
        goal: 'Expand src and open util.ts.',
        buffer: '',
        par: 5,
        hint: 'l expands the folder under the cursor. j moves to util.ts. Enter opens it.',
        solution: ['Control+Shift+E', 'l', 'j', 'j', cr],
        workspace: spec({
          goal: { activePath: 'src/util.ts', openedVia: 'explorer', focus: 'editor' },
        }),
      },
      {
        id: 'vs-create',
        title: 'Create a file',
        goal: 'Create notes.txt in the project root and open it.',
        buffer: '',
        par: 13,
        hint: 'Move onto readme.md so the new file lands in the root, press a, type the name, and Enter.',
        solution: ['Control+Shift+E', 'j', 'a', 'n', 'o', 't', 'e', 's', '.', 't', 'x', 't', cr],
        workspace: spec({
          goal: { fileExists: 'notes.txt', activePath: 'notes.txt', openedVia: 'explorer' },
        }),
      },
      {
        id: 'vs-rename',
        title: 'Rename a file',
        goal: 'Rename readme.md to guide.md.',
        buffer: '',
        par: 12,
        hint: 'r starts a rename. Type the new name and press Enter. The old name is not kept in the field.',
        solution: ['Control+Shift+E', 'j', 'r', 'g', 'u', 'i', 'd', 'e', '.', 'm', 'd', cr],
        workspace: spec({
          goal: { fileExists: 'guide.md', fileMissing: 'readme.md' },
        }),
      },
    ],
  },
  {
    id: 'vscode-terminal',
    number: 3,
    title: 'Use the terminal, then edit',
    summary:
      'The terminal is a small shell: pwd, ls, cd, cat, echo, and clear. Ctrl+` jumps in. Ctrl/Cmd+1 jumps back to the editor so you can keep editing with Vim.',
    detail,
    commands: ['Ctrl+`', 'pwd', 'ls', 'cd', 'Ctrl/Cmd+1'],
    drills: [
      {
        id: 'vs-pwd',
        title: 'Print the working directory',
        goal: 'Open the terminal and run pwd.',
        buffer: '',
        par: 5,
        hint: 'Ctrl+` focuses the terminal. Type pwd and press Enter.',
        solution: ['Control+Backquote', 'p', 'w', 'd', cr],
        workspace: spec({
          goal: { focus: 'terminal', lastCommand: 'pwd', terminalHas: '/' },
        }),
      },
      {
        id: 'vs-cd-ls',
        title: 'Change directory and list',
        goal: 'In the terminal, cd into src and run ls.',
        buffer: '',
        par: 10,
        hint: 'cd src, then ls. The prompt shows the directory you are in.',
        solution: ['c', 'd', 'Space', 's', 'r', 'c', cr, 'l', 's', cr],
        workspace: spec({
          focus: 'terminal',
          terminalVisible: true,
          goal: { cwd: 'src', lastCommand: 'ls', terminalHas: 'app.ts' },
        }),
      },
      {
        id: 'vs-roundtrip',
        title: 'Terminal, then back to the edit',
        goal: 'Run pwd, return to the editor, and change helo into hello.',
        buffer: 'export const title = "helo";',
        target: 'export const title = "hello";',
        par: 12,
        hint: 'Ctrl+` then pwd. Ctrl+1 focuses the editor. The second e is the one in helo; a inserts after it.',
        solution: ['Control+Backquote', 'p', 'w', 'd', cr, 'Control+Digit1', 'f', 'e', ';', 'a', 'l', esc],
        workspace: spec({
          goal: {
            focus: 'editor',
            lastCommand: 'pwd',
            buffer: 'export const title = "hello";',
          },
        }),
      },
    ],
  },
  {
    id: 'vscode-palette',
    number: 4,
    title: 'Quick open, palette, and tabs',
    summary:
      'Ctrl/Cmd+P opens a file by name. Ctrl/Cmd+Shift+P runs a command. Alt+] and Alt+[ switch editor tabs, because the browser keeps Ctrl+Tab. Alt+W closes a tab.',
    detail,
    commands: ['Ctrl/Cmd+P', 'Ctrl/Cmd+Shift+P', 'Alt+]', 'Alt+[', 'Alt+W'],
    drills: [
      {
        id: 'vs-quick',
        title: 'Quick open',
        goal: 'Open src/util.ts with quick open.',
        buffer: '',
        par: 6,
        hint: 'Ctrl+P, type util, and press Enter. On Mac the shortcut is Cmd+P.',
        solution: ['Control+p', 'u', 't', 'i', 'l', cr],
        workspace: spec({
          activePath: 'readme.md',
          openTabs: ['readme.md'],
          goal: { activePath: 'src/util.ts', openedVia: 'quickOpen', focus: 'editor' },
        }),
      },
      {
        id: 'vs-palette',
        title: 'Command palette',
        goal: 'Open the terminal from the command palette.',
        buffer: '',
        par: 6,
        hint: 'Ctrl+Shift+P, type term, and press Enter. The first match toggles the terminal.',
        solution: ['Control+Shift+P', 't', 'e', 'r', 'm', cr],
        workspace: spec({
          goal: { terminalVisible: true, focus: 'terminal' },
        }),
      },
      {
        id: 'vs-tabs',
        title: 'Switch tabs and edit',
        goal: 'Switch to app.ts and change on to off.',
        buffer: 'status = on',
        target: 'status = off',
        par: 9,
        hint: 'Alt+] selects the next editor tab. The browser keeps Ctrl+Tab, so this trainer uses Alt+] and Alt+[.',
        note: 'Ctrl+PageDown also moves to the next tab when the browser delivers it. Ctrl+Tab does not arrive at the page.',
        solution: ['Alt+BracketRight', 'f', 'o', 'c', 'w', 'o', 'f', 'f', esc],
        workspace: spec({
          app: 'status = on',
          openTabs: ['readme.md', 'src/app.ts'],
          activePath: 'readme.md',
          goal: { activePath: 'src/app.ts', focus: 'editor', buffer: 'status = off' },
        }),
      },
      {
        id: 'vs-close',
        title: 'Close the editor tab',
        goal: 'Close the current tab so only app.ts stays open.',
        buffer: '',
        par: 1,
        hint: 'Alt+W closes the editor tab. Ctrl+W and Cmd+W close the browser tab instead, and the page never sees them.',
        solution: ['Alt+w'],
        workspace: spec({
          openTabs: ['readme.md', 'src/app.ts'],
          activePath: 'readme.md',
          goal: { activePath: 'src/app.ts', openTabs: ['src/app.ts'] },
        }),
      },
    ],
  },
];
