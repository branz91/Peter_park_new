import { Link } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { signUpWithEmail } from '@/api/auth';
import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function RegisterScreen() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!username || !email || !password) {
      Alert.alert('Compila tutti i campi');
      return;
    }
    if (password.length < 8) {
      Alert.alert('La password deve essere di almeno 8 caratteri');
      return;
    }
    setLoading(true);
    try {
      const { session } = await signUpWithEmail({
        email: email.trim(),
        password,
        username: username.trim(),
      });
      if (!session) {
        Alert.alert(
          'Controlla la tua email',
          'Ti abbiamo inviato un link di conferma. Una volta confermato, potrai accedere.'
        );
      }
    } catch (err) {
      Alert.alert('Registrazione fallita', err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <ThemedText type="title">Registrati</ThemedText>
          <ThemedText type="muted">Bonus di benvenuto: 50 punti per iniziare.</ThemedText>
        </View>

        <View style={styles.form}>
          <TextField
            label="Username"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />
          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <TextField
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password-new"
          />
          <Button title="Crea account" onPress={handleRegister} loading={loading} />
        </View>

        <View style={styles.footer}>
          <ThemedText type="muted">Hai gia un account? </ThemedText>
          <Link href="/(auth)/login">
            <ThemedText type="link">Accedi</ThemedText>
          </Link>
        </View>
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 64, gap: 24 },
  header: { gap: 6 },
  form: { gap: 16 },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 8 },
});
