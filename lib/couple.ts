import { supabase } from './supabase';

export interface Couple {
  id: string;
  user_a: string;
  user_b: string;
  created_at: string;
}

export async function getMyCouple(): Promise<Couple | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('couples')
    .select('id, user_a, user_b, created_at')
    .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
    .maybeSingle();

  if (error) throw error;
  return data;
}
