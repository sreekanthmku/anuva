/**
 * The `Translation` table, loaded into memory.
 *
 * Translations ship as JSON files; a row in the table overrides the same key, so wording can be
 * fixed from the admin panel without a deploy. Every lookup is served from memory — no query sits in
 * a request path — and a refresh reloads only when the table has actually changed.
 *
 * The database is treated as optional throughout. If it is unreachable, or the table does not exist
 * yet because the migration has not run, the API logs it once and serves the files. Copy is never
 * worth an outage.
 */
import { prisma } from '@anuva/database';
import { applyTranslationOverrides, overrideCounts } from './index.js';
import { logger } from '../logger.js';

const log = logger.child({ module: 'i18n-store' });

/** How often to check for edits. The check is one aggregate query, not a reload. */
const REFRESH_MS = Number(process.env.I18N_REFRESH_MS ?? 60_000);

/** What the last load saw, so an unchanged table costs one cheap query and no allocation. */
let signature: string | null = null;
let timer: NodeJS.Timeout | null = null;

async function currentSignature(): Promise<string> {
  const { _count, _max } = await prisma.translation.aggregate({
    _count: { _all: true },
    _max: { updatedAt: true },
  });
  return `${_count._all}:${_max.updatedAt?.toISOString() ?? '-'}`;
}

/**
 * Loads every override into memory, replacing what was there. Returns the number of strings loaded,
 * or null when the table could not be read — in which case the previously loaded set is left alone.
 */
export async function loadTranslationOverrides(): Promise<number | null> {
  try {
    const next = await currentSignature();
    const rows = await prisma.translation.findMany({
      select: { language: true, key: true, value: true },
    });
    const count = applyTranslationOverrides(rows);
    signature = next;
    return count;
  } catch (error) {
    log.warn({ err: error }, 'Translation overrides unavailable — serving the bundled files');
    return null;
  }
}

/** Reloads only when the table has changed since the last load. */
export async function refreshTranslationOverrides(): Promise<number | null> {
  try {
    if ((await currentSignature()) === signature) return null;
  } catch (error) {
    log.debug({ err: error }, 'Translation refresh check failed');
    return null;
  }
  const count = await loadTranslationOverrides();
  if (count !== null) {
    log.info({ strings: count, byLanguage: overrideCounts() }, 'Translation overrides reloaded');
  }
  return count;
}

/**
 * Loads once at boot and then polls. Polling (rather than invalidating on write) is deliberate: the
 * admin panel writes these rows through its generic CRUD, and several API instances may be running,
 * so each one finding out for itself is what keeps them consistent.
 */
export async function startTranslationOverrides(): Promise<void> {
  const count = await loadTranslationOverrides();
  if (count !== null) {
    log.info({ strings: count, byLanguage: overrideCounts() }, 'Translation overrides loaded');
  }

  if (REFRESH_MS > 0 && !timer) {
    timer = setInterval(() => {
      void refreshTranslationOverrides();
    }, REFRESH_MS);
    // Never hold the process open for a copy refresh.
    timer.unref?.();
  }
}

/** Stops the refresh timer. For tests and a clean shutdown. */
export function stopTranslationOverrides(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
