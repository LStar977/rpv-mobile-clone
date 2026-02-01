import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useTheme, SPACING, TYPOGRAPHY, SHADOWS, RADIUS, EASING } from '../../lib/theme';
import { haptics } from '../../lib/haptics';
import { StatusDot } from './Badge';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

interface HeaderProps {
  title: string;
  subtitle?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon2?: keyof typeof Ionicons.glyphMap;
  onLeftPress?: () => void;
  onRightPress?: () => void;
  onRightPress2?: () => void;
  showBorder?: boolean;
  transparent?: boolean;
  style?: ViewStyle;
  large?: boolean;
  blur?: boolean;
}

export function Header({
  title,
  subtitle,
  leftIcon,
  rightIcon,
  rightIcon2,
  onLeftPress,
  onRightPress,
  onRightPress2,
  showBorder = false,
  transparent = false,
  style,
  large = false,
  blur = false,
}: HeaderProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const IconButton = ({
    icon,
    onPress,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    onPress?: () => void;
  }) => {
    const scale = useSharedValue(1);

    const handlePressIn = () => {
      haptics.light();
      scale.value = withSpring(0.9, EASING.springSnappy);
    };

    const handlePressOut = () => {
      scale.value = withSpring(1, EASING.springSnappy);
    };

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    return (
      <AnimatedTouchable
        style={[
          styles.iconButton,
          { backgroundColor: colors.surface, borderColor: colors.border },
          animatedStyle,
        ]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
      >
        <Ionicons name={icon} size={20} color={colors.text} />
      </AnimatedTouchable>
    );
  };

  const content = (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + (large ? 16 : 12),
          borderBottomColor: showBorder ? colors.border : 'transparent',
          borderBottomWidth: showBorder ? 1 : 0,
          backgroundColor: transparent ? 'transparent' : colors.background,
        },
        large && styles.containerLarge,
        style,
      ]}
    >
      <View style={styles.leftSection}>
        {leftIcon && <IconButton icon={leftIcon} onPress={onLeftPress} />}
      </View>

      <View style={styles.centerSection}>
        <Text
          style={[
            large ? styles.titleLarge : styles.title,
            { color: colors.text },
          ]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle && (
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {subtitle}
          </Text>
        )}
      </View>

      <View style={styles.rightSection}>
        {rightIcon2 && (
          <IconButton icon={rightIcon2} onPress={onRightPress2} />
        )}
        {rightIcon && <IconButton icon={rightIcon} onPress={onRightPress} />}
      </View>
    </View>
  );

  if (blur && !transparent) {
    return (
      <BlurView intensity={80} tint={isDark ? 'dark' : 'light'} style={style}>
        {content}
      </BlurView>
    );
  }

  return content;
}

// Screen Header with welcome message
interface WelcomeHeaderProps {
  name?: string;
  subtitle?: string;
  verified?: boolean;
  avatarLetter?: string;
  avatarUrl?: string;
  onAvatarPress?: () => void;
  onNotificationPress?: () => void;
  notificationCount?: number;
  style?: ViewStyle;
}

