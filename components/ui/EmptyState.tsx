import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme, SPACING, FONTS, withAlpha } from '../../lib/theme';
import { Button } from './Button';

// ═══════════════════════════════════════════════════════════════════════════════
// EMPTY STATE — 22b spec
// 64px icon tile on surface · serif title · sans body · a single CTA (Button).
// Copy stays honest: an empty list says what will appear here, nothing more.
// ═══════════════════════════════════════════════════════════════════════════════

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
  const iconColor = accentColor || colors.textTertiary;

  const handlePress = () => {
    if (onCtaPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onCtaPress();
    }
  };

  return (
    <Animated.View entering={FadeInUp.delay(delay).duration(400)} style={styles.container}>
      <View
        style={[
          styles.iconTile,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Ionicons name={icon} size={28} color={iconColor} />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
      {ctaLabel && onCtaPress && (
        <View style={styles.ctaWrap}>
          <Button
            title={ctaLabel}
            onPress={handlePress}
            variant="primary"
            size="lg"
            icon={ctaIcon}
            fullWidth
          />
        </View>
      )}
    </Animated.View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR STATE — 22c spec
// Failure must look like failure — never "nothing here", and never the user's
// fault. Red-tinted icon tile · serif title · honest body · gold Try Again CTA
// · optional mono error reference.
// ═══════════════════════════════════════════════════════════════════════════════

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  /** Optional machine-readable reference (error code / server message), mono. */
  errorRef?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  delay?: number;
}

export function ErrorState({
  title = 'Something went wrong',
  message = "That was on our side, not yours. Nothing was lost — you can safely try again.",
  onRetry,
  retryLabel = 'Try Again',
  errorRef,
  icon = 'cloud-offline-outline',
  delay = 100,
}: ErrorStateProps) {
  const { colors } = useTheme();

  const handleRetry = () => {
    if (onRetry) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onRetry();
    }
  };

  return (
    <Animated.View entering={FadeInUp.delay(delay).duration(400)} style={styles.container}>
      <View
        style={[
          styles.iconTile,
          {
            backgroundColor: withAlpha(colors.error, 0.06),
            borderColor: withAlpha(colors.error, 0.25),
          },
        ]}
      >
        <Ionicons name={icon} size={28} color={colors.error} />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{message}</Text>
      {errorRef ? (
        <View
          style={[
            styles.refCard,
            { backgroundColor: colors.surface, borderColor: colors.borderSubtle },
          ]}
        >
          <Text style={[styles.refLabel, { color: colors.textTertiary }]}>REF</Text>
          <Text style={[styles.refValue, { color: colors.text }]} numberOfLines={2}>
            {errorRef}
          </Text>
        </View>
      ) : null}
      {onRetry && (
        <View style={styles.ctaWrap}>
          <Button
            title={retryLabel}
            onPress={handleRetry}
            variant="primary"
            size="lg"
            icon="refresh"
            fullWidth
          />
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: SPACING.screenPadding,
    paddingVertical: SPACING['3xl'],
  },
  iconTile: {
    width: 64,
    height: 64,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xl,
  },
  title: {
    fontFamily: FONTS.serif,
    fontSize: 24,
    lineHeight: 29,
    letterSpacing: -0.29,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontFamily: FONTS.sans,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 280,
  },
  ctaWrap: {
    width: '100%',
    maxWidth: 280,
    marginTop: SPACING.xl,
  },
  refCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    maxWidth: 300,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: SPACING.lg,
  },
  refLabel: {
    fontFamily: FONTS.mono,
    fontSize: 10.5,
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
  refValue: {
    flexShrink: 1,
    fontFamily: FONTS.mono,
    fontSize: 10.5,
    fontVariant: ['tabular-nums'],
  },
});

export default EmptyState;
