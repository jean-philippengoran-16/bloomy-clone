export type DeckId =
  | 'who_is_v1'
  | 'would_you_rather_v1'
  | 'connection_v1'
  | 'chemistry_v1'
  | 'dare_v1';

export type PlayMode = 'who_is' | 'would_you_rather';
export type Subtheme = 'playful' | 'romantic' | 'chemistry';
export type Tone = 'light' | 'warm' | 'sensual';
export type Profile = 'universal' | 'alliance';
export type WhoIsAnswer = 'me' | 'you' | 'both';
export type WouldYouRatherAnswer = 'option_a' | 'option_b';
export type GameAnswer = WhoIsAnswer | WouldYouRatherAnswer;

export interface GameCard {
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
