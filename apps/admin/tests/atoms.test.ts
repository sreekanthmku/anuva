import { describe, expect, it } from 'vitest';
import { adminTokenAtom } from '../src/atoms';

describe('adminTokenAtom', () => {
  it('is a jotai primitive atom', () => {
    expect(adminTokenAtom).toBeTruthy();
    expect('init' in adminTokenAtom || 'read' in adminTokenAtom).toBe(true);
  });
});
