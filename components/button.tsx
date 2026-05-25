import { forwardRef } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  PressableProps,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useTheme } from '@/hooks/use-theme';

type Variant = 'primary' | 'ghost' | 'danger' | 'secondary';

type ButtonProps = Omit<PressableProps, 'children'> & {
  title: string;
  variant?: Variant;
  loading?: boolean;
};

export const Button = forwardRef<View, ButtonProps>(function Button(
  { title, variant = 'primary', loading, disabled, style, ...rest },
  ref
) {
  const { colors } = useTheme();

  const palette = (() => {
    switch (variant) {
      case 'primary':
        return { bg: colors.tint, fg: colors.onTint, border: 'transparent', shadow: true };
      case 'danger':
        return { bg: colors.danger, fg: '#FFFFFF', border: 'transparent', shadow: false };
      case 'ghost':
        return { bg: 'transparent', fg: colors.tint, border: colors.tint, shadow: false };
      case 'secondary':
        return { bg: colors.surface, fg: colors.text, border: colors.border, shadow: false };
    }
  })();

  const inactive = disabled || loading;

  return (
    <Pressable
      ref={ref}
      disabled={inactive}
      style={(state) => [
        styles.btn,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          opacity: inactive ? 0.5 : state.pressed ? 0.85 : 1,
          transform: [{ scale: state.pressed && !inactive ? 0.98 : 1 }],
        },
        palette.shadow && !inactive ? primaryShadow(colors.tint) : null,
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <Text style={[styles.label, { color: palette.fg }]}>{title}</Text>
      )}
    </Pressable>
  );
});

function primaryShadow(tint: string) {
  return Platform.select({
    ios: {
      shadowColor: tint,
      shadowOpacity: 0.25,
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 8,
    },
    android: {
      elevation: 3,
    },
    default: {
      shadowColor: tint,
      shadowOpacity: 0.25,
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 8,
    },
  });
}

const styles = StyleSheet.create({
  btn: {
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
