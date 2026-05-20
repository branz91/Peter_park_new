import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { signInWithEmail } from '@/api/auth';
import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Compila email e password');
      return;
    }
    setLoading(true);
    try {
      await signInWithEmail({ email: email.trim(), password });
    } catch (err) {
      Alert.alert('Login fallito', err instanceof Error ? err.message : String(err));
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
        <ThemedText type="title">Accedi</ThemedText>
        <ThemedText style={styles.subtitle}>Bentornato su PeterPark.</ThemedText>

        <View style={styles.form}>
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
            autoComplete="password"
          />
          <Button title="Accedi" onPress={handleLogin} loading={loading} />
        </View>

        <View style={styles.footer}>
          <ThemedText>Non hai un account? </ThemedText>
          <Link href="/(auth)/register">
            <ThemedText type="link">Registrati</ThemedText>
          </Link>
        </View>
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 8 },
  subtitle: { opacity: 0.7, marginBottom: 16 },
  form: { gap: 12 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
});
