import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../../lib/theme';

const VERIFICATION_BENEFITS = [
  { icon: 'checkmark-circle', text: 'Vote on all proposals (global + geo-restricted)' },
  { icon: 'location', text: 'Create proposals for your verified region' },
  { icon: 'infinite', text: 'Unlimited voting (no monthly limits)' },
  { icon: 'shield-checkmark', text: 'Verified badge on your profile' },
  { icon: 'gift', text: 'Free verification, lifetime access' },
];

const CITIZEN_BENEFITS = [
  { icon: 'shield-checkmark', text: 'Vote on citizens-only proposals (e.g. the Alberta referendum)' },
  { icon: 'checkmark-circle', text: 'Everything standard verification unlocks' },
  { icon: 'document-text', text: 'Passport + proof of address required' },
  { icon: 'gift', text: 'Free, lifetime access' },
];

export default function VerificationPaymentScreen() {
  const { colors } = useTheme();

  // UPDATE 24: when navigated from a verify-required org, the route carries
  // originatingOrgId + (optional) originatingOrgName. The screen swaps the
  // self-pay copy for an org-paid banner and threads orgId through to the
  // /modals/veriff session-create call.
  const params = useLocalSearchParams<{ originatingOrgId?: string; originatingOrgName?: string; flow?: string }>();
  const originatingOrgId = typeof params.originatingOrgId === 'string' && params.originatingOrgId.length > 0
    ? params.originatingOrgId : undefined;
  const originatingOrgName = typeof params.originatingOrgName === 'string' && params.originatingOrgName.length > 0
    ? params.originatingOrgName : undefined;
  const isOrgPaid = !!originatingOrgId;

  // Picker state: if the route carries flow=citizen or an org-paid flag,
  // skip the picker. Otherwise let the user pick standard vs citizen.
  const initialFlow: 'standard' | 'citizen' | null =
    params.flow === 'citizen' ? 'citizen' : isOrgPaid ? 'standard' : null;
  const [chosenFlow, setChosenFlow] = useState<'standard' | 'citizen' | null>(initialFlow);

  const isCitizenFlow = chosenFlow === 'citizen';

  const handleStartVerification = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const veriffParams: Record<string, string> = {};
    if (originatingOrgId) veriffParams.originatingOrgId = originatingOrgId;
    if (isCitizenFlow) veriffParams.flow = 'citizen';
    router.replace({
      pathname: '/modals/veriff',
      params: veriffParams,
    });
  };

  const handleViewPremium = () => {
    router.replace('/modals/subscription');
  };

  // ── Picker view (no preselected flow) ──────────────────────────────
  if (chosenFlow === null) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Verify Identity</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeInDown.duration(400)} style={styles.heroSection}>
            <Text style={[styles.heroTitle, { color: colors.text }]}>Choose verification level</Text>
            <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
              Both are free and take about 2 minutes. Pick the one that matches what you want to vote on.
            </Text>
          </Animated.View>

          {/* Standard card */}
          <Animated.View entering={FadeInUp.delay(100).duration(400)}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => {
                Haptics.selectionAsync();
                setChosenFlow('standard');
              }}
              style={[styles.pickerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={styles.pickerHeader}>
                <View style={[styles.pickerIcon, { backgroundColor: `${colors.success}15` }]}>
                  <Ionicons name="card-outline" size={22} color={colors.success} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.pickerTitle, { color: colors.text }]}>Standard Verification</Text>
                  <Text style={[styles.pickerSubtitle, { color: colors.textSecondary }]}>
                    Driver's license or government ID
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
              </View>
              <Text style={[styles.pickerDesc, { color: colors.textSecondary }]}>
                Unlocks voting on geo-restricted proposals in your country, province, and city. Required for most proposals on the platform.
              </Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Citizen card */}
          <Animated.View entering={FadeInUp.delay(200).duration(400)}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => {
                Haptics.selectionAsync();
                setChosenFlow('citizen');
              }}
              style={[styles.pickerCard, { backgroundColor: colors.surface, borderColor: colors.gold, borderWidth: 1.5 }]}
            >
              <LinearGradient
                colors={[`${colors.gold}10`, 'transparent']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <View style={styles.pickerHeader}>
                <View style={[styles.pickerIcon, { backgroundColor: `${colors.gold}15` }]}>
                  <Ionicons name="shield-checkmark" size={22} color={colors.gold} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, flexWrap: 'wrap' }}>
                    <Text style={[styles.pickerTitle, { color: colors.text }]}>Citizen Verification</Text>
                    <View style={[styles.pickerBadge, { backgroundColor: colors.gold }]}>
                      <Text style={styles.pickerBadgeText}>UNLOCKS MORE</Text>
                    </View>
                  </View>
                  <Text style={[styles.pickerSubtitle, { color: colors.textSecondary }]}>
                    Passport + proof of address
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.gold} />
              </View>
              <Text style={[styles.pickerDesc, { color: colors.textSecondary }]}>
                Everything Standard unlocks, <Text style={{ color: colors.gold, fontWeight: '600' }}>plus citizens-only proposals</Text> like the Alberta separation referendum.
              </Text>
            </TouchableOpacity>
          </Animated.View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    );
  }

  // ── Flow-specific confirmation view ────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => {
            // When the picker was shown and the user already picked, the
            // back button returns to the picker (state reset) rather than
            // closing the modal. When org-paid (picker was skipped), close.
            if (initialFlow === null) {
              setChosenFlow(null);
            } else {
              router.back();
            }
          }}
          style={styles.backButton}
        >
          <Ionicons name={initialFlow === null ? 'arrow-back' : 'close'} size={24} color={colors.text} />
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
            {isCitizenFlow
              ? 'Verify your citizenship'
              : isOrgPaid ? 'Verify to vote in this organization' : 'Unlock Full Voting Access'}
          </Text>
          <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
            {isCitizenFlow
              ? 'Verify with your passport and a proof-of-address document to unlock citizens-only proposals.'
              : isOrgPaid
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

          {(isCitizenFlow ? CITIZEN_BENEFITS : VERIFICATION_BENEFITS).map((benefit, index) => (
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
            {isCitizenFlow
              ? "You'll verify with a passport and a proof-of-address document. This confirms citizenship and your region."
              : "You'll complete identity verification using a government-issued ID. Your location will be verified automatically."}
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
  // Picker cards
  pickerCard: {
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS['2xl'],
    borderWidth: 1,
    marginBottom: SPACING.md,
    overflow: 'hidden',
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.sm,
  },
  pickerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerTitle: {
    fontFamily: 'Georgia',
    fontSize: 18,
    fontWeight: '500',
  },
  pickerSubtitle: {
    ...TYPOGRAPHY.bodySmall,
    marginTop: 2,
  },
  pickerDesc: {
    ...TYPOGRAPHY.bodyMedium,
    lineHeight: 22,
  },
  pickerBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  pickerBadgeText: {
    ...TYPOGRAPHY.labelSmall,
    color: '#000',
    fontWeight: '700',
    fontSize: 9,
  },
});
