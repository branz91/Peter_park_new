import { supabase } from '@/lib/supabase';
import type { PointsTransaction, Profile } from '@/types/database';

export async function getMyProfile(): Promise<Profile | null> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userData.user.id)
    .single();
  if (error) throw error;
  return data;
}

export async function getMyPointsHistory(limit = 30): Promise<PointsTransaction[]> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return [];
  const { data, error } = await supabase
    .from('points_transactions')
    .select('*')
    .eq('user_id', userData.user.id)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as PointsTransaction[];
}

export async function updateUsername(username: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('not_authenticated');
  const { error } = await supabase
    .from('profiles')
    .update({ username })
    .eq('id', userData.user.id);
  if (error) throw error;
}
