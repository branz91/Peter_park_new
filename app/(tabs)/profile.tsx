import { useQuery } from '@tanstack/react-query';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { signOut } from '@/api/auth';
import { getMyPointsHistory, getMyProfile } from '@/api/profile';
import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function ProfileScreen() {
  const { data: profile } = useQuery({ queryKey: ['me'], queryFn: getMyProfile });
  const { data: history } = useQuery({
    queryKey: ['me', 'history'],
    queryFn: () => getMyPointsHistory(20),
  });

  async function handleSignOut() {
    try {
      await signOut();
    } catch (e) {
      Alert.alert('Errore', e instanceof Error ? e.message : String(e));
    }
  }

  if (!profile) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText>Caricamento profilo...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <ThemedText type="title">@{profile.username}</ThemedText>
          <ThemedText style={styles.points}>{profile.points} punti</ThemedText>
        </View>

        <View style={styles.statsRow}>
          <Stat label="Segnalazioni" value={profile.total_reports} />
          <Stat label="Trovati" value={profile.total_claims} />
          <Stat label="Feedback" value={profile.total_feedbacks} />
        </View>

        <ThemedText type="subtitle" style={styles.section}>
          Storico punti
        </ThemedText>

        <View style={styles.history}>
          {history?.length ? (
            history.map((tx) => (
              <View key={tx.id} style={styles.txRow}>
                <View style={{ flex: 1 }}>
                  <ThemedText>{formatReason(tx.reason)}</ThemedText>
                  <ThemedText style={styles.txDate}>
                    {new Date(tx.created_at).toLocaleString('it-IT')}
                  </ThemedText>
                </View>
                <ThemedText
                  style={[styles.txDelta, { color: tx.delta >= 0 ? '#2c7' : '#d33' }]}
                >
                  {tx.delta > 0 ? '+' : ''}
                  {tx.delta}
                </ThemedText>
              </View>
            ))
          ) : (
            <ThemedText style={{ opacity: 0.6 }}>Nessuna transazione ancora.</ThemedText>
          )}
        </View>

        <View style={{ marginTop: 24 }}>
          <Button title="Esci" variant="danger" onPress={handleSignOut} />
        </View>
      </ScrollView>
    </ThemedView>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <ThemedText type="subtitle">{value}</ThemedText>
      <ThemedText style={{ opacity: 0.7, fontSize: 13 }}>{label}</ThemedText>
    </View>
  );
}

function formatReason(reason: string): string {
  const map: Record<string, string> = {
    initial_bonus: 'Bonus di benvenuto',
    report_created: 'Segnalazione creata',
    report_confirmed: 'Segnalazione confermata',
    spot_claimed: 'Parcheggio prenotato',
    feedback_bonus: 'Feedback lasciato',
    fraud_penalty: 'Penalita segnalazione',
    daily_streak: 'Streak giornaliera',
    invite_bonus: 'Invito amico',
    admin_adjustment: 'Aggiustamento manuale',
  };
  return map[reason] ?? reason;
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 64, gap: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { alignItems: 'center', gap: 6 },
  points: { fontSize: 28, fontWeight: 'bold' },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(127,127,127,0.08)',
  },
  stat: { alignItems: 'center' },
  section: { marginTop: 12 },
  history: { gap: 8 },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(127,127,127,0.2)',
  },
  txDate: { opacity: 0.5, fontSize: 12 },
  txDelta: { fontSize: 18, fontWeight: '700' },
});
