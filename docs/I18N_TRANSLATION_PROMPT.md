# Translation prompt — Anuva patient & family PWAs

Paste everything below the line into a fresh Claude Code session opened at the repo root.

---

You are adding nine language bundles to the Anuva PWAs. All the wiring already exists — your job is
**only** to create JSON translation files. Do not change any `.tsx`, `.ts`, `.css` or config file.

## What exists already

Two apps, each with its own self-contained i18n setup:

| App | Locales directory | English strings |
|---|---|---|
| Patient PWA (`@anuva/pwa`) | `apps/pwa/src/i18n/locales/` | 1323 |
| Family PWA (`@anuva/family-pwa`) | `apps/family-pwa/src/i18n/locales/` | 174 |

Each directory currently holds one file, `en.json`. The app loads every `locales/*.json` through a
Vite glob, so **dropping a new file in is the whole of "add a language"** — there is no list to
update, no import to add, no component to touch. The language toggle greys out any language whose
file is missing and lights it up automatically once the file lands.

## What to produce

Eighteen files — nine languages × two apps:

```
apps/pwa/src/i18n/locales/{hi,bn,mr,te,ta,gu,kn,ml,or}.json
apps/family-pwa/src/i18n/locales/{hi,bn,mr,te,ta,gu,kn,ml,or}.json
```

| Code | Language | Script |
|---|---|---|
| `hi` | Hindi | Devanagari |
| `bn` | Bengali | Bengali |
| `mr` | Marathi | Devanagari |
| `te` | Telugu | Telugu |
| `ta` | Tamil | Tamil |
| `gu` | Gujarati | Gujarati |
| `kn` | Kannada | Kannada |
| `ml` | Malayalam | Malayalam |
| `or` | Odia | Odia |

Each file must mirror `en.json` **exactly**: the same nested structure, the same key names, every
key present. Only the string values change.

## Hard rules

1. **Never translate a key.** `"hotFlashes"` stays `"hotFlashes"`; only its value changes.
2. **Keep every `{{placeholder}}` verbatim**, including the braces and the exact name inside.
   `"Day {{day}} · Week {{week}}"` must still contain `{{day}}` and `{{week}}` — reorder them freely
   to suit the grammar, but never rename, translate or drop one.
3. **Keep every `<1>…</1>` marker.** These are React components the app substitutes in — a link, a
   `<strong>`, an emphasised word, an inline icon. Wrap whichever words in the target language
   should carry that emphasis or that link; the *numbers* must match the English exactly
   (`<1>`/`</1>` pairs, and self-closing ones such as `<1/>` stay self-closing).
   Example — English `"Know your <1>body</1>."` becomes Hindi `"अपने <1>शरीर</1> को जानें।"`
4. **Plural keys.** A handful of keys end in `_one` / `_other` (12 in the patient app). If the target
   language needs a different set of CLDR plural categories, use those instead — `_one`/`_other` are
   not required to survive, but the base name before the suffix must.
5. **Keep emoji and typographic symbols** where English has them: `✓`, `★`, `→`, `←`, `💛`, `😊`,
   `●`, `·`, `—`. They are part of the layout.
6. **Do not translate brand names.** `Anuva`, `Anuva Wellness`, `Anuva Family`, `ANU`, `Anu`,
   `DPDP`, `WhatsApp`, `Safari`, `Chrome`, `PDF`, `HRT` stay as they are. Transliterating `ANU` into
   the local script is acceptable *only* if it reads naturally; when in doubt, leave it Latin.
7. **`common.brandName`** is the wordmark `ANUVA WELLNESS` — leave it in Latin capitals in every
   language. **`common.tagline`** ("a soft place to land.") is set in a script face that has no
   Indic glyphs, so leave it in English too.
8. **Leave `₹` prices, digits and units as they are** (`₹799`, `₹4,999`, `<5h`, `5–6h`). Translate
   only any words around them.
9. **Valid JSON, UTF-8, 2-space indent, no trailing commas, no comments.**

## Tone

This is a perimenopause health app used daily by Indian women aged roughly 38–55, and a companion
app used by their families. The English is deliberately warm, plain and unclinical — it explains
rather than instructs, and never sounds alarmed.

- Use the **respectful second person** throughout (Hindi आप, Tamil நீங்கள், Telugu మీరు, and each
  language's equivalent) — never the familiar form, in either app.
- Prefer **everyday spoken vocabulary over Sanskritised or literary registers**. Someone reading on
  a phone at 3am should not have to parse a formal word. Where a clinical term is genuinely the one
  people use (often the English loanword for "hormone", "period", "PCOS"), use the loanword in the
  local script rather than inventing a translation nobody says.
- Keep it **short**. These strings sit in 9.5px nav labels, chips and one-line cards. If a faithful
  translation runs much longer than the English, find a shorter way to say the same thing.
- **Never invent, soften or add medical claims.** Translate what is there.

## Places to be especially careful

- `pwa/assessment.questions.*` and `pwa/detailedAssessment.questions.*` — clinical screening
  questions. Translate the *meaning* precisely; a woman's answer here feeds a score and a care path.
- `pwa/joints.*`, `pwa/sleepSheet.*`, `pwa/moodSheet.*` — symptom vocabulary. Use the words a
  patient would use with her own doctor, not a textbook.
- `pwa/privacy.*` and `pwa/help.dpdpNotice` — statutory DPDP language. Stay faithful; do not
  paraphrase away a right or a retention period.
- `family-pwa/join.*` and `family-pwa/signIn.*` — read by a husband, son or daughter who has never
  seen the app before. Plain and welcoming.
- `pwa/nav.*` and `family-pwa/nav.*` — bottom-tab labels rendered at 9.5px. One or two short words.

## Verify before you finish

```bash
pnpm check:i18n
```

It compares every bundle against its app's English one and fails on a missing key, an extra key, a
dropped `{{placeholder}}` or a mismatched `<1>` marker. It also flags strings left identical to the
English so you can check whether that was deliberate (brand names and `₹` prices legitimately are).

Then confirm nothing else broke:

```bash
cd apps/pwa && npx tsc --noEmit && npx vite build
cd ../family-pwa && npx tsc --noEmit && npx vite build
```

Report which languages you completed and anything you had to leave in English with the reason.
