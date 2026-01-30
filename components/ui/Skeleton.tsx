import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import { useTheme, BORDER_RADIUS, SPACING } from '../../lib/theme';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({
  width = '100%',
  height = 20,
  borderRadius = BORDER_RADIUS.md,
  style,
}: SkeletonProps) {
  const { colors, isDark } = useTheme();
  const shimmerValue = useSharedValue(0);

  useEffect(() => {
    shimmerValue.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      shimmerValue.value,
      [0, 0.5, 1],
      [0.3, 0.6, 0.3]
    );

    return {
      opacity,
    };
  });

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
          backgroundColor: isDark ? colors.cardBgLight : colors.border,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

// Skeleton Card
interface SkeletonCardProps {
  lines?: number;
  showImage?: boolean;
  style?: ViewStyle;
}

export function SkeletonCard({
  lines = 3,
  showImage = false,
  style,
}: SkeletonCardProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.cardBg, borderColor: colors.border },
        style,
      ]}
    >
      {showImage && (
        <Skeleton
          height={160}
          borderRadius={BORDER_RADIUS.lg}
          style={styles.cardImage}
        />
      )}
      <View style={styles.cardContent}>
        <Skeleton width="40%" height={12} style={styles.badge} />
        <Skeleton width="85%" height={20} style={styles.title} />
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton
            key={i}
            width={i === lines - 1 ? '60%' : '100%'}
            height={14}
            style={styles.line}
          />
        ))}
        <View style={styles.cardFooter}>
          <Skeleton width={80} height={32} borderRadius={BORDER_RADIUS.lg} />
          <Skeleton width={80} height={32} borderRadius={BORDER_RADIUS.lg} />
        </View>
      </View>
    </View>
  );
}

// Skeleton List Item
export function SkeletonListItem({ style }: { style?: ViewStyle }) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.listItem,
        { backgroundColor: colors.cardBg, borderColor: colors.border },
        style,
      ]}
    >
      <Skeleton
        width={48}
        height={48}
        borderRadius={BORDER_RADIUS.full}
        style={styles.avatar}
      />
      <View style={styles.listContent}>
        <Skeleton width="70%" height={16} style={styles.listTitle} />
        <Skeleton width="90%" height={12} />
      </View>
      <Skeleton width={40} height={24} borderRadius={BORDER_RADIUS.md} />
    </View>
  );
}

// Skeleton Stats Grid
export function SkeletonStats({ count = 3 }: { count?: number }) {
  const { colors } = useTheme();

  return (
    <View style={styles.statsGrid}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.statCard,
            { backgroundColor: colors.cardBg, borderColor: colors.border },
          ]}
        >
          <Skeleton width={24} height={24} borderRadius={BORDER_RADIUS.sm} />
          <Skeleton width={40} height={28} style={{ marginTop: SPACING.sm }} />
          <Skeleton width={50} height={12} style={{ marginTop: SPACING.xs }} />
        </View>
      ))}
    </View>
  );
}

// Skeleton Profile Header
export function SkeletonProfile() {
  const { colors } = useTheme();

  return (
    <View style={[styles.profile, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
      <Skeleton
        width={80}
        height={80}
        borderRadius={BORDER_RADIUS.full}
        style={styles.profileAvatar}
      />
      <Skeleton width={150} height={24} style={styles.profileName} />
      <Skeleton width={200} height={14} style={styles.profileEmail} />
      <Skeleton width={120} height={28} borderRadius={BORDER_RADIUS.lg} style={{ marginTop: SPACING.md }} />
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    overflow: 'hidden',
  },
  card: {
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: SPACING.lg,
  },
  cardImage: {
    marginBottom: 0,
  },
  cardContent: {
    padding: SPACING.lg,
  },
  badge: {
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
    marginTop: SPACING.md,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
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
  statsGrid: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
  },
  profile: {
    alignItems: 'center',
    padding: SPACING.xxl,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
  },
  profileAvatar: {
    marginBottom: SPACING.lg,
  },
  profileName: {
    marginBottom: SPACING.sm,
  },
  profileEmail: {},
});
