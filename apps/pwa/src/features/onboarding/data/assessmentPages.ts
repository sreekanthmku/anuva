export type AssessmentPage = {
  questionIndices: number[];
};

/** Pairs questions per screen; the final question is always on its own page. */
export function buildAssessmentPages(questionCount: number): AssessmentPage[] {
  const pages: AssessmentPage[] = [];
  let index = 0;

  while (index < questionCount) {
    const remaining = questionCount - index;
    if (remaining === 1) {
      pages.push({ questionIndices: [index] });
      break;
    }
    pages.push({ questionIndices: [index, index + 1] });
    index += 2;
  }

  return pages;
}
