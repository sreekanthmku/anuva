# Anuva — Regulatory Compliance Audit

**Date:** 2026-08-08
**Scope:** DPDP Act 2023, NMC Telemedicine Practice Guidelines 2020, NRCeS/EHR Standards (FHIR R4, SNOMED-CT, LOINC), ABDM/UHI, CERT-In VAPT readiness.
**Method:** Static read of the repository at `main`. No code changed. No runtime/infra inspection — infra claims below are inferred from committed config and docs only.

**Verdict: NOT compliant for a production launch.** Roughly 8 of ~40 checked requirements are met. The largest gaps are (a) no consent capture at signup, (b) no account/data deletion, (c) health chat text leaves India to OpenAI, (d) no doctor registration numbers anywhere in the schema or UI, (e) no clinical terminology or FHIR layer at all.

---

## Scorecard

| # | Area | Status | Detail |
|---|---|---|---|
| 1 | DPDP — notice & consent at collection | 🔴 Missing | §1.1 |
| 2 | DPDP — regional-language notice | 🔴 Missing | §1.2 |
| 3 | DPDP — right to erasure | 🔴 Missing (dead UI) | §1.3 |
| 4 | DPDP — right to access / export | 🔴 Missing (dead UI) | §1.4 |
| 5 | DPDP — right to nominate | 🔴 Missing | §1.5 |
| 6 | DPDP — grievance officer published | 🟡 Partial | §1.6 |
| 7 | DPDP — no third-party sharing / monetisation | 🟢 Met (no ad SDKs) | §1.7 |
| 8 | DPDP — data localisation (India) | 🔴 Violated | §1.8 |
| 9 | DPDP — retention policy enforced | 🟡 Partial (support tickets only) | §1.9 |
| 10 | NMC — doctor registration number displayed | 🔴 Missing | §2.1 |
| 11 | NMC — state medical council displayed | 🔴 Missing | §2.1 |
| 12 | NMC — no delegation of consultation | 🟢 Met (structurally) | §2.2 |
| 13 | NMC — implied consent (patient-initiated) | 🟡 Partial | §2.3 |
| 14 | NMC — explicit consent (platform-initiated) | 🔴 Missing | §2.3 |
| 15 | NMC — recording consent, opt-in before connect | 🟢 Met | §2.4 |
| 16 | NMC — List O/A/B drug categorisation | 🔴 Not applicable yet / unbuilt | §2.5 |
| 17 | NMC — Schedule X / narcotics blocked | 🔴 Missing | §2.5 |
| 18 | NMC — structured digital prescription | 🔴 Missing (file upload only) | §2.6 |
| 19 | NMC — digital signature (IT Act 2000) | 🔴 Missing | §2.6 |
| 20 | NMC — tamper-proof flattened PDF | 🔴 Missing | §2.6 |
| 21 | NMC — 3-year record retention | 🟡 Unenforced (no policy, no purge) | §2.7 |
| 22 | NMC — patient can download prescription | 🟢 Met | §2.7 |
| 23 | NRCeS — SNOMED-CT symptom coding | 🔴 Absent | §3.1 |
| 24 | NRCeS — LOINC lab coding | 🔴 Absent (no lab module) | §3.2 |
| 25 | NRCeS — FHIR R4 resources/bundles | 🔴 Absent | §3.3 |
| 26 | ABDM — ABHA linkage (M1) | 🔴 Absent | §4 |
| 27 | ABDM — HIP/HIU (M2/M3), UHI | 🔴 Absent | §4 |
| 28 | CERT-In — VAPT | 🔴 Not started | §5 |
| 29 | Security — encryption at rest (AES-256) | 🔴 Not evidenced | §5.1 |
| 30 | Security — TLS in transit | 🟡 Likely (Coolify/LE), unpinned | §5.2 |
| 31 | Security — CORS | 🔴 Reflect-any-origin + credentials | §5.3 |
| 32 | Security — security headers (helmet) | 🔴 Missing | §5.3 |
| 33 | Security — global rate limiting | 🟡 Per-feature only | §5.4 |
| 34 | Security — password/session hashing | 🟢 Met (scrypt + hashed tokens) | §5.5 |
| 35 | Marketing claims vs. reality | 🔴 Overclaiming | §6 |

