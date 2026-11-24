import { describe, expect, it } from 'vitest';
import { vscodeLessons } from '../src/content/vscodeLessons';
import { trialChallenges } from '../src/content/trialChallenges';
import {
  applyKey,
  createWorkspace,
  goalMet,
  paletteMatches,
  replayKeys,
  runCommand,
  withEditorBuffer,
  type WorkspaceSpec,
} from '../src/engine/workspace';

const file = (name: string, content = ''): { name: string; kind: 'file'; content: string } => ({
  name,
  kind: 'file',
  content,
});

function expectSolution(spec: WorkspaceSpec, solution: string[], label: string) {
  const initial = createWorkspace(spec);
  expect(goalMet(initial, spec.goal), `${label} starts solved`).toBe(false);
  const after = replayKeys(initial, solution);
  if (spec.goal.buffer !== undefined) {
    expect(goalMet(after, spec.goal), `${label} ignores the edit`).toBe(false);
    expect(goalMet(withEditorBuffer(after, spec.goal.buffer), spec.goal), label).toBe(true);
  } else {
    expect(goalMet(after, spec.goal), label).toBe(true);
    const prefix = replayKeys(initial, solution.slice(0, -1));
    expect(goalMet(prefix, spec.goal), `${label} solves early`).toBe(false);
  }
}

describe('workspace navigation', () => {
  const specs = [
    ...vscodeLessons.flatMap((lesson) =>
      lesson.drills.filter((drill) => drill.workspace).map((drill) => ({
        label: drill.id,
        spec: drill.workspace!,
        solution: drill.solution,
      })),
    ),
    ...trialChallenges
      .filter((challenge) => challenge.workspace)
      .map((challenge) => ({
        label: challenge.id,
        spec: challenge.workspace!,
        solution: challenge.solution,
      })),
  ];

  for (const { label, spec, solution } of specs) {
    it(`${label} completes on its solution and not before`, () => {
      expectSolution(spec, solution, label);
    });
  }

  it('uses Cmd on Mac and Ctrl elsewhere, while Ctrl+` stays Ctrl', () => {
    const state = createWorkspace({
      children: [file('a.ts', 'a')],
      activePath: 'a.ts',
      sidebarVisible: true,
    });
    expect(applyKey(state, { key: 'b', ctrlKey: true }, 'mac').state.sidebarVisible).toBe(true);
    expect(applyKey(state, { key: 'b', metaKey: true }, 'mac').state.sidebarVisible).toBe(false);
    expect(applyKey(state, { key: 'b', ctrlKey: true }, 'other').state.sidebarVisible).toBe(false);
    expect(applyKey(state, { key: '`', ctrlKey: true }, 'mac').state).toMatchObject({
      focus: 'terminal',
      terminalVisible: true,
    });
  });

  it('filters the command palette in list order', () => {
    const opened = applyKey(
      createWorkspace({ children: [file('a.ts')] }),
      { key: 'P', ctrlKey: true, shiftKey: true },
      'other',
    ).state;
    const typing = 'term'.split('').reduce((state, key) => applyKey(state, { key }, 'other').state, opened);
    expect(paletteMatches(typing)[0]?.title).toBe('View: Toggle Terminal');
  });
});

describe('simulated shell', () => {
  const base = createWorkspace({
    children: [
      {
        name: 'src',
        kind: 'dir',
        children: [file('app.ts', 'export {}\n')],
      },
    ],
  });

  it('prints the root, changes directory, and lists it', () => {
    const pwd = runCommand(base, 'pwd');
    expect(pwd.terminalLines.join('\n')).toContain('/');
    expect(pwd.lastCommand).toBe('pwd');
    const moved = runCommand(pwd, 'cd src');
    expect(moved.cwd).toBe('src');
    const listed = runCommand(moved, 'ls');
    expect(listed.terminalLines.join('\n')).toContain('app.ts');
    expect(runCommand(listed, 'cd ..').cwd).toBe('');
  });

  it('cats a file from disk and rejects an unknown command', () => {
    const shown = runCommand(base, 'cat src/app.ts');
    expect(shown.terminalLines.join('\n')).toContain('export {}');
    expect(runCommand(base, 'make').terminalLines.at(-1)).toBe('make: command not found');
  });
});
