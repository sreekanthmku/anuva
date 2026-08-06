import { describe, expect, it } from 'vitest';
import { DPDP_ACT_URL } from '../src/shared/lib/dpdp';

describe('DPDP_ACT_URL', () => {
  it('points at the MeitY DPDP Act PDF', () => {
    expect(DPDP_ACT_URL).toBe(
      'https://www.meity.gov.in/static/uploads/2024/06/2bf1f0e9f04e6fb4f8fef35e82c42aa5.pdf',
    );
  });

  it('is an https URL ending in .pdf', () => {
    expect(DPDP_ACT_URL.startsWith('https://')).toBe(true);
    expect(DPDP_ACT_URL.endsWith('.pdf')).toBe(true);
  });
});
