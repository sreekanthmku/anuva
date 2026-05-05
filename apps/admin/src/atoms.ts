import { atom } from 'jotai';

export type AdminTab = 'overview' | 'examples';

export const adminTabAtom = atom<AdminTab>('overview');
