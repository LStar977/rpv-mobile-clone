import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle, DimensionValue } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import { useTheme, RADIUS, SPACING } from '../../lib/theme';

interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
  variant?: 'default' | 'circular' | 'text';
}

export function Skeleton({
  width = '100%',
  height = 20,
  borderRadius,
  style,
  variant = 'default',
}: SkeletonProps) {
  const { colors, isDark } = useTheme();
  const shimmerValue = useSharedValue(0);

  useEffect(() => {
    shimmerValue.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.bezier(0.4, 0, 0.2, 1) }),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const translateX = interpolate(
      shimmerValue.value,
      [0, 1],
      [-100, 100]
    );

    return {
      transform: [{ translateX: `${translateX}%` as any }],
    };
  });

  const getRadius = () => {
    if (borderRadius !== undefined) return borderRadius;
    switch (variant) {
      case 'circular':
        return 9999;
      case 'text':
        return RADIUS.xs;
      default:
        return RADIUS.md;
    }
  };

  return (
    <View
      style={[
        styles.skeleton,
        {
          width,
          height: variant === 'circular' ? width : height,
          borderRadius: getRadius(),
          backgroundColor: colors.shimmer,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Animated.View style={[styles.shimmer, animatedStyle]}>
        <LinearGradient
          colors={[
            'transparent',
            colors.shimmerHighlight,
            'transparent',
          ]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.shimmerGradient}
        />
      </Animated.View>
    </View>
  );
}

// Skeleton Card
interface SkeletonCardProps {
  lines?: number;
  showImage?: boolean;
  showHeader?: boolean;
  style?: ViewStyle;
}

export function SkeletonCard({
  lines = 3,
  showImage = false,
  showHeader = true,
  style,
}: SkeletonCardProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        style,
      ]}
    >
      {showImage && (
        <Skeleton
          height={180}
          borderRadius={0}
          style={styles.cardImage}
        />
      )}
      <View style={styles.cardContent}>
        {showHeader && (
          <View style={styles.cardHeader}>
            <Skeleton width={80} height={20} borderRadius={RADIUS.sm} />
            <Skeleton width={60} height={20} borderRadius={RADIUS.sm} />
          </View>
        )}
        <Skeleton width="90%" height={22} style={styles.title} />
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton
            key={i}
            width={i === lines - 1 ? '60%' : '100%'}
            height={14}
            variant="text"
            style={styles.line}
          />
        ))}
        <View style={styles.cardFooter}>
          <Skeleton width={100} height={36} borderRadius={RADIUS.md} />
          <Skeleton width={100} height={36} borderRadius={RADIUS.md} />
        </View>
      </View>
    </View>
  );
}

// Skeleton List Item
interface SkeletonListItemProps {
  showAvatar?: boolean;
  showAction?: boolean;
  style?: ViewStyle;
}

export function SkeletonListItem({
  showAvatar = true,
  showAction = true,
  style,
}: SkeletonListItemProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.listItem,
        { backgroundColor: colors.surface, borderColor: colors.border },
        style,
      ]}
    >
      {showAvatar && (
        <Skeleton
          width={48}
          height={48}
          variant="circular"
          style={styles.avatar}
        />
      )}
      <View style={styles.listContent}>
        <Skeleton width="65%" height={16} style={styles.listTitle} />
        <Skeleton width="90%" height={12} variant="text" />
      </View>
      {showAction && (
        <Skeleton width={40} height={24} borderRadius={RADIUS.sm} />
      )}
    </View>
  );
}

// Skeleton Stats Grid
interface SkeletonStatsProps {
  count?: number;
  compact?: boolean;
}

export function SkeletonStats({ count = 3, compact = false }: SkeletonStatsProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.statsGrid}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.statCard,
            compact && styles.statCardCompact,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Skeleton width={32} height={32} borderRadius={RADIUS.sm} />
          <Skeleton width={50} height={24} style={{ marginTop: SPACING.sm }} />
          <Skeleton width={60} height={12} variant="text" style={{ marginTop: SPACING.xs }} />
        </View>
      ))}
    </View>
  );
}

