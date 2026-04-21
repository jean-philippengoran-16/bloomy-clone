import { supabase } from './supabase';

export const MOODS = ['😍', '😊', '😐', '😔', '😢'] as const;
export type Mood = (typeof MOODS)[number];

export interface CheckIn {
  id: string;
  couple_id: string;
  user_id: string;
  mood: Mood;
  note: string | null;
  created_at: string;
}

export async function saveCheckIn(coupleId: string, mood: Mood, note: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('not_authenticated');

  const { error } = await supabase.from('daily_checkins').insert({
    couple_id: coupleId,
    user_id: user.id,
    mood,
    note: note.trim() || null,
  });

  if (error) throw error;
}

export async function getMyLastCheckIn(coupleId: string): Promise<CheckIn | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('daily_checkins')
    .select('id, couple_id, user_id, mood, note, created_at')
    .eq('couple_id', coupleId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}
