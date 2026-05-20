/**
 * Layer di astrazione per l'autenticazione.
 * Le schermate chiamano queste funzioni, non Supabase direttamente.
 * In un domani in cui si cambia backend, basta sostituire questo file.
 */

import type { Session, User } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

export type AuthSession = Session;
export type AuthUser = User;

export async function signUpWithEmail(params: {
  email: string;
  password: string;
  username: string;
}): Promise<{ session: AuthSession | null }> {
  const { data, error } = await supabase.auth.signUp({
    email: params.email,
    password: params.password,
    options: {
      data: { username: params.username },
    },
  });
  if (error) throw error;
  return { session: data.session };
}

export async function signInWithEmail(params: {
  email: string;
  password: string;
}): Promise<{ session: AuthSession }> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: params.email,
    password: params.password,
  });
  if (error) throw error;
  return { session: data.session };
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession(): Promise<AuthSession | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthStateChange(cb: (session: AuthSession | null) => void) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session));
  return () => data.subscription.unsubscribe();
}
