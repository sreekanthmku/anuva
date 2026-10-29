/** The detailed assessment's date-of-birth answer, stored as `YYYY-MM-DD`. */
export const DATE_OF_BIRTH_KEY = 'date-of-birth';

/**
 * Her age today, worked out from her date of birth each time it is shown — never stored, so it
 * cannot go stale on her birthday.
 *
 * Whole years, on her own calendar: the birthday counts from the start of that day where she is,
 * and someone born on 29 February turns a year older on 1 March in other years. `null` for an
 * answer that is not a real date, or one in the future.
 */
export function ageFromDateOfBirth(dateOfBirth: string | undefined, now = new Date()): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOfBirth ?? '');
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const born = new Date(year, month, day);
  if (born.getFullYear() !== year || born.getMonth() !== month || born.getDate() !== day) return null;

  const beforeBirthday =
    now.getMonth() < month || (now.getMonth() === month && now.getDate() < day);
  const age = now.getFullYear() - year - (beforeBirthday ? 1 : 0);
  return age >= 0 ? age : null;
}
