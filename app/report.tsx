import { useQueryClient } from '@tanstack/react-query';
// --- FOTO DISABILITATE (per tenere il DB leggero). Riattivare in futuro. ---
// import { Image } from 'expo-image';
// import * as ImagePicker from 'expo-image-picker';
// import { uploadSpotPhoto } from '@/api/storage';
// import { useAuthStore } from '@/stores/auth';
// --------------------------------------------------------------------------
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import MapView from 'react-native-maps';

import { reportParkingSpot } from '@/api/spots';
import { Button } from '@/components/button';
import { LocationNotice } from '@/components/location-notice';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useCurrentLocation } from '@/hooks/use-current-location';
import { useTheme } from '@/hooks/use-theme';
import type { SpotType } from '@/types/database';

const PICKER_DELTA = 0.004;

type Coord = { latitude: number; longitude: number };

const SPOT_TYPES: { value: SpotType; label: string }[] = [
  { value: 'free', label: 'Libero' },
  { value: 'paid', label: 'A pagamento' },
  { value: 'disc', label: 'Disco orario' },
  { value: 'disabled', label: 'Disabili' },
  { value: 'motorbike', label: 'Moto' },
  { value: 'electric', label: 'Elettrico' },
];

const DURATIONS = [5, 10, 15, 30];

