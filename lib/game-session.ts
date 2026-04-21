import type {
  AnswerBasedValue,
  CompletionValue,
  DeckId,
  GameCard,
  GameSession,
  GameSessionAnswer,
  GameSessionCardAnswers,
  GameSessionProgress,
} from '@/types/game';
import type { Couple } from './couple';
import { buildSessionCardIds, resolveSessionCards, SESSION_SIZE } from './game';
import { supabase } from './supabase';

async function requireUserId(): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) throw error;
  if (!user) throw new Error('not_authenticated');

  return user.id;
}

function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === '23505';
}

export async function createOrResumeGameSession(
  coupleId: string,
  deckId: DeckId
): Promise<GameSession> {
  const { data: existing, error: selectError } = await supabase
    .from('game_sessions')
    .select('id, couple_id, deck_id, card_ids, created_at, updated_at')
    .eq('couple_id', coupleId)
    .eq('deck_id', deckId)
    .maybeSingle();

  if (selectError) throw selectError;
  if (existing) return existing as GameSession;

  const cardIds = buildSessionCardIds(deckId);
  if (cardIds.length !== SESSION_SIZE) {
    throw new Error('session_build_failed');
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('game_sessions')
    .insert({
      couple_id: coupleId,
      deck_id: deckId,
      card_ids: cardIds,
      updated_at: now,
    })
    .select('id, couple_id, deck_id, card_ids, created_at, updated_at')
    .single();

  if (error) {
    if (isUniqueViolation(error)) {
      const { data: retried, error: retryError } = await supabase
        .from('game_sessions')
        .select('id, couple_id, deck_id, card_ids, created_at, updated_at')
        .eq('couple_id', coupleId)
        .eq('deck_id', deckId)
        .single();

      if (retryError) throw retryError;
      return retried as GameSession;
    }

    throw error;
  }

  return data as GameSession;
}

export function loadSessionCards(session: Pick<GameSession, 'deck_id' | 'card_ids'>): GameCard[] {
  const cards = resolveSessionCards(session.deck_id, session.card_ids);
  if (cards.length !== session.card_ids.length) {
    throw new Error('session_cards_unavailable');
  }

  return cards;
}

async function upsertGameSessionResponseValue(
  sessionId: string,
  cardId: string,
  value: AnswerBasedValue | CompletionValue,
  customText: string | null = null
): Promise<GameSessionAnswer> {
  const userId = await requireUserId();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('game_session_answers')
    .upsert(
      {
        session_id: sessionId,
        card_id: cardId,
        user_id: userId,
        answer: value,
        custom_text: customText,
        updated_at: now,
      },
      { onConflict: 'session_id,card_id,user_id' }
    )
    .select('id, session_id, card_id, user_id, answer, custom_text, created_at, updated_at')
    .single();

  if (error) throw error;
  return data as GameSessionAnswer;
}

export async function saveGameSessionAnswer(
  sessionId: string,
  cardId: string,
  answer: AnswerBasedValue,
  customText: string | null = null
): Promise<GameSessionAnswer> {
  return upsertGameSessionResponseValue(sessionId, cardId, answer, customText);
}

export async function saveGameSessionCompletion(
  sessionId: string,
  cardId: string,
  completion: CompletionValue = 'completed'
): Promise<GameSessionAnswer> {
  return upsertGameSessionResponseValue(sessionId, cardId, completion);
}

export async function clearGameSessionAnswer(sessionId: string, cardId: string): Promise<void> {
  const userId = await requireUserId();

  const { error } = await supabase
    .from('game_session_answers')
    .delete()
    .eq('session_id', sessionId)
    .eq('card_id', cardId)
    .eq('user_id', userId);

  if (error) throw error;
}

export async function clearGameSessionCompletion(sessionId: string, cardId: string): Promise<void> {
  return clearGameSessionAnswer(sessionId, cardId);
}

export async function loadGameSessionCardAnswers(
  sessionId: string,
  cardId: string,
  couple: Couple
): Promise<GameSessionCardAnswers> {
  const userId = await requireUserId();
  const partnerId = couple.user_a === userId ? couple.user_b : couple.user_a;

  const { data, error } = await supabase
    .from('game_session_answers')
    .select('id, session_id, card_id, user_id, answer, custom_text, created_at, updated_at')
    .eq('session_id', sessionId)
    .eq('card_id', cardId);

  if (error) throw error;

  const answers = (data ?? []) as GameSessionAnswer[];
  const myEntry = answers.find((entry) => entry.user_id === userId) ?? null;
  const partnerEntry = answers.find((entry) => entry.user_id === partnerId) ?? null;

  return {
    myAnswer: myEntry?.answer ?? null,
    partnerAnswer: partnerEntry?.answer ?? null,
    myCustomText: myEntry?.custom_text ?? null,
    partnerCustomText: partnerEntry?.custom_text ?? null,
    partnerAnswered: partnerEntry !== null,
  };
}

export async function loadMyGameSessionProgress(sessionId: string): Promise<number> {
  const userId = await requireUserId();

  const { data, error } = await supabase
    .from('game_session_progress')
    .select('current_index')
    .eq('session_id', sessionId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;

  return Math.max(0, Math.min(data?.current_index ?? 0, SESSION_SIZE - 1));
}

export async function updateMyGameSessionProgress(
  sessionId: string,
  currentIndex: number
): Promise<GameSessionProgress> {
  const userId = await requireUserId();
  const now = new Date().toISOString();
  const nextIndex = Math.max(0, Math.min(currentIndex, SESSION_SIZE - 1));

  const { data, error } = await supabase
    .from('game_session_progress')
    .upsert(
      {
        session_id: sessionId,
        user_id: userId,
        current_index: nextIndex,
        updated_at: now,
      },
      { onConflict: 'session_id,user_id' }
    )
    .select('id, session_id, user_id, current_index, created_at, updated_at')
    .single();

  if (error) throw error;
  return data as GameSessionProgress;
}

export async function loadCoupleActiveSessions(coupleId: string): Promise<DeckId[]> {
  const { data, error } = await supabase
    .from('game_sessions')
    .select('deck_id')
    .eq('couple_id', coupleId);

  if (error) throw error;
  return (data ?? []).map((row) => row.deck_id as DeckId);
}

export async function resetGameSession(
  sessionId: string,
  coupleId: string,
  deckId: DeckId
): Promise<GameSession> {
  const { error } = await supabase
    .from('game_sessions')
    .delete()
    .eq('id', sessionId);

  if (error) throw error;

  return createOrResumeGameSession(coupleId, deckId);
}
