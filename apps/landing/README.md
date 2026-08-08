# apps/landing

Static site for `anuvawellness.com`, deployed by the Vercel project `anuva-landing`.

## Current state: pre-launch

The build publishes **`coming-soon.html` only**, as `dist/index.html`. The full marketing page
(`Anuva Wellness Landing.dc.html`) is still in the repo but is **not served** — it advertises a
free trial and pricing, which is wrong before launch.

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
mkdir -p dist/uploads && cp "Anuva Wellness Landing.dc.html" dist/index.html && sed "s|__WEB3FORMS_ACCESS_KEY__|${WEB3FORMS_ACCESS_KEY}|" coming-soon.html > dist/coming-soon.html && cp support.js image-slot.js dist/ && cp uploads/hero-woman.webp uploads/meet-anuva.webp dist/uploads/
```

That serves the marketing page at `/` and keeps the waitlist reachable at `/coming-soon`.
Restore the longer-lived cache headers for `/uploads/(.*)` and `/(support|image-slot).js` at the
same time — the current single no-cache rule exists so the pre-launch page can be swapped
instantly.

## Deploy

Run from this directory (the project's Root Directory is `.`):

```
npx vercel deploy --prod --archive=tgz
```
