import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import MapView, { Callout, Circle, Marker, type Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { claimParkingSpot, searchNearbySpots } from '@/api/spots';
import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useCurrentLocation } from '@/hooks/use-current-location';
import { useSpotsRealtime } from '@/hooks/use-spots-realtime';
import { useTheme } from '@/hooks/use-theme';
import { haversineMeters, radiusFromRegion } from '@/lib/geo';
import type { NearbySpot } from '@/types/database';

const DEFAULT_RADIUS_M = 1000;
const DEFAULT_LATITUDE_DELTA = 0.02;
const DEFAULT_LONGITUDE_DELTA = 0.02;
const RADIUS_PRESETS = [250, 500, 1000, 2000, 5000];

type MapKind = 'standard' | 'hybrid';

type Coord = { latitude: number; longitude: number };

function formatRadius(meters: number): string {
  return meters < 1000 ? `${meters} m` : `${meters / 1000} km`;
}

const SPOT_TYPE_LABELS: Record<string, string> = {
  free: 'Libero',
  paid: 'A pagamento',
  disc: 'Disco orario',
  disabled: 'Disabili',
  motorbike: 'Moto',
  electric: 'Elettrico',
};

function spotTypeLabel(type: string): string {
  return SPOT_TYPE_LABELS[type] ?? type;
}

function formatExpiry(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'Scaduto';
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `Scade tra ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `Scade tra ${hours}h ${rest}min` : `Scade tra ${hours}h`;
}

function locationPrompt(status: string): { title: string; message: string } {
  switch (status) {
    case 'denied':
      return {
        title: 'Attiva la posizione',
        message:
          'PeterPark ha bisogno della tua posizione per mostrarti i parcheggi vicini. Consenti l\u2019accesso dalle impostazioni.',
      };
    case 'services_off':
      return {
        title: 'Posizione disattivata',
        message:
          'I servizi di localizzazione del telefono sono spenti. Attivali per vedere i parcheggi intorno a te.',
      };
    default:
      return {
        title: 'Posizione non disponibile',
        message:
          'Non riesco a leggere la tua posizione. Assicurati che la localizzazione sia attiva, poi riprova.',
      };
  }
}

function openNavigation(latitude: number, longitude: number): void {
  const universal = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
  const url =
    Platform.select({
      ios: `http://maps.apple.com/?daddr=${latitude},${longitude}`,
      android: `google.navigation:q=${latitude},${longitude}`,
      default: universal,
    }) ?? universal;
  Linking.openURL(url).catch(() => Linking.openURL(universal));
}

interface SearchArea {
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

export default function MapScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView | null>(null);
  const { location, status, retry } = useCurrentLocation();

  const regionRef = useRef<Region | null>(null);
  const [searchArea, setSearchArea] = useState<SearchArea | null>(null);
  const [showSearchHere, setShowSearchHere] = useState(false);
  const [mapKind, setMapKind] = useState<MapKind>('standard');
  const [addressQuery, setAddressQuery] = useState('');
  const [geocoding, setGeocoding] = useState(false);
  const [manualPin, setManualPin] = useState<Coord | null>(null);
  const [searchRadius, setSearchRadius] = useState(DEFAULT_RADIUS_M);

  // Appena abbiamo il GPS, inizializziamo l'area di ricerca sulla nostra
  // posizione e centriamo la mappa (solo la prima volta).
  useEffect(() => {
    if (!location || searchArea) return;
    const { latitude, longitude } = location.coords;
    setSearchArea({ latitude, longitude, radiusMeters: DEFAULT_RADIUS_M });
    mapRef.current?.animateToRegion(
      {
        latitude,
        longitude,
        latitudeDelta: DEFAULT_LATITUDE_DELTA,
        longitudeDelta: DEFAULT_LONGITUDE_DELTA,
      },
      800
    );
  }, [location, searchArea]);

