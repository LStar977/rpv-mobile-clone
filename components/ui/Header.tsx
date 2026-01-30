import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme, SPACING, TYPOGRAPHY, SHADOWS, BORDER_RADIUS } from '../../lib/theme';

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
  showBorder = true,
  transparent = false,
  style,
  large = false,
}: HeaderProps) {
  const { colors, isDark } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: transparent ? 'transparent' : colors.background,
          borderBottomColor: showBorder ? colors.border : 'transparent',
          borderBottomWidth: showBorder ? 1 : 0,
        },
        large && styles.containerLarge,
        style,
      ]}
    >
      <View style={styles.leftSection}>
        {leftIcon && (
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: colors.cardBg }]}
            onPress={onLeftPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name={leftIcon} size={22} color={colors.text} />
          </TouchableOpacity>
        )}
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
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: colors.cardBg, marginRight: SPACING.sm }]}
            onPress={onRightPress2}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name={rightIcon2} size={22} color={colors.text} />
          </TouchableOpacity>
        )}
        {rightIcon && (
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: colors.cardBg }]}
            onPress={onRightPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name={rightIcon} size={22} color={colors.text} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// Screen Header with welcome message
interface WelcomeHeaderProps {
  name?: string;
  subtitle?: string;
  verified?: boolean;
  avatarLetter?: string;
  onAvatarPress?: () => void;
  style?: ViewStyle;
}

export function WelcomeHeader({
  name,
  subtitle,
  verified = false,
  avatarLetter,
  onAvatarPress,
  style,
}: WelcomeHeaderProps) {
  const { colors } = useTheme();
  const displayName = name ? name.split(' ')[0] : 'there';
  const letter = avatarLetter || (name ? name.charAt(0).toUpperCase() : 'U');

  return (
    <Animated.View
      entering={FadeInDown.duration(400)}
      style={[
        styles.welcomeContainer,
        { backgroundColor: colors.cardBg, borderColor: colors.gold },
        style,
      ]}
    >
      <View style={styles.welcomeContent}>
        <View style={styles.welcomeTextSection}>
          <Text style={[styles.welcomeGreeting, { color: colors.gold }]}>
            Welcome back,
          </Text>
          <Text style={[styles.welcomeName, { color: colors.text }]}>
            {displayName}!
          </Text>
          {subtitle && (
            <Text style={[styles.welcomeSubtitle, { color: colors.textSecondary }]}>
              {subtitle}
            </Text>
          )}
        </View>

        <TouchableOpacity
          onPress={onAvatarPress}
          style={styles.avatarContainer}
          accessibilityRole="button"
          accessibilityLabel="Profile"
        >
          <View style={[styles.avatar, { backgroundColor: colors.gold, ...SHADOWS.glow }]}>
            <Text style={[styles.avatarText, { color: colors.background }]}>
              {letter}
            </Text>
          </View>
          {verified && (
            <View style={[styles.verifiedBadge, { backgroundColor: colors.success }]}>
              <Ionicons name="checkmark" size={10} color="#fff" />
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View style={[styles.citizenBadge, { backgroundColor: colors.goldLight }]}>
        <Ionicons
          name={verified ? 'shield-checkmark' : 'shield-outline'}
          size={14}
          color={colors.gold}
        />
        <Text style={[styles.citizenText, { color: colors.gold }]}>
          {verified ? 'Verified Citizen' : 'Active Citizen'}
        </Text>
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
}

export function SectionHeader({
  title,
  action,
  onActionPress,
  icon,
  iconColor,
  style,
}: SectionHeaderProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.sectionHeader, style]}>
      <View style={styles.sectionTitleRow}>
        {icon && (
          <Ionicons
            name={icon}
            size={16}
            color={iconColor || colors.gold}
            style={styles.sectionIcon}
          />
        )}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          {title}
        </Text>
      </View>
      {action && (
        <TouchableOpacity onPress={onActionPress}>
          <Text style={[styles.sectionAction, { color: colors.gold }]}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: 60,
    paddingBottom: SPACING.lg,
  },
  containerLarge: {
    paddingTop: 70,
    paddingBottom: SPACING.xl,
  },
  leftSection: {
    width: 44,
  },
  centerSection: {
    flex: 1,
    alignItems: 'center',
  },
  rightSection: {
    width: 44,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...TYPOGRAPHY.headlineSmall,
  },
  titleLarge: {
    ...TYPOGRAPHY.headlineLarge,
  },
  subtitle: {
    ...TYPOGRAPHY.bodySmall,
    marginTop: SPACING.xxs,
  },
  // Welcome Header
  welcomeContainer: {
    margin: SPACING.lg,
    padding: SPACING.xl,
    borderRadius: BORDER_RADIUS.xxl,
    borderWidth: 1.5,
    ...SHADOWS.md,
  },
  welcomeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  welcomeTextSection: {
    flex: 1,
  },
  welcomeGreeting: {
    ...TYPOGRAPHY.bodyMedium,
    fontWeight: '500',
  },
  welcomeName: {
    ...TYPOGRAPHY.headlineLarge,
    marginTop: SPACING.xxs,
  },
  welcomeSubtitle: {
    ...TYPOGRAPHY.bodySmall,
    marginTop: SPACING.xs,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '700',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0F0F12',
  },
  citizenBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    gap: SPACING.sm,
  },
  citizenText: {
    ...TYPOGRAPHY.labelMedium,
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
  },
  sectionIcon: {
    marginRight: SPACING.sm,
  },
  sectionTitle: {
    ...TYPOGRAPHY.overline,
  },
  sectionAction: {
    ...TYPOGRAPHY.labelMedium,
  },
});
