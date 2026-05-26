import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Linking, Alert, Platform } from 'react-native';
import { useState, useEffect } from 'react';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../lib/auth';
import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS, responsive } from '../../lib/theme';
import { showPaymentError, showPaymentSuccess } from '../../lib/stripe';
import { processPremiumPayment } from '../../lib/payment';
import { restorePurchases } from '../../lib/iap';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://representportal.com';

interface SubscriptionData {
  subscription: string | null;
  tier: 'free' | 'verified' | 'premium';
  status: string;
  endDate: string | null;
}

const TIERS = {
  free: {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Get started with global proposals',
    icon: 'person-outline' as const,
    features: [
      { text: 'Unlimited voting on global proposals', included: true },
      { text: 'Create 1 proposal/month', included: true },
      { text: 'Basic analytics on your proposals', included: true },
      { text: 'Geo-restricted proposals', included: false },
      { text: 'Sentinel AI analyzer', included: false },
    ],
  },
  verified: {
    name: 'Verified',
    price: 'Free',
    period: '',
    description: 'Verify your identity to unlock all proposals',
    icon: 'shield-checkmark' as const,
    features: [
      { text: 'Unlimited voting on every proposal you can act on', included: true },
      { text: 'Create 3 proposals/month', included: true },
      { text: 'Access geo-restricted proposals', included: true },
      { text: 'Verified badge on profile', included: true },
      { text: 'Basic analytics on your proposals', included: true },
      { text: 'Sentinel AI analyzer', included: false },
    ],
  },
  premium: {
    name: 'Premium',
    price: '$7.99',
    period: '/month',
    description: 'Full access + Sentinel AI',
    icon: 'star' as const,
    features: [
      { text: 'Everything in Verified', included: true },
      { text: 'Unlimited proposal creation', included: true },
      { text: 'Sentinel AI governance analyzer', included: true },
      { text: 'Advanced analytics (geo + demographic breakdowns)', included: true },
      { text: 'Custom proposal alerts', included: true },
      { text: 'Voting history export', included: true },
      { text: 'Patron badge on profile', included: true },
    ],
  },
  organization: {
    name: 'Organizations',
    price: '$29-299',
    period: '/month',
    description: 'For unions, nonprofits & groups',
    icon: 'business' as const,
    features: [
      { text: 'Verified organization badge', included: true },
      { text: 'Member verification via invite codes', included: true },
      { text: 'Unlimited official proposals', included: true },
      { text: 'Full analytics & reporting', included: true },
      { text: 'Team management', included: true },
      { text: 'API access (Professional tier)', included: true },
    ],
  },
};

