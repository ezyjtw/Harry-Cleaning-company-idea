import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { Colors } from '@rena/shared';

interface BadgeProps {
  label: string;
  color?: string;
  backgroundColor?: string;
  style?: ViewStyle;
}

export function Badge({
  label,
  color = Colors.white,
  backgroundColor = Colors.primary,
  style,
}: BadgeProps) {
  return (
    <View style={[styles.badge, { backgroundColor }, style]}>
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});
