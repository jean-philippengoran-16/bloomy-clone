# AGENTS.md

## Project
Bloomy-like app for a married Christian evangelical couple.
Tech stack: Expo / React Native / Expo Router / TypeScript / Supabase.

## Product direction
The product is a couple game app inspired by Bloomy:
- playful
- romantic
- sensual but never vulgar
- elegant
- married-couple only
- Christian evangelical vision of marriage
- no infidelity, no humiliation, no manipulation, no comparison with other partners

## Current architecture
- Supabase couple connection flow already works
- `/couple` is the main home screen
- check-in feature already exists
- multi-deck game architecture has started
- current playable deck: `who_is_v1`
- upcoming decks:
  - `would_you_rather_v1`
  - `connection_v1`
  - `chemistry_v1`
  - `dare_v1`

## Working rules
- Keep deck content local in code unless explicitly asked otherwise
- Do not touch Supabase unless the task explicitly requires it
- Prefer minimal, high-confidence changes
- Do not refactor unrelated files
- Preserve the current Terracotta design system
- Use TypeScript cleanly
- Keep the UX mobile-first and simple

## Design palette
- background: #F9F6F0
- card background: #FFFDF9
- primary text: #2B2D42
- secondary text: #5C677D
- muted text: #8D99AE
- primary CTA: #E07A5F
- darker CTA: #D46A4C
- soft accent: #F2CCB7
- borders: #E9D8C8
- white text: #FFFFFF

## Current priority
Build a complete V1 before testing:
1. stabilize multi-deck architecture
2. add the remaining decks
3. add persistent history / favorites / anti-repetition
4. polish `/couple` as the real product home

## Code safety
- Before large changes, summarize the intended edits
- Keep changes scoped
- Do not introduce new dependencies unless necessary