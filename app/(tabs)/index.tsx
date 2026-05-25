import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { claimParkingSpot, searchNearbySpots } from '@/api/spots';
import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useCurrentLocation } from '@/hooks/use-current-location';
import { useSpotsRealtime } from '@/hooks/use-spots-realtime';
import { useTheme } from '@/hooks/use-theme';
import type { NearbySpot } from '@/types/database';

export default function MapScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const mapRef = useRef<MapView | null>(null);
  const { location, status, error, retry } = useCurrentLocation();

  useEffect(() => {
    if (!location) return;
    mapRef.current?.animateToRegion(
      {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      800
    );
  }, [location]);

  const { data: spots, refetch } = useQuery({
    queryKey: ['spots', location?.coords.latitude, location?.coords.longitude],
    enabled: !!location,
    queryFn: () =>
      searchNearbySpots({
        latitude: location!.coords.latitude,
        longitude: location!.coords.longitude,
        radiusMeters: 1000,
      }),
    // Fallback nel caso il websocket realtime non sia disponibile
    refetchInterval: 60000,
  });

  // Aggiorna la mappa in tempo reale quando arriva un INSERT/UPDATE/DELETE
  // sui parking_spots. Evita il polling stretto sopra.
  const handleRealtimeChange = useCallback(() => {
    refetch();
  }, [refetch]);
  useSpotsRealtime({ enabled: !!location, onChange: handleRealtimeChange });

  async function handleClaim(spot: NearbySpot) {
    Alert.alert(
      'Prenotare questo parcheggio?',
      `Costa 10 punti. Reporter: @${spot.reporter_username}\nDistanza: ${Math.round(spot.distance_m)}m`,
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Prenota',
          onPress: async () => {
            try {
              await claimParkingSpot(spot.id);
              await refetch();
              Alert.alert(
                'Parcheggio prenotato!',
                'Apri il navigatore per raggiungerlo. Quando arrivi torna qui per lasciare un feedback.',
                [
                  { text: 'Piu tardi', style: 'cancel' },
                  {
                    text: 'Dai feedback ora',
                    onPress: () =>
                      router.push({
                        pathname: '/feedback',
                        params: {
                          spotId: spot.id,
                          reporter: spot.reporter_username,
                        },
                      }),
                  },
                ]
              );
            } catch (e) {
              Alert.alert('Errore', e instanceof Error ? e.message : String(e));
            }
          },
        },
      ]
    );
  }

  if (!location) {
    return (
      <ThemedView style={styles.center}>
        <View
          style={[
            styles.centerCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <ThemedText type="subtitle" style={styles.centerText}>
            {status === 'loading' ? 'Caricamento posizione...' : 'Posizione non disponibile'}
          </ThemedText>
          {status !== 'loading' && error ? (
            <ThemedText type="muted" style={styles.centerText}>
              {error}
            </ThemedText>
          ) : null}
          {status !== 'loading' && (
            <View style={styles.retryButton}>
              <Button title="Riprova" onPress={retry} />
            </View>
          )}
        </View>
      </ThemedView>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        showsUserLocation
        showsMyLocationButton
        initialRegion={{
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
      >
        {spots?.map((spot) => (
          <Marker
            key={spot.id}
            coordinate={{ latitude: spot.latitude, longitude: spot.longitude }}
            title={`@${spot.reporter_username}`}
            description={`${Math.round(spot.distance_m)}m · ${spot.spot_type}`}
            pinColor={colors.tint}
            onCalloutPress={() => handleClaim(spot)}
          />
        ))}
      </MapView>

      <View
        style={[
          styles.bottomBar,
          { backgroundColor: colors.background },
          Platform.OS === 'ios'
            ? {
                shadowColor: '#000',
                shadowOpacity: 0.15,
                shadowOffset: { width: 0, height: -2 },
                shadowRadius: 10,
              }
            : { elevation: 8 },
        ]}
      >
        <Button title="Segnala parcheggio" onPress={() => router.push('/report')} />
        {spots && spots.length === 0 ? (
          <ThemedText type="muted" style={styles.bottomHint}>
            Nessun parcheggio segnalato qui intorno. Sii il primo!
          </ThemedText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  centerCard: {
    padding: 24,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    gap: 12,
    maxWidth: 360,
    width: '100%',
  },
  centerText: { textAlign: 'center' },
  retryButton: { minWidth: 200, alignSelf: 'stretch', marginTop: 4 },
  bottomBar: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    padding: 12,
    borderRadius: 18,
    gap: 8,
  },
  bottomHint: { textAlign: 'center', fontSize: 12 },
});
