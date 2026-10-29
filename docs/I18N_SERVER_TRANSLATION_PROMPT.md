# Server-side translation prompt (API)

Paste everything below the line into a fresh Claude Code session opened at the repo root.

---

The Anuva API (`apps/api`) now localises the text it sends to the patient and family apps: error
messages, push notifications, nudge questions and answer options, the weekly report, the 14-day
assessment report, family digest and articles, ANU safety replies, and specialist profiles. It
picks the language from the request's `Accept-Language` header, or from the recipient's stored
language for pushes and jobs. Every lookup falls back to English, so a missing file or key is
never an error. It just shows English.

English is the only bundle so far. Your job is to create the other nine.

## What to produce

**1. Required.** Nine files next to `apps/api/src/i18n/locales/en.json`:

| file | language |
|---|---|
| `hi.json` | Hindi |
| `mr.json` | Marathi |
| `te.json` | Telugu |
| `ta.json` | Tamil |
| `kn.json` | Kannada |
| `ml.json` | Malayalam |
| `bn.json` | Bengali |
| `or.json` | Odia |
| `gu.json` | Gujarati |

Each file has exactly the same nested key structure as `en.json`, with every string translated.
`en.json` has about 1,300 strings, so work one language at a time, section by section. Run one
subagent per language if you can.

**2. Optional, lower priority.** Library article overlays, `apps/api/src/data/library.<code>.json`.
These are translations of `apps/api/src/data/library.json` (40 long-form articles). An overlay only
holds the translated parts, matched by `slug` or `key`:

```json
{
  "session": { "...same keys as library.json session..." : "..." },
  "categories": [{ "key": "nutrition", "label": "…" }],
  "articles": [{
    "slug": "<same slug>",
    "title": "…", "dek": "…", "heroCaption": "…", "author": "…",
    "keyTakeaways": ["…"], "tags": ["…"],
    "blocks": [ /* the article's blocks array copied whole: same length, same order, same
                   `type` and every non-text field; translate only the human-readable text */ ]
  }]
}
```

Anything you leave out stays English, so partial overlays are fine. A file that doesn't fit the
schema is ignored whole, with English served instead. So copy `blocks` structure exactly. Do the
nine locale bundles first.

## Hard rules (the code depends on these)

- **Never translate, rename, add or remove keys.** Don't edit `en.json`, `library.json` or any code.
- **Keep every placeholder exactly as written.** Move it wherever the grammar needs it. There are
  two forms, and both must be kept:
  - Double braces: `{{firstName}}`, `{{name}}`, `{{count}}`, `{{date}}`, `{{doctor}}`, `{{metric}}`, …
  - Single braces, used in the weekly-report tables: `{this}`, `{last}`, `{noun}`, `{days}`,
    `{dayWord}`, `{episodes}`, `{when}`, `{count}`. These are filled by the code too. Don't turn
    them into `{{…}}`, and don't drop them.
- **Plurals.** Keys ending `_one` / `_other` are one counted string. Keep both keys. Add `_few`,
  `_many`, etc. only if the language's CLDR rules need them. Never merge them into one key.
- **Numbered lists** (objects keyed `"0"`, `"1"`, `"2"`, …) are translated item by item, keeping
  the same keys in the same order. This matters most in `nudges.items.*.options`:
  - Her tapped answer is mapped back to English **by position**, so keep every option at its index.
  - Within one question, every option must stay **distinct** from the others.
- **Brand and product names stay in Latin script**: Anuva, ANU, Anuva Wellness.
  - Helpline names and numbers stay exactly as written: Tele-MANAS 14416, iCall, AASRA, ERSS 112.
  - Drug names (HRT, SSRIs, venlafaxine, gabapentin) may be transliterated, with the Latin form kept
    in brackets on first use.
- **Emoji** stay where they are (💜 🌿).

## Voice

- The patient is an Indian woman aged roughly 40–55 in perimenopause. Speak to her in respectful
  second person (Hindi आप, Tamil நீங்கள், and so on), warm and plain, like a knowledgeable friend,
  not a textbook.
- Family strings (`family.*`) are read by her partner, children or parents. They refer to her in
  the third person, and they are gentle and never clinical.
- Everyday register. Prefer the word people actually say over a Sanskritised or formal coinage.
  Keep common English loanwords where that's normal speech (app, report, doctor, period).
- Keep strings about as short as the English. Push titles (`push.*`, `family.*Push*`,
  `family.cadenceTitles`) show on a lock screen and must stay short.
- Where the PWA bundles (`apps/pwa/src/i18n/locales/<code>.json`,
  `apps/family-pwa/src/i18n/locales/<code>.json`) already translate a term (symptom names such as
  hot flashes and brain fog; band names such as Restful and Strong), use **the same term** so the app
  and server agree.

## Sections that need extra care

- **`anu.redFlags.*.response`**: safety replies shown when she describes an emergency or
  thoughts of self-harm. Translate them faithfully and urgently. Never soften them, and keep every
  helpline number. Mark these for native-speaker clinical review in your summary.
- **`report14.*`**: the 14-day assessment report. The English is medically signed-off copy.
  Translate it precisely, without adding, dropping or softening any claim. List it in your summary
  as needing medical-advisor sign-off before release.
- **`errors.*`**: error messages. Keep them calm, not alarming.
- **`nudges.*`**: daily check-in questions and one-tap answers. Answers are her voice, in first
  person ("I slept well"), and should be short enough to fit on a chip.
- **`specialists.*`**: doctors' profile text. Keep degrees, institutions and proper nouns as
  written; translate the descriptive prose.

## Verify

```bash
pnpm check:i18n
```

In the `api:` section, every language must pass: no missing keys and no dropped placeholders.
(The `pwa` / `family-pwa` sections may still show a separate pending delta. That is not part of
this task.) Also:

```bash
for f in apps/api/src/i18n/locales/*.json apps/api/src/data/library.*.json; do node -e "JSON.parse(require('fs').readFileSync('$f','utf8'))" || echo "BAD $f"; done
pnpm --filter @anuva/api test
```

Once the files are in, they can be loaded into the `Translation` table so the team can correct
wording from the admin panel without a deploy (`pnpm --filter @anuva/api i18n:seed`). You do not
need to do that — just leave the files in place. See `docs/I18N.md`.

End with a short summary covering:
- anything you were unsure how to translate;
- the red-flag and report14 strings awaiting native or clinical review;
- which library overlays, if any, you produced.
