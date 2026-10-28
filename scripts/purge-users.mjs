#!/usr/bin/env node
/**
 * Hard-deletes test accounts and everything they created — for clearing UAT users, not for a
 * patient's erasure request (that is privacy/erasure.ts, which keeps clinical records).
 *
 *   node scripts/purge-users.mjs <userId> [<userId> ...]            dry run: counts only
 *   node scripts/purge-users.mjs <userId> [<userId> ...] --confirm  backup, then delete
 *   node scripts/purge-users.mjs --all [--confirm]                  every patient account
 *
 * `--all` takes every `User` row. Doctors are `Specialist` rows and content (library, care paths,
 * guides, slots) belongs to no user, so none of that goes; slots booked by these accounts are freed.
 *
 * Deleting the User row cascades almost everything. What does not cascade is handled first, in the
 * same transaction: booked slots are freed, doctor notifications naming the consultations go,
 * login history, OTP codes, anonymous questions, support tickets and data requests are deleted
 * rather than left detached. Family members of these accounts go with them (cascade), along with
 * their sessions, devices and login history.
 *
 * Before deleting, every row with a `userId` for these accounts is written to a JSON backup.
 * Files (note photos, consultation documents, recordings, exports) live on the API server's disk,
 * so this cannot remove them; their paths are printed for removal there.
 *
 * DATABASE_URL comes from the environment, falling back to the repo-root .env.
 */

import { createRequire } from 'node:module';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'packages/database/package.json'));

