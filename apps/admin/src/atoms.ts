import { atom } from 'jotai';
import { getStoredToken } from './lib/api';
import type { AdminField } from './features/entities/fieldTypes';

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
  canCreate: boolean;
  createFields: AdminField[] | null;
  updateFields: AdminField[] | null;
};

export const entityMetaAtom = atom<EntityMeta[]>([]);
export const selectedResourceAtom = atom<string | null>(null);
