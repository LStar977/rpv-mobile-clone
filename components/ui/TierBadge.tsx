import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '../../lib/theme';

export type UserTier = 'free' | 'verified' | 'premium';

interface TierBadgeProps {
  tier: UserTier;
  size?: 'sm' | 'md' | 'lg';
  onPress?: () => void;
  showLabel?: boolean;
}

const TIER_CONFIG = {
  free: {
    label: 'Free',
    icon: 'person-outline' as const,
    description: 'Basic access',
  },
  verified: {
    label: 'Verified',
    icon: 'shield-checkmark' as const,
    description: 'Identity verified',
  },
  premium: {
    label: 'Premium',
    icon: 'star' as const,
    description: 'Full access',
  },
};

export function TierBadge({ tier, size = 'md', onPress, showLabel = true }: TierBadgeProps) {
  const { colors } = useTheme();
  const config = TIER_CONFIG[tier];

  const getTierColors = (): { bg: string; text: string; gradient: [string, string] } => {
    switch (tier) {
      case 'premium':
        return {
          bg: `${colors.gold}20`,
          text: colors.gold,
          gradient: [colors.gold, colors.goldDark || '#A68523'],
        };
      case 'verified':
        return {
          bg: `${colors.success}15`,
          text: colors.success,
          gradient: [colors.success, '#0F8A5F'],
        };
      default:
        return {
          bg: `${colors.textTertiary}15`,
          text: colors.textSecondary,
          gradient: [colors.textTertiary, colors.textSecondary],
        };
    }
  };

  const tierColors = getTierColors();

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return {
          container: { paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xxs },
          iconSize: 12,
          textStyle: { ...TYPOGRAPHY.labelSmall, fontSize: 10 },
        };
      case 'lg':
        return {
          container: { paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md },
          iconSize: 20,
          textStyle: { ...TYPOGRAPHY.labelLarge },
        };
      default:
        return {
          container: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs },
          iconSize: 14,
          textStyle: { ...TYPOGRAPHY.labelSmall },
        };
    }
  };

  const sizeStyles = getSizeStyles();

  const BadgeContent = (
    <Animated.View
      entering={FadeIn.duration(300)}
      style={[
        styles.container,
        sizeStyles.container,
        { backgroundColor: tierColors.bg, borderColor: tierColors.text },
        tier === 'premium' && styles.premiumBorder,
      ]}
    >
      <Ionicons name={config.icon} size={sizeStyles.iconSize} color={tierColors.text} />
      {showLabel && (
        <Text style={[sizeStyles.textStyle, { color: tierColors.text }]}>
          {config.label}
        </Text>
      )}
    </Animated.View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {BadgeContent}
      </TouchableOpacity>
    );
  }

  return BadgeContent;
}

interface TierCardProps {
  tier: UserTier;
  onUpgrade?: () => void;
}

export function TierCard({ tier, onUpgrade }: TierCardProps) {
  const { colors } = useTheme();
  const config = TIER_CONFIG[tier];

  const getTierColors = () => {
    switch (tier) {
      case 'premium':
        return { primary: colors.gold, secondary: colors.goldDark || '#A68523' };
      case 'verified':
        return { primary: colors.success, secondary: '#0F8A5F' };
      default:
        return { primary: colors.textTertiary, secondary: colors.textSecondary };
    }
  };

  const tierColors = getTierColors();
  const canUpgrade = tier !== 'premium';

  return (
    <Animated.View
      entering={FadeIn.duration(400)}
      style={[styles.cardContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={styles.cardContent}>
        <View style={[styles.cardIconBg, { backgroundColor: `${tierColors.primary}15` }]}>
          <Ionicons name={config.icon} size={24} color={tierColors.primary} />
        </View>
        <View style={styles.cardInfo}>
          <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>Current Plan</Text>
          <Text style={[styles.cardTitle, { color: tierColors.primary }]}>{config.label}</Text>
          <Text style={[styles.cardDescription, { color: colors.textTertiary }]}>
            {config.description}
          </Text>
        </View>
      </View>

      {canUpgrade && onUpgrade && (
        <TouchableOpacity
          style={[styles.upgradeButton, { backgroundColor: colors.gold }]}
          onPress={onUpgrade}
          activeOpacity={0.8}
        >
          <Text style={styles.upgradeButtonText}>Upgrade</Text>
          <Ionicons name="arrow-forward" size={14} color="#000" />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  premiumBorder: {
    borderWidth: 1.5,
  },
  cardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cardIconBg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  cardInfo: {
    flex: 1,
  },
  cardLabel: {
    ...TYPOGRAPHY.labelSmall,
    marginBottom: 2,
  },
  cardTitle: {
    ...TYPOGRAPHY.headlineSmall,
    marginBottom: 2,
  },
  cardDescription: {
    ...TYPOGRAPHY.bodySmall,
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    gap: SPACING.xs,
  },
  upgradeButtonText: {
    ...TYPOGRAPHY.labelSmall,
    color: '#000',
  },
});

export default TierBadge;
