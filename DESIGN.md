---
name: Anuva Wellness
colors:
  surface: '#F7F0E8'
  surface-dim: '#EFE4D8'
  surface-bright: '#FFFFFF'
  surface-container-lowest: '#FFFFFF'
  surface-container-low: '#FBF6F0'
  surface-container: '#F3E9DD'
  surface-container-high: '#ECDFD0'
  surface-container-highest: '#ECDFD0'
  on-surface: '#3E2542'
  on-surface-variant: '#6E5870'
  inverse-surface: '#3E2542'
  inverse-on-surface: '#F7F0E8'
  outline: '#B49FB0'
  outline-variant: '#E3D4DC'
  surface-tint: '#5E3566'
  primary: '#5E3566'
  on-primary: '#FBF6F0'
  primary-container: '#E7DCEC'
  on-primary-container: '#3E2542'
  inverse-primary: '#CDB9DE'
  secondary: '#C97E92'
  on-secondary: '#FFFFFF'
  secondary-container: '#F4DCE0'
  on-secondary-container: '#7A3A4C'
  tertiary: '#B8923C'
  on-tertiary: '#FFFFFF'
  tertiary-container: '#F0E4C8'
  on-tertiary-container: '#5A4716'
  error: '#C0405A'
  on-error: '#FFFFFF'
  error-container: '#F8DCE2'
  on-error-container: '#5A1020'
  background: '#F7F0E8'
  on-background: '#3E2542'
  surface-variant: '#ECDFD0'
  deep-space: '#5E3566'
  surface-base: '#F7F0E8'
  surface-raised: '#FFFFFF'
  surface-sunken: '#EFE4D8'
  surface-overlay: '#5E3566'
  success: '#4F9D6B'
  warning: '#C9912E'
  info: '#5B82C4'
  locked: '#9E8BA8'
  border-default: rgba(94, 53, 102, 0.15)
typography:
  h1:
    fontFamily: Fraunces
    fontSize: 36px
    fontWeight: '700'
    lineHeight: '1.2'
  h2:
    fontFamily: Fraunces
    fontSize: 28px
    fontWeight: '700'
    lineHeight: '1.25'
  h3:
    fontFamily: Fraunces
    fontSize: 22px
    fontWeight: '600'
    lineHeight: '1.3'
  h4:
    fontFamily: Fraunces
    fontSize: 18px
    fontWeight: '600'
    lineHeight: '1.35'
  body:
    fontFamily: Mulish
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  small:
    fontFamily: Mulish
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  tiny:
    fontFamily: Mulish
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.4'
  script:
    fontFamily: Dancing Script
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.3'
  mono:
    fontFamily: Space Mono
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.6'
rounded:
  sm: 0.5rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  sp-1: 4px
  sp-2: 8px
  sp-3: 16px
  sp-4: 24px
  sp-5: 32px
  sp-6: 48px
  sp-7: 64px
  sp-8: 96px
---

# Anuva Wellness Design System

## Overview
Anuva Wellness is a warm, light, feminine design system for India's family-inclusive menopause and perimenopause wellness platform. It is derived from the Anuva reference image: a cream/ivory canvas, confident deep-plum brand structure, dusty-rose calls to action, muted lavender wellness washes and quiet gold ornamental detailing. The mood is reassuring and human — never clinical, never loud.

