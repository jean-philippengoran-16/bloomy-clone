# HANDOFF

## Ce qui fonctionne

- couple creation and claiming work with Supabase
- boot redirects to `/couple` when a couple exists
- daily check-in exists
- tous les 5 decks sont jouables : `who_is_v1`, `would_you_rather_v1`, `connection_v1`, `chemistry_v1`, `dare_v1`
- l'écran de jeu gère les 5 play modes (who_is, would_you_rather, conversation, guided_choice, dare)
- le moteur de session est stabilisé : `buildSession` tombe en fallback si un subthème est absent d'un deck
- une vraie fin de session existe : écran "Session terminée" avec message contextuel, bouton "Nouvelle session" et retour
- Rejouer supprime et recrée la session (nouvelles 10 cartes), sans modification SQL
- passe polish V1 appliquée : libellés harmonisés par play mode, micro-textes affinés, polling sans re-render inutile
- refonte UI V1 : hero émotionnel sur /couple, identités visuelles par deck (bande colorée + tagline + intensité), bande d'accent par playMode sur /play

## Architecture session

- `SESSION_SIZE = 10` cartes par session
- BLUEPRINT : escalade naturelle playful → romantic → chemistry
- `buildSession()` : fallback sur les cartes disponibles si un pool de subthème est vide
- `resetGameSession(sessionId, coupleId, deckId)` : DELETE + recreate, cascade supprime réponses et progressions
- 1 session par couple par deck (contrainte unique Supabase)

## État des decks

Tous les 5 decks ont 60 cartes avec couverture complète des 3 subthèmes (20 playful / 20 romantic / 20 chemistry).

## Prochaines étapes

1. anti-répétition et historique de sessions (pour éviter de revoir les mêmes cartes à chaque replay)
2. polish de `/couple` : montrer la progression de chaque deck (cartes vues, session complétée)
3. deck `dare_v1` : valider le flow complet en conditions réelles

## Fichiers importants

- `app/couple.tsx`
- `app/play/[deck].tsx`
- `lib/game.ts`
- `lib/game-session.ts`
- `data/decks/index.ts`
- `types/game.ts`
- `supabase/schema.sql`