function loadEnv() {
  if (process.env.DATABASE_URL) return;
  const envPath = path.join(root, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!m) continue;
    const [, key, rawValue] = m;
    if (process.env[key] !== undefined) continue;
    let value = rawValue.trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnv();
const { PrismaClient, Prisma } = require('@prisma/client');
const prisma = new PrismaClient();

const args = process.argv.slice(2);
const confirm = args.includes('--confirm');
const backupArg = args.find((arg) => arg.startsWith('--backup-dir='));
const backupDir = backupArg ? backupArg.slice('--backup-dir='.length) : process.cwd();
const all = args.includes('--all');
let userIds = [...new Set(args.filter((arg) => !arg.startsWith('--')))];

if (all === (userIds.length > 0)) {
  console.error('Usage: node scripts/purge-users.mjs (<userId> [...] | --all) [--confirm] [--backup-dir=DIR]');
  process.exit(1);
}

const host = (process.env.DATABASE_URL ?? '').replace(/^[a-z]+:\/\/[^@]*@/, '').replace(/\?.*$/, '');
const lower = (name) => name.charAt(0).toLowerCase() + name.slice(1);

/** Every model with a `userId` column, read from the schema so a new table is never missed. */
const userModels = Prisma.dmmf.datamodel.models
  .filter((model) => model.fields.some((field) => field.name === 'userId'))
  .map((model) => lower(model.name));

const json = (value) =>
  JSON.stringify(value, (_key, v) => (typeof v === 'bigint' ? v.toString() : v), 2);

async function main() {
  console.log(`Database: ${host}`);
  console.log(confirm ? 'Mode: DELETE (after backup)\n' : 'Mode: dry run — nothing will be deleted\n');

  if (all) {
    userIds = (await prisma.user.findMany({ select: { id: true } })).map((user) => user.id);
    const doctors = await prisma.specialist.count();
    console.log(`--all: ${userIds.length} patient account(s). ${doctors} doctor(s) are not users and stay.\n`);
    if (userIds.length === 0) return;
  }

  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, phone: true, createdAt: true },
  });
  const missing = userIds.filter((id) => !users.some((user) => user.id === id));
  if (missing.length > 0) {
    console.error(`Not found, nothing done: ${missing.join(', ')}`);
    process.exit(1);
  }
  for (const user of users) {
    console.log(`  ${user.id}  ${user.name ?? '(no name)'}  ${user.phone}  joined ${user.createdAt.toISOString().slice(0, 10)}`);
  }

  const [consultations, members] = await Promise.all([
    prisma.consultation.findMany({ where: { userId: { in: userIds } }, select: { id: true } }),
    prisma.familyMember.findMany({ where: { userId: { in: userIds } }, select: { id: true, phone: true } }),
  ]);
  const consultationIds = consultations.map((row) => row.id);
  const memberIds = members.map((row) => row.id);
  const phones = [...new Set([...users.map((user) => user.phone), ...members.map((member) => member.phone)])];

  const extra = {
    'consultationSlot (freed)': await prisma.consultationSlot.count({ where: { consultationId: { in: consultationIds } } }),
    doctorNotification: await prisma.doctorNotification.count({ where: { consultationId: { in: consultationIds } } }),
    'loginSession (family)': await prisma.loginSession.count({ where: { familyMemberId: { in: memberIds } } }),
    'otpChallenge (by phone)': await prisma.otpChallenge.count({ where: { phone: { in: phones } } }),
  };

  // A model can be in the schema without its table having been migrated in; skip those rather than
  // fail. Postgres cascades through the tables that do exist.
  const existing = new Set(
    (await prisma.$queryRaw`select table_name from information_schema.tables where table_schema = 'public'`).map(
      (row) => row.table_name,
    ),
  );
  const tableOf = new Map(Prisma.dmmf.datamodel.models.map((model) => [lower(model.name), model.dbName ?? model.name]));
  const skipped = userModels.filter((model) => !existing.has(tableOf.get(model)));
  if (skipped.length > 0) console.log(`\n(Not in this database, skipped: ${skipped.join(', ')})`);

  console.log('\nRows that will go:');
  const backup = { database: host, takenAt: new Date().toISOString(), users, tables: {} };
  let total = 0;
  for (const model of userModels.filter((name) => !skipped.includes(name))) {
    const rows = await prisma[model].findMany({ where: { userId: { in: userIds } } });
    if (rows.length === 0) continue;
    backup.tables[model] = rows;
    total += rows.length;
    console.log(`  ${model.padEnd(28)} ${rows.length}`);
  }
  for (const [label, count] of Object.entries(extra)) {
    if (count > 0) console.log(`  ${label.padEnd(28)} ${count}`);
  }
  console.log(`  ${'(plus rows that cascade from these: notes\' files, chat messages, call records, family sessions…)'}`);

  const [noteFiles, documents, recordings, exports] = await Promise.all([
    prisma.healthNoteAttachment.findMany({ where: { note: { userId: { in: userIds } } }, select: { storagePath: true } }),
    prisma.consultationDocument.findMany({ where: { consultationId: { in: consultationIds } }, select: { storagePath: true } }),
    prisma.consultationRecording.findMany({
      where: { consultationCall: { consultationId: { in: consultationIds } }, storagePath: { not: null } },
      select: { storagePath: true },
    }),
    prisma.dataExportRequest.findMany({
      where: { userId: { in: userIds }, storagePath: { not: null } },
      select: { storagePath: true },
    }),
  ]);
  const files = {
    'HEALTH_NOTE_DIR': noteFiles.map((row) => row.storagePath),
    'CONSULTATION_DOC_DIR': documents.map((row) => row.storagePath),
    'recordings': recordings.map((row) => row.storagePath),
    'exports': exports.map((row) => row.storagePath),
  };
  backup.files = files;

  if (!confirm) {
    console.log(`\n${total} rows across ${Object.keys(backup.tables).length} tables. Re-run with --confirm to back up and delete.`);
    return;
  }

  if (all) {
    // Every account, on whatever database DATABASE_URL names: one last chance to stop.
    console.log(`\nDeleting ALL ${users.length} patient accounts on ${host} in 10 seconds. Ctrl-C to stop.`);
    await new Promise((resolve) => setTimeout(resolve, 10_000));
  }

  const backupPath = path.join(backupDir, `purge-backup-${Date.now()}.json`);
  writeFileSync(backupPath, json(backup), { mode: 0o600 });
  console.log(`\nBackup written: ${backupPath}`);

  await prisma.$transaction([
    // Free the slots, or the times stay "booked" by a consultation that no longer exists.
    prisma.consultationSlot.updateMany({
      where: { consultationId: { in: consultationIds } },
      data: { isBooked: false, consultationId: null },
    }),
    // No relation to the consultation, and the body names the patient.
    prisma.doctorNotification.deleteMany({ where: { consultationId: { in: consultationIds } } }),
    // These detach (SetNull) instead of cascading; for a test account they should simply go.
    prisma.loginSession.deleteMany({
      where: { OR: [{ userId: { in: userIds } }, { familyMemberId: { in: memberIds } }] },
    }),
    prisma.otpChallenge.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { phone: { in: phones } }] } }),
    prisma.anonymousQuestion.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.supportTicket.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.dataDeletionRequest.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.dataExportRequest.deleteMany({ where: { userId: { in: userIds } } }),
    // Everything else cascades from the account.
    prisma.user.deleteMany({ where: { id: { in: userIds } } }),
  ]);

  const left = await prisma.user.count({ where: { id: { in: userIds } } });
  console.log(left === 0 ? `Deleted ${users.length} account(s).` : `WARNING: ${left} account(s) still present.`);

  const allFiles = Object.entries(files).filter(([, list]) => list.length > 0);
  if (allFiles.length > 0) {
    console.log('\nFiles to remove on the API server (relative to each directory):');
    for (const [dir, list] of allFiles) {
      console.log(`  ${dir}:`);
      for (const file of list) console.log(`    ${file}`);
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
