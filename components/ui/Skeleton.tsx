import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle, DimensionValue, LayoutChangeEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
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
  const containerWidthValue = useSharedValue(200);

  // Spec (22a): shimmer sweeps surfaceHighlight → surfaceElevated →
  // surfaceHighlight on a 1.4s linear loop.
  useEffect(() => {
    shimmerValue.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width: measuredWidth } = event.nativeEvent.layout;
    if (measuredWidth > 0) {
      containerWidthValue.value = measuredWidth;
    }
  };

  const animatedStyle = useAnimatedStyle(() => {
    // Use pixel values - animate from -100% to +100% of container width
    const w = containerWidthValue.value;
    const translateX = -w + (shimmerValue.value * w * 2);

    return {
      transform: [{ translateX }],
    };
  });

  const getRadius = () => {
    if (borderRadius !== undefined) return borderRadius;
    switch (variant) {
      case 'circular':
        return 9999;
      case 'text':
        // 22a: text lines are ~17px tall with an 8px radius.
        return 8;
      default:
        // 22a: bars round to half their height, capped at the card radius.
        return Math.min(Math.round(height / 2), RADIUS.md);
    }
  };

  return (
    <View
      onLayout={onLayout}
      style={[
        styles.skeleton,
        {
          width,
          height: variant === 'circular' ? width : height,
          borderRadius: getRadius(),
          backgroundColor: colors.surfaceHighlight,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Animated.View style={[styles.shimmer, animatedStyle]}>
        <LinearGradient
          colors={[
            colors.surfaceHighlight,
            colors.surfaceElevated,
            colors.surfaceHighlight,
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

// Skeleton Proposal Card — 22a spec: 18-radius card on surface with a
// chip-shaped header row, two title lines (17px / r8), a 6px tally bar,
// and a mono footer row (11px / r5).
export function SkeletonProposal({ style }: { style?: ViewStyle }) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.proposalCard,
        { backgroundColor: colors.surface, borderColor: colors.borderSubtle },
        style,
      ]}
    >
      <View style={styles.proposalHeader}>
        <Skeleton width={120} height={20} borderRadius={RADIUS.chip} />
        <Skeleton width={64} height={14} borderRadius={7} />
      </View>
      <Skeleton width="88%" height={17} borderRadius={8} />
      <Skeleton width="64%" height={17} borderRadius={8} />
      <Skeleton width="100%" height={6} borderRadius={3} />
      <View style={styles.proposalFooter}>
        <Skeleton width={80} height={11} borderRadius={5} />
        <Skeleton width={120} height={11} borderRadius={5} />
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
  // Proposal — 22a: padding 17/18, 13px internal gap, radius 18
  proposalCard: {
    paddingVertical: 17,
    paddingHorizontal: 18,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    marginBottom: SPACING.lg,
    gap: 13,
  },
  proposalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  proposalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