Legend: 🟢 met · 🟡 partial/unproven · 🔴 gap.

---

## 1. DPDP Act 2023

### 1.1 Notice and consent before collection — 🔴 Missing

There is no consent screen, checkbox, or notice anywhere in the signup or onboarding path. `apps/pwa/src/features/auth/` (`LoginRoute.tsx`, `SplashRoute.tsx`, `AuthProvider.tsx`) and `apps/pwa/src/features/onboarding/` contain zero occurrences of *consent*, *agree*, *terms*, or *privacy*. A user completes OTP login and starts logging symptoms with no notice presented and no consent record written.

The only consent artefacts in the system are:

- Support tickets — `SupportTicket.consentVersion` (`packages/database/prisma/schema.prisma:1234`), stamped from `CONSENT_VERSION = 'support-consent-v1'` (`apps/pwa/src/features/core/HelpRoute.tsx:22`), with the notice rendered at `HelpRoute.tsx:298`.
- Call recording — `ConsultationCallConsent` (`schema.prisma:636`), version `recording-consent-v1` (`apps/api/src/index.ts:211`).

Both are good patterns. Neither covers the primary act of collecting menstrual, mood, sleep, hot-flash, and mental-health data. **This is the single largest DPDP gap.**

### 1.2 Regional-language notice — 🔴 Missing

No i18n library in `apps/pwa/package.json` (no `i18next`, `react-intl`, `formatjs`). All copy is hardcoded English. The `en-IN` hits in the codebase are `toLocaleDateString` calls only (e.g. `ProfileRoute.tsx:25`) — date formatting, not translation.

### 1.3 Right to erasure — 🔴 Missing, and the UI implies otherwise

- No `DELETE /account`, `/auth/delete`, or equivalent exists. Full route list confirmed by enumerating every `app.<method>(` in `apps/api/src/index.ts` — the closest are `/auth/logout` (:3644) and `/doctor/…/documents/:docId` (:2393).
- `ProfileRoute.tsx:14` renders a row labelled **"Privacy & data — DPDP · export or delete"**. That row has no `to` field, so `onClick` resolves to `undefined` (`ProfileRoute.tsx:85`). **The button does nothing.** Only the nested `DPDP` text is a live link, and it points at the MeitY PDF of the Act (`apps/pwa/src/shared/lib/dpdp.ts:2`).
- `anonymizeSupportTicketsForUser()` (`apps/api/src/supportRetention.ts:32`) was written for account deletion — its docstring says "Called from account deletion" — but nothing calls it. It has zero callers in the repo.

Advertising an erasure control that is inert is worse than omitting it: it is a representation to the data principal that the platform cannot honour.

### 1.4 Right to access / portable export — 🔴 Missing

Same dead row as above. No export route, no archive job, no download endpoint for symptom history or lab metrics.

### 1.5 Right to nominate — 🔴 Missing

No nominee field on `User`, no route, no UI. `familyFeatureOptOut` (`schema.prisma:22`) is unrelated.

### 1.6 Grievance officer — 🟡 Partial

Published as `privacy@anuvawellness.com` (`apps/pwa/src/shared/lib/dpdp.ts:12`), surfaced in `HelpRoute.tsx:398` with a correct §13 rationale in the comment. The file carries its own blocker: *"TODO: confirm this mailbox exists before launch — a published contact that bounces is worse than none."* Unresolved.

### 1.7 No third-party sharing / monetisation — 🟢 Met on the ad-tech axis

No advertising, analytics, or pharma SDK found. Notably absent: GA, Segment, Mixpanel, Meta pixel. Health data is not being monetised. Two processors do receive data (see §1.8) — those are processing relationships, not sale, but they still require disclosure in a notice that does not exist.

