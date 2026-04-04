import React, { useState } from 'react';
import { View, TextInput, Text, StyleSheet, type TextInputProps } from 'react-native';
import { Colors } from '@rena/shared';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export function Input({ label, error, icon, style, ...props }: InputProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[styles.inputContainer, isFocused && styles.focused, error && styles.errorBorder]}
      >
        {icon && <View style={styles.icon}>{icon}</View>}
        <TextInput
          style={[styles.input, icon && styles.inputWithIcon, style]}
          placeholderTextColor={Colors.placeholder}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: Colors.white,
  },
  focused: {
    borderColor: Colors.primary,
  },
  errorBorder: {
    borderColor: Colors.error,
  },
  icon: {
    paddingLeft: 14,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  inputWithIcon: {
    paddingLeft: 10,
  },
  errorText: {
    fontSize: 12,
    color: Colors.error,
    marginTop: 4,
  },
});
