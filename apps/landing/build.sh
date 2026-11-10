#!/bin/sh
# Builds the deployable landing site into dist/. Used by docker/landing.Dockerfile.
# Same steps as the buildCommand in vercel.json: only the pages listed here are published.
set -eu

rm -rf dist
mkdir -p dist

for f in coming-soon:index contact:contact; do
  sed "s|__WEB3FORMS_ACCESS_KEY__|${WEB3FORMS_ACCESS_KEY:-}|" "${f%%:*}.html" > "dist/${f##*:}.html"
done

cp about.html privacy.html terms.html page.css symptom.css \
  anuva-logo-mark.png anuva-logo-icon.png anu-mascot.png dist/

mkdir -p dist/symptoms dist/uploads/founders
cp symptoms/*.html dist/symptoms/
cp uploads/hero-woman-cutout.webp dist/uploads/
# Optional until the founder photos are committed; a missing glob must not fail the deploy.
for img in uploads/founders/*.webp; do
  if [ -e "$img" ]; then cp "$img" dist/uploads/founders/; fi
done
