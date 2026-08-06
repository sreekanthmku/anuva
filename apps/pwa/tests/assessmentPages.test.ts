import { describe, expect, it } from 'vitest';
import { buildAssessmentPages } from '../src/features/onboarding/data/assessmentPages';

describe('buildAssessmentPages', () => {
  it('returns no pages for zero questions', () => {
    expect(buildAssessmentPages(0)).toEqual([]);
  });

  it('puts a single question on its own page', () => {
    expect(buildAssessmentPages(1)).toEqual([{ questionIndices: [0] }]);
  });

  it('pairs two questions on one page', () => {
    expect(buildAssessmentPages(2)).toEqual([{ questionIndices: [0, 1] }]);
  });

  it('pairs questions and keeps the final odd question alone', () => {
    expect(buildAssessmentPages(3)).toEqual([
      { questionIndices: [0, 1] },
      { questionIndices: [2] },
    ]);
  });

  it('covers an even count as consecutive pairs only', () => {
    expect(buildAssessmentPages(4)).toEqual([
      { questionIndices: [0, 1] },
      { questionIndices: [2, 3] },
    ]);
  });

  it('pages the full 11-question assessment with last alone', () => {
    const pages = buildAssessmentPages(11);
    expect(pages).toHaveLength(6);
    expect(pages[0]).toEqual({ questionIndices: [0, 1] });
    expect(pages[4]).toEqual({ questionIndices: [8, 9] });
    expect(pages[5]).toEqual({ questionIndices: [10] });

    const flat = pages.flatMap((page) => page.questionIndices);
    expect(flat).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});
