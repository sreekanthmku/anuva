import { describe, expect, it } from 'vitest';
import { pdfPasswordFromDateOfBirth } from '../src/report14/pdfPassword.js';

describe('pdfPasswordFromDateOfBirth', () => {
  it('is the month and year of birth as six digits', () => {
    expect(pdfPasswordFromDateOfBirth('1991-08-17')).toBe('081991');
    expect(pdfPasswordFromDateOfBirth('1975-12-01')).toBe('121975');
    expect(pdfPasswordFromDateOfBirth('1980-02-29')).toBe('021980');
  });

  it('gives nothing for a missing or unreal date, so the PDF is never served open', () => {
    expect(pdfPasswordFromDateOfBirth(undefined)).toBeNull();
    expect(pdfPasswordFromDateOfBirth('')).toBeNull();
    expect(pdfPasswordFromDateOfBirth('17/08/1991')).toBeNull();
    expect(pdfPasswordFromDateOfBirth('1991-02-30')).toBeNull();
    expect(pdfPasswordFromDateOfBirth('1991-13-01')).toBeNull();
  });
});
