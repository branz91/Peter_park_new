import { StyleSheet, TextInput, TextInputProps, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

import { ThemedText } from './themed-text';

type TextFieldProps = TextInputProps & {
  label?: string;
};

export function TextField({ label, style, ...rest }: TextFieldProps) {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const borderColor = scheme === 'dark' ? '#333' : '#d9d9d9';

  return (
    <View style={styles.wrapper}>
      {label ? <ThemedText style={styles.label}>{label}</ThemedText> : null}
      <TextInput
        placeholderTextColor={colors.icon}
        style={[
          styles.input,
          {
            color: colors.text,
            borderColor,
            backgroundColor: scheme === 'dark' ? '#1c1f21' : '#fafafa',
          },
          style,
        ]}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 6 },
  label: { fontSize: 14, opacity: 0.7 },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 16,
  },
});
