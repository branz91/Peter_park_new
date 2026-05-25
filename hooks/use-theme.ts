import { Colors, type ThemeColors, type ThemeName } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

/**
 * Ritorna la palette completa per il tema corrente (light/dark) piu' il nome
 * del tema. Comodo per scrivere componenti che leggono piu' token in un colpo
 * solo, senza dover chiamare `useThemeColor` token per token.
 */
export function useTheme(): { name: ThemeName; colors: ThemeColors } {
  const name: ThemeName = useColorScheme() === 'dark' ? 'dark' : 'light';
  return { name, colors: Colors[name] };
}
