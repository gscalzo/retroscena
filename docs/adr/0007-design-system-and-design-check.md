# 0007 — The artifacts' language, tokenised in one file, a design-check gate

**Status:** accepted
**Date:** 2026-09-04

## Context

The three artifacts share a visual language the owner works in daily:
Bricolage Grotesque for display, Public Sans for body, Shantell Sans for
the handwritten sticky notes; a paper background, an amber accent on the
workbench and a teal one on the reading room; sticky notes with a slight
rotation and a shadow; light and dark palettes. Bottega gates its tokens
with `scripts/design-check.mjs` (its ADR-0011).

## Decision

- **Keep the artifacts' language**, tokenised: `src/styles.css` is the
  only file with raw colours, font families, gradients, literal radii and
  shadows, keyframes and untokenised motion; `npm run design` fails on
  any of them elsewhere under `src/`.
- **Fonts** self-hosted from `@fontsource-variable` (Bricolage Grotesque,
  Public Sans, Shantell Sans), not the Google Fonts CDN.
- **One accent per surface**, set by `data-surface` on the shell: amber
  for the bench, teal for the room, a third for home. Components stay
  surface-agnostic.
- **Seven swatches** for sticky notes (yellow, blue, green, violet,
  orange, pink, teal); a bench category names one (ADR-0002) and the note
  sets `data-swatch`. Ink stays dark on a swatch in both themes.
- Responsive to a phone, visible focus, reduced motion honoured.

## Consequences

Changing the look is changing tokens. The bench keeps the muscle memory
the owner already has.

## Alternatives considered

- **Bottega's peg-board look** — one family across the boards, at the
  cost of a tool the owner already reads at a glance.