export default function SubscriptionScreen() {
  const { colors } = useTheme();
  const { user, token } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);

  // Demo account should appear as premium (for App Store review)
  const isDemoAccount = user?.email === 'demo@represent.app';
  const isVerified = isDemoAccount ? true : (user?.verified ?? false);
  const isPremium = isDemoAccount ? true : (subscription?.tier === 'premium' && subscription?.status === 'active');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(`${API_URL}/api/stripe/subscription`, { headers });
      if (response.ok) {
        setSubscription(await response.json());
      }
    } catch (error) {
      console.error('Error fetching subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGetVerified = async () => {
    router.push('/modals/verification-payment');
  };

  const handleSubscribePremium = async () => {
    setActionLoading('premium');
    try {
      const result = await processPremiumPayment(token);

      if (result.success) {
        showPaymentSuccess('premium');
        fetchData();
      } else if (result.cancelled) {
        // User cancelled - do nothing
      } else {
        showPaymentError(result.error || 'Payment failed');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to start checkout');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestorePurchases = async () => {
    setActionLoading('restore');
    try {
      const result = await restorePurchases(token);
      if (result.restored) {
        Alert.alert('Purchases Restored', 'Your previous purchases have been restored successfully.');
        fetchData();
      } else if (result.error) {
        Alert.alert('Error', result.error);
      } else {
        Alert.alert('No Purchases Found', 'No previous purchases were found to restore.');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to restore purchases');
    } finally {
      setActionLoading(null);
    }
  };

  const handleManageBilling = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // iOS subscriptions are managed in Apple's settings, not a web portal.
    // App Review rejects external payment-management URLs for digital subs.
    await Linking.openURL('https://apps.apple.com/account/subscriptions');
  };

  const handleContactOrganizations = () => {
    router.push('/modals/create-organization');
  };

  const getCurrentTier = (): 'free' | 'verified' | 'premium' => {
    if (isPremium) return 'premium';
    if (isVerified) return 'verified';
    return 'free';
  };

  const currentTier = getCurrentTier();

  const renderTierCard = (
    tierKey: 'free' | 'verified' | 'premium' | 'organization',
    delay: number,
    isHighlighted: boolean = false
  ) => {
    const tier = TIERS[tierKey];
    const isCurrent = tierKey === currentTier;
    const isOrgTier = tierKey === 'organization';

    return (
      <Animated.View
        key={tierKey}
        entering={FadeInUp.delay(delay).duration(400)}
        style={[
          styles.tierCard,
          {
            backgroundColor: colors.surface,
            borderColor: isHighlighted ? colors.gold : colors.border,
            borderWidth: isHighlighted ? 2 : 1,
          },
        ]}
      >
        {isHighlighted && (
          <View style={[styles.bestValueBadge, { backgroundColor: colors.gold }]}>
            <Text style={styles.bestValueText}>BEST VALUE</Text>
          </View>
        )}

        <View style={styles.tierHeader}>
          <View style={[
            styles.tierIconContainer,
            { backgroundColor: isHighlighted ? `${colors.gold}20` : `${colors.textSecondary}15` }
          ]}>
            <Ionicons
              name={tier.icon}
              size={24}
              color={isHighlighted ? colors.gold : colors.textSecondary}
            />
          </View>
          <View style={styles.tierInfo}>
            <Text style={[styles.tierName, { color: isHighlighted ? colors.gold : colors.text }]}>
              {tier.name}
            </Text>
            <Text style={[styles.tierDescription, { color: colors.textSecondary }]}>
              {tier.description}
            </Text>
          </View>
        </View>

        <View style={styles.priceContainer}>
          <Text style={[styles.tierPrice, { color: isHighlighted ? colors.gold : colors.text }]}>
            {tier.price}
          </Text>
          <Text style={[styles.tierPeriod, { color: colors.textSecondary }]}>
            {tier.period}
          </Text>
        </View>

        <View style={styles.featuresList}>
          {tier.features.map((feature, index) => (
            <View key={index} style={styles.featureRow}>
              <Ionicons
                name={feature.included ? 'checkmark-circle' : 'close-circle'}
                size={18}
                color={feature.included ? colors.success : colors.textTertiary}
              />
              <Text
                style={[
                  styles.featureText,
                  { color: feature.included ? colors.text : colors.textTertiary },
                ]}
              >
                {feature.text}
              </Text>
            </View>
          ))}
        </View>

        {isCurrent && !isOrgTier && (
          <View style={[styles.currentBadge, { backgroundColor: `${colors.success}15` }]}>
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <Text style={[styles.currentText, { color: colors.success }]}>Current Plan</Text>
          </View>
        )}

        {!isCurrent && !isOrgTier && tierKey !== 'free' && (
          <TouchableOpacity
            onPress={
              tierKey === 'verified'
                ? handleGetVerified
                : tierKey === 'premium'
                ? isPremium
                  ? handleManageBilling
                  : handleSubscribePremium
                : undefined
            }
            disabled={actionLoading !== null}
            style={[
              styles.tierButton,
              isHighlighted && styles.highlightedButton,
            ]}
          >
            {isHighlighted ? (
              <LinearGradient
                colors={[colors.gold, colors.goldDark || '#A68523']}
                style={styles.gradientButton}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {actionLoading === 'premium' ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <>
                    <Ionicons name="star" size={18} color="#000" />
                    <Text style={styles.gradientButtonText}>
                      {isPremium ? 'Manage Billing' : 'Subscribe Now'}
                    </Text>
                  </>
                )}
              </LinearGradient>
            ) : (
              <View
                style={[
                  styles.outlineButton,
                  { borderColor: tierKey === 'verified' ? colors.success : colors.border },
                ]}
              >
                {actionLoading === tierKey ? (
                  <ActivityIndicator size="small" color={colors.success} />
                ) : (
                  <>
                    <Ionicons
                      name={tierKey === 'verified' ? 'shield-checkmark' : 'card-outline'}
                      size={18}
                      color={tierKey === 'verified' ? colors.success : colors.text}
                    />
                    <Text
                      style={[
                        styles.outlineButtonText,
                        { color: tierKey === 'verified' ? colors.success : colors.text },
                      ]}
                    >
                      {tierKey === 'verified' ? 'Get Verified' : 'Subscribe'}
                    </Text>
                  </>
                )}
              </View>
            )}
          </TouchableOpacity>
        )}

        {isOrgTier && (
          <TouchableOpacity onPress={handleContactOrganizations} style={styles.tierButton}>
            <View style={[styles.outlineButton, { borderColor: colors.gold }]}>
              <Ionicons name="arrow-forward" size={18} color={colors.gold} />
              <Text style={[styles.outlineButtonText, { color: colors.gold }]}>
                Get Started
              </Text>
            </View>
          </TouchableOpacity>
        )}
      </Animated.View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border, paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Choose Your Plan</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.gold} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border, paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Choose Your Plan</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(400)} style={styles.heroSection}>
          <Text style={[styles.heroTitle, { color: colors.text }]}>
            Unlock Your Full Voice
          </Text>
          <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
            Choose the plan that fits your civic engagement needs
          </Text>
        </Animated.View>

        {renderTierCard('free', 100)}
        {renderTierCard('verified', 200)}
        {renderTierCard('premium', 300, true)}
        {renderTierCard('organization', 400)}

        {/* Restore Purchases (iOS only) */}
        {Platform.OS === 'ios' && (
          <Animated.View entering={FadeInUp.delay(450).duration(400)}>
            <TouchableOpacity
              onPress={handleRestorePurchases}
              disabled={actionLoading !== null}
              style={styles.restoreButton}
            >
              {actionLoading === 'restore' ? (
                <ActivityIndicator size="small" color={colors.textSecondary} />
              ) : (
                <Text style={[styles.restoreText, { color: colors.textSecondary }]}>
                  Restore Purchases
                </Text>
              )}
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Legal disclosure — required on the purchase screen by Apple
            (Guideline 3.1.2) and good practice on Android. */}
        <Animated.View entering={FadeInUp.delay(475).duration(400)} style={styles.legalFooter}>
          <Text style={[styles.legalFooterText, { color: colors.textTertiary }]}>
            Subscriptions auto-renew until canceled in {Platform.OS === 'ios' ? 'App Store settings' : 'Google Play settings'}. By subscribing you agree to our{' '}
            <Text
              style={[styles.legalLink, { color: colors.text }]}
              onPress={() => Linking.openURL('https://representportal.com/terms')}
            >
              Terms
            </Text>
            {' and '}
            <Text
              style={[styles.legalLink, { color: colors.text }]}
              onPress={() => Linking.openURL('https://representportal.com/privacy')}
            >
              Privacy Policy
            </Text>
            .
          </Text>
        </Animated.View>

        {/* FAQ Section */}
        <Animated.View
          entering={FadeInUp.delay(500).duration(400)}
          style={[styles.faqSection, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Text style={[styles.faqTitle, { color: colors.text }]}>Frequently Asked Questions</Text>

          <View style={styles.faqItem}>
            <Text style={[styles.faqQuestion, { color: colors.text }]}>
              What's the difference between Verified and Premium?
            </Text>
            <Text style={[styles.faqAnswer, { color: colors.textSecondary }]}>
              Verified (free) unlocks geo-restricted voting and proposals. Premium ($7.99/mo) includes verification plus analytics, unlimited proposals, and priority visibility.
            </Text>
          </View>

          <View style={styles.faqItem}>
            <Text style={[styles.faqQuestion, { color: colors.text }]}>
              Can I cancel Premium anytime?
            </Text>
            <Text style={[styles.faqAnswer, { color: colors.textSecondary }]}>
              Yes, cancel anytime with no questions asked. You'll keep Verified status after canceling.
            </Text>
          </View>

          <View style={styles.faqItem}>
            <Text style={[styles.faqQuestion, { color: colors.text }]}>
              What payment methods do you accept?
            </Text>
            <Text style={[styles.faqAnswer, { color: colors.textSecondary }]}>
              On iOS, subscriptions are processed through Apple In-App Purchase. On Android, through Stripe (cards, Apple Pay, Google Pay). All transactions complete inside the app — no redirects to external websites.
            </Text>
          </View>

          <View style={styles.faqItem}>
            <Text style={[styles.faqQuestion, { color: colors.text }]}>
              How does organization verification work?
            </Text>
            <Text style={[styles.faqAnswer, { color: colors.textSecondary }]}>
              Organization members verify via invite codes - no individual KYC needed for internal proposals.
            </Text>
          </View>
        </Animated.View>

        <View style={{ height: 40 }} />
      </ScrollView>
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
    fontFamily: 'Georgia',
    fontSize: 20,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    padding: SPACING.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
    paddingTop: SPACING.md,
  },
  heroTitle: {
    fontFamily: 'Georgia',
    fontSize: responsive(24, 26, 28),
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  heroSubtitle: {
    ...TYPOGRAPHY.bodyMedium,
    textAlign: 'center',
  },
  tierCard: {
    borderRadius: BORDER_RADIUS['2xl'],
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    ...SHADOWS.md,
  },
  bestValueBadge: {
    position: 'absolute',
    top: -12,
    alignSelf: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xxs,
    borderRadius: BORDER_RADIUS.full,
  },
  bestValueText: {
    ...TYPOGRAPHY.labelSmall,
    color: '#000',
    fontWeight: '700',
  },
  tierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  tierIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  tierInfo: {
    flex: 1,
  },
  tierName: {
    fontFamily: 'Georgia',
    fontSize: 18,
    fontWeight: '500',
    marginBottom: 2,
  },
  tierDescription: {
    ...TYPOGRAPHY.bodySmall,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: SPACING.lg,
  },
  tierPrice: {
    fontFamily: 'Georgia',
    fontSize: responsive(28, 32, 36),
    fontWeight: '500',
  },
  tierPeriod: {
    ...TYPOGRAPHY.bodyMedium,
    marginLeft: SPACING.xs,
  },
  featuresList: {
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  featureText: {
    ...TYPOGRAPHY.bodySmall,
    flex: 1,
  },
  currentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
  },
  currentText: {
    ...TYPOGRAPHY.labelMedium,
    fontWeight: '600',
  },
  tierButton: {
    marginTop: SPACING.xs,
  },
  highlightedButton: {},
  gradientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    gap: SPACING.sm,
  },
  gradientButtonText: {
    ...TYPOGRAPHY.labelLarge,
    color: '#000',
    fontWeight: '600',
  },
  outlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1.5,
    gap: SPACING.sm,
  },
  outlineButtonText: {
    ...TYPOGRAPHY.labelMedium,
    fontWeight: '600',
  },
  restoreButton: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
    marginBottom: SPACING.md,
  },
  restoreText: {
    ...TYPOGRAPHY.labelMedium,
    fontWeight: '500',
  },
  legalFooter: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.md,
  },
  legalFooterText: {
    fontSize: 11.5,
    lineHeight: 17,
    textAlign: 'center',
  },
  legalLink: {
    textDecorationLine: 'underline',
    fontWeight: '500',
  },
  faqSection: {
    borderRadius: BORDER_RADIUS['2xl'],
    borderWidth: 1,
    padding: SPACING.lg,
    marginTop: SPACING.md,
  },
  faqTitle: {
    fontFamily: 'Georgia',
    fontSize: 20,
    fontWeight: '500',
    marginBottom: SPACING.lg,
  },
  faqItem: {
    marginBottom: SPACING.lg,
  },
  faqQuestion: {
    ...TYPOGRAPHY.labelMedium,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  faqAnswer: {
    ...TYPOGRAPHY.bodySmall,
    lineHeight: 20,
  },
});
