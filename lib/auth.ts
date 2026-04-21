import { type Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

export async function ensureAnonymousSession(): Promise<Session> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) throw sessionError;
  if (session) return session;

  const { data, error: signInError } = await supabase.auth.signInAnonymously();
  if (signInError) throw signInError;
  if (!data.session) throw new Error('session_unavailable');

  return data.session;
}
