import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';

type LocationStatus = 'loading' | 'ready' | 'denied' | 'services_off' | 'unavailable';

interface UseCurrentLocationResult {
  location: Location.LocationObject | null;
  status: LocationStatus;
  error: string | null;
  /**
   * Quando lo stato e' `denied`, indica se l'OS puo' ancora mostrare il dialog
   * di richiesta permesso (`true`) oppure se l'utente lo ha bloccato in modo
   * permanente e bisogna mandarlo nelle impostazioni dell'app (`false`).
   */
  canAskAgain: boolean;
  retry: () => void;
}

/**
 * Recupera la posizione corrente in modo robusto:
 *
 *  1. Verifica che i servizi di localizzazione siano attivi a livello OS.
 *  2. Richiede il permesso foreground.
 *  3. Usa `getLastKnownPositionAsync()` per dare subito qualcosa (~istantaneo).
 *  4. In parallelo richiede una posizione fresca con `getCurrentPositionAsync()`
 *     a precisione `Balanced` (piu' veloce di High e sufficiente per la mappa).
 *
 * In caso di errore non lancia mai: espone uno stato (`status`, `error`)
 * che la schermata puo' tradurre in UI.
 */
export function useCurrentLocation(): UseCurrentLocationResult {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [status, setStatus] = useState<LocationStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [canAskAgain, setCanAskAgain] = useState(true);

  const fetchLocation = useCallback(async () => {
    setStatus('loading');
    setError(null);

    try {
      // 1) Permesso: se manca lo richiediamo (dialog OS). Lo facciamo PRIMA del
      // check servizi, cosi' la richiesta scatta davvero quando serve.
      const permission = await Location.requestForegroundPermissionsAsync();
      setCanAskAgain(permission.canAskAgain);
      if (permission.status !== 'granted') {
        setStatus('denied');
        setError('Permesso di accesso alla posizione negato.');
        return;
      }

      // 2) Servizi di localizzazione (GPS) accesi a livello di sistema.
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        setStatus('services_off');
        setError('I servizi di localizzazione (GPS) sono spenti. Attivali dalle impostazioni del telefono.');
        return;
      }

      // Last known: spesso istantaneo, ci permette di mostrare gia' qualcosa
      const last = await Location.getLastKnownPositionAsync();
      if (last) {
        setLocation(last);
        setStatus('ready');
      }

      // Fresh fix: piu' lento ma piu' accurato
      try {
        const fresh = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setLocation(fresh);
        setStatus('ready');
      } catch (freshError) {
        if (!last) {
          setStatus('unavailable');
          setError(
            freshError instanceof Error
              ? freshError.message
              : 'Impossibile ottenere la posizione.'
          );
        }
        // Se avevamo gia' una last known, la teniamo ed evitiamo di rompere la UI.
      }
    } catch (e) {
      setStatus('unavailable');
      setError(e instanceof Error ? e.message : 'Errore sconosciuto.');
    }
  }, []);

  useEffect(() => {
    fetchLocation();
  }, [fetchLocation]);

  return { location, status, error, canAskAgain, retry: fetchLocation };
}
