import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../../lib/theme';

interface UpgradeModalProps {
  visible: boolean;
  onClose: () => void;
  type: 'premium' | 'verification';
  title?: string;
  message?: string;
}

const MODAL_CONFIG = {
  premium: {
    icon: 'sparkles' as const,
    defaultTitle: 'Premium Feature',
    defaultMessage: 'Upgrade to Premium to unlock Sentinel AI and analyze government documents against 155 governance principles.',
    buttonText: 'Upgrade to Premium',
    buttonIcon: 'star' as const,
    price: '$7.99/month',
    route: '/modals/subscription',
  },
  verification: {
    icon: 'shield-checkmark' as const,
    defaultTitle: 'Verification Required',
    defaultMessage: 'This proposal is restricted to verified users in specific regions. Complete identity verification to vote.',
    buttonText: 'Get Verified',
    buttonIcon: 'shield-checkmark' as const,
    price: '$4.99 one-time',
    route: '/modals/verification-payment',
  },
};

export function UpgradeModal({
  visible,
  onClose,
  type,
  title,
  message,
}: UpgradeModalProps) {
  const { colors } = useTheme();
  const config = MODAL_CONFIG[type];

  const handleUpgrade = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onClose();
    router.push(config.route as any);
  };

  const handleClose = () => {
    Haptics.selectionAsync();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={handleClose}>
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          style={styles.overlay}
        >
          <TouchableWithoutFeedback>
            <Animated.View
              entering={SlideInDown.springify().damping(20).stiffness(200)}
              exiting={SlideOutDown.duration(200)}
              style={[
                styles.modalContainer,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.gold,
                  ...SHADOWS.lg,
                },
              ]}
            >
              {/* Gold gradient accent at top */}
              <LinearGradient
                colors={[`${colors.gold}20`, 'transparent']}
                style={styles.gradientAccent}
              />

              {/* Close button */}
              <TouchableOpacity
                style={[styles.closeButton, { backgroundColor: colors.surfaceHighlight }]}
                onPress={handleClose}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>

              {/* Icon */}
              <View style={[styles.iconContainer, { backgroundColor: `${colors.gold}15` }]}>
                <View style={[styles.iconInner, { backgroundColor: colors.gold }]}>
                  <Ionicons name={config.icon} size={32} color="#000" />
                </View>
              </View>

              {/* Title */}
              <Text style={[styles.title, { color: colors.gold }]}>
                {title || config.defaultTitle}
              </Text>

              {/* Message */}
              <Text style={[styles.message, { color: colors.textSecondary }]}>
                {message || config.defaultMessage}
              </Text>

              {/* Price badge */}
              <View style={[styles.priceBadge, { backgroundColor: `${colors.gold}10`, borderColor: `${colors.gold}30` }]}>
                <Ionicons name="pricetag" size={14} color={colors.gold} />
                <Text style={[styles.priceText, { color: colors.gold }]}>
                  {config.price}
                </Text>
              </View>

              {/* Action button */}
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleUpgrade}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[colors.gold, colors.goldDark || '#A68523']}
                  style={styles.gradientButton}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Ionicons name={config.buttonIcon} size={20} color="#000" />
                  <Text style={styles.buttonText}>{config.buttonText}</Text>
                </LinearGradient>
              </TouchableOpacity>

              {/* Cancel link */}
              <TouchableOpacity onPress={handleClose} style={styles.cancelButton}>
                <Text style={[styles.cancelText, { color: colors.textTertiary }]}>
                  Maybe later
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 340,
    borderRadius: BORDER_RADIUS.xxl,
    borderWidth: 1.5,
    padding: SPACING.xl,
    alignItems: 'center',
    overflow: 'hidden',
  },
  gradientAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  closeButton: {
    position: 'absolute',
    top: SPACING.md,
    right: SPACING.md,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
  },
  iconInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...TYPOGRAPHY.headlineMedium,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  message: {
    ...TYPOGRAPHY.bodyMedium,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.sm,
  },
  priceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    gap: SPACING.xs,
    marginBottom: SPACING.lg,
  },
  priceText: {
    ...TYPOGRAPHY.labelMedium,
    fontWeight: '600',
  },
  actionButton: {
    width: '100%',
    marginBottom: SPACING.md,
  },
  gradientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    gap: SPACING.sm,
  },
  buttonText: {
    ...TYPOGRAPHY.labelLarge,
    color: '#000',
    fontWeight: '700',
  },
  cancelButton: {
    paddingVertical: SPACING.sm,
  },
  cancelText: {
    ...TYPOGRAPHY.bodyMedium,
  },
});

export default UpgradeModal;
