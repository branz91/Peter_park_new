import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';

export default function WelcomeScreen() {
  const { colors } = useTheme();

  return (
    <ThemedView style={styles.container}>
      <View style={styles.hero}>
        <View style={[styles.logoBadge, { backgroundColor: colors.tint }]}>
          <ThemedText style={[styles.logoLetter, { color: colors.onTint }]}>P</ThemedText>
        </View>
        <ThemedText type="title" style={styles.title}>
          PeterPark
        </ThemedText>
        <ThemedText type="muted" style={styles.subtitle}>
          Segnala parcheggi liberi, guadagna punti, trova posto piu velocemente.
        </ThemedText>

        <View style={[styles.bonusPill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ThemedText style={[styles.bonusDot, { color: colors.success }]}>•</ThemedText>
          <ThemedText style={styles.bonusText}>
            50 punti di benvenuto al primo accesso
          </ThemedText>
        </View>
      </View>

      <View style={styles.actions}>
        <Link href="/(auth)/register" asChild>
          <Button title="Crea un account" />
        </Link>
        <Link href="/(auth)/login" asChild>
          <Button title="Ho gia un account" variant="ghost" />
        </Link>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'space-between',
  },
  hero: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  logoBadge: {
    width: 88,
    height: 88,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoLetter: {
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: -1,
  },
  title: {
    fontSize: 44,
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    paddingHorizontal: 16,
    fontSize: 16,
    lineHeight: 22,
  },
  bonusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 4,
  },
  bonusDot: { fontSize: 22, lineHeight: 22 },
  bonusText: { fontSize: 13, fontWeight: '600' },
  actions: {
    gap: 12,
    paddingBottom: 16,
  },
});
