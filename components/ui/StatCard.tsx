import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { useTheme, SPACING, RADIUS, TYPOGRAPHY, SHADOWS, FONTS } from '../../lib/theme';

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
  highlighted?: boolean;
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
  highlighted = false,
}: StatCardProps) {
  const { colors } = useTheme();

  const getTrendColor = () => {
    switch (trend) {
      case 'up':
        return colors.success;
      case 'down':
        return colors.error;
      default:
        return colors.textTertiary;
    }
  };

  const getTrendIcon = (): keyof typeof Ionicons.glyphMap => {
    switch (trend) {
      case 'up':
        return 'arrow-up';
      case 'down':
        return 'arrow-down';
      default:
        return 'remove';
    }
  };

  const color = iconColor || colors.gold;

  if (compact) {
    return (
      <Animated.View
        entering={FadeInUp.delay(delay).duration(400).springify()}
        style={[
          styles.compactContainer,
          {
            backgroundColor: colors.surface,
            borderColor: highlighted ? color : colors.border,
          },
          highlighted && {
            shadowColor: color,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.15,
            shadowRadius: 8,
          },
          style,
        ]}
      >
        <View style={styles.compactTop}>
          {icon && (
            <View style={[styles.compactIconBg, { backgroundColor: color + '15' }]}>
              <Ionicons name={icon} size={16} color={color} />
            </View>
          )}
          <Text style={[styles.compactValue, { color: colors.text }]}>{value}</Text>
        </View>
        <Text style={[styles.compactLabel, { color: colors.textSecondary }]}>{label}</Text>
        {trend && trendValue && (
          <View style={[styles.compactTrend, { backgroundColor: getTrendColor() + '15' }]}>
            <Ionicons name={getTrendIcon()} size={10} color={getTrendColor()} />
            <Text style={[styles.compactTrendText, { color: getTrendColor() }]}>{trendValue}</Text>
          </View>
        )}
      </Animated.View>
    );
  }

  return (
    <Animated.View
      entering={FadeInUp.delay(delay).duration(400).springify()}
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: highlighted ? color : colors.border,
        },
        highlighted && {
          shadowColor: color,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.2,
          shadowRadius: 12,
        },
        style,
      ]}
    >
      {icon && (
        <View style={[styles.iconContainer, { backgroundColor: color + '15' }]}>
          <Ionicons name={icon} size={22} color={color} />
        </View>
      )}

      <Text style={[styles.value, { color: highlighted ? color : colors.text }]}>{value}</Text>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>

      {trend && trendValue && (
        <View style={[styles.trendContainer, { backgroundColor: getTrendColor() + '15' }]}>
          <Ionicons name={getTrendIcon()} size={12} color={getTrendColor()} />
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
    trend?: 'up' | 'down' | 'neutral';
    trendValue?: string;
    highlighted?: boolean;
  }>;
  columns?: 2 | 3 | 4;
  compact?: boolean;
  style?: ViewStyle;
}

