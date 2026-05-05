---
name: StarChart Luxury
colors:
  surface: '#141219'
  surface-dim: '#141219'
  surface-bright: '#3b383f'
  surface-container-lowest: '#0f0d14'
  surface-container-low: '#1d1a21'
  surface-container: '#211e25'
  surface-container-high: '#2b2930'
  surface-container-highest: '#36343b'
  on-surface: '#e6e0ea'
  on-surface-variant: '#cac4d4'
  inverse-surface: '#e6e0ea'
  inverse-on-surface: '#322f37'
  outline: '#948e9d'
  outline-variant: '#494552'
  surface-tint: '#cebdff'
  primary: '#cebdff'
  on-primary: '#381385'
  primary-container: '#a78bfa'
  on-primary-container: '#3c1989'
  inverse-primary: '#674bb5'
  secondary: '#e2c62d'
  on-secondary: '#393000'
  secondary-container: '#c1a800'
  on-secondary-container: '#483d00'
  tertiary: '#dbc839'
  on-tertiary: '#373100'
  tertiary-container: '#af9e00'
  on-tertiary-container: '#3b3500'
  error: '#F87171'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e8ddff'
  primary-fixed-dim: '#cebdff'
  on-primary-fixed: '#21005e'
  on-primary-fixed-variant: '#4f319c'
  secondary-fixed: '#ffe24c'
  secondary-fixed-dim: '#e2c62d'
  on-secondary-fixed: '#211b00'
  on-secondary-fixed-variant: '#524600'
  tertiary-fixed: '#f8e454'
  tertiary-fixed-dim: '#dbc839'
  on-tertiary-fixed: '#201c00'
  on-tertiary-fixed-variant: '#504700'
  background: '#141219'
  on-background: '#e6e0ea'
  surface-variant: '#36343b'
  deep-space: '#1E1B4B'
  surface-base: '#1E1B4B'
  surface-raised: '#2E2A6E'
  surface-sunken: '#141136'
  surface-overlay: '#3D3890'
  success: '#4ADE80'
  warning: '#FBBF24'
  info: '#60A5FA'
  locked: '#8B82C3'
  border-default: rgba(167, 139, 250, 0.2)
typography:
  h1:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: '700'
    lineHeight: '1.2'
  h2:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: '1.25'
  h3:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '600'
    lineHeight: '1.3'
  h4:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: '1.35'
  body:
    fontFamily: Lexend
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  small:
    fontFamily: Lexend
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  tiny:
    fontFamily: Lexend
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.4'
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

