import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function WelcomeScreen() {
  return (
    <ThemedView style={styles.container}>
      <View style={styles.hero}>
        <ThemedText type="title" style={styles.title}>
          PeterPark
        </ThemedText>
        <ThemedText style={styles.subtitle}>
          Segnala parcheggi liberi, guadagna punti, trova posto piu velocemente.
        </ThemedText>
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
    gap: 12,
  },
  title: {
    fontSize: 44,
  },
  subtitle: {
    textAlign: 'center',
    opacity: 0.7,
    paddingHorizontal: 16,
  },
  actions: {
    gap: 12,
    paddingBottom: 24,
  },
});