// Skeleton Profile Header
export function SkeletonProfile() {
  const { colors } = useTheme();

  return (
    <View style={[styles.profile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Skeleton
        width={88}
        height={88}
        variant="circular"
        style={styles.profileAvatar}
      />
      <Skeleton width={160} height={24} style={styles.profileName} />
      <Skeleton width={200} height={14} variant="text" style={styles.profileEmail} />
      <View style={styles.profileBadges}>
        <Skeleton width={80} height={28} borderRadius={RADIUS.lg} />
        <Skeleton width={100} height={28} borderRadius={RADIUS.lg} />
      </View>
    </View>
  );
}

// Skeleton Proposal Card
export function SkeletonProposal({ style }: { style?: ViewStyle }) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.proposalCard,
        { backgroundColor: colors.surface, borderColor: colors.border },
        style,
      ]}
    >
      <View style={styles.proposalHeader}>
        <View style={styles.proposalHeaderLeft}>
          <Skeleton width={70} height={22} borderRadius={RADIUS.sm} />
          <Skeleton width={90} height={18} borderRadius={RADIUS.sm} />
        </View>
        <Skeleton width={32} height={32} variant="circular" />
      </View>
      <Skeleton width="95%" height={20} style={{ marginTop: SPACING.lg }} />
      <Skeleton width="80%" height={20} style={{ marginTop: SPACING.xs }} />
      <Skeleton width="100%" height={14} variant="text" style={{ marginTop: SPACING.md }} />
      <Skeleton width="70%" height={14} variant="text" style={{ marginTop: SPACING.xs }} />
      <View style={styles.proposalFooter}>
        <View style={styles.proposalStats}>
          <Skeleton width={60} height={16} />
          <Skeleton width={60} height={16} />
        </View>
        <Skeleton width={120} height={40} borderRadius={RADIUS.md} />
      </View>
    </View>
  );
}

// Skeleton Welcome Header
export function SkeletonWelcome() {
  const { colors } = useTheme();

  return (
    <View style={styles.welcomeContainer}>
      <View style={styles.welcomeContent}>
        <View style={styles.welcomeText}>
          <Skeleton width={100} height={16} variant="text" />
          <Skeleton width={150} height={32} style={{ marginTop: SPACING.xs }} />
        </View>
        <Skeleton width={48} height={48} variant="circular" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    position: 'relative',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  shimmerGradient: {
    flex: 1,
  },
  // Card
  card: {
    borderRadius: RADIUS.card,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: SPACING.lg,
  },
  cardImage: {
    marginBottom: 0,
  },
  cardContent: {
    padding: SPACING.xl,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  title: {
    marginBottom: SPACING.md,
  },
  line: {
    marginBottom: SPACING.sm,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.lg,
  },
  // List Item
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  avatar: {
    marginRight: SPACING.md,
  },
  listContent: {
    flex: 1,
  },
  listTitle: {
    marginBottom: SPACING.sm,
  },
  // Stats
  statsGrid: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  statCardCompact: {
    padding: SPACING.md,
  },
  // Profile
  profile: {
    alignItems: 'center',
    padding: SPACING['3xl'],
    borderRadius: RADIUS.xl,
    borderWidth: 1,
  },
  profileAvatar: {
    marginBottom: SPACING.lg,
  },
  profileName: {
    marginBottom: SPACING.sm,
  },
  profileEmail: {},
  profileBadges: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  // Proposal
  proposalCard: {
    padding: SPACING.xl,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    marginBottom: SPACING.lg,
  },
  proposalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  proposalHeaderLeft: {
    gap: SPACING.sm,
  },
  proposalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.xl,
  },
  proposalStats: {
    flexDirection: 'row',
    gap: SPACING.lg,
  },
  // Welcome
  welcomeContainer: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
  },
  welcomeContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  welcomeText: {},
});
