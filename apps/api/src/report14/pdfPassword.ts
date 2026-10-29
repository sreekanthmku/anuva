/** The detailed assessment's date-of-birth answer, stored as `YYYY-MM-DD`. */
export const DATE_OF_BIRTH_KEY = 'date-of-birth';

/**
 * The password her report PDF opens with: month and year of birth as six digits, `MMYYYY`.
 * Born 17 August 1991 → `081991`.
 *
 * Something she knows without being told, and that a doctor she shares the file with can be told
 * in one breath. `null` when the answer is missing or is not a real date — the PDF is then not
 * served at all rather than served open.
 */
export function pdfPasswordFromDateOfBirth(dateOfBirth: string | undefined): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOfBirth ?? '');
  if (!match) return null;

  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) {
    return null;
  }

  return `${month}${year}`;
}
