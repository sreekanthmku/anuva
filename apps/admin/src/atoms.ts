import { atom } from 'jotai';
import { getStoredToken } from './lib/api';

export const adminTokenAtom = atom<string | null>(getStoredToken());

export type EntityMeta = {
  resource: string;
  label: string;
  group: string;
  searchFields: string[];
  filterFields: string[];
  sortableFields: string[];
  defaultSort: string;
  /** Preferred table columns; null means auto-pick human fields */
  listFields: string[] | null;
  softDeleteField: string | null;
  activeField: string | null;
  actions: Array<{ key: string; label: string; description?: string }>;
};

export const entityMetaAtom = atom<EntityMeta[]>([]);
export const selectedResourceAtom = atom<string | null>(null);
