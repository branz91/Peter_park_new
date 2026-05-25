import { useQuery } from '@tanstack/react-query';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { signOut } from '@/api/auth';
import { getMyPointsHistory, getMyProfile } from '@/api/profile';
import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';

export default function ProfileScreen() {
  const { colors } = useTheme();
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
        <ThemedText type="muted">Caricamento profilo...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View style={[styles.avatar, { backgroundColor: colors.tint }]}>
            <ThemedText style={[styles.avatarLetter, { color: colors.onTint }]}>
              {profile.username.charAt(0).toUpperCase()}
            </ThemedText>
          </View>
          <ThemedText type="title" style={styles.username}>
            @{profile.username}
          </ThemedText>
        </View>

        <View style={[styles.pointsCard, { backgroundColor: colors.tint }]}>
          <ThemedText style={[styles.pointsValue, { color: colors.onTint }]}>
            {profile.points}
          </ThemedText>
          <ThemedText style={[styles.pointsLabel, { color: colors.onTint }]}>
            punti totali
          </ThemedText>
          <View style={[styles.reputationRow, { borderTopColor: 'rgba(255,255,255,0.2)' }]}>
            <ThemedText style={[styles.reputationLabel, { color: colors.onTint }]}>
              Reputazione
            </ThemedText>
            <ThemedText style={[styles.reputationValue, { color: colors.onTint }]}>
              {(profile.reputation * 100).toFixed(0)}%
            </ThemedText>
          </View>
        </View>

        <View
          style={[
            styles.statsRow,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Stat label="Segnalazioni" value={profile.total_reports} />
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <Stat label="Trovati" value={profile.total_claims} />
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <Stat label="Feedback" value={profile.total_feedbacks} />
        </View>

        <ThemedText type="subtitle" style={styles.section}>
          Storico punti
        </ThemedText>

        <View
          style={[
            styles.historyCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          {history?.length ? (
            history.map((tx, idx) => (
              <View
                key={tx.id}
                style={[
                  styles.txRow,
                  idx < history.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: colors.border,
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.txReason}>{formatReason(tx.reason)}</ThemedText>
                  <ThemedText type="muted" style={styles.txDate}>
                    {new Date(tx.created_at).toLocaleString('it-IT', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </ThemedText>
                </View>
                <ThemedText
                  style={[
                    styles.txDelta,
                    { color: tx.delta >= 0 ? colors.success : colors.danger },
                  ]}
                >
                  {tx.delta > 0 ? '+' : ''}
                  {tx.delta}
                </ThemedText>
              </View>
            ))
          ) : (
            <ThemedText type="muted" style={{ padding: 16, textAlign: 'center' }}>
              Nessuna transazione ancora.
            </ThemedText>
          )}
        </View>

        <View style={styles.logoutWrap}>
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
      <ThemedText type="muted" style={styles.statLabel}>{label}</ThemedText>
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
  container: { padding: 24, paddingTop: 64, gap: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { alignItems: 'center', gap: 12 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 32,
    fontWeight: '800',
  },
  username: { textAlign: 'center' },
  pointsCard: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 4,
  },
  pointsValue: { fontSize: 48, fontWeight: '800', letterSpacing: -1, lineHeight: 52 },
  pointsLabel: { fontSize: 14, opacity: 0.85, fontWeight: '600', letterSpacing: 0.3 },
  reputationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingTop: 14,
    marginTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  reputationLabel: { fontSize: 13, opacity: 0.85, fontWeight: '500' },
  reputationValue: { fontSize: 16, fontWeight: '700' },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  stat: { flex: 1, alignItems: 'center' },
  statLabel: { fontSize: 12, marginTop: 2 },
  statDivider: { width: 1, height: 32, alignSelf: 'center' },
  section: { marginTop: 4 },
  historyCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  txReason: { fontWeight: '600' },
  txDate: { fontSize: 12 },
  txDelta: { fontSize: 18, fontWeight: '800' },
  logoutWrap: { marginTop: 12, marginBottom: 24 },
});
