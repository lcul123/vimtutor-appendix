import { describe, expect, it } from 'vitest';
import { placedLessons, placedSections } from '../src/content/curriculum';
import { trialChallenges } from '../src/content/trialChallenges';
import { createWorkspace, goalMet } from '../src/engine/workspace';

describe('full curriculum', () => {
  const lessons = placedLessons();

  it('numbers every lesson once, in section order', () => {
    expect(placedSections().map((section) => section.id)).toEqual(['core', 'appendix', 'vscode']);
    lessons.forEach((lesson, index) => expect(lesson.number).toBe(index + 1));
    const ids = lessons.map((lesson) => lesson.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps drills solvable on paper', () => {
    const drillIds = lessons.flatMap((lesson) => lesson.drills.map((drill) => drill.id));
    expect(new Set(drillIds).size).toBe(drillIds.length);
    for (const lesson of lessons) {
      expect(lesson.drills.length).toBeGreaterThanOrEqual(2);
      expect(lesson.drills.length).toBeLessThanOrEqual(5);
      expect(lesson.summary.length).toBeLessThan(280);
      for (const drill of lesson.drills) {
        expect(drill.solution.length, drill.id).toBeGreaterThan(0);
        expect(drill.par, drill.id).toBe(drill.solution.length);
        const hasGoal = Boolean(
          drill.target || drill.cursor || drill.checkpoints || drill.cursorStops || drill.requiresWrite || drill.workspace,
        );
        expect(hasGoal, drill.id).toBe(true);
        if (drill.workspace) {
          expect(goalMet(createWorkspace(drill.workspace), drill.workspace.goal), drill.id).toBe(false);
        }
      }
    }
  });

  it('does not start a workspace trial challenge already solved', () => {
    for (const challenge of trialChallenges) {
      if (!challenge.workspace) continue;
      expect(goalMet(createWorkspace(challenge.workspace), challenge.workspace.goal), challenge.id).toBe(false);
    }
  });
});
