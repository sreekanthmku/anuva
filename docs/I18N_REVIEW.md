# Translation review — what needs a human before release

All nine languages are complete: app screens, server text (Track page, reports, errors, pushes,
family app) and the 40-article library. Every file passes the automated checks in `docs/I18N.md`.

What automation cannot judge is below, in priority order. Nothing here blocks shipping the app; the
first two sections should be settled before a language goes to real patients.

## 1. Errors in the English source (content / clinical owner)

The translators translated these as written, so **fixing the English means updating all nine
languages too** — edit `apps/api/src/data/library.json`, then re-translate the affected passage.

**Factual or self-contradictory**

| Article | Problem |
|---|---|
| `bone-health-perimenopause` | "Most bone loss *during perimenopause* occurs in the 5–10 years immediately *post-menopause*" — contradicts itself. |
| `perimenopause-insomnia` | Tip headed "Early-evening exercise" says "a walk after lunch". |
| `irritability-not-depression` | "But you're not. You're perimenopause." — ungrammatical (likely "You're in perimenopause"). |
| Timelines | Perimenopause is "3–10 years" in two relationship articles, "4–10 years" in `this-phase-is-temporary`. |

**Claims stated more strongly than their own article supports**

| Article | Problem |
|---|---|
| `hot-flashes-and-your-sleep` | Takeaway states sage and black cohosh cut flashes for 40–60% of women as fact; the body says "emerging evidence suggests". |
| `complementary-therapies` | Herbal medicine sits under "With good evidence" but is described as "modest evidence". Acupuncture takeaway drops the body's hedge, and its session count differs from the body. |
| `sleep-supplements` | Valerian listed under "good evidence" but described as "modest evidence". |
| `desire-changes-perimenopause` | Says vaginal estrogen has no systemic effects; `vaginal-dryness` says "minimal systemic absorption". A list item headed "Hydration" is about lubrication. |

**Physiology worth a clinician's look**

- `why-your-jeans-dont-fit`: "slows your metabolic rate by 2–8% per year".
- `exhausted-even-though-sleeping`: hormones "tax your adrenal system"; a morning walk "activates your parasympathetic system".
- `perimenopause-skin-changes`: oily teenage skin "improved after 20s, as estrogen rose".
- `perimenopause-migraines`: hormonal contraceptives "amplify estrogen fluctuations"; an IUD "stabilizes hormone levels".
- `joint-aches-perimenopause`: the heading "What reverses this" promises more than the advice under it.

## 2. Safety-critical translations (native speaker with clinical background, all 9 languages)

- **`anu.redFlags.*.response`** in `apps/api/src/i18n/locales/<code>.json` — emergency and
  self-harm replies. Check each is urgent, unsoftened, and carries every helpline number.
- **`report14.*`** — the 14-day assessment report, medically signed-off in English. Needs the same
  sign-off per language.
- **Library "When to get checked" callouts** — bleeding, breast, self-harm and migraine red flags.

Separately: ANU's red-flag **detection** matches English words only. An emergency described in
another language is caught by the model, not by the rules. Needs a decision before non-English
chat is promoted.

## 3. Decisions for the product owner

- **"Anuva Care Companion"** (3 library articles) has no established name. Hindi, Marathi, Bengali
  and Telugu transliterated it; Gujarati, Kannada, Malayalam and Odia kept it in Latin script. Pick
  one and apply it everywhere.
- **Tamil `bone-health-perimenopause`** quietly corrected the contradictory sentence above instead
  of translating it; every other language kept the English meaning. Resolve when the English is fixed.
- **"Share with Family"** is quoted in English inside the Family overlay of the 14-day report, as a
  literal button label. If that button is itself translated, the sentence should match it.

## 4. Native-speaker polish (non-blocking)

Flagged by the translators, by key or slug:

- **Chip length:** `nudges.items.L1-003.options.4` ("Emotionally numb") is long in Telugu.
- **Grammar in composed sentences:** the report's `{this}` / `{last}` / `{noun}` words are slotted
  into sentences; each language chose case forms to fit. Worth reading real rendered reports:
  `report.text.daysThis`, `report.periodWords.*.last`, `family.activityText.oneActor`.
- **Fallback words:** `report14.document.recipientFallback` ("there", as in "Hello there") has no
  natural equivalent in several languages. `family.jobText.herFallback` ("her") in all.
- **Plurals:** several languages don't inflect for number, so `_one` / `_other` pairs are
  identical. Correct, but expected when reviewing.
- **Friend:** `privacy.recipientRelationships.friend` in Telugu gives both genders with a slash.
- **Sexual-health wording** in `desire-changes-perimenopause`, `sexual-pain-dyspareunia` and
  `vaginal-dryness`, where register varies by language.
- **Digits:** Bengali app screens sometimes use Bengali numerals; the library uses Western digits.
- **"primary care doctor"** became "family doctor" in most languages — the Indian equivalent.

## 5. Known limits

- The 14-day report **PDF** is always English: its built-in fonts have no Indic glyphs. The in-app
  and HTML versions are translated.
- Doctor-written notes, document titles and Q&A answers are shown as the doctor wrote them.
- The doctor portal and admin panel are English.

## Deploying

```bash
pnpm db:migrate                          # preferredLanguage (User, FamilyMember) + Translation table
pnpm --filter @anuva/api i18n:seed       # optional: load bundles into the table for admin edits
```

Until a user's next request stores their language, their pushes go out in English.
