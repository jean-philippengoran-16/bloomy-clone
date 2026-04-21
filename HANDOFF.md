# HANDOFF

## What already works
- couple creation and claiming work with Supabase
- boot redirects to `/couple` when a couple exists
- daily check-in exists
- `who_is_v1` exists and the app runs again after quote fixes

## What is currently visible in the app
- `/couple` shows:
  - active card for "Qui de nous deux ?"
  - inactive cards for:
    - Tu préfères ?
    - Connexion
    - Chemistry
    - Dare

## Next logical task
Make `would_you_rather_v1` the second playable deck, without changing backend architecture.

## Important files
- `app/couple.tsx`
- `app/play/[deck].tsx` or current play screen
- `data/decks/who-is-v1.ts`
- `data/decks/index.ts`
- `lib/game.ts`
- `types/game.ts`