export default function ReportScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  // const userId = useAuthStore((s) => s.session?.user.id); // usato solo per le foto
  const { location, status: locationStatus, canAskAgain, retry: retryLocation } = useCurrentLocation();

  const pickerRef = useRef<MapView | null>(null);
  const [spotType, setSpotType] = useState<SpotType>('free');
  const [duration, setDuration] = useState(10);
  const [notes, setNotes] = useState('');
  // const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null); // FOTO DISABILITATE
  const [loading, setLoading] = useState(false);
  // Punto scelto dall'utente sulla mappa (di default la posizione attuale).
  const [pickedCoord, setPickedCoord] = useState<Coord | null>(null);
  const [addressQuery, setAddressQuery] = useState('');
  const [geocoding, setGeocoding] = useState(false);

  // Appena arriva il GPS, inizializziamo il punto sul quale segnalare.
  useEffect(() => {
    if (location && !pickedCoord) {
      setPickedCoord({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    }
  }, [location, pickedCoord]);

  function recenterPickerToCurrent() {
    if (!location) return;
    const coord: Coord = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
    setPickedCoord(coord);
    pickerRef.current?.animateToRegion(
      { ...coord, latitudeDelta: PICKER_DELTA, longitudeDelta: PICKER_DELTA },
      400
    );
  }

  // Cerca la via/indirizzo digitato e sposta la gocciolina su quel punto.
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
      const coord: Coord = { latitude: results[0].latitude, longitude: results[0].longitude };
      setPickedCoord(coord);
      pickerRef.current?.animateToRegion(
        { ...coord, latitudeDelta: PICKER_DELTA, longitudeDelta: PICKER_DELTA },
        600
      );
    } catch (e) {
      Alert.alert('Errore ricerca', e instanceof Error ? e.message : String(e));
    } finally {
      setGeocoding(false);
    }
  }

  // --- FOTO DISABILITATE: selezione immagine da fotocamera/galleria. -------
  // Riattivare insieme agli import e allo stato `photo` in cima al file, e al
  // blocco UI piu' in basso, quando si vorra' di nuovo permettere le foto.
  // async function pickPhoto(source: 'camera' | 'library') {
  //   const permission =
  //     source === 'camera'
  //       ? await ImagePicker.requestCameraPermissionsAsync()
  //       : await ImagePicker.requestMediaLibraryPermissionsAsync();
  //   if (!permission.granted) {
  //     Alert.alert(
  //       'Permesso negato',
  //       source === 'camera'
  //         ? 'Per scattare una foto serve il permesso fotocamera.'
  //         : 'Per scegliere una foto serve il permesso galleria.'
  //     );
  //     return;
  //   }
  //   const result =
  //     source === 'camera'
  //       ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.6 })
  //       : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
  //   if (result.canceled || result.assets.length === 0) return;
  //   setPhoto(result.assets[0]);
  // }
  // -------------------------------------------------------------------------

  async function handleSubmit() {
    if (!location) return;
    const coord = pickedCoord ?? {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
    setLoading(true);
    try {
      // FOTO DISABILITATE: nessun upload, photoUrl resta null.
      const photoUrl: string | null = null;
      // if (photo && userId) {
      //   photoUrl = await uploadSpotPhoto({
      //     userId,
      //     fileUri: photo.uri,
      //     contentType: photo.mimeType ?? 'image/jpeg',
      //   });
      // }
      await reportParkingSpot({
        latitude: coord.latitude,
        longitude: coord.longitude,
        spotType,
        notes: notes.trim() || null,
        photoUrl,
        durationMinutes: duration,
      });
      await queryClient.invalidateQueries({ queryKey: ['spots'] });
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      Alert.alert(
        'Segnalazione inviata!',
        'Riceverai +10 punti quando un altro utente confermera che il parcheggio era davvero libero.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (e) {
      Alert.alert('Errore', e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  // Senza posizione mostriamo la scheda che spiega e chiede permesso/GPS.
  if (!location) {
    return (
      <LocationNotice status={locationStatus} canAskAgain={canAskAgain} onRetry={retryLocation} />
    );
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <ThemedText type="subtitle">Dove lasci il parcheggio</ThemedText>

        <View style={[styles.pickerWrap, { borderColor: colors.border }]}>
          <MapView
            ref={pickerRef}
            style={styles.picker}
            showsUserLocation
            initialRegion={{
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              latitudeDelta: PICKER_DELTA,
              longitudeDelta: PICKER_DELTA,
            }}
            onRegionChangeComplete={(r) =>
              setPickedCoord({ latitude: r.latitude, longitude: r.longitude })
            }
          />

          {/* Barra di ricerca via/indirizzo sopra la mappa */}
          <View
            style={[
              styles.searchBar,
              { backgroundColor: colors.background, borderColor: colors.border },
              Platform.OS === 'ios'
                ? { shadowColor: '#000', shadowOpacity: 0.15, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6 }
                : { elevation: 4 },
            ]}
          >
            <IconSymbol name="magnifyingglass" size={18} color={colors.textMuted} />
            <TextInput
              value={addressQuery}
              onChangeText={setAddressQuery}
              onSubmitEditing={handleSearchAddress}
              placeholder="Scrivi la via o l'indirizzo..."
              placeholderTextColor={colors.textMuted}
              returnKeyType="search"
              style={[styles.searchInput, { color: colors.text }]}
            />
            {geocoding ? (
              <ActivityIndicator size="small" color={colors.tint} />
            ) : addressQuery.length > 0 ? (
              <Pressable onPress={() => setAddressQuery('')} hitSlop={8} accessibilityLabel="Cancella">
                <IconSymbol name="xmark.circle.fill" size={18} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>

          {/* Gocciolina fissa al centro: la mappa scorre sotto al pin. */}
          <View style={styles.pickerPin} pointerEvents="none">
            <View style={styles.pickerPinInner}>
              <IconSymbol name="mappin.circle.fill" size={40} color={colors.tint} />
            </View>
          </View>

          <Pressable
            onPress={recenterPickerToCurrent}
            style={[
              styles.pickerRecenter,
              { backgroundColor: colors.background, borderColor: colors.border },
            ]}
            accessibilityLabel="Usa la mia posizione"
          >
            <IconSymbol name="location.fill" size={18} color={colors.tint} />
          </Pressable>
        </View>
        <ThemedText style={styles.hint}>
          Trascina la mappa, scrivi la via o usa la tua posizione per centrare la gocciolina sul punto
          esatto.
        </ThemedText>

        <ThemedText type="subtitle">Tipo di parcheggio</ThemedText>
        <View style={styles.chips}>
          {SPOT_TYPES.map((t) => {
            const active = t.value === spotType;
            return (
              <Pressable
                key={t.value}
                onPress={() => setSpotType(t.value)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? colors.tint : colors.surface,
                    borderColor: active ? colors.tint : colors.border,
                  },
                ]}
              >
                <ThemedText style={{ color: active ? colors.onTint : colors.text, fontWeight: '600' }}>
                  {t.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        <ThemedText type="subtitle">Durata stimata (min)</ThemedText>
        <View style={styles.chips}>
          {DURATIONS.map((d) => {
            const active = d === duration;
            return (
              <Pressable
                key={d}
                onPress={() => setDuration(d)}
                style={[
                  styles.chip,
                  styles.chipDuration,
                  {
                    backgroundColor: active ? colors.tint : colors.surface,
                    borderColor: active ? colors.tint : colors.border,
                  },
                ]}
              >
                <ThemedText style={{ color: active ? colors.onTint : colors.text, fontWeight: '600' }}>
                  {d}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        <TextField
          label="Note (opzionale)"
          value={notes}
          onChangeText={setNotes}
          placeholder="Es. accanto al bar, lato destro..."
          multiline
        />

        {/* --- FOTO DISABILITATE (DB leggero). Riattivare questo blocco insieme
            allo stato `photo` e a `pickPhoto`. ---
        <ThemedText style={styles.label}>Foto (opzionale)</ThemedText>
        {photo ? (
          <View style={styles.photoBox}>
            <Image
              source={{ uri: photo.uri }}
              style={[styles.photo, { backgroundColor: colors.surfaceMuted }]}
              contentFit="cover"
            />
            <View style={styles.photoActions}>
              <View style={styles.photoActionItem}>
                <Button title="Cambia" variant="ghost" onPress={() => pickPhoto('library')} />
              </View>
              <View style={styles.photoActionItem}>
                <Button title="Rimuovi" variant="danger" onPress={() => setPhoto(null)} />
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.photoButtons}>
            <View style={styles.photoActionItem}>
              <Button title="Scatta foto" variant="secondary" onPress={() => pickPhoto('camera')} />
            </View>
            <View style={styles.photoActionItem}>
              <Button title="Dalla galleria" variant="secondary" onPress={() => pickPhoto('library')} />
            </View>
          </View>
        )}
        --- fine blocco foto disabilitato --- */}

        <Button title="Pubblica segnalazione" onPress={handleSubmit} loading={loading} />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 20, gap: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipDuration: { minWidth: 56, alignItems: 'center' },
  pickerWrap: {
    height: 360,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  picker: { flex: 1 },
  searchBar: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
  pickerPin: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Alza il pin di meta' altezza cosi' la punta cade sul centro della mappa.
  pickerPinInner: { transform: [{ translateY: -20 }] },
  pickerRecenter: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: { fontSize: 12, opacity: 0.7 },
  label: { marginTop: 4, fontWeight: '700' },
  photoButtons: { flexDirection: 'row', gap: 8 },
  photoBox: { gap: 8 },
  photo: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 14,
  },
  photoActions: { flexDirection: 'row', gap: 8 },
  photoActionItem: { flex: 1 },
});
