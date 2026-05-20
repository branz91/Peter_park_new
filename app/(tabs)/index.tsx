import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { claimParkingSpot, searchNearbySpots } from '@/api/spots';
import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import type { NearbySpot } from '@/types/database';

export default function MapScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView | null>(null);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permesso di accesso alla posizione negato');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      setLocation(loc);
      mapRef.current?.animateToRegion(
        {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        800
      );
    })();
  }, []);

  const { data: spots, refetch } = useQuery({
    queryKey: ['spots', location?.coords.latitude, location?.coords.longitude],
    enabled: !!location,
    queryFn: () =>
      searchNearbySpots({
        latitude: location!.coords.latitude,
        longitude: location!.coords.longitude,
        radiusMeters: 1000,
      }),
    refetchInterval: 15000,
  });

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
              Alert.alert('Parcheggio prenotato!', 'Apri il navigatore per raggiungerlo.');
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
        <ThemedText>{errorMsg ?? 'Caricamento posizione...'}</ThemedText>
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
            pinColor="#0a7ea4"
            onCalloutPress={() => handleClaim(spot)}
          />
        ))}
      </MapView>

      <View style={styles.bottomBar}>
        <Button
          title="Segnala parcheggio"
          onPress={() => router.push('/report')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bottomBar: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    right: 24,
  },
});
