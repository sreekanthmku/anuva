#!/bin/sh
# Builds the deployable landing site into dist/. Used by docker/landing.Dockerfile.
# Same steps as the buildCommand in vercel.json: only the pages listed here are published.
set -eu

rm -rf dist
mkdir -p dist

# The home page is the full site (index.html); the waitlist (coming-soon.html) is no longer published.
sed "s|__WEB3FORMS_ACCESS_KEY__|${WEB3FORMS_ACCESS_KEY:-}|" contact.html > dist/contact.html

cp index.html about.html privacy.html terms.html \
  page.css symptom.css landing.css landing-white.css bg-lighter.css redesign.css cookie-consent.js \
  anuva-logo-mark.png anuva-logo-icon.png anu-mascot.png family.jpg family.webp dist/

mkdir -p dist/symptoms dist/uploads/founders
cp symptoms/*.html dist/symptoms/
cp uploads/hero-woman-cutout.webp dist/uploads/
# Optional until the founder photos are committed; a missing glob must not fail the deploy.
for img in uploads/founders/*.webp; do
  if [ -e "$img" ]; then cp "$img" dist/uploads/founders/; fi
done