### 1.8 Data localisation — 🔴 Violated

**Patient health chat text is sent to OpenAI in the US.** `apps/api/src/anu/openai.ts:10` posts to `https://api.openai.com/v1`; `/chat/completions` (:115) and `/embeddings` (:60) both carry the user's free-text message. That message is by design about hot flashes, mood, sleep, and sexual wellness. `AnuChatTurn.userMessage` (`schema.prisma:1146`) proves the content is verbatim patient input.

Other residency issues:

- Hosting is a self-managed VPS via Coolify, provider referenced as OVH in `docs/SERVER_MIGRATION.md` §2. **No region is pinned anywhere in the repo** — no `ap-south`, `bom1`, or equivalent in any config.
- Patient and doctor PWAs on Vercel (`SERVER_MIGRATION.md` §0). Static assets only, so lower risk, but the edge region is unset.
- FCM push via `firebase-admin` (`apps/api/package.json:19`) — Google infrastructure. Notification titles/bodies are stored in `DoctorNotification` (`schema.prisma:474`) and can carry clinical context.

LiveKit is self-hosted (`apps/livekit/docker-compose.prod.yml`), so call media does not leave your infrastructure — that part is correct, and the in-app copy claiming it (`ConsultationCallRoute.tsx:242`) is accurate.

### 1.9 Retention — 🟡 Partial

One genuine, enforced retention policy exists and it is well built: `SupportTicket.purgeAfter` stamped at creation (`apps/api/src/index.ts:4853`, default 180 days at :221), with a nightly cron hard-deleting expired rows (`supportRetention.ts:57`). This is the model to copy elsewhere.

Nothing else has a retention policy: symptom logs, nudge logs, `AnuChatTurn`, call recordings, and consultation documents all accumulate indefinitely. `ConsultationDocument.deletedAt` is a soft delete for the medico-legal trail (`schema.prisma:587`) — correct intent, but with no defined end date.

---

## 2. NMC Telemedicine Practice Guidelines

### 2.1 Practitioner credentials — 🔴 Missing

The `Specialist` model (`schema.prisma:414`) has `name`, `subtitle`, `role`, `specialization`, `summary`, `experience`, `tag`, `imageUrl`, and a `SpecialistQualification[]` free-text label list. It has **no registration number and no state medical council field**. `serializeSpecialist()` (`apps/api/src/index.ts:1604-1629`) therefore cannot expose them, and the patient booking UI cannot display them.

Grep for `regNumber`, `registrationNumber`, `medicalCouncil`, `NMC` across the codebase returns nothing (the `registration` hits are all service-worker / push-token registration).

Also absent from the profile, per your checklist: consultation fee and duration, language badges, consultation mode (video vs. audio) indicator, and a report-profile control. `Consultation.isFree` defaults `true` (`schema.prisma:560`) — there is no pricing model at all yet.

### 2.2 No delegation — 🟢 Met structurally

Call start is gated on a doctor session: `POST /doctor/consultations/:id/call/start` (`index.ts:2950`) behind `SpecialistSession`. There is no bot or assistant path into a consultation room. Anu (the AI) is a separate, non-clinical surface with a deterministic red-flag gate (`AnuChatTurn.redFlagArea`, `schema.prisma:1156`).

### 2.3 Dual consent framework — 🟡 / 🔴

- **Implied consent (patient-initiated):** `POST /consultations/book` (`index.ts:2508`) is patient-initiated, which satisfies the implied-consent reading. But there is no microcopy under the booking button stating that logged symptoms will be shared with the doctor — and symptoms *are* shared: `GET /doctor/consultations/:id/detailed-assessment` (`index.ts:4422`) exposes her questionnaire to the doctor. Consent for that disclosure is never captured.
- **Explicit consent (platform-initiated / record access):** Missing. Nothing prompts for tap-to-accept when the doctor pulls the assessment, and there are no per-data-type sharing toggles.

