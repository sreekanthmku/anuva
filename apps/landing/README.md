# apps/landing

Static site for `anuvawellness.com`, deployed by the Vercel project `anuva-landing`.

## Current state: pre-launch

The build publishes **`coming-soon.html` only**, as `dist/index.html`. The full marketing page
(`index.html`) is still in the repo but is **not served** — it advertises a free trial and
pricing, which is wrong before launch.

## The marketing page

`index.html` + `landing.css`, layered on `page.css` like every other page here. Plain HTML, no
build step, no framework, no JavaScript except the JSON-LD block. The mobile menu is a
`<details>` and the FAQ is a stack of `<details>`, so the content is all in the served HTML.

It replaces **`Anuva Wellness Landing.dc.html`**, which is kept only as a reference and should
not be deployed. That file is a design-canvas template: `<x-dc>`, `<sc-for>` and `{{ }}`
bindings rendered in the browser by `support.js` (React). Anything that did not run the script
— crawlers, link unfurlers, `curl` — saw raw mustache tags instead of the FAQ, and the file
carried no `<title>`, description or OG tags at all. `.dc.html.bak` next to it is a byte copy
taken before the rewrite.

### Before this page goes live

`index.html` carries `VERIFY BEFORE LAUNCH` comments on the three things that need evidence
rather than copywriting, and a `TODO BEFORE LAUNCH` on the care-team section:

- the "Trusted by 2,000+ women" figure and the 5-star rating,
- the three named testimonials (`Priya M.`, `Anjali R.`, `Sunita K.`),
- the trial billing timeline, in particular whether card details are taken up front,
- the four discipline cards, which should become named practitioners with registration numbers.

Grep for `BEFORE LAUNCH` to find them. Unsupported claims on a health product are a Consumer
Protection Act 2019 exposure, not a polish item; delete the blocks rather than ship them
unverified.

### Images

`uploads/hero-woman-cutout.webp` is the hero. It is `uploads/hero-woman.webp` with its alpha
channel recovered: the original was exported with the editor's transparency checkerboard
flattened into the pixels (`sips -g hasAlpha` reports `no`), so it renders as a grey grid on the
cream ground. If the photo is ever re-exported, export it as WebP **with alpha** and this
derived file can go.

## Standalone pages

`about.html`, `contact.html`, `privacy.html` and `terms.html` are plain static pages sharing
`page.css`, and they **do** ship pre-launch — the marketing page is withheld because it
advertises pricing, which these do not. `cleanUrls` serves them at `/about`, `/contact`,
`/privacy` and `/terms`.

`contact.html` posts to the same Web3Forms inbox as the waitlist and needs the same build-time
key substitution, so it goes through `sed` alongside `coming-soon.html` in both build commands.

The legal pages are **unreviewed templates** with bracketed placeholders (entity name, address,
CIN/GSTIN, Grievance Officer, jurisdiction city). Get them checked and filled in before launch.

## Waitlist

Signups POST to Web3Forms, which emails each one to the registered inbox. There is no backend
and no database.

The access key is substituted into `dist/index.html` at build time from the
`WEB3FORMS_ACCESS_KEY` environment variable (set on the Vercel project, Production + Preview),
so it is not committed. It does still appear in the served HTML — it has to reach the browser —
which Web3Forms considers fine: the key is a public alias for the destination inbox, not a
secret. Anyone can post to the form; a hidden `botcheck` honeypot plus Web3Forms' own spam
filtering is the defense.

If the variable is missing at build time, the form renders **disabled** rather than accepting
addresses it cannot deliver. Same if you open `coming-soon.html` directly with no build.

Free tier is **250 submissions/month**; past that, submissions are rejected until the month
resets.

## Going live: restore the full landing

Replace `buildCommand` in `vercel.json` with:

```
mkdir -p dist/uploads dist/symptoms && cp index.html dist/index.html && for f in coming-soon contact; do sed "s|__WEB3FORMS_ACCESS_KEY__|${WEB3FORMS_ACCESS_KEY}|" "$f.html" > "dist/$f.html"; done && cp about.html privacy.html terms.html page.css landing.css symptom.css anuva-logo-mark.png anuva-logo-icon.png anu-mascot.png dist/ && cp symptoms/*.html dist/symptoms/ && cp uploads/hero-woman-cutout.webp uploads/meet-anuva.webp dist/uploads/
```

That serves the marketing page at `/` and keeps the waitlist reachable at `/coming-soon`.
Note it ships `landing.css` and `uploads/hero-woman-cutout.webp`, and no longer needs
`support.js` or `image-slot.js` — those existed only for the design-canvas page. Restore the
longer-lived cache headers for `/uploads/(.*)` at the same time — the current single no-cache
rule exists so the pre-launch page can be swapped instantly.

## Deploy

Run from this directory (the project's Root Directory is `.`):

```
npx vercel deploy --prod --archive=tgz
```
