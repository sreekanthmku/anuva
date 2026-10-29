# Translation delta prompt — round 2

Paste everything below the line into a fresh Claude Code session opened at the repo root.

---

The nine language bundles in `apps/pwa/src/i18n/locales/` and `apps/family-pwa/src/i18n/locales/`
(`hi, bn, mr, te, ta, gu, kn, ml, or`) are already translated. An i18n audit added **103 new English
strings** that those bundles don't have yet, so those strings currently fall back to English on screen.

Translate only the new strings:

- `docs/i18n-delta/pwa.en.json` — 102 strings → merge into each of the 9 files in `apps/pwa/src/i18n/locales/`
- `docs/i18n-delta/family-pwa.en.json` — 1 string → merge into each of the 9 files in `apps/family-pwa/src/i18n/locales/`

**Merge, don't replace.** Each delta file has the same nested structure as `en.json`. Deep-merge the
translated delta into the existing language file. Don't touch, reorder or re-translate any key
that's already there. Don't edit `en.json` or any code.

All the rules from `docs/I18N_TRANSLATION_PROMPT.md` still apply: never translate keys; keep every
`{{placeholder}}` and `<1>…</1>` marker; use respectful second person; keep everyday register; stay short.
Match the terminology the existing bundle already uses. For example, if `hi.json` already translates
"Hot flashes" a certain way, use that same term here.

Notes on this batch:

- `report.balanceColumn.*`, `cycleSheet.loggedCycles`, `privacy.deletedItems` are plural keys
  (`_one` / `_other`). Use whatever CLDR plural categories the target language needs.
- `charts.*` and `*Aria*` strings are screen-reader labels that are never shown on screen. Keep them
  plain and complete rather than short.
- `wellness.bandNames.*` name how a day went (Great → Very hard), shown after the score as "72 · Good". One or two words each.
- `errors.*` are error messages. Keep them calm, not alarming.
- `time.hoursAgo` / `time.daysAgo` are compact relative times ("3h ago"). Use the language's natural
  short form.

Verify with:

```bash
pnpm check:i18n
```

It must end with `All bundles match English.`