### 2.4 Recording consent — 🟢 Met

Well implemented. `POST /consultations/:id/call/consent` (`index.ts:3088`) upserts a versioned `ConsultationCallConsent`, and `POST /consultations/:id/call/join` (:3138) hard-blocks with 403 when recording is enabled and consent is absent (`index.ts:3147-3149`). The consent screen precedes connection (`ConsultationCallRoute.tsx:235-250`). This is the one requirement in this document that is fully satisfied.

### 2.5 Drug categorisation (List O / A / B / prohibited) — 🔴 Not implemented

There is no drug model, no formulary, no prescribing module. Grep for `schedule x`, `narcotic`, `psychotropic` returns nothing. No backend restriction can exist because no structured prescribing exists (see §2.6). If a doctor writes an HRT or anxiolytic on an uploaded image, nothing in the system knows or enforces the video-consult-only rule.

### 2.6 Digital prescription structure — 🔴 Missing

A "prescription" here is a doctor-uploaded **image or PDF file**: `ConsultationDocument` with `kind = prescription` (`schema.prisma:573`), accepting JPEG/PNG/WebP/HEIC/PDF up to 10 MB (`apps/api/src/consultationDocuments.ts:22-45`).

Against the NMC structured-prescription requirement, none of the following exist: mandatory header block (doctor reg. no., platform legal name, timestamp, patient age/gender, unique prescription ID), chief complaints / history / Rx / investigations / advice / follow-up sections, generic-name-in-block-letters enforcement, dosage-form-frequency-duration fields, digital signature per IT Act 2000, or PDF flattening. There is no PDF generation library in `apps/api/package.json` at all.

### 2.7 3-year record keeping — 🟡 Unenforced

- **Patient download:** works. `GET /consultations/:id/documents/:docId/file` (`index.ts:2202`) with ownership checks, surfaced in `MyBookingsRoute.tsx`. 🟢
- **Retention:** there is no 3-year floor and no policy anywhere. Documents survive by soft delete (`deletedAt`), recordings and `ConsultationCall` rows have no protection against a routine cleanup, and — the inverse risk — `Consultation` cascades on user delete (`schema.prisma:555`, `onDelete: Cascade`). If you implement DPDP erasure naively (§1.3), **deleting a user will destroy the consultation records the NMC requires you to keep for 3 years.** These two obligations conflict and must be resolved deliberately: anonymise the clinical record, do not cascade it away. The `SupportTicket` pattern (`onDelete: SetNull` + field scrub, `schema.prisma:1219`) is exactly the right precedent.
- Chat transcripts: `ChatMessage` / `AnuChatTurn` cascade-delete with the user too.

---

## 3. NRCeS / EHR Standards

### 3.1 SNOMED-CT — 🔴 Absent

Zero occurrences of `snomed` in the repo. Symptoms are free strings or local enums with no code column:

- `quickSymptomSchema = z.enum(['hot_flash','anxiety','chills','irritability'])` (`packages/shared/src/quickLog.ts:3`) — maps to SNOMED 67443009, 48694002, and so on, but nothing records that.
- `Symptom` model has `key`, `label`, `category` and no `snomedCode` (`schema.prisma:276`).
- Every nudge log (`HotFlashDailyLog`, `BrainFogLog`, `PainLog`, `BloatingLog`, …) stores `category String` — an ANU-internal bucket, uncoded.
- `MenopauseStage` enum (`schema.prisma:138`) has the four states you'd map to 289908002 / 373717006 / 398700009, with no code attached.

The recommended decoupling (UI display name separate from concept ID) is not present anywhere. The good news: the schema is *shaped* for it — adding a nullable `snomedCode` to `Symptom` and a code map for the nudge categories is additive, not a rewrite.

### 3.2 LOINC — 🔴 Absent, no lab module exists

