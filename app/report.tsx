import { useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { reportParkingSpot } from '@/api/spots';
import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
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
  const scheme = useColorScheme() ?? 'light';
  const tint = Colors[scheme].tint;

  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [spotType, setSpotType] = useState<SpotType>('free');
  const [duration, setDuration] = useState(10);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permesso necessario', 'Serve l accesso alla posizione per segnalare.');
        router.back();
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLocation(loc);
    })();
  }, [router]);

  async function handleSubmit() {
    if (!location) return;
    setLoading(true);
    try {
      await reportParkingSpot({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        spotType,
        notes: notes.trim() || null,
        durationMinutes: duration,
      });
      await queryClient.invalidateQueries({ queryKey: ['spots'] });
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      Alert.alert(
        'Segnalazione inviata!',
        '+5 punti provvisori. Verranno confermati quando un altro utente lo prendera.',
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
                    backgroundColor: active ? tint : 'transparent',
                    borderColor: tint,
                  },
                ]}
              >
                <ThemedText style={{ color: active ? '#fff' : tint, fontWeight: '600' }}>
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
                  {
                    backgroundColor: active ? tint : 'transparent',
                    borderColor: tint,
                  },
                ]}
              >
                <ThemedText style={{ color: active ? '#fff' : tint, fontWeight: '600' }}>
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

        <Button title="Pubblica segnalazione" onPress={handleSubmit} loading={loading} />
        <ThemedText style={styles.hint}>
          {location
            ? 'Verra usata la tua posizione attuale.'
            : 'Recupero posizione...'}
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  hint: { textAlign: 'center', opacity: 0.6, fontSize: 12, marginTop: 8 },
});