# StarChart Design System
## Overview
StarChart is a space-themed, achievement-driven design system built with wonder at its core. It transforms everyday chores and learning milestones into cosmic adventures for kids. The dark deep-space backdrop provides contrast for vibrant nebula purples and glowing star yellows, creating an immersive environment that rewards exploration and accomplishment.
---
## Colors
- **Deep Space** (#1E1B4B): Primary background, headers
- **Nebula** (#A78BFA): Interactive elements, accents
- **Star (CTA / `secondary` token)** (#e2c62d in app; #FDE047 in marketing swatches): Achievements, highlights, primary CTA fill
- **Surface Base** (#1E1B4B): App background
- **Success** (#4ADE80): Completed chores, correct
- **Warning** (#FBBF24): Almost due, reminders
- **Error** (#F87171): Missed tasks, incorrect
- **Info** (#60A5FA): Tips, hints
## Typography
- **Headline Font**: Plus Jakarta Sans
- **Body Font**: Lexend
- **Mono Font**: Space Mono
- **h1**: Plus Jakarta Sans 36px bold, 1.2 line height
- **h2**: Plus Jakarta Sans 28px bold, 1.25 line height
- **h3**: Plus Jakarta Sans 22px semibold, 1.3 line height
- **h4**: Plus Jakarta Sans 18px semibold, 1.35 line height
- **body**: Lexend 16px regular, 1.5 line height
- **small**: Lexend 14px regular, 1.5 line height
- **tiny**: Lexend 12px medium, 1.4 line height
- **mono**: Space Mono 14px regular, 1.6 line height
---
## Spacing
Base unit: 8px
- **sp-1**: 4px
- **sp-2**: 8px
- **sp-3**: 16px
- **sp-4**: 24px
- **sp-5**: 32px
- **sp-6**: 48px
- **sp-7**: 64px
- **sp-8**: 96px
## Border Radius
- **radius-sm** (8px): Small elements, badges
- **radius-md** (12px): Inputs, chips
- **radius-lg** (16px): Cards, modals
- **radius-pill** (9999px): Star badges, achievement pills
- **radius-circle** (50%): Avatars, planet icons
## Elevation (Glow Effects)
- **glow-nebula-sm**: Soft 8px nebula-purple (#A78BFA) glow at 30% opacity. Subtle hover.
- **glow-nebula-md**: Medium 16px nebula-purple (#A78BFA) glow at 40% opacity. Cards, focused.
- **glow-nebula-lg**: Strong 32px nebula-purple (#A78BFA) glow at 50% opacity. Modals, hero.
- **glow-star-sm**: Soft 8px star-yellow (#FDE047) glow at 35% opacity. Star badge idle.
- **glow-star-md**: Medium 16px star-yellow (#FDE047) glow at 50% opacity. Star badge active.
- **glow-star-lg**: Strong 32px star-yellow (#FDE047) glow at 60% opacity. Achievement burst.
## Components
### Buttons
All buttons are pill-shaped (9999px radius).
- **Primary (Star Yellow)**: Star-yellow (#FDE047) fill, deep-space (#1E1B4B) text, no border. Hover brightens the fill and adds a soft star glow (glow-star-sm). Active state slightly dims brightness. Available in small (14px text, 32px tall, 6px 16px padding), medium (16px text, 40px tall, 10px 24px padding), and large (18px text, 48px tall, 14px 32px padding).
- **Secondary (Nebula)**: Transparent fill, nebula-purple (#A78BFA) text, 2px nebula border. Hover tints the background to faint purple (#A78BFA at 15% opacity) with a soft nebula glow (glow-nebula-sm).
- **Ghost**: Transparent fill, content-secondary text, no border. Hover tints the background to faint purple (#A78BFA at 10% opacity).
- **Destructive**: Red (#F87171) fill, white (#FFFFFF) text, no border. Hover brightens the fill and adds a 12px red (#F87171) glow at 40% opacity.
Disabled buttons drop to 0.4 opacity with a disabled cursor and no glow or hover effects.
### Cards
- **Default**: Raised surface (#2E2A6E) background with a 1px default border, 16px rounded corners, and 24px padding.
- **Elevated (Achievement Card)**: Raised surface background with a 1px star-colored border, 16px rounded corners, star glow (glow-star-md), and 24px padding.
### Inputs
Inputs sit on a sunken surface (#141136) with 12px rounded corners, 10px 16px padding, and Lexend 16px text in content-primary. The border is 2px in the default border color.
In the default state there is no shadow. On hover the border shifts to nebula. On focus the border stays nebula and a soft nebula glow (glow-nebula-sm) appears. In the error state the border turns red (error) with an 8px red (#F87171) glow at 30% opacity. When disabled the border returns to default and opacity drops to 0.4.
Labels are Lexend 14px semibold (600) in content-secondary with 6px bottom margin. Helper text is Lexend 12px regular (400) in content-tertiary with 4px top margin; error helper text uses the error color.
### Chips
- **Filter**: Transparent fill, content-secondary text, 1px default border, pill-shaped, 4px 14px padding. When active the background fills nebula, text turns white (#FFFFFF), and a soft nebula glow (glow-nebula-sm) appears.
- **Status**: Pill-shaped, 12px semibold (600) text, 4px 12px padding. Completed shows #4ADE80 at 20% opacity fill with #4ADE80 text. Pending shows #FBBF24 at 20% opacity fill with #FBBF24 text. Missed shows #F87171 at 20% opacity fill with #F87171 text. Locked shows #8B82C3 at 20% opacity fill with #8B82C3 text.
### Lists
Transparent background with 1px default-color dividers. Each item has 12px 16px padding. On hover the background tints to faint purple (#A78BFA at 8% opacity). The active row darkens to #A78BFA at 15% opacity. A 32px leading icon area is center-aligned. Trailing elements include badges, star counts, and chevrons.
### Checkboxes
22px square with 6px rounded corners and a 2px default border. Unchecked state is transparent. When checked the box fills nebula-purple with a white (#FFFFFF) 2px-stroke checkmark. Focus adds a soft nebula glow (glow-nebula-sm). Disabled drops to 0.4 opacity.
### Radio Buttons
22px circular with a 2px default border. Unchecked state is transparent. When selected the border turns nebula and a 10px nebula inner dot appears. Focus adds a soft nebula glow (glow-nebula-sm). Disabled drops to 0.4 opacity.
### Tooltips
Overlay surface (#3D3890) background with content-primary text at 13px, 8px rounded corners, 6px 12px padding, and a soft nebula glow (glow-nebula-sm). A 6px arrow matches the background. Maximum width is 240px. Shows after 300ms and hides after 100ms.
---
## Do's and Don'ts
1. **Do** use star-yellow sparingly for achievements and primary CTAs only; overuse dilutes reward feeling.
2. **Do** keep text large and readable -- this is for kids; minimum 14px body text.
3. **Do** use nebula-purple glow to guide attention to interactive elements.
4. **Don't** use pure white backgrounds; always maintain the deep space theme.
5. **Don't** combine star-glow and nebula-glow on the same element -- choose one.
6. **Do** animate achievement moments (star burst, glow pulse) to reinforce accomplishment.
7. **Don't** use small, dense layouts; kids need generous tap targets (minimum 44px).
8. **Do** pair every icon with a text label for early readers.
9. **Don't** use the destructive red for anything other than truly irreversible actions.
10. **Do** test all text against the dark background for sufficient contrast (minimum 4.5:1).
