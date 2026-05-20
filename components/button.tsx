import { forwardRef } from 'react';
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type Variant = 'primary' | 'ghost' | 'danger';

type ButtonProps = Omit<PressableProps, 'children'> & {
  title: string;
  variant?: Variant;
  loading?: boolean;
};

export const Button = forwardRef<View, ButtonProps>(function Button(
  { title, variant = 'primary', loading, disabled, style, ...rest },
  ref
) {
  const scheme = useColorScheme() ?? 'light';
  const tint = Colors[scheme].tint;

  const bg =
    variant === 'primary' ? tint : variant === 'danger' ? '#d33' : 'transparent';
  const color =
    variant === 'ghost' ? tint : '#fff';
  const border = variant === 'ghost' ? tint : 'transparent';

  return (
    <Pressable
      ref={ref}
      disabled={disabled || loading}
      style={(state) => [
        styles.btn,
        {
          backgroundColor: bg,
          borderColor: border,
          opacity: state.pressed || disabled ? 0.7 : 1,
        },
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={color} />
      ) : (
        <Text style={[styles.label, { color }]}>{title}</Text>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  btn: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
});
