#!/usr/bin/env node
// Guards the one weakness of a tombstone erasure.
//
// Keeping the User row means Prisma's `onDelete: Cascade` never fires, so `eraseAccount` deletes
// child tables by name from the registry in packages/shared/src/privacy.ts. The default is
// therefore unsafe: add a model with a `userId` and it silently survives every erasure — data we
// told a user was gone, still sitting in Postgres, with nothing failing to say so.
//
// This script is what turns that silence into a build failure. It reads the schema, finds every
// model with a `user User` relation, and requires each one to appear in exactly one registry list.
//
//   pnpm check:erasure
//
// If it fails, do not just add the name to a list. Decide which list: deleted with the tracker,
// deleted with the chat, account-only, anonymised, or genuinely retained — and if retained, say
// why in a comment. The lists are the policy; this script only checks you wrote it down.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA = path.join(root, 'packages/database/prisma/schema.prisma');
const REGISTRY = path.join(root, 'packages/shared/src/privacy.ts');

const LISTS = [
  'ERASURE_TRACKER_MODELS',
  'ERASURE_CHAT_MODELS',
  'ERASURE_ACCOUNT_MODELS',
  'ERASURE_ANONYMIZED_MODELS',
  'ERASURE_RETAINED_MODELS',
];

/** Prisma model name -> delegate name, which is how the registry and `prisma[model]` spell it. */
function toDelegate(model) {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

function modelsOwningUserData(schema) {
  const found = [];
  // Split on the model keyword rather than brace-matching: enums and blocks in between are
  // irrelevant, and every model body ends before the next `\nmodel ` starts.
  for (const block of schema.split(/\nmodel /).slice(1)) {
    const name = block.split(/[\s{]/)[0];
    // The relation field, not the scalar: `userId String` also appears on join tables that reach a
    // user only indirectly, and those are erased through their parent.
    if (/^\s*user\s+User\??\s+@relation\(/m.test(block)) {
      found.push(name);
    }
  }
  return found;
}

function registryEntries(source) {
  const entries = new Map();

  for (const list of LISTS) {
    const match = source.match(new RegExp(`export const ${list} = \\[([^\\]]*)\\]`));
    if (!match) {
      throw new Error(`${list} not found in ${path.relative(root, REGISTRY)}`);
    }

    for (const raw of match[1].matchAll(/'([A-Za-z0-9_]+)'/g)) {
      const model = raw[1];
      if (entries.has(model)) {
        throw new Error(`"${model}" is in both ${entries.get(model)} and ${list}.`);
      }
      entries.set(model, list);
    }
  }

  return entries;
}

const schema = readFileSync(SCHEMA, 'utf8');
const registry = registryEntries(readFileSync(REGISTRY, 'utf8'));
const owned = modelsOwningUserData(schema);

const missing = owned.filter((model) => !registry.has(toDelegate(model)));
// A registry entry with no matching model is just as wrong: a rename leaves the erasure code
// pointing at a delegate that no longer exists, and it throws at request time rather than here.
const ownedDelegates = new Set(owned.map(toDelegate));
const stale = [...registry.keys()].filter((model) => !ownedDelegates.has(model));

if (missing.length === 0 && stale.length === 0) {
  console.log(
    `erasure coverage ok — ${owned.length} models with user data, all registered (${registry.size} entries)`,
  );
  process.exit(0);
}

if (missing.length > 0) {
  console.error(
    `\nThese models hold user data but no erasure list names them, so they would SURVIVE an account deletion:\n`,
  );
  for (const model of missing) {
    console.error(`  ${model}  (add '${toDelegate(model)}' to one of: ${LISTS.join(', ')})`);
  }
}

if (stale.length > 0) {
  console.error(`\nThese registry entries match no model with a user relation:\n`);
  for (const model of stale) {
    console.error(`  ${model}  (${registry.get(model)}) — renamed or removed?`);
  }
}

console.error(`\nRegistry: ${path.relative(root, REGISTRY)}`);
process.exit(1);
