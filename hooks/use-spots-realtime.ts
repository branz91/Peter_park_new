import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { useEffect, useRef } from 'react';

import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

type ParkingSpotRow = Database['public']['Tables']['parking_spots']['Row'];

export type ParkingSpotChangePayload = RealtimePostgresChangesPayload<ParkingSpotRow>;

/**
 * Sottoscrive i cambiamenti realtime sulla tabella `parking_spots` e invoca
 * `onChange` per ogni INSERT / UPDATE / DELETE.
 *
 * Il channel viene creato una sola volta (dipende solo da `enabled`); il
 * callback `onChange` puo' cambiare identita' tra un render e l'altro senza
 * forzare la ri-sottoscrizione, grazie al ref interno.
 */
export function useSpotsRealtime(options: {
  enabled: boolean;
  onChange: (payload: ParkingSpotChangePayload) => void;
}): void {
  const { enabled, onChange } = options;

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel('parking_spots_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'parking_spots' },
        (payload) => {
          onChangeRef.current(payload as ParkingSpotChangePayload);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled]);
}
