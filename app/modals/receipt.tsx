import { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
import { useTheme, SPACING, RADIUS, FONTS, withAlpha } from '../../lib/theme';
import { Button } from '../../components/ui';
import { haptics } from '../../lib/haptics';

interface ReceiptParams {
  type: 'verification' | 'premium' | 'organization';
  amount: string;
  transactionId: string;
  date: string;
  paymentMethod?: string;
  organizationName?: string;
  tier?: string;
}

// Sealed-receipt checkmark — gold ring with drawn check
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
    <Animated.View
      style={[
        styles.checkmarkRing,
        {
          backgroundColor: colors.goldSurface,
          borderColor: withAlpha(colors.goldFill, 0.35),
          shadowColor: colors.goldFill,
        },
        animatedStyle,
      ]}
    >
      <Ionicons name="checkmark" size={48} color={colors.gold} />
    </Animated.View>
  );
}

// Mono ledger row — label + recorded value, hairline separated
function ReceiptRow({
  label,
  value,
  highlight = false,
  last = false,
  delay = 0,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  last?: boolean;
  delay?: number;
}) {
  const { colors } = useTheme();

  return (
    <Animated.View
      entering={FadeInUp.delay(delay).duration(400)}
      style={[
        styles.receiptRow,
        { borderBottomColor: colors.borderSubtle },
        last && { borderBottomWidth: 0 },
      ]}
    >
      <Text style={[styles.receiptLabel, { color: colors.textTertiary }]}>
        {label}
      </Text>
      <View style={styles.receiptValueWrap}>
        {highlight && (
          <Ionicons name="checkmark" size={12} color={colors.support} />
        )}
        <Text
          style={[
            styles.receiptValue,
            highlight
              ? { color: colors.support, fontFamily: FONTS.monoSemiBold }
              : { color: colors.text },
          ]}
          numberOfLines={1}
        >
          {value}
        </Text>
      </View>
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
          style={[styles.headerButton, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={22} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.headerButton, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
          onPress={handleShare}
          activeOpacity={0.7}
        >
          <Ionicons name="share-outline" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Seal */}
        <AnimatedCheckmark />

        <Animated.Text
          entering={FadeInDown.delay(400).duration(500)}
          style={[styles.successTitle, { color: colors.text }]}
        >
          Payment Recorded
        </Animated.Text>

        <Animated.Text
          entering={FadeInDown.delay(500).duration(500)}
          style={[styles.subtitle, { color: colors.textSecondary }]}
        >
          {productInfo.description} — your receipt is below.
        </Animated.Text>

        {/* Receipt card — mono ledger block */}
        <Animated.View
          entering={FadeIn.delay(600).duration(500)}
          style={[styles.receiptCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          {/* Ledger header */}
          <View style={[styles.receiptHeader, { borderBottomColor: colors.borderStrong }]}>
            <Text style={[styles.receiptHeaderLabel, { color: colors.textTertiary }]}>
              PAYMENT RECEIPT
            </Text>
            <View style={[styles.receiptHeaderIcon, { backgroundColor: colors.goldSurface }]}>
              <Ionicons name={productInfo.icon as any} size={13} color={colors.gold} />
            </View>
          </View>

          {/* Product */}
          <View style={[styles.productHeader, { borderBottomColor: colors.borderSubtle }]}>
            <Text style={[styles.productTitle, { color: colors.text }]}>
              {productInfo.title}
            </Text>
          </View>

          {/* Ledger rows */}
          <View style={styles.receiptDetails}>
            <ReceiptRow label="AMOUNT" value={amount} delay={700} />
            <ReceiptRow label="RECORDED" value={date.toUpperCase()} delay={750} />
            <ReceiptRow label="METHOD" value={paymentMethod.toUpperCase()} delay={800} />
            <ReceiptRow label="TRANSACTION ID" value={transactionId} delay={850} />
            <ReceiptRow label="STATUS" value="COMPLETED" highlight last delay={900} />
          </View>
        </Animated.View>

        {/* Footer note */}
        <Animated.Text
          entering={FadeIn.delay(950).duration(500)}
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
    paddingHorizontal: SPACING.screenPadding,
    paddingBottom: SPACING.md,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.screenPadding,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkRing: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING['2xl'],
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 30,
    elevation: 8,
  },
  successTitle: {
    fontFamily: FONTS.serif,
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -0.4,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontFamily: FONTS.sans,
    fontSize: 14.5,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 290,
    marginBottom: SPACING['2xl'],
  },
  receiptCard: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  receiptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  receiptHeaderLabel: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    letterSpacing: 1.6,
  },
  receiptHeaderIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productHeader: {
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  productTitle: {
    fontFamily: FONTS.serif,
    fontSize: 17,
    lineHeight: 22,
  },
  receiptDetails: {
    paddingHorizontal: 18,
    paddingVertical: SPACING.xs,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  receiptLabel: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  receiptValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 1,
    marginLeft: SPACING.md,
  },
  receiptValue: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
  },
  footerNote: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    lineHeight: 17,
    letterSpacing: 0.2,
    textAlign: 'center',
    marginTop: SPACING.xl,
    paddingHorizontal: SPACING.lg,
  },
  bottomContainer: {
    paddingHorizontal: SPACING.screenPadding,
    paddingTop: SPACING.lg,
  },
});
