import { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  withDelay,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useTheme, SPACING, RADIUS, TYPOGRAPHY, SHADOWS } from '../../lib/theme';
import { Button } from '../../components/ui';
import { haptics } from '../../lib/haptics';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

interface ReceiptParams {
  type: 'verification' | 'premium' | 'organization';
  amount: string;
  transactionId: string;
  date: string;
  paymentMethod?: string;
  organizationName?: string;
  tier?: string;
}

// Checkmark animation component
function AnimatedCheckmark() {
  const { colors } = useTheme();
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(200, withSpring(1));
    scale.value = withDelay(200, withSequence(
      withSpring(1.2, { damping: 8, stiffness: 200 }),
      withSpring(1, { damping: 12, stiffness: 300 })
    ));
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.checkmarkContainer, animatedStyle]}>
      <LinearGradient
        colors={[colors.goldLight, colors.gold, colors.goldDark] as any}
        style={styles.checkmarkGradient}
      >
        <Ionicons name="checkmark" size={48} color={colors.black} />
      </LinearGradient>
    </Animated.View>
  );
}

// Receipt detail row
function ReceiptRow({
  label,
  value,
  highlight = false,
  delay = 0,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  delay?: number;
}) {
  const { colors } = useTheme();

  return (
    <Animated.View
      entering={FadeInUp.delay(delay).duration(400)}
      style={[styles.receiptRow, { borderBottomColor: colors.border }]}
    >
      <Text style={[styles.receiptLabel, { color: colors.textSecondary }]}>
        {label}
      </Text>
      <Text style={[
        styles.receiptValue,
        { color: highlight ? colors.gold : colors.text }
      ]}>
        {value}
      </Text>
    </Animated.View>
  );
}

export default function ReceiptScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<ReceiptParams>();

  const {
    type = 'verification',
    amount = '$4.99',
    transactionId = 'TXN-' + Date.now().toString(36).toUpperCase(),
    date = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    paymentMethod = 'Card',
    organizationName,
    tier,
  } = params;

  // Product info based on type
  const productInfo = {
    verification: {
      title: 'Identity Verification',
      description: 'One-time verification fee',
      icon: 'shield-checkmark',
    },
    premium: {
      title: 'Premium Subscription',
      description: 'Monthly subscription',
      icon: 'star',
    },
    organization: {
      title: organizationName ? `${organizationName} - ${tier || 'Organization'}` : 'Organization Plan',
      description: 'Organization subscription',
      icon: 'people',
    },
  }[type];

  const handleShare = async () => {
    haptics.light();
    try {
      await Share.share({
        message: `Represent Payment Receipt\n\n` +
          `Product: ${productInfo.title}\n` +
          `Amount: ${amount}\n` +
          `Date: ${date}\n` +
          `Transaction ID: ${transactionId}\n\n` +
          `Thank you for your purchase!`,
        title: 'Payment Receipt',
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleDone = () => {
    haptics.light();
    // Navigate to the appropriate screen based on payment type
    if (type === 'verification') {
      router.replace('/modals/veriff');
    } else if (type === 'organization') {
      router.replace('/(tabs)/groups');
    } else {
      router.back();
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + SPACING.md }]}>
        <TouchableOpacity
          style={[styles.closeButton, { backgroundColor: colors.surface }]}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.shareButton, { backgroundColor: colors.surface }]}
          onPress={handleShare}
          activeOpacity={0.7}
        >
          <Ionicons name="share-outline" size={22} color={colors.gold} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Success indicator */}
        <AnimatedCheckmark />

        <Animated.Text
          entering={FadeInDown.delay(400).duration(500)}
          style={[styles.successTitle, { color: colors.text }]}
        >
          Payment Successful
        </Animated.Text>

        <Animated.Text
          entering={FadeInDown.delay(500).duration(500)}
          style={[styles.amount, { color: colors.gold }]}
        >
          {amount}
        </Animated.Text>

        {/* Receipt card */}
        <Animated.View
          entering={FadeIn.delay(600).duration(500)}
          style={[styles.receiptCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          {/* Product header */}
          <View style={[styles.productHeader, { borderBottomColor: colors.border }]}>
            <View style={[styles.productIcon, { backgroundColor: colors.goldSurface }]}>
              <Ionicons name={productInfo.icon as any} size={24} color={colors.gold} />
            </View>
            <View style={styles.productInfo}>
              <Text style={[styles.productTitle, { color: colors.text }]}>
                {productInfo.title}
              </Text>
              <Text style={[styles.productDescription, { color: colors.textSecondary }]}>
                {productInfo.description}
              </Text>
            </View>
          </View>

          {/* Receipt details */}
          <View style={styles.receiptDetails}>
            <ReceiptRow label="Date" value={date} delay={700} />
            <ReceiptRow label="Payment Method" value={paymentMethod} delay={750} />
            <ReceiptRow label="Transaction ID" value={transactionId} delay={800} />
            <ReceiptRow label="Status" value="Completed" highlight delay={850} />
          </View>
        </Animated.View>

        {/* Footer note */}
        <Animated.Text
          entering={FadeIn.delay(900).duration(500)}
          style={[styles.footerNote, { color: colors.textTertiary }]}
        >
          A confirmation email has been sent to your registered email address.
        </Animated.Text>
      </View>

      {/* Bottom button */}
      <View style={[styles.bottomContainer, { paddingBottom: insets.bottom + SPACING.lg }]}>
        <Button
          title={
            type === 'verification' ? 'Continue to Verification' :
            type === 'organization' ? 'View Organizations' : 'Done'
          }
          onPress={handleDone}
          variant="primary"
          size="xl"
          fullWidth
        />
      </View>

      {/* Gold accent line */}
      <LinearGradient
        colors={[colors.goldLight, colors.gold, colors.goldDark] as any}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.bottomAccent, { bottom: insets.bottom }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
  },
  checkmarkContainer: {
    marginTop: SPACING['3xl'],
    marginBottom: SPACING.xl,
  },
  checkmarkGradient: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.glow,
  },
  successTitle: {
    fontFamily: 'Georgia',
    fontSize: 24,
    fontWeight: '500',
    marginBottom: SPACING.sm,
  },
  amount: {
    fontFamily: 'Georgia',
    fontSize: 40,
    fontWeight: '500',
    marginBottom: SPACING['2xl'],
  },
  receiptCard: {
    width: '100%',
    borderRadius: RADIUS.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  productHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 1,
  },
  productIcon: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  productInfo: {
    flex: 1,
  },
  productTitle: {
    fontFamily: 'Georgia',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: SPACING.xs,
  },
  productDescription: {
    ...TYPOGRAPHY.bodySmall,
  },
  receiptDetails: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  receiptLabel: {
    ...TYPOGRAPHY.body,
  },
  receiptValue: {
    ...TYPOGRAPHY.label,
  },
  footerNote: {
    ...TYPOGRAPHY.caption,
    textAlign: 'center',
    marginTop: SPACING.xl,
    paddingHorizontal: SPACING.lg,
  },
  bottomContainer: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
  },
  bottomAccent: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 3,
    opacity: 0.6,
  },
});
