import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../../lib/theme';

const VERIFICATION_BENEFITS = [
  { icon: 'checkmark-circle', text: 'Vote on all proposals (global + geo-restricted)' },
  { icon: 'location', text: 'Create proposals for your verified region' },
  { icon: 'infinite', text: 'Unlimited voting (no monthly limits)' },
  { icon: 'shield-checkmark', text: 'Verified badge on your profile' },
  { icon: 'gift', text: 'Free verification, lifetime access' },
];

export default function VerificationPaymentScreen() {
  const { colors } = useTheme();

  // UPDATE 24: when navigated from a verify-required org, the route carries
  // originatingOrgId + (optional) originatingOrgName. The screen swaps the
  // self-pay copy for an org-paid banner and threads orgId through to the
  // /modals/veriff session-create call.
  const params = useLocalSearchParams<{ originatingOrgId?: string; originatingOrgName?: string }>();
  const originatingOrgId = typeof params.originatingOrgId === 'string' && params.originatingOrgId.length > 0
    ? params.originatingOrgId : undefined;
  const originatingOrgName = typeof params.originatingOrgName === 'string' && params.originatingOrgName.length > 0
    ? params.originatingOrgName : undefined;
  const isOrgPaid = !!originatingOrgId;

  const handleStartVerification = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.replace({
      pathname: '/modals/veriff',
      params: originatingOrgId ? { originatingOrgId } : {},
    });
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
          <View style={[styles.priceContainer, { backgroundColor: `${colors.success}15` }]}>
            <Text style={[styles.priceAmount, { color: colors.success }]}>
              {isOrgPaid ? 'Covered' : 'Free'}
            </Text>
            <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>
              {isOrgPaid ? `by ${originatingOrgName ?? 'your organization'}` : 'forever'}
            </Text>
          </View>

          <Text style={[styles.heroTitle, { color: colors.text }]}>
            {isOrgPaid ? 'Verify to vote in this organization' : 'Unlock Full Voting Access'}
          </Text>
          <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
            {isOrgPaid
              ? `${originatingOrgName ?? 'Your organization'} requires identity verification before voting. Your verification is covered — no payment needed.`
              : 'Verify your identity once to participate in all proposals in your region.'}
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
            You'll complete identity verification using a government-issued ID.
            Your location will be verified automatically.
          </Text>
        </Animated.View>

        {/* Premium Upsell — hidden in the org-paid flow (the user isn't
            paying, the org is, so the cross-sell would just confuse). */}
        {!isOrgPaid && (
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
        )}

        <View style={{ height: 140 }} />
      </ScrollView>

      {/* Fixed CTA */}
      <View style={[styles.ctaContainer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <TouchableOpacity
          onPress={handleStartVerification}
        >
          <LinearGradient
            colors={[colors.success, '#22A06B']}
            style={styles.ctaButton}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Ionicons name="shield-checkmark" size={20} color="#000" />
            <Text style={styles.ctaButtonText}>Start Verification</Text>
          </LinearGradient>
        </TouchableOpacity>
        <View style={styles.paymentMethodsRow}>
          <Text style={[styles.ctaDisclaimer, { color: colors.textTertiary }]}>
            Quick, secure identity verification
          </Text>
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
    fontFamily: 'Georgia',
    fontSize: 20,
    fontWeight: '500',
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
    fontFamily: 'Georgia',
    fontSize: 36,
    fontWeight: '500',
    textAlign: 'center',
  },
  priceLabel: {
    ...TYPOGRAPHY.labelMedium,
    textAlign: 'center',
    marginTop: SPACING.xxs,
  },
  heroTitle: {
    fontFamily: 'Georgia',
    fontSize: 24,
    fontWeight: '500',
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
    borderRadius: BORDER_RADIUS['2xl'],
    borderWidth: 1,
    marginBottom: SPACING.lg,
    ...SHADOWS.md,
  },
  benefitsTitle: {
    fontFamily: 'Georgia',
    fontSize: 18,
    fontWeight: '500',
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
    borderRadius: BORDER_RADIUS['2xl'],
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
    fontFamily: 'Georgia',
    fontSize: 16,
    fontWeight: '500',
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
