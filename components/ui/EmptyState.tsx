import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../../lib/theme';

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  ctaLabel?: string;
  ctaIcon?: keyof typeof Ionicons.glyphMap;
  onCtaPress?: () => void;
  accentColor?: string;
  delay?: number;
}

export function EmptyState({
  icon,
  title,
  subtitle,
  ctaLabel,
  ctaIcon,
  onCtaPress,
  accentColor,
  delay = 200,
}: EmptyStateProps) {
  const { colors } = useTheme();
  const accent = accentColor || colors.gold;

  const handlePress = () => {
    if (onCtaPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onCtaPress();
    }
  };

  return (
    <Animated.View
      entering={FadeInUp.delay(delay).duration(400)}
      style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={[styles.iconContainer, { backgroundColor: `${accent}15` }]}>
        <Ionicons name={icon} size={32} color={accent} />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
      {ctaLabel && onCtaPress && (
        <TouchableOpacity
          style={[styles.ctaButton, { backgroundColor: accent }]}
          onPress={handlePress}
          activeOpacity={0.8}
        >
          {ctaIcon && <Ionicons name={ctaIcon} size={20} color="#000" />}
          <Text style={styles.ctaText}>{ctaLabel}</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: SPACING.xl,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    alignItems: 'center',
    marginHorizontal: SPACING.lg,
    ...SHADOWS.sm,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  title: {
    ...TYPOGRAPHY.headlineSmall,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  subtitle: {
    ...TYPOGRAPHY.bodyMedium,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.lg,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: BORDER_RADIUS.full,
  },
  ctaText: {
    ...TYPOGRAPHY.labelLarge,
    color: '#000',
  },
});

export default EmptyState;