Zero occurrences of `loinc`. There is no lab-result model, no FSH/LH/Estradiol/AMH/TSH tracking, no hormone trend chart, and no upload path for blood work. Everything in your LOINC and hormone-charting specification is unbuilt from scratch — not miscoded, simply absent.

### 3.3 FHIR R4 — 🔴 Absent

Zero occurrences of `fhir`. No `Patient`, `Observation`, or `Bundle` resource shapes; no FHIR serialisation layer; no dependency. All API contracts are bespoke Zod schemas in `@anuva/shared`.

---

## 4. ABDM / ABHA / UHI — 🔴 Absent

Zero occurrences of `abdm`/`abha` in application code. The only hits are marketing copy in `apps/landing/Anuva Wellness Landing.html`. No ABHA field on `User`, no gateway client, no consent-manager integration, no HIP/HIU callbacks, no UHI discovery/booking adapter. Sandbox milestones M1–M3 are all at zero. **Note the landing page already references ABDM** — see §6.

---

## 5. CERT-In VAPT readiness

No audit artefacts, no `SECURITY.md`, no threat model, no staging-environment config distinct from production in the repo. Findings that a VAPT would raise on day one:

### 5.1 Encryption at rest — 🔴 Not evidenced
No application-level encryption of health fields. No `pgcrypto`, no envelope encryption, no KMS reference. Postgres is a plain Coolify database or managed instance (`SERVER_MIGRATION.md` §0) with no documented disk encryption. Consultation recordings and prescription files sit on a plain volume (`CONSULTATION_DOC_DIR`, `consultationDocuments.ts:26`; `apps/livekit/consultation-recordings/`). AES-256 at rest is asserted in marketing (§6) and implemented nowhere.

### 5.2 TLS — 🟡 Probable, unpinned
Let's Encrypt via the Coolify proxy (`SERVER_MIGRATION.md` §1). No minimum-version pin to TLS 1.2/1.3 in any committed config. LiveKit media ports 7881/tcp and 7882/udp bypass the proxy (§2 of the runbook) — WebRTC is DTLS-SRTP encrypted, which is fine, but it belongs in the audit scope explicitly.

### 5.3 CORS and security headers — 🔴
`app.use(cors({ origin: true, credentials: true }))` (`apps/api/src/index.ts:229`) reflects **any** origin and allows credentials. Combined with cookie-based sessions, this is a cross-origin request forgery / data-exfiltration finding an auditor will flag immediately. Fix: an explicit origin allowlist.

No `helmet` in `apps/api/package.json` — no HSTS, CSP, X-Frame-Options, X-Content-Type-Options, or Referrer-Policy. No CSRF token anywhere.

### 5.4 Rate limiting — 🟡
No global limiter (no `express-rate-limit`). Per-feature throttles exist and are sensible: OTP resend cooldown (`index.ts:190`, :3355), OTP verify attempt cap (`OTP_MAX_VERIFY_ATTEMPTS`, :3456), Q&A daily cap (:218), support ticket daily cap. Every other route — including `/anu/chat`, which costs money per call — is unthrottled.

### 5.5 Credentials — 🟢
Genuinely good. Doctor passwords use scrypt with a documented parameterised format (`schema.prisma:422-425`), session tokens are stored only as hashes (`Session.tokenHash`, `SpecialistSession.tokenHash`), DB-persisted lockout survives restart (`schema.prisma:428-430`), cookies are `httpOnly` + `sameSite` + `secure` (`index.ts:392-402`), doctor sessions are capped at 12h vs. the patient 30d with the reasoning recorded (`index.ts:214-216`), and the logger redacts `x-admin-token` (`apps/api/src/logger.ts:29`). Admin auth is a shared `ADMIN_PASSWORD` (`apps/api/src/admin/config.ts:14`) — acceptable for an internal panel, but single-factor and shared, which an auditor will note.

---

## 6. Claims already being made publicly — 🔴

This is the most immediate legal exposure, because these are representations to consumers today:

