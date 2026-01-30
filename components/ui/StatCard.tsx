import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../../lib/theme';

interface StatCardProps {
  value: string | number;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  style?: ViewStyle;
  delay?: number;
  compact?: boolean;
}

export function StatCard({
  value,
  label,
  icon,
  iconColor,
  trend,
  trendValue,
  style,
  delay = 0,
  compact = false,
}: StatCardProps) {
  const { colors } = useTheme();

  const getTrendColor = () => {
    switch (trend) {
      case 'up':
        return colors.success;
      case 'down':
        return colors.error;
      default:
        return colors.textMuted;
    }
  };

  const getTrendIcon = (): keyof typeof Ionicons.glyphMap => {
    switch (trend) {
      case 'up':
        return 'trending-up';
      case 'down':
        return 'trending-down';
      default:
        return 'remove';
    }
  };

  if (compact) {
    return (
      <Animated.View
        entering={FadeInUp.delay(delay).duration(400).springify()}
        style={[
          styles.compactContainer,
          { backgroundColor: colors.cardBg, borderColor: colors.border },
          style,
        ]}
      >
        <View style={styles.compactTop}>
          {icon && (
            <View style={[styles.compactIconBg, { backgroundColor: iconColor ? `${iconColor}15` : colors.goldLight }]}>
              <Ionicons name={icon} size={18} color={iconColor || colors.gold} />
            </View>
          )}
          <Text style={[styles.compactValue, { color: colors.text }]}>{value}</Text>
        </View>
        <Text style={[styles.compactLabel, { color: colors.textSecondary }]}>{label}</Text>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      entering={FadeInUp.delay(delay).duration(400).springify()}
      style={[
        styles.container,
        { backgroundColor: colors.cardBg, borderColor: colors.border },
        style,
      ]}
    >
      {icon && (
        <View style={[styles.iconContainer, { backgroundColor: iconColor ? `${iconColor}15` : colors.goldLight }]}>
          <Ionicons name={icon} size={22} color={iconColor || colors.gold} />
        </View>
      )}

      <Text style={[styles.value, { color: colors.gold }]}>{value}</Text>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>

      {trend && trendValue && (
        <View style={styles.trendContainer}>
          <Ionicons name={getTrendIcon()} size={14} color={getTrendColor()} />
          <Text style={[styles.trendValue, { color: getTrendColor() }]}>{trendValue}</Text>
        </View>
      )}
    </Animated.View>
  );
}

// Grid of Stats
interface StatsGridProps {
  stats: Array<{
    value: string | number;
    label: string;
    icon?: keyof typeof Ionicons.glyphMap;
    iconColor?: string;
  }>;
  columns?: 2 | 3 | 4;
  style?: ViewStyle;
}

export function StatsGrid({ stats, columns = 3, style }: StatsGridProps) {
  return (
    <View style={[styles.grid, { gap: SPACING.md }, style]}>
      {stats.map((stat, index) => (
        <StatCard
          key={index}
          {...stat}
          delay={index * 100}
          style={{ flex: 1 / columns, minWidth: `${100 / columns - 2}%` }}
        />
      ))}
    </View>
  );
}

// Large Featured Stat
interface FeaturedStatProps {
  value: string | number;
  label: string;
  description?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  accentColor?: string;
  style?: ViewStyle;
}

export function FeaturedStat({
  value,
  label,
  description,
  icon,
  accentColor,
  style,
}: FeaturedStatProps) {
  const { colors } = useTheme();
  const color = accentColor || colors.gold;

  return (
    <Animated.View
      entering={FadeInUp.duration(400).springify()}
      style={[
        styles.featuredContainer,
        {
          backgroundColor: colors.cardBg,
          borderColor: color,
          shadowColor: color,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 12,
          elevation: 8,
        },
        style,
      ]}
    >
      <View style={styles.featuredTop}>
        {icon && (
          <View style={[styles.featuredIcon, { backgroundColor: `${color}20` }]}>
            <Ionicons name={icon} size={28} color={color} />
          </View>
        )}
        <Text style={[styles.featuredLabel, { color: colors.textSecondary }]}>{label}</Text>
      </View>

      <Text style={[styles.featuredValue, { color: color }]}>{value}</Text>

      {description && (
        <Text style={[styles.featuredDescription, { color: colors.textMuted }]}>
          {description}
        </Text>
      )}
    </Animated.View>
  );
}

// Progress Stat
interface ProgressStatProps {
  value: number;
  max: number;
  label: string;
  showPercentage?: boolean;
  color?: string;
  style?: ViewStyle;
}

export function ProgressStat({
  value,
  max,
  label,
  showPercentage = true,
  color,
  style,
}: ProgressStatProps) {
  const { colors } = useTheme();
  const percentage = Math.min((value / max) * 100, 100);
  const accentColor = color || colors.gold;

  return (
    <View style={[styles.progressContainer, style]}>
      <View style={styles.progressHeader}>
        <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>{label}</Text>
        <Text style={[styles.progressValue, { color: colors.text }]}>
          {value}/{max}
          {showPercentage && (
            <Text style={{ color: colors.textMuted }}> ({Math.round(percentage)}%)</Text>
          )}
        </Text>
      </View>
      <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
        <Animated.View
          style={[
            styles.progressFill,
            { width: `${percentage}%`, backgroundColor: accentColor },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  value: {
    ...TYPOGRAPHY.headlineLarge,
    fontWeight: '700',
  },
  label: {
    ...TYPOGRAPHY.labelSmall,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.sm,
    gap: SPACING.xxs,
  },
  trendValue: {
    ...TYPOGRAPHY.labelSmall,
  },
  // Compact
  compactContainer: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
  },
  compactTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  compactIconBg: {
    width: 28,
    height: 28,
    borderRadius: BORDER_RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  compactValue: {
    ...TYPOGRAPHY.headlineSmall,
    fontWeight: '700',
  },
  compactLabel: {
    ...TYPOGRAPHY.labelSmall,
  },
  // Grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  // Featured
  featuredContainer: {
    padding: SPACING.xl,
    borderRadius: BORDER_RADIUS.xxl,
    borderWidth: 1.5,
  },
  featuredTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  featuredIcon: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  featuredLabel: {
    ...TYPOGRAPHY.labelLarge,
  },
  featuredValue: {
    fontSize: 40,
    fontWeight: '700',
    letterSpacing: -1,
  },
  featuredDescription: {
    ...TYPOGRAPHY.bodyMedium,
    marginTop: SPACING.sm,
  },
  // Progress
  progressContainer: {
    marginBottom: SPACING.md,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  progressLabel: {
    ...TYPOGRAPHY.labelMedium,
  },
  progressValue: {
    ...TYPOGRAPHY.labelMedium,
  },
  progressBar: {
    height: 6,
    borderRadius: BORDER_RADIUS.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: BORDER_RADIUS.sm,
  },
});