export function StatsGrid({ stats, columns = 3, compact = false, style }: StatsGridProps) {
  const getFlexBasis = () => {
    switch (columns) {
      case 2:
        return '48%';
      case 4:
        return '23%';
      default:
        return '31%';
    }
  };

  return (
    <View style={[styles.grid, style]}>
      {stats.map((stat, index) => (
        <StatCard
          key={index}
          {...stat}
          delay={index * 75}
          compact={compact}
          style={{ flexBasis: getFlexBasis(), flexGrow: 1 }}
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
  gradient?: boolean;
}

export function FeaturedStat({
  value,
  label,
  description,
  icon,
  accentColor,
  style,
  gradient = false,
}: FeaturedStatProps) {
  const { colors } = useTheme();
  const color = accentColor || colors.gold;

  const content = (
    <>
      <View style={styles.featuredTop}>
        {icon && (
          <View style={[styles.featuredIcon, { backgroundColor: gradient ? 'rgba(0,0,0,0.2)' : color + '20' }]}>
            <Ionicons name={icon} size={24} color={gradient ? colors.black : color} />
          </View>
        )}
        <Text style={[styles.featuredLabel, { color: gradient ? 'rgba(0,0,0,0.7)' : colors.textSecondary }]}>
          {label}
        </Text>
      </View>

      <Text style={[styles.featuredValue, { color: gradient ? colors.black : color }]}>{value}</Text>

      {description && (
        <Text style={[styles.featuredDescription, { color: gradient ? 'rgba(0,0,0,0.5)' : colors.textTertiary }]}>
          {description}
        </Text>
      )}
    </>
  );

  if (gradient) {
    return (
      <Animated.View
        entering={FadeInUp.duration(400).springify()}
        style={style}
      >
        <LinearGradient
          colors={[colors.goldLight, colors.gold, colors.goldDark] as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.featuredContainer, styles.featuredGradient]}
        >
          {content}
        </LinearGradient>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      entering={FadeInUp.duration(400).springify()}
      style={[
        styles.featuredContainer,
        {
          backgroundColor: colors.surface,
          borderColor: color,
          ...SHADOWS.glowSubtle,
          shadowColor: color,
        },
        style,
      ]}
    >
      {content}
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
  size?: 'sm' | 'md' | 'lg';
}

export function ProgressStat({
  value,
  max,
  label,
  showPercentage = true,
  color,
  style,
  size = 'md',
}: ProgressStatProps) {
  const { colors } = useTheme();
  const percentage = Math.min((value / max) * 100, 100);
  const accentColor = color || colors.gold;

  const sizeConfig = {
    sm: { height: 4, fontSize: 11 },
    md: { height: 6, fontSize: 12 },
    lg: { height: 8, fontSize: 13 },
  };

  const currentSize = sizeConfig[size];

  return (
    <View style={[styles.progressContainer, style]}>
      <View style={styles.progressHeader}>
        <Text style={[styles.progressLabel, { color: colors.textSecondary, fontSize: currentSize.fontSize }]}>
          {label}
        </Text>
        <Text style={[styles.progressValue, { color: colors.text, fontSize: currentSize.fontSize }]}>
          {value}/{max}
          {showPercentage && (
            <Text style={{ color: colors.textTertiary }}> ({Math.round(percentage)}%)</Text>
          )}
        </Text>
      </View>
      <View style={[styles.progressBar, { backgroundColor: colors.surface, height: currentSize.height }]}>
        <Animated.View
          style={[
            styles.progressFill,
            {
              width: `${percentage}%`,
              backgroundColor: accentColor,
              height: currentSize.height,
            },
          ]}
        />
      </View>
    </View>
  );
}

// Metric Row - for inline metric display
interface MetricRowProps {
  label: string;
  value: string | number;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  action?: React.ReactNode;
  style?: ViewStyle;
}

export function MetricRow({
  label,
  value,
  icon,
  iconColor,
  action,
  style,
}: MetricRowProps) {
  const { colors } = useTheme();
  const color = iconColor || colors.gold;

  return (
    <View style={[styles.metricRow, style]}>
      <View style={styles.metricRowLeft}>
        {icon && (
          <View style={[styles.metricRowIcon, { backgroundColor: color + '15' }]}>
            <Ionicons name={icon} size={16} color={color} />
          </View>
        )}
        <Text style={[styles.metricRowLabel, { color: colors.textSecondary }]}>{label}</Text>
      </View>
      <View style={styles.metricRowRight}>
        <Text style={[styles.metricRowValue, { color: colors.text }]}>{value}</Text>
        {action}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  value: {
    ...TYPOGRAPHY.h3,
    fontFamily: FONTS.monoSemiBold,
    fontVariant: ['tabular-nums'],
  },
  label: {
    ...TYPOGRAPHY.caption,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
    gap: 3,
  },
  trendValue: {
    ...TYPOGRAPHY.captionSmall,
    fontFamily: FONTS.monoSemiBold,
    fontVariant: ['tabular-nums'],
  },
  // Compact
  compactContainer: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
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
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  compactValue: {
    ...TYPOGRAPHY.h5,
    fontFamily: FONTS.monoSemiBold,
    fontVariant: ['tabular-nums'],
  },
  compactLabel: {
    ...TYPOGRAPHY.caption,
  },
  compactTrend: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.xs,
    gap: 2,
  },
  compactTrendText: {
    fontSize: 10,
    fontFamily: FONTS.monoSemiBold,
    fontVariant: ['tabular-nums'],
  },
  // Grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  // Featured
  featuredContainer: {
    padding: SPACING.xl,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
  },
  featuredGradient: {
    borderWidth: 0,
  },
  featuredTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  featuredIcon: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  featuredLabel: {
    ...TYPOGRAPHY.label,
  },
  featuredValue: {
    fontSize: 40,
    fontFamily: FONTS.monoSemiBold,
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
  },
  featuredDescription: {
    ...TYPOGRAPHY.body,
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
    fontFamily: FONTS.sansMedium,
  },
  progressValue: {
    fontFamily: FONTS.monoSemiBold,
    fontVariant: ['tabular-nums'],
  },
  progressBar: {
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  progressFill: {
    borderRadius: RADIUS.full,
  },
  // Metric Row
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  metricRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  metricRowIcon: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricRowLabel: {
    ...TYPOGRAPHY.body,
  },
  metricRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  metricRowValue: {
    ...TYPOGRAPHY.label,
  },
});
