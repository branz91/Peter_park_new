import { ActivityIndicator, Linking, Platform, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useTheme } from '@/hooks/use-theme';

type LocationStatus = 'loading' | 'ready' | 'denied' | 'services_off' | 'unavailable';

interface LocationNoticeProps {
  status: LocationStatus;
  /** Solo per `denied`: se l'OS puo' ancora mostrare il dialog di permesso. */
  canAskAgain: boolean;
  onRetry: () => void;
}

/** Apre le impostazioni GIUSTE in base al problema. */
function openLocationSettings(): void {
  if (Platform.OS === 'android') {
    // Toggle GPS di sistema (non le impostazioni dell'app).
    Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS').catch(() =>
      Linking.openSettings()
    );
  } else {
    // iOS non espone un deep-link affidabile al toggle Localizzazione:
    // apriamo le impostazioni e guidiamo l'utente col testo.
    Linking.openSettings();
  }
}

interface NoticeContent {
  title: string;
  message: string;
  primary: { label: string; onPress: () => void };
  secondary?: { label: string; onPress: () => void };
}

/**
 * Schermata a tutto schermo che spiega perche' la posizione non e' disponibile
 * e offre l'azione corretta:
 *  - GPS spento -> apre le impostazioni di localizzazione del sistema.
 *  - Permesso negato ma richiedibile -> ri-lancia la richiesta di permesso.
 *  - Permesso bloccato -> apre le impostazioni dell'app.
 */
export function LocationNotice({ status, canAskAgain, onRetry }: LocationNoticeProps) {
  const { colors } = useTheme();

  if (status === 'loading' || status === 'ready') {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator size="large" color={colors.tint} />
        <ThemedText type="muted" style={styles.centerText}>
          Individuo la tua posizione...
        </ThemedText>
      </ThemedView>
    );
  }

  const content = ((): NoticeContent => {
    switch (status) {
      case 'services_off':
        return {
          title: 'Attiva la localizzazione',
          message:
            Platform.OS === 'ios'
              ? 'Il GPS del telefono e\u2019 spento. Attivalo da Impostazioni \u203a Privacy e sicurezza \u203a Localizzazione, poi torna qui.'
              : 'Il GPS del telefono e\u2019 spento. Attivalo per continuare.',
          primary: { label: 'Apri impostazioni posizione', onPress: openLocationSettings },
          secondary: { label: 'Ho attivato, riprova', onPress: onRetry },
        };
      case 'denied':
        return canAskAgain
          ? {
              title: 'Consenti la posizione',
              message:
                'PeterPark ha bisogno della tua posizione per mostrarti o segnalare i parcheggi vicini.',
              primary: { label: 'Consenti', onPress: onRetry },
            }
          : {
              title: 'Permesso negato',
              message:
                'Hai negato il permesso di posizione. Abilitalo dalle impostazioni dell\u2019app, poi riprova.',
              primary: { label: 'Apri impostazioni app', onPress: () => Linking.openSettings() },
              secondary: { label: 'Riprova', onPress: onRetry },
            };
      default:
        return {
          title: 'Posizione non disponibile',
          message:
            'Non riesco a leggere la tua posizione. Assicurati che il GPS sia attivo, poi riprova.',
          primary: { label: 'Riprova', onPress: onRetry },
        };
    }
  })();

  return (
    <ThemedView style={styles.center}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.icon, { backgroundColor: `${colors.tint}22` }]}>
          <IconSymbol name="location.fill" size={30} color={colors.tint} />
        </View>
        <ThemedText type="subtitle" style={styles.centerText}>
          {content.title}
        </ThemedText>
        <ThemedText type="muted" style={styles.centerText}>
          {content.message}
        </ThemedText>
        <View style={styles.actions}>
          <Button title={content.primary.label} onPress={content.primary.onPress} />
          {content.secondary ? (
            <Button title={content.secondary.label} variant="ghost" onPress={content.secondary.onPress} />
          ) : null}
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  centerText: { textAlign: 'center' },
  card: {
    padding: 24,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    gap: 10,
    maxWidth: 360,
    width: '100%',
  },
  icon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  actions: { alignSelf: 'stretch', gap: 8, marginTop: 8 },
});
