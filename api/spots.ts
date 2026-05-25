import { supabase } from '@/lib/supabase';
import type { NearbySpot, SpotType } from '@/types/database';

export async function searchNearbySpots(params: {
  latitude: number;
  longitude: number;
  radiusMeters?: number;
  limit?: number;
}): Promise<NearbySpot[]> {
  const { data, error } = await supabase.rpc('spots_nearby', {
    p_lat: params.latitude,
    p_lng: params.longitude,
    p_radius_m: params.radiusMeters ?? 500,
    p_limit: params.limit ?? 30,
  });
  if (error) throw error;
  return (data ?? []) as NearbySpot[];
}

export async function reportParkingSpot(params: {
  latitude: number;
  longitude: number;
  spotType?: SpotType;
  address?: string | null;
  notes?: string | null;
  photoUrl?: string | null;
  durationMinutes?: number;
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_parking_spot', {
    p_lat: params.latitude,
    p_lng: params.longitude,
    p_spot_type: params.spotType ?? 'free',
    p_address: params.address ?? null,
    p_notes: params.notes ?? null,
    p_photo_url: params.photoUrl ?? null,
    p_duration_minutes: params.durationMinutes ?? 10,
  });
  if (error) throw mapSpotError(error);
  return data as string;
}

export async function claimParkingSpot(spotId: string): Promise<void> {
  const { error } = await supabase.rpc('claim_parking_spot', { p_spot_id: spotId });
  if (error) throw mapSpotError(error);
}

export async function submitSpotFeedback(params: {
  spotId: string;
  wasAvailable: boolean;
  rating?: number;
  comment?: string;
}): Promise<void> {
  const { error } = await supabase.rpc('submit_feedback', {
    p_spot_id: params.spotId,
    p_was_available: params.wasAvailable,
    p_rating: params.rating ?? null,
    p_comment: params.comment ?? null,
  });
  if (error) throw mapSpotError(error);
}

/**
 * Traduce i codici di errore lanciati dalle RPC in messaggi utente.
 */
function mapSpotError(err: { message: string }): Error {
  const messages: Record<string, string> = {
    not_authenticated: 'Devi essere loggato per fare questa azione.',
    rate_limit_daily: 'Hai raggiunto il limite giornaliero di 5 segnalazioni.',
    too_close_to_existing: 'Hai gia una segnalazione attiva troppo vicina.',
    spot_not_found: 'Parcheggio non trovato.',
    spot_not_available: 'Questo parcheggio non e piu disponibile.',
    spot_expired: 'Questo parcheggio e scaduto.',
    cannot_claim_own_spot: 'Non puoi prendere un parcheggio che hai segnalato tu.',
    insufficient_points: 'Punti insufficienti (servono 10 punti).',
    cannot_feedback_own_spot: 'Non puoi lasciare un feedback su un tuo parcheggio.',
    feedbacks_spot_id_user_id_key: 'Hai gia lasciato un feedback per questo parcheggio.',
  };
  for (const code of Object.keys(messages)) {
    if (err.message.includes(code)) return new Error(messages[code]);
  }
  return new Error(err.message);
}
