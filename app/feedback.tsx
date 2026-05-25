import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { submitSpotFeedback } from '@/api/spots';
import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';

const RATINGS = [1, 2, 3, 4, 5];

export default function FeedbackScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();

  const { spotId, reporter } = useLocalSearchParams<{
    spotId: string;
    reporter?: string;
  }>();

  const [wasAvailable, setWasAvailable] = useState<boolean | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!spotId) {
      Alert.alert('Errore', 'ID parcheggio mancante.');
      return;
    }
    if (wasAvailable === null) {
      Alert.alert('Manca una risposta', 'Indica se il parcheggio era libero o no.');
      return;
    }
    setLoading(true);
    try {
      await submitSpotFeedback({
        spotId,
        wasAvailable,
        rating: rating ?? undefined,
        comment: comment.trim() || undefined,
      });
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      await queryClient.invalidateQueries({ queryKey: ['spots'] });
      Alert.alert(
        'Grazie!',
        wasAvailable
          ? 'Feedback registrato. +2 punti per te, +10 al reporter.'
          : 'Feedback registrato. +2 punti per te.',
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
        <View style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            Feedback
          </ThemedText>
          {reporter ? (
            <ThemedText type="muted">Segnalato da @{reporter}</ThemedText>
          ) : null}
        </View>

        <View
          style={[
            styles.intro,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <ThemedText type="muted">
            Aiuta gli altri utenti: era davvero libero quando sei arrivato?
            Il tuo feedback assegna +10 punti al reporter (se positivo) e +2 a te.
          </ThemedText>
        </View>

        <ThemedText style={styles.label}>Il parcheggio era libero?</ThemedText>
        <View style={styles.row}>
          {(
            [
              { value: true, label: 'Si, libero', color: colors.success },
              { value: false, label: 'No, occupato', color: colors.danger },
            ] as const
          ).map((opt) => {
            const active = wasAvailable === opt.value;
            return (
              <Pressable
                key={String(opt.value)}
                onPress={() => setWasAvailable(opt.value)}
                style={[
                  styles.bigChoice,
                  {
                    backgroundColor: active ? opt.color : colors.surface,
                    borderColor: active ? opt.color : colors.border,
                  },
                ]}
              >
                <ThemedText
                  style={{
                    color: active ? '#FFFFFF' : colors.text,
                    fontWeight: '700',
                    fontSize: 15,
                  }}
                >
                  {opt.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        <ThemedText style={styles.label}>Voto (opzionale)</ThemedText>
        <View style={styles.row}>
          {RATINGS.map((value) => {
            const active = rating === value;
            return (
              <Pressable
                key={value}
                onPress={() => setRating(active ? null : value)}
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
                  {value} stelle
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        <TextField
          label="Commento (opzionale)"
          value={comment}
          onChangeText={setComment}
          placeholder="Es. e stato libero per 20 min..."
          multiline
        />

        <Button title="Invia feedback" onPress={handleSubmit} loading={loading} />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 48, gap: 16 },
  header: { gap: 4 },
  title: { fontSize: 32 },
  intro: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  label: { marginTop: 8, fontWeight: '700', fontSize: 15 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  bigChoice: {
    flex: 1,
    minWidth: 140,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
  },
});
