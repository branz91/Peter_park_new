/**
 * Palette colori dell'app. Light e Dark sono mantenute simmetriche (stessi
 * token in entrambe), cosi' i componenti possono interrogare il tema corrente
 * con `useTheme()` o `Colors[scheme]` senza preoccuparsi del fallback.
 *
 * Token disponibili:
 *  - text / textMuted        : testo principale e secondario
 *  - background              : sfondo full-screen
 *  - surface / surfaceMuted  : card / sezioni / chip non attivo
 *  - border / borderStrong   : separatori e bordi input
 *  - tint / onTint           : colore primario e contrasto sopra il primario
 *  - icon                    : icone non interattive
 *  - tabIconDefault/Selected : tab bar
 *  - success / danger / warning : feedback semantici
 */

import { Platform } from 'react-native';

const tintLight = '#0a7ea4';
const tintDark = '#7BD5FF';

export const Colors = {
  light: {
    text: '#11181C',
    textMuted: '#5B6770',
    background: '#FFFFFF',
    surface: '#F5F7FA',
    surfaceMuted: '#E9ECF1',
    border: '#E1E5EB',
    borderStrong: '#C8CFD8',
    tint: tintLight,
    onTint: '#FFFFFF',
    icon: '#5B6770',
    tabIconDefault: '#8A97A1',
    tabIconSelected: tintLight,
    success: '#179C61',
    danger: '#DC3545',
    warning: '#F59E0B',
  },
  dark: {
    text: '#ECEDEE',
    textMuted: '#9BA1A6',
    background: '#0E1416',
    surface: '#1A2024',
    surfaceMuted: '#222A2F',
    border: '#2A3338',
    borderStrong: '#3A4448',
    tint: tintDark,
    onTint: '#0E1416',
    icon: '#9BA1A6',
    tabIconDefault: '#6B7780',
    tabIconSelected: tintDark,
    success: '#22C55E',
    danger: '#EF4444',
    warning: '#FBBF24',
  },
};

export type ThemeName = keyof typeof Colors;
export type ThemeColors = (typeof Colors)[ThemeName];

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
