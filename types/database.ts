/**
 * Tipi del database. Manualmente sincronizzati con `supabase/migrations/0001_init.sql`.
 *
 * In futuro si possono rigenerare automaticamente con:
 *   npx supabase gen types typescript --project-id <ID> > types/database.ts
 */

export type SpotType = 'free' | 'paid' | 'disc' | 'disabled' | 'motorbike' | 'electric';
export type SpotStatus = 'active' | 'claimed' | 'expired' | 'invalid';

export type TxReason =
  | 'initial_bonus'
  | 'report_created'
  | 'report_confirmed'
  | 'spot_claimed'
  | 'feedback_bonus'
  | 'fraud_penalty'
  | 'daily_streak'
  | 'invite_bonus'
  | 'admin_adjustment';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          avatar_url: string | null;
          points: number;
          reputation: number;
          level: number;
          total_reports: number;
          total_claims: number;
          total_feedbacks: number;
          last_streak_at: string | null;
          streak_days: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          avatar_url?: string | null;
          points?: number;
          reputation?: number;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      parking_spots: {
        Row: {
          id: string;
          reporter_id: string;
          address: string | null;
          spot_type: SpotType;
          status: SpotStatus;
          claimed_by: string | null;
          claimed_at: string | null;
          notes: string | null;
          photo_url: string | null;
          available_from: string;
          expires_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
      };
      feedbacks: {
        Row: {
          id: string;
          spot_id: string;
          user_id: string;
          was_available: boolean;
          rating: number | null;
          comment: string | null;
          arrived_at: string;
          created_at: string;
        };
        Insert: never;
        Update: never;
      };
      points_transactions: {
        Row: {
          id: string;
          user_id: string;
          delta: number;
          reason: TxReason;
          related_spot_id: string | null;
          metadata: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
      };
    };
    Functions: {
      spots_nearby: {
        Args: {
          p_lat: number;
          p_lng: number;
          p_radius_m?: number;
          p_limit?: number;
        };
        Returns: NearbySpot[];
      };
      create_parking_spot: {
        Args: {
          p_lat: number;
          p_lng: number;
          p_spot_type?: SpotType;
          p_address?: string | null;
          p_notes?: string | null;
          p_photo_url?: string | null;
          p_duration_minutes?: number;
        };
        Returns: string;
      };
      claim_parking_spot: { Args: { p_spot_id: string }; Returns: void };
      submit_feedback: {
        Args: {
          p_spot_id: string;
          p_was_available: boolean;
          p_rating?: number | null;
          p_comment?: string | null;
        };
        Returns: void;
      };
    };
  };
}

export interface NearbySpot {
  id: string;
  reporter_id: string;
  reporter_username: string;
  latitude: number;
  longitude: number;
  distance_m: number;
  address: string | null;
  spot_type: SpotType;
  status: SpotStatus;
  notes: string | null;
  photo_url: string | null;
  expires_at: string;
  created_at: string;
}

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type PointsTransaction = Database['public']['Tables']['points_transactions']['Row'];
