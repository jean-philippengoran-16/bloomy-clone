import type { DeckId, DeckDefinition } from '@/types/game';
import { CHEMISTRY_V1 } from './chemistry-v1';
import { CONNECTION_V1 } from './connection-v1';
import { WHO_IS_V1 } from './who-is-v1';
import { WOULD_YOU_RATHER_V1 } from './would-you-rather-v1';

export const DECK_REGISTRY: Record<DeckId, DeckDefinition> = {
  who_is_v1: {
    id: 'who_is_v1',
    playMode: 'who_is',
    title: 'Qui de nous deux ?',
    subtitle: 'Set 1 · 60 cartes',
    description: 'Un jeu léger, complice et un peu piquant pour mieux se connaître.',
    available: true,
    cards: WHO_IS_V1,
  },
  would_you_rather_v1: {
    id: 'would_you_rather_v1',
    playMode: 'would_you_rather',
    title: 'Tu préfères ?',
    subtitle: 'Set 1 · 60 cartes',
    description: 'Des dilemmes à deux, des révélations en douceur.',
    available: true,
    cards: WOULD_YOU_RATHER_V1,
  },
  connection_v1: {
    id: 'connection_v1',
    playMode: 'conversation',
    title: 'Connexion',
    subtitle: 'Set 1 · 60 cartes',
    description: 'Des questions douces et vraies pour écouter, remercier et rêver ensemble.',
    available: true,
    cards: CONNECTION_V1,
  },
  chemistry_v1: {
    id: 'chemistry_v1',
    playMode: 'guided_choice',
    title: 'Chemistry',
    subtitle: 'Set 1 · 60 cartes',
    description: 'Des élans guidés, des réponses nuancées et une vraie place pour votre désir à deux.',
    available: true,
    cards: CHEMISTRY_V1,
  },
  dare_v1: {
    id: 'dare_v1',
    playMode: 'would_you_rather',
    title: 'Dare',
    subtitle: 'Set 1',
    description: 'Des défis audacieux. Amusants, complices, inoubliables.',
    available: false,
    cards: [],
  },
};

export const DECK_ORDER: DeckId[] = [
  'who_is_v1',
  'would_you_rather_v1',
  'connection_v1',
  'chemistry_v1',
  'dare_v1',
];

export function getDeck(id: string): DeckDefinition | undefined {
  if (!(id in DECK_REGISTRY)) return undefined;
  return DECK_REGISTRY[id as DeckId];
}
