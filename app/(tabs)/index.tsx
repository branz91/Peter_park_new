import { useRouter } from 'expo-router';
import { type ComponentProps } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useTheme } from '@/hooks/use-theme';

type IconName = ComponentProps<typeof IconSymbol>['name'];

interface ActionCardProps {
  icon: IconName;
  title: string;
  subtitle: string;
  onPress: () => void;
}

function ActionCard({ icon, title, subtitle, onPress }: ActionCardProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.9 : 1,
          transform: [{ scale: pressed ? 0.99 : 1 }],
        },
        Platform.OS === 'ios'
          ? { shadowColor: '#000', shadowOpacity: 0.1, shadowOffset: { width: 0, height: 3 }, shadowRadius: 8 }
          : { elevation: 3 },
      ]}
    >
      <View style={[styles.cardIcon, { backgroundColor: `${colors.tint}22` }]}>
        <IconSymbol name={icon} size={30} color={colors.tint} />
      </View>
      <View style={styles.cardText}>
        <ThemedText style={styles.cardTitle}>{title}</ThemedText>
        <ThemedText type="muted" style={styles.cardSubtitle}>
          {subtitle}
        </ThemedText>
      </View>
      <IconSymbol name="chevron.right" size={22} color={colors.textMuted} />
    </Pressable>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + 24 }]}>
      <View style={styles.header}>
        <ThemedText type="title">PeterPark</ThemedText>
        <ThemedText type="muted">Cosa vuoi fare?</ThemedText>
      </View>

      <View style={styles.cards}>
        <ActionCard
          icon="magnifyingglass"
          title="Cerca Parcheggio"
          subtitle="Trova posti liberi segnalati vicino a te"
          onPress={() => router.push('/search')}
        />
        <ActionCard
          icon="mappin.circle.fill"
          title="Lascia Parcheggio"
          subtitle="Segnala un posto che stai per liberare"
          onPress={() => router.push('/report')}
        />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 28 },
  header: { gap: 6 },
  cards: { gap: 16 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
  },
  cardIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: { flex: 1, gap: 3 },
  cardTitle: { fontSize: 18, fontWeight: '700' },
  cardSubtitle: { fontSize: 13 },
});
