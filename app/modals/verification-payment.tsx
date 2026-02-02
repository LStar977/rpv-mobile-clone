import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Linking, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useAuthStore } from '../../lib/auth';
import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../../lib/theme';
import {
  fetchVerificationPaymentIntent,
  fetchVerificationCheckoutUrl,
  processPayment,
  showPaymentError,
  showPaymentSuccess,
  isApplePaySupported,
  isGooglePaySupported,
} from '../../lib/stripe';

const VERIFICATION_BENEFITS = [
  { icon: 'checkmark-circle', text: 'Vote on all proposals (global + geo-restricted)' },
  { icon: 'location', text: 'Create proposals for your verified region' },
  { icon: 'infinite', text: 'Unlimited voting (no monthly limits)' },
  { icon: 'shield-checkmark', text: 'Verified badge on your profile' },
  { icon: 'lock-closed', text: 'One-time payment, lifetime access' },
];

export default function VerificationPaymentScreen() {
  const { colors } = useTheme();
  const { token } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [applePayAvailable, setApplePayAvailable] = useState(false);
  const [googlePayAvailable, setGooglePayAvailable] = useState(false);

  useEffect(() => {
    // Check for available payment methods
    const checkPaymentMethods = async () => {
      const [applePay, googlePay] = await Promise.all([
        isApplePaySupported(),
        isGooglePaySupported(),
      ]);
      setApplePayAvailable(applePay);
      setGooglePayAvailable(googlePay);
    };
    checkPaymentMethods();
  }, []);

  const handlePayment = async () => {
    setLoading(true);
    try {
      // Try native Payment Sheet first
      const paymentIntent = await fetchVerificationPaymentIntent(token);

      // If backend returns clientSecret, use native Payment Sheet
      if (paymentIntent.clientSecret) {
        const result = await processPayment({
          clientSecret: paymentIntent.clientSecret,
          ephemeralKey: paymentIntent.ephemeralKey,
          customerId: paymentIntent.customerId,
          merchantDisplayName: 'Represent Wallet',
        });

        if (result.success) {
          showPaymentSuccess('verification');
          // Navigate to Veriff verification after successful payment
          router.replace('/modals/veriff');
        } else if (result.cancelled) {
          // User cancelled - do nothing
        } else {
          showPaymentError(result.error || 'Payment failed');
        }
      } else if (paymentIntent.url) {
        // Fallback to web checkout if backend returns URL instead
        await Linking.openURL(paymentIntent.url);
        router.back();
      }
    } catch (error: any) {
      // If native payment fails, try web checkout as fallback
      try {
        const url = await fetchVerificationCheckoutUrl(token);
        await Linking.openURL(url);
        router.back();
      } catch (fallbackError: any) {
        Alert.alert('Error', fallbackError.message || 'Failed to start payment. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleViewPremium = () => {
    router.replace('/modals/subscription');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Verify Identity</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.heroSection}>
          <View style={[styles.priceContainer, { backgroundColor: `${colors.gold}15` }]}>
            <Text style={[styles.priceAmount, { color: colors.gold }]}>$4.99</Text>
            <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>one-time</Text>
          </View>

          <Text style={[styles.heroTitle, { color: colors.text }]}>
            Unlock Full Voting Access
          </Text>
          <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
            Verify your identity once to participate in all proposals in your region.
          </Text>
        </Animated.View>

        {/* Benefits Card */}
        <Animated.View
          entering={FadeInUp.delay(150).duration(400)}
          style={[styles.benefitsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Text style={[styles.benefitsTitle, { color: colors.text }]}>What you get</Text>

          {VERIFICATION_BENEFITS.map((benefit, index) => (
            <View key={index} style={styles.benefitRow}>
              <View style={[styles.benefitIcon, { backgroundColor: `${colors.success}15` }]}>
                <Ionicons name={benefit.icon as any} size={16} color={colors.success} />
              </View>
              <Text style={[styles.benefitText, { color: colors.text }]}>{benefit.text}</Text>
            </View>
          ))}
        </Animated.View>

        {/* Process Info */}
        <Animated.View
          entering={FadeInUp.delay(300).duration(400)}
          style={[styles.processCard, { backgroundColor: `${colors.info}10`, borderColor: `${colors.info}25` }]}
        >
          <Ionicons name="information-circle-outline" size={20} color={colors.info} />
          <Text style={[styles.processText, { color: colors.textSecondary }]}>
            After payment, you'll complete identity verification via Veriff using a government-issued ID.
            Your location will be verified automatically.
          </Text>
        </Animated.View>

        {/* Premium Upsell */}
        <Animated.View
          entering={FadeInUp.delay(450).duration(400)}
          style={[styles.upsellCard, { backgroundColor: colors.surface, borderColor: colors.gold }]}
        >
          <LinearGradient
            colors={[`${colors.gold}08`, 'transparent']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <View style={styles.upsellHeader}>
            <Ionicons name="star" size={20} color={colors.gold} />
            <Text style={[styles.upsellTitle, { color: colors.gold }]}>Or go Premium</Text>
            <View style={[styles.upsellBadge, { backgroundColor: colors.gold }]}>
              <Text style={styles.upsellBadgeText}>BEST VALUE</Text>
            </View>
          </View>
          <Text style={[styles.upsellText, { color: colors.textSecondary }]}>
            Get verification included + unlimited proposals, analytics dashboard, and more for just $7.99/month.
          </Text>
          <TouchableOpacity
            onPress={handleViewPremium}
            style={styles.upsellLink}
          >
            <Text style={[styles.upsellLinkText, { color: colors.gold }]}>View Premium</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.gold} />
          </TouchableOpacity>
        </Animated.View>

        <View style={{ height: 140 }} />
      </ScrollView>

      {/* Fixed CTA */}
      <View style={[styles.ctaContainer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <TouchableOpacity
          onPress={handlePayment}
          disabled={loading}
          style={[loading && styles.btnDisabled]}
        >
          <LinearGradient
            colors={[colors.gold, colors.goldDark || '#A68523']}
            style={styles.ctaButton}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <>
                <Ionicons name="card-outline" size={20} color="#000" />
                <Text style={styles.ctaButtonText}>Continue to Payment</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
        <View style={styles.paymentMethodsRow}>
          <Text style={[styles.ctaDisclaimer, { color: colors.textTertiary }]}>
            Secure payment via Stripe
          </Text>
          {(applePayAvailable || googlePayAvailable) && (
            <View style={styles.paymentIcons}>
              {applePayAvailable && (
                <Ionicons name="logo-apple" size={16} color={colors.textTertiary} />
              )}
              {googlePayAvailable && (
                <Ionicons name="logo-google" size={16} color={colors.textTertiary} />
              )}
            </View>
          )}
        </View>
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
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...TYPOGRAPHY.headlineSmall,
  },
  content: {
    flex: 1,
    padding: SPACING.lg,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  priceContainer: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
    marginBottom: SPACING.lg,
  },
  priceAmount: {
    ...TYPOGRAPHY.displayMedium,
    fontWeight: '700',
    textAlign: 'center',
  },
  priceLabel: {
    ...TYPOGRAPHY.labelMedium,
    textAlign: 'center',
    marginTop: SPACING.xxs,
  },
  heroTitle: {
    ...TYPOGRAPHY.headlineLarge,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  heroSubtitle: {
    ...TYPOGRAPHY.bodyMedium,
    textAlign: 'center',
    lineHeight: 22,
  },
  benefitsCard: {
    padding: SPACING.xl,
    borderRadius: BORDER_RADIUS.xxl,
    borderWidth: 1,
    marginBottom: SPACING.lg,
    ...SHADOWS.md,
  },
  benefitsTitle: {
    ...TYPOGRAPHY.headlineSmall,
    marginBottom: SPACING.lg,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  benefitIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  benefitText: {
    ...TYPOGRAPHY.bodyMedium,
    flex: 1,
  },
  processCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    marginBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  processText: {
    ...TYPOGRAPHY.bodySmall,
    flex: 1,
    lineHeight: 20,
  },
  upsellCard: {
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xxl,
    borderWidth: 2,
    overflow: 'hidden',
  },
  upsellHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  upsellTitle: {
    ...TYPOGRAPHY.labelLarge,
    fontWeight: '600',
  },
  upsellBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  upsellBadgeText: {
    ...TYPOGRAPHY.labelSmall,
    color: '#000',
    fontWeight: '700',
    fontSize: 9,
  },
  upsellText: {
    ...TYPOGRAPHY.bodySmall,
    lineHeight: 20,
    marginBottom: SPACING.sm,
  },
  upsellLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xxs,
  },
  upsellLinkText: {
    ...TYPOGRAPHY.labelMedium,
    fontWeight: '600',
  },
  ctaContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: SPACING.lg,
    paddingBottom: SPACING.xxxl,
    borderTopWidth: 1,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    gap: SPACING.sm,
    ...SHADOWS.md,
  },
  ctaButtonText: {
    ...TYPOGRAPHY.labelLarge,
    color: '#000',
    fontWeight: '600',
  },
  ctaDisclaimer: {
    ...TYPOGRAPHY.labelSmall,
    textAlign: 'center',
  },
  paymentMethodsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.sm,
    gap: SPACING.sm,
  },
  paymentIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