| Claim | Where | Reality |
|---|---|---|
| "DPDP-compliant, encrypted" | `apps/pwa/src/features/onboarding/SubscriptionRoute.tsx:50` | No consent notice, no erasure, no export, no encryption at rest |
| "DPDP · export or delete" | `apps/pwa/src/features/core/ProfileRoute.tsx:14` | Inert button |
| "Encrypted" trust badge | `apps/pwa/src/features/onboarding/components/TrustStrip.tsx:24` | TLS in transit only |
| AES-256 / ABDM / ABHA | `apps/landing/Anuva Wellness Landing.html` | None implemented |

Either build the capability or remove the claim. Under DPDP, a false statement about data handling in the consent flow taints the consent itself.

Accurate claims worth keeping: the recording copy at `ConsultationCallRoute.tsx:242` ("not sent through a third-party calling provider") is true — LiveKit is self-hosted.

---

## 7. What is actually working

Worth stating plainly, because the compliance instincts in this codebase are good where they were applied:

1. **Recording consent** — versioned, join-blocking, pre-connection. Fully NMC-compliant (§2.4).
2. **Support-ticket retention** — stamped `purgeAfter`, hard-delete cron, consent version recorded so a reword can't rewrite history. The correct pattern; copy it (§1.9).
3. **Anonymity in Q&A** — `AnonymousQuestion.userId` is documented as never reaching the doctor portal and the routes honour it (`schema.prisma:702-707`).
4. **Document access control** — `storagePath` server-generated and never sent to clients, MIME sniffed rather than trusted, ownership-checked reads (`consultationDocuments.ts:56`, `index.ts:2202`).
5. **Credential handling** — scrypt, hashed session tokens, persistent lockout (§5.5).
6. **Support-ticket erasure design** — `SetNull` + field scrub rather than cascade. This is the pattern that resolves the DPDP-vs-NMC conflict in §2.7.

---

## 8. Recommended order of work

**Blocking for any public launch (weeks, not months):**

1. Consent notice + non-pre-checked checkbox before first health data write; persist `consentVersion` on `User`. (§1.1)
2. `DELETE /account` + working Privacy & data screen — with clinical records anonymised, **not** cascaded, so the 3-year NMC obligation survives. (§1.3, §2.7)
3. `GET /account/export` — portable JSON/PDF archive. (§1.4)
4. Add `registrationNumber` + `stateMedicalCouncil` to `Specialist`; display on every profile. Legally required before any consultation is sold. (§2.1)
5. Remove or substantiate every "DPDP-compliant / encrypted / AES-256 / ABDM" claim. (§6)
6. Fix CORS to an allowlist; add helmet. (§5.3)
7. Decide the Anu chat data-residency question: an India-hosted model, an India inference region, or an explicit granular cross-border consent. Current state is an unconsented cross-border transfer of sensitive health data. (§1.8)
8. Pin all infrastructure to an India region and document it. (§1.8)

**Before charging for teleconsultations:**

9. Structured prescription generator: mandatory sections, generic name in block letters, unique prescription ID, flattened PDF, doctor e-signature. (§2.6)
10. Drug formulary with List O/A/B categorisation and a hard block on Schedule X / narcotics / psychotropics. (§2.5)
11. 3-year retention policy for calls, transcripts, documents, and recordings — with a purge job for everything *past* it. (§2.7)
12. Explicit tap-to-accept consent before a doctor reads the detailed assessment; per-data-type sharing toggles. (§2.3)
13. CERT-In empanelled VAPT on a staging build; encryption at rest for PHI columns and file volumes. (§5)

**Interoperability track (additive, do it before the data grows):**

14. Add `snomedCode` to `Symptom` and map the nudge categories — cheap now, a backfill migration later. (§3.1)
15. Build the lab module LOINC-coded from day one rather than retrofitting. (§3.2)
16. FHIR R4 serialisation layer, then ABDM sandbox M1 (ABHA), then M2/M3. (§3.3, §4)