export function WelcomeHeader({
  name,
  subtitle,
  verified = false,
  avatarLetter,
  avatarUrl,
  onAvatarPress,
  onNotificationPress,
  notificationCount = 0,
  style,
}: WelcomeHeaderProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const displayName = name ? name.split(' ')[0] : 'there';
  const letter = avatarLetter || (name ? name.charAt(0).toUpperCase() : 'U');

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <Animated.View
      entering={FadeInDown.duration(400).springify()}
      style={[
        styles.welcomeContainer,
        { paddingTop: insets.top + 16 },
        style,
      ]}
    >
      <View style={styles.welcomeContent}>
        <View style={styles.welcomeTextSection}>
          <Text style={[styles.welcomeGreeting, { color: colors.textSecondary }]}>
            {getGreeting()},
          </Text>
          <View style={styles.welcomeNameRow}>
            <Text style={[styles.welcomeName, { color: colors.text }]}>
              {displayName}
            </Text>
            {verified && (
              <View style={[styles.verifiedBadgeSmall, { backgroundColor: colors.success }]}>
                <Ionicons name="checkmark" size={10} color={colors.white} />
              </View>
            )}
          </View>
          {subtitle && (
            <Text style={[styles.welcomeSubtitle, { color: colors.textTertiary }]}>
              {subtitle}
            </Text>
          )}
        </View>

        <View style={styles.welcomeActions}>
          {onNotificationPress && (
            <TouchableOpacity
              onPress={() => {
                haptics.light();
                onNotificationPress();
              }}
              style={[styles.notificationButton, { backgroundColor: colors.surface }]}
            >
              <Ionicons name="notifications-outline" size={22} color={colors.text} />
              {notificationCount > 0 && (
                <View style={[styles.notificationDot, { backgroundColor: colors.gold }]}>
                  <Text style={[styles.notificationCount, { color: colors.black }]}>
                    {notificationCount > 9 ? '9+' : notificationCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => {
              haptics.light();
              onAvatarPress?.();
            }}
            style={styles.avatarContainer}
            accessibilityRole="button"
            accessibilityLabel="Profile"
          >
            <LinearGradient
              colors={[colors.goldLight, colors.gold, colors.goldDark] as any}
              style={[styles.avatarGradient]}
            >
              <View style={[styles.avatarInner, { backgroundColor: colors.background }]}>
                <Text style={[styles.avatarText, { color: colors.gold }]}>
                  {letter}
                </Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

// Section Header
interface SectionHeaderProps {
  title: string;
  action?: string;
  onActionPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  style?: ViewStyle;
  count?: number;
}

export function SectionHeader({
  title,
  action,
  onActionPress,
  icon,
  iconColor,
  style,
  count,
}: SectionHeaderProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.sectionHeader, style]}>
      <View style={styles.sectionTitleRow}>
        {icon && (
          <View style={[styles.sectionIconBg, { backgroundColor: (iconColor || colors.gold) + '15' }]}>
            <Ionicons
              name={icon}
              size={14}
              color={iconColor || colors.gold}
            />
          </View>
        )}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          {title}
        </Text>
        {count !== undefined && (
          <View style={[styles.sectionCount, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionCountText, { color: colors.textTertiary }]}>
              {count}
            </Text>
          </View>
        )}
      </View>
      {action && (
        <TouchableOpacity
          onPress={() => {
            haptics.light();
            onActionPress?.();
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={[styles.sectionAction, { color: colors.gold }]}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// Page Title - for modal/screen titles
interface PageTitleProps {
  title: string;
  subtitle?: string;
  centered?: boolean;
  style?: ViewStyle;
}

export function PageTitle({ title, subtitle, centered = false, style }: PageTitleProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.pageTitle, centered && styles.pageTitleCentered, style]}>
      <Text style={[styles.pageTitleText, { color: colors.text }]}>{title}</Text>
      {subtitle && (
        <Text style={[styles.pageTitleSubtitle, { color: colors.textSecondary }]}>
          {subtitle}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.md,
  },
  containerLarge: {
    paddingBottom: SPACING.lg,
  },
  leftSection: {
    width: 48,
  },
  centerSection: {
    flex: 1,
    alignItems: 'center',
  },
  rightSection: {
    width: 48,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  title: {
    ...TYPOGRAPHY.h5,
  },
  titleLarge: {
    ...TYPOGRAPHY.h4,
  },
  subtitle: {
    ...TYPOGRAPHY.caption,
    marginTop: 2,
  },
  // Welcome Header
  welcomeContainer: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.lg,
  },
  welcomeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  welcomeTextSection: {
    flex: 1,
  },
  welcomeGreeting: {
    ...TYPOGRAPHY.body,
  },
  welcomeNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: 2,
  },
  welcomeName: {
    ...TYPOGRAPHY.h2,
  },
  verifiedBadgeSmall: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeSubtitle: {
    ...TYPOGRAPHY.caption,
    marginTop: SPACING.xs,
  },
  welcomeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  notificationCount: {
    fontSize: 10,
    fontWeight: '700',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarGradient: {
    width: 48,
    height: 48,
    borderRadius: 24,
    padding: 2,
  },
  avatarInner: {
    flex: 1,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
  },
  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  sectionIconBg: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    ...TYPOGRAPHY.overline,
  },
  sectionCount: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 4,
  },
  sectionCountText: {
    fontSize: 11,
    fontWeight: '600',
  },
  sectionAction: {
    ...TYPOGRAPHY.label,
  },
  // Page Title
  pageTitle: {
    marginBottom: SPACING.xl,
  },
  pageTitleCentered: {
    alignItems: 'center',
  },
  pageTitleText: {
    ...TYPOGRAPHY.h2,
  },
  pageTitleSubtitle: {
    ...TYPOGRAPHY.body,
    marginTop: SPACING.xs,
  },
});
