import type { DeckId, GameCard, Subtheme } from '@/types/game';
import { getDeck } from '@/data/decks/index';

export const SESSION_SIZE = 10;

// Natural escalation: playful → romantic → chemistry. Max 2 consecutive same subtheme.
const BLUEPRINT: Subtheme[] = [
  'playful',
  'playful',
  'romantic',
  'playful',
  'romantic',
  'romantic',
  'playful',
  'chemistry',
  'romantic',
  'chemistry',
];

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function buildSession(deckId: DeckId): GameCard[] {
  const deck = getDeck(deckId);
  if (!deck || deck.cards.length === 0) return [];

  const pools: Record<Subtheme, GameCard[]> = {
    playful: shuffle(deck.cards.filter((c) => c.subtheme === 'playful')),
    romantic: shuffle(deck.cards.filter((c) => c.subtheme === 'romantic')),
    chemistry: shuffle(deck.cards.filter((c) => c.subtheme === 'chemistry')),
  };

  // Refill by reshuffling when a pool runs dry (handles small decks gracefully)
  function draw(subtheme: Subtheme): GameCard | undefined {
    if (pools[subtheme].length === 0) {
      pools[subtheme] = shuffle(deck!.cards.filter((c) => c.subtheme === subtheme));
    }
    return pools[subtheme].pop();
  }

  const session: GameCard[] = [];
  for (const subtheme of BLUEPRINT) {
    const card = draw(subtheme);
    if (card) session.push(card);
  }

  return session;
}

export function buildSessionCardIds(deckId: DeckId): string[] {
  return buildSession(deckId).map((card) => card.id);
}

export function resolveSessionCards(deckId: DeckId, cardIds: string[]): GameCard[] {
  const deck = getDeck(deckId);
  if (!deck) return [];

  const cardsById = new Map(deck.cards.map((card) => [card.id, card]));
  return cardIds.flatMap((cardId) => {
    const card = cardsById.get(cardId);
    return card ? [card] : [];
  });
}
