export type DeckId =
  | 'who_is_v1'
  | 'would_you_rather_v1'
  | 'connection_v1'
  | 'chemistry_v1'
  | 'dare_v1';

export type Subtheme = 'playful' | 'romantic' | 'chemistry';
export type Tone = 'light' | 'warm' | 'sensual';
export type Profile = 'universal' | 'alliance';

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
  title: string;
  subtitle: string;
  description: string;
  available: boolean;
  cards: GameCard[];
}
