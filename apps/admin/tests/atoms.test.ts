import { createStore, getDefaultStore } from 'jotai';
import { describe, expect, it } from 'vitest';
import { adminTabAtom, type AdminTab } from '../src/atoms';

describe('AdminTab', () => {
  it('allows only overview and examples at the type level', () => {
    const tabs = ['overview', 'examples'] as const satisfies readonly AdminTab[];
    expect(tabs).toEqual(['overview', 'examples']);
  });
});

describe('adminTabAtom', () => {
  it("initializes to 'overview' on the default store", () => {
    expect(getDefaultStore().get(adminTabAtom)).toBe('overview');
  });

  it("initializes to 'overview' on an isolated store", () => {
    const store = createStore();
    expect(store.get(adminTabAtom)).toBe('overview');
  });

  it("updates when set to 'examples' and back to 'overview'", () => {
    const store = createStore();
    store.set(adminTabAtom, 'examples');
    expect(store.get(adminTabAtom)).toBe('examples');
    store.set(adminTabAtom, 'overview');
    expect(store.get(adminTabAtom)).toBe('overview');
  });
});