---
## Colors
- **Cream** (#F7F0E8): Primary background / app canvas
- **Deep Plum** (#5E3566): Brand authority, active states, selected controls, primary buttons, links and structural bands
- **Plum Ink** (#3E2542): Primary text on cream
- **Mauve** (#6E5870): Secondary / muted text
- **Lavender** (#E7DCEC): Calm focus surfaces, current sections, ANU guidance blocks (`primary-container`)
- **Dusty Rose** (#C97E92): CTA fill and supportive human moments (`secondary` token). Do not use for routine selected/current state.
- **Blush** (#F4DCE0): Soft supportive container tint (`secondary-container`). Use sparingly; not a default section color.
- **Gold** (#B8923C): Ornamental dividers, premium/insight accents, report/clinical-note highlights (`tertiary` token). Do not use as a routine card background.
- **White / Soft Cream** (#FFFFFF / #FBF6F0): Raised cards, inputs
- **Success** (#4F9D6B) · **Warning** (#C9912E) · **Error** (#C0405A) · **Info** (#5B82C4)

### Color semantics
- **Page canvas**: `surface` cream.
- **Working/input surfaces**: `surface-raised` or `surface-container-low` with `border-default`.
- **Active/current/focus**: `primary` or `primary-container`.
- **Supportive prompts / conversational warmth / one primary CTA**: `secondary` or `secondary-container`.
- **Insight / report / premium-value / ornamental detail**: `tertiary` or `tertiary-container`.
- **Warning/error**: `warning`, `error`, and containers only for true attention states.

## Typography
- **Headline Font**: Fraunces (serif, optical sizing — legible at UI sizes)
- **Body Font**: Mulish (humanist sans)
- **Accent Script**: Dancing Script — decorative only, one tagline/hero line at a time, never UI/body text
- **Mono Font**: Space Mono — numeric readouts, data
- **h1**: Fraunces 36px bold, 1.2 · **h2**: Fraunces 28px bold, 1.25 · **h3**: Fraunces 22px semibold, 1.3 · **h4**: Fraunces 18px semibold, 1.35
- **body**: Mulish 16px regular, 1.5 · **small**: Mulish 14px, 1.5 · **tiny**: Mulish 12px medium, 1.4
- **script**: Dancing Script 20px semibold (accent line) · **mono**: Space Mono 14px, 1.6

---
## Spacing
Base unit: 8px — sp-1 4px, sp-2 8px, sp-3 16px, sp-4 24px, sp-5 32px, sp-6 48px, sp-7 64px, sp-8 96px

## Border Radius
- **sm** (8px): badges, small elements · **md** (12px): inputs, chips · **lg** (16px): cards · **xl** (24px): sheets, modals · **full** (9999px): pills, avatars

## Elevation — FLAT
No shadows, no gradients anywhere. Separation comes from solid fill + 1px `border-default` (rgba(94,53,102,0.15)). Cards are flat solid blocks of brand color (cream, blush, lavender, plum, gold). Sheets/modals sit on a translucent scrim with a hairline border.

## Eyebrows / section labels
Small-caps label above a section: Mulish 600, 11px, `tracking-[0.13em]`, uppercase, preceded by a 4px accent rule. Tone = plum (default), gold (premium/insight), or cream (on plum blocks). Never Space Mono — labels are Mulish like body.

## Components
### Buttons
All buttons are pill-shaped (9999px radius), minimum 44px tap target.
- **Primary (Plum)**: Deep-plum (#5E3566) fill, cream (#FBF6F0) text. Hover darkens slightly.
- **CTA (Rose)**: Dusty-rose (#C97E92) fill, white text — the "Take assessment / Get started" moment. Use sparingly for the single most important action on a screen.
- **Secondary**: Transparent fill, plum text, 1.5px plum border. Hover tints background blush.
- **Ghost**: Transparent, mauve text, no border. Hover tints faint plum.
- **Destructive**: Error (#C0405A) fill, white text — irreversible actions only.
Disabled buttons drop to 0.4 opacity.

### Cards
- **Default**: White / soft-cream (#FBF6F0) surface, 1px `border-default` (rgba(94,53,102,0.15)), 16px radius, 24px padding. No shadows.
- **Active/focus**: Lavender (`primary-container`) or plum (`primary`) according to contrast needs.
- **Supportive/CTA-adjacent**: Blush (`secondary-container`) only when the content is emotionally supportive or CTA-adjacent.
- **Insight/report**: Gold (`tertiary-container`) only for insights, report notes, value callouts or ornament.

### Inputs
Soft-cream (#FBF6F0) field, 12px radius, 10px 16px padding, Mulish 16px plum text, 1.5px `outline` border. Hover/focus border shifts to plum with a soft plum focus ring. Error border = #C0405A. Labels: Mulish 14px semibold mauve. Helper: Mulish 12px mauve; error helper uses error color.

### Chips
- **Filter**: Transparent, mauve text, 1px border, pill, 4px 14px. Active fills plum, text white.
- **Status**: Pill, 12px semibold. Completed #4F9D6B@18% fill + #4F9D6B text. Pending #C9912E@18% + #C9912E. Missed #C0405A@18% + #C0405A. Locked #9E8BA8@18% + #9E8BA8.

### Lists
Transparent background, 1px `outline-variant` dividers, 12px 16px item padding. Hover tints faint blush; active row tints plum@8%.

## Do's and Don'ts
1. **Do** keep the cream canvas calm; let plum carry the brand authority.
2. **Do** reserve dusty-rose for the single primary CTA per screen or clearly supportive conversational moments; overuse makes neutral healthcare UI feel alert-like.
3. **Do** use gold sparingly for ornamental dividers, report insights and premium/value highlights.
4. **Do** use the script font for at most one short tagline/hero line — never body, buttons or labels.
5. **Don't** use shadows for elevation. Use solid fills, borders, dividers and spacing only.
6. **Do** keep body text ≥14px and ensure plum text holds ≥4.5:1 contrast on cream.
7. **Don't** mix more than two accent colors in one component.
8. **Do** keep generous tap targets (minimum 44px) and gentle, unhurried motion.
9. **Don't** use the error red for anything other than truly irreversible actions.
10. **Do** pair icons with text labels for clarity and warmth.
