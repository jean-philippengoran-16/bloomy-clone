export type DeckId =
  | 'who_is_v1'
  | 'would_you_rather_v1'
  | 'connection_v1'
  | 'chemistry_v1'
  | 'dare_v1';

export type AnswerBasedPlayMode = 'who_is' | 'would_you_rather';
export type CompletionBasedPlayMode = 'conversation';
export type PlayMode = AnswerBasedPlayMode | CompletionBasedPlayMode;
export type Subtheme = 'playful' | 'romantic' | 'chemistry';
export type Tone = 'light' | 'warm' | 'sensual';
export type Profile = 'universal' | 'alliance';
export type WhoIsAnswer = 'me' | 'you' | 'both';
export type WouldYouRatherAnswer = 'option_a' | 'option_b';
export type ConversationAnswer = 'completed';
export type AnswerBasedValue = WhoIsAnswer | WouldYouRatherAnswer;
export type CompletionValue = ConversationAnswer;
export type GameAnswer = AnswerBasedValue | CompletionValue;

export interface BaseGameCard {
  id: string;
  deck: DeckId;
  subtheme: Subtheme;
  intensity: 1 | 2 | 3;
  prompt: string;
  tags: string[];
  profile: Profile;
  audience: 'married_couple';
  tone: Tone;
}

export interface StandardGameCard extends BaseGameCard {
  deck: Exclude<DeckId, 'would_you_rather_v1'>;
}

export interface WouldYouRatherCard extends BaseGameCard {
  deck: 'would_you_rather_v1';
  optionA: string;
  optionB: string;
}

export type GameCard = StandardGameCard | WouldYouRatherCard;

export interface DeckDefinition {
  id: DeckId;
  playMode: PlayMode;
  title: string;
  subtitle: string;
  description: string;
  available: boolean;
  cards: GameCard[];
}

export interface GameSession {
  id: string;
  couple_id: string;
  deck_id: DeckId;
  card_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface GameSessionAnswer {
  id: string;
  session_id: string;
  card_id: string;
  user_id: string;
  answer: GameAnswer;
  created_at: string;
  updated_at: string;
}

export interface GameSessionProgress {
  id: string;
  session_id: string;
  user_id: string;
  current_index: number;
  created_at: string;
  updated_at: string;
}

export interface GameSessionCardAnswers {
  myAnswer: GameAnswer | null;
  partnerAnswer: GameAnswer | null;
  partnerAnswered: boolean;
}