  const {
    data: spots,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: [
      'spots',
      searchArea?.latitude,
      searchArea?.longitude,
      searchArea?.radiusMeters,
    ],
    enabled: !!searchArea,
    queryFn: () =>
      searchNearbySpots({
        latitude: searchArea!.latitude,
        longitude: searchArea!.longitude,
        radiusMeters: searchArea!.radiusMeters,
        limit: 50,
      }),
    // Fallback nel caso il websocket realtime non sia disponibile
    refetchInterval: 60000,
  });

  // Aggiorna la mappa in tempo reale quando arriva un INSERT/UPDATE/DELETE
  // sui parking_spots. Evita il polling stretto sopra.
  const handleRealtimeChange = useCallback(() => {
    refetch();
  }, [refetch]);
  useSpotsRealtime({ enabled: !!searchArea, onChange: handleRealtimeChange });

  function handleRegionChangeComplete(region: Region) {
    regionRef.current = region;
    // In modalita' punto manuale la ricerca e' ancorata alla gocciolina:
    // non proponiamo "Cerca in questa zona".
    if (!searchArea || manualPin) {
      if (manualPin) setShowSearchHere(false);
      return;
    }
    const movedMeters = haversineMeters(region, searchArea);
    // Mostra "Cerca in questa zona" solo se ci si e' spostati in modo
    // significativo rispetto all'ultima ricerca.
    const threshold = Math.max(150, searchArea.radiusMeters * 0.3);
    setShowSearchHere(movedMeters > threshold);
  }

  function handleSearchHere() {
    const region = regionRef.current;
    if (!region) return;
    setManualPin(null);
    setSearchArea({
      latitude: region.latitude,
      longitude: region.longitude,
      radiusMeters: radiusFromRegion(region),
    });
    setShowSearchHere(false);
  }

  function handleRecenter() {
    if (!location) return;
    const { latitude, longitude } = location.coords;
    mapRef.current?.animateToRegion(
      {
        latitude,
        longitude,
        latitudeDelta: DEFAULT_LATITUDE_DELTA,
        longitudeDelta: DEFAULT_LONGITUDE_DELTA,
      },
      600
    );
    setManualPin(null);
    setSearchArea({ latitude, longitude, radiusMeters: DEFAULT_RADIUS_M });
    setShowSearchHere(false);
  }

  // Posiziona/rimuove la "gocciolina" di ricerca manuale.
  function dropManualPin(coord: Coord) {
    setManualPin(coord);
    setSearchArea({ latitude: coord.latitude, longitude: coord.longitude, radiusMeters: searchRadius });
    setShowSearchHere(false);
  }

  function toggleManualPin() {
    if (manualPin) {
      clearManualPin();
      return;
    }
    const region = regionRef.current;
    const center: Coord | null = region
      ? { latitude: region.latitude, longitude: region.longitude }
      : location
      ? { latitude: location.coords.latitude, longitude: location.coords.longitude }
      : null;
    if (center) dropManualPin(center);
  }

  function clearManualPin() {
    setManualPin(null);
    setShowSearchHere(false);
    if (location) {
      setSearchArea({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        radiusMeters: DEFAULT_RADIUS_M,
      });
    }
  }

  function handleRadiusChange(radiusMeters: number) {
    setSearchRadius(radiusMeters);
    if (manualPin) {
      setSearchArea({ latitude: manualPin.latitude, longitude: manualPin.longitude, radiusMeters });
    }
  }

  async function handleSearchAddress() {
    const query = addressQuery.trim();
    if (!query) return;
    Keyboard.dismiss();
    setGeocoding(true);
    try {
      const results = await Location.geocodeAsync(query);
      if (results.length === 0) {
        Alert.alert(
          'Nessun risultato',
          'Non ho trovato questo indirizzo. Prova a essere piu specifico (via, citta).'
        );
        return;
      }
      const { latitude, longitude } = results[0];
      mapRef.current?.animateToRegion(
        {
          latitude,
          longitude,
          latitudeDelta: DEFAULT_LATITUDE_DELTA,
          longitudeDelta: DEFAULT_LONGITUDE_DELTA,
        },
        700
      );
      setManualPin(null);
      setSearchArea({ latitude, longitude, radiusMeters: DEFAULT_RADIUS_M });
      setShowSearchHere(false);
    } catch (e) {
      Alert.alert('Errore ricerca', e instanceof Error ? e.message : String(e));
    } finally {
      setGeocoding(false);
    }
  }

  // Menu azioni aperto toccando il callout del pin: naviga o prenota.
  function handleSpotActions(spot: NearbySpot) {
    Alert.alert(
      `Parcheggio di @${spot.reporter_username}`,
      `${spotTypeLabel(spot.spot_type)} · ${Math.round(spot.distance_m)}m\n${formatExpiry(spot.expires_at)}`,
      [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Naviga', onPress: () => openNavigation(spot.latitude, spot.longitude) },
        { text: 'Prenota (-10 punti)', onPress: () => claimSpot(spot) },
      ]
    );
  }

  async function claimSpot(spot: NearbySpot) {
    try {
      await claimParkingSpot(spot.id);
      await refetch();
      Alert.alert(
        'Parcheggio prenotato!',
        'Apri il navigatore per raggiungerlo. Quando arrivi torna qui per lasciare un feedback.',
        [
          { text: 'Naviga', onPress: () => openNavigation(spot.latitude, spot.longitude) },
          {
            text: 'Dai feedback',
            onPress: () =>
              router.push({
                pathname: '/feedback',
                params: { spotId: spot.id, reporter: spot.reporter_username },
              }),
          },
          { text: 'Piu tardi', style: 'cancel' },
        ]
      );
    } catch (e) {
      Alert.alert('Errore', e instanceof Error ? e.message : String(e));
    }
  }

  if (!location) {
    if (status === 'loading') {
      return (
        <ThemedView style={styles.center}>
          <ActivityIndicator size="large" color={colors.tint} />
          <ThemedText type="muted" style={styles.loadingText}>
            Individuo la tua posizione...
          </ThemedText>
        </ThemedView>
      );
    }

    const prompt = locationPrompt(status);
    return (
      <ThemedView style={styles.center}>
        <View
          style={[
            styles.centerCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={[styles.centerIcon, { backgroundColor: `${colors.tint}22` }]}>
            <IconSymbol name="location.fill" size={30} color={colors.tint} />
          </View>
          <ThemedText type="subtitle" style={styles.centerText}>
            {prompt.title}
          </ThemedText>
          <ThemedText type="muted" style={styles.centerText}>
            {prompt.message}
          </ThemedText>
          <View style={styles.centerActions}>
            <Button title="Apri impostazioni" onPress={() => Linking.openSettings()} />
            <Button title="Riprova" variant="ghost" onPress={retry} />
          </View>
        </View>
      </ThemedView>
    );
  }

  const spotCount = spots?.length ?? 0;

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        mapType={mapKind}
        showsUserLocation
        showsMyLocationButton={false}
        onRegionChangeComplete={handleRegionChangeComplete}
        onLongPress={(e) => dropManualPin(e.nativeEvent.coordinate)}
        initialRegion={{
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: DEFAULT_LATITUDE_DELTA,
          longitudeDelta: DEFAULT_LONGITUDE_DELTA,
        }}
      >
        {searchArea ? (
          <Circle
            center={{ latitude: searchArea.latitude, longitude: searchArea.longitude }}
            radius={searchArea.radiusMeters}
            strokeColor={colors.tint}
            fillColor={`${colors.tint}22`}
            strokeWidth={1.5}
          />
        ) : null}
        {manualPin ? (
          <Marker
            coordinate={manualPin}
            draggable
            onDragEnd={(e) => dropManualPin(e.nativeEvent.coordinate)}
            pinColor={colors.danger}
            title="Punto di ricerca"
            description="Trascinami per spostare la ricerca"
          />
        ) : null}
        {spots?.map((spot) => (
          <Marker
            key={spot.id}
            coordinate={{ latitude: spot.latitude, longitude: spot.longitude }}
            pinColor={colors.tint}
            onCalloutPress={() => handleSpotActions(spot)}
          >
            <Callout onPress={() => handleSpotActions(spot)}>
              <View style={[styles.callout, { backgroundColor: colors.background }]}>
                <ThemedText style={[styles.calloutTitle, { color: colors.text }]}>
                  {spotTypeLabel(spot.spot_type)}
                </ThemedText>
                <ThemedText style={[styles.calloutLine, { color: colors.textMuted }]}>
                  @{spot.reporter_username} · {Math.round(spot.distance_m)}m
                </ThemedText>
                <ThemedText style={[styles.calloutLine, { color: colors.textMuted }]}>
                  {formatExpiry(spot.expires_at)}
                </ThemedText>
                {spot.notes ? (
                  <ThemedText
                    style={[styles.calloutLine, { color: colors.text }]}
                    numberOfLines={2}
                  >
                    {spot.notes}
                  </ThemedText>
                ) : null}
                <ThemedText style={[styles.calloutAction, { color: colors.tint }]}>
                  Tocca per Naviga / Prenota
                </ThemedText>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

      {/* Barra superiore: ricerca per indirizzo + "Cerca in questa zona" */}
      <View style={[styles.topBar, { top: insets.top + 8 }]} pointerEvents="box-none">
        <View
          style={[
            styles.searchBar,
            { backgroundColor: colors.background, borderColor: colors.border },
            Platform.OS === 'ios'
              ? {
                  shadowColor: '#000',
                  shadowOpacity: 0.15,
                  shadowOffset: { width: 0, height: 2 },
                  shadowRadius: 6,
                }
              : { elevation: 4 },
          ]}
        >
          <IconSymbol name="magnifyingglass" size={18} color={colors.textMuted} />
          <TextInput
            value={addressQuery}
            onChangeText={setAddressQuery}
            onSubmitEditing={handleSearchAddress}
            placeholder="Cerca via, indirizzo o citta..."
            placeholderTextColor={colors.textMuted}
            returnKeyType="search"
            style={[styles.searchInput, { color: colors.text }]}
          />
          {geocoding ? (
            <ActivityIndicator size="small" color={colors.tint} />
          ) : addressQuery.length > 0 ? (
            <Pressable
              onPress={() => setAddressQuery('')}
              hitSlop={8}
              accessibilityLabel="Cancella ricerca"
            >
              <IconSymbol name="xmark.circle.fill" size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>

        {showSearchHere ? (
          <Pressable
            onPress={handleSearchHere}
            style={[
              styles.searchHere,
              { backgroundColor: colors.tint },
              Platform.OS === 'ios'
                ? {
                    shadowColor: '#000',
                    shadowOpacity: 0.2,
                    shadowOffset: { width: 0, height: 2 },
                    shadowRadius: 6,
                  }
                : { elevation: 4 },
            ]}
          >
            {isFetching ? (
              <ActivityIndicator color={colors.onTint} size="small" />
            ) : (
              <IconSymbol name="magnifyingglass" size={16} color={colors.onTint} />
            )}
            <ThemedText style={[styles.searchHereText, { color: colors.onTint }]}>
              Cerca in questa zona
            </ThemedText>
          </Pressable>
        ) : null}
      </View>

      {/* Controlli mappa a destra: punto manuale + tipo mappa + ricentra */}
      <Pressable
        onPress={toggleManualPin}
        style={[
          styles.mapControl,
          styles.pinButton,
          {
            backgroundColor: manualPin ? colors.tint : colors.background,
            borderColor: colors.border,
          },
          mapControlShadow,
        ]}
        accessibilityLabel="Punto di ricerca manuale"
      >
        <IconSymbol
          name="mappin.circle.fill"
          size={22}
          color={manualPin ? colors.onTint : colors.tint}
        />
      </Pressable>

      <Pressable
        onPress={() => setMapKind((k) => (k === 'standard' ? 'hybrid' : 'standard'))}
        style={[
          styles.mapControl,
          styles.mapTypeButton,
          { backgroundColor: colors.background, borderColor: colors.border },
          mapControlShadow,
        ]}
        accessibilityLabel="Cambia tipo di mappa"
      >
        <IconSymbol
          name={mapKind === 'standard' ? 'globe' : 'map'}
          size={22}
          color={colors.tint}
        />
      </Pressable>

      <Pressable
        onPress={handleRecenter}
        style={[
          styles.mapControl,
          styles.recenterButton,
          { backgroundColor: colors.background, borderColor: colors.border },
          mapControlShadow,
        ]}
        accessibilityLabel="Torna sulla mia posizione"
      >
        <IconSymbol name="location.fill" size={22} color={colors.tint} />
      </Pressable>

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
        {manualPin ? (
          <View style={styles.radiusPanel}>
            <View style={styles.radiusHeader}>
              <ThemedText style={styles.radiusTitle}>Raggio di ricerca</ThemedText>
              <Pressable onPress={clearManualPin} hitSlop={8}>
                <ThemedText style={[styles.radiusClear, { color: colors.tint }]}>
                  Rimuovi punto
                </ThemedText>
              </Pressable>
            </View>
            <View style={styles.radiusChips}>
              {RADIUS_PRESETS.map((radius) => {
                const active = searchRadius === radius;
                return (
                  <Pressable
                    key={radius}
                    onPress={() => handleRadiusChange(radius)}
                    style={[
                      styles.radiusChip,
                      {
                        backgroundColor: active ? colors.tint : colors.surface,
                        borderColor: active ? colors.tint : colors.border,
                      },
                    ]}
                  >
                    <ThemedText
                      style={[
                        styles.radiusChipText,
                        { color: active ? colors.onTint : colors.text },
                      ]}
                    >
                      {formatRadius(radius)}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
        {spotCount > 0 ? (
          <ThemedText type="muted" style={styles.bottomHint}>
            {spotCount === 1
              ? '1 parcheggio in questa zona'
              : `${spotCount} parcheggi in questa zona`}
          </ThemedText>
        ) : !isFetching ? (
          <ThemedText type="muted" style={styles.bottomHint}>
            Nessun parcheggio qui. Sposta la mappa, cerca un indirizzo o tieni premuto
            sulla mappa per scegliere un punto, oppure segnala il primo!
          </ThemedText>
        ) : null}
        <Button title="Segnala parcheggio" onPress={() => router.push('/report')} />
      </View>
    </View>
  );
}

const mapControlShadow =
  Platform.OS === 'ios'
    ? {
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 6,
      }
    : { elevation: 4 };

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  centerCard: {
    padding: 24,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    gap: 10,
    maxWidth: 360,
    width: '100%',
  },
  centerIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  centerText: { textAlign: 'center' },
  centerActions: { alignSelf: 'stretch', gap: 8, marginTop: 8 },
  loadingText: { marginTop: 4 },
  topBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
    gap: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'stretch',
    height: 48,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
  searchHere: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
  },
  searchHereText: { fontSize: 14, fontWeight: '700' },
  mapControl: {
    position: 'absolute',
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinButton: { bottom: 226 },
  mapTypeButton: { bottom: 170 },
  recenterButton: { bottom: 114 },
  radiusPanel: { gap: 8, marginBottom: 4 },
  radiusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  radiusTitle: { fontSize: 13, fontWeight: '700' },
  radiusClear: { fontSize: 12, fontWeight: '700' },
  radiusChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  radiusChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  radiusChipText: { fontSize: 12, fontWeight: '600' },
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
  callout: { width: 210, padding: 6, gap: 2 },
  calloutTitle: { fontSize: 15, fontWeight: '700' },
  calloutLine: { fontSize: 12 },
  calloutAction: { fontSize: 12, fontWeight: '700', marginTop: 4 },
});
