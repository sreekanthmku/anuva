import { describe, expect, it } from 'vitest';
import { ageFromDateOfBirth } from '../src/features/core/ageFromDateOfBirth';

const on = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12);

describe('ageFromDateOfBirth', () => {
  it('counts whole years, turning older on the birthday itself', () => {
    expect(ageFromDateOfBirth('1978-10-29', on(2026, 10, 28))).toBe(47);
    expect(ageFromDateOfBirth('1978-10-29', on(2026, 10, 29))).toBe(48);
    expect(ageFromDateOfBirth('1978-10-29', on(2026, 11, 1))).toBe(48);
  });

  it('turns a 29 February birthday over on 1 March in other years', () => {
    expect(ageFromDateOfBirth('1980-02-29', on(2026, 2, 28))).toBe(45);
    expect(ageFromDateOfBirth('1980-02-29', on(2026, 3, 1))).toBe(46);
  });

  it('gives nothing for a missing, malformed, impossible or future date', () => {
    expect(ageFromDateOfBirth(undefined)).toBeNull();
    expect(ageFromDateOfBirth('')).toBeNull();
    expect(ageFromDateOfBirth('29/10/1978')).toBeNull();
    expect(ageFromDateOfBirth('1978-02-30')).toBeNull();
    expect(ageFromDateOfBirth('2030-01-01', on(2026, 10, 29))).toBeNull();
  });
});
