import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { uploadSpotPhoto } from '@/api/storage';
import { reportParkingSpot } from '@/api/spots';
import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useCurrentLocation } from '@/hooks/use-current-location';
import { useTheme } from '@/hooks/use-theme';
import { useAuthStore } from '@/stores/auth';
import type { SpotType } from '@/types/database';

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
  const userId = useAuthStore((s) => s.session?.user.id);
  const { location, status: locationStatus, error: locationError, retry: retryLocation } = useCurrentLocation();

  const [spotType, setSpotType] = useState<SpotType>('free');
  const [duration, setDuration] = useState(10);
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (locationStatus === 'denied') {
      Alert.alert(
        'Permesso necessario',
        'Serve l accesso alla posizione per segnalare un parcheggio.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    }
  }, [locationStatus, router]);

  async function pickPhoto(source: 'camera' | 'library') {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Permesso negato',
        source === 'camera'
          ? 'Per scattare una foto serve il permesso fotocamera.'
          : 'Per scegliere una foto serve il permesso galleria.'
      );
      return;
    }
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 0.6,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.6,
          });
    if (result.canceled || result.assets.length === 0) return;
    setPhoto(result.assets[0]);
  }

  async function handleSubmit() {
    if (!location) return;
    setLoading(true);
    try {
      let photoUrl: string | null = null;
      if (photo && userId) {
        photoUrl = await uploadSpotPhoto({
          userId,
          fileUri: photo.uri,
          contentType: photo.mimeType ?? 'image/jpeg',
        });
      }
      await reportParkingSpot({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
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

  return (
    <ThemedView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>
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
                <ThemedText
                  style={{
                    color: active ? colors.onTint : colors.text,
                    fontWeight: '600',
                  }}
                >
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
                <ThemedText
                  style={{
                    color: active ? colors.onTint : colors.text,
                    fontWeight: '600',
                  }}
                >
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

        <Button
          title="Pubblica segnalazione"
          onPress={handleSubmit}
          loading={loading}
          disabled={!location}
        />
        {location ? (
          <ThemedText style={styles.hint}>Verra usata la tua posizione attuale.</ThemedText>
        ) : locationStatus === 'loading' ? (
          <ThemedText style={styles.hint}>Recupero posizione...</ThemedText>
        ) : (
          <View style={styles.locationError}>
            <ThemedText style={styles.hint}>
              {locationError ?? 'Posizione non disponibile.'}
            </ThemedText>
            <Button title="Riprova" variant="ghost" onPress={retryLocation} />
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 48, gap: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipDuration: { minWidth: 56, alignItems: 'center' },
  hint: { textAlign: 'center', fontSize: 12, marginTop: 4, opacity: 0.7 },
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
  locationError: { gap: 8, marginTop: 4 },
});
