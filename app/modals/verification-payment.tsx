import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { useTheme, SPACING, RADIUS, TYPOGRAPHY, FONTS } from '../../lib/theme';

const VERIFICATION_BENEFITS = [
  'Vote on all proposals (global + geo-restricted)',
  'Create proposals for your verified region',
  'Unlimited voting (no monthly limits)',
  'Verified badge on your profile',
  'Free verification, lifetime access',
];

const CITIZEN_BENEFITS = [
  'Vote on citizens-only proposals (e.g. the Alberta referendum)',
  'Everything standard verification unlocks',
  'Free, lifetime access',
];

const STANDARD_REQUIREMENTS: { icon: keyof typeof Ionicons.glyphMap; title: string; sub: string }[] = [
  { icon: 'card-outline', title: 'Government-Issued ID', sub: "Driver's licence, passport, or provincial ID" },
  { icon: 'person-outline', title: 'A Quick Selfie', sub: 'Confirms the ID belongs to you' },
];

const CITIZEN_REQUIREMENTS: { icon: keyof typeof Ionicons.glyphMap; title: string; sub: string }[] = [
  { icon: 'document-text-outline', title: 'Passport', sub: 'Confirms your citizenship' },
  { icon: 'home-outline', title: 'Proof of Address', sub: 'Utility bill or bank statement' },
  { icon: 'person-outline', title: 'A Quick Selfie', sub: 'Confirms the documents belong to you' },
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
        <View style={styles.topRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.circleButton, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
          >
            <Ionicons name="close" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
          <Text style={[styles.stepLabel, { color: colors.textTertiary }]}>VERIFICATION</Text>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeInDown.duration(400)} style={styles.heroSection}>
            <Text style={[styles.heroTitle, { color: colors.text }]}>Choose verification level</Text>
            <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
              Both are free and take about two minutes. Pick the one that matches what you want to vote on.
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
              style={[styles.pickerCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
            >
              <View style={styles.pickerHeader}>
                <View style={[styles.pickerIcon, { backgroundColor: colors.surfaceHighlight }]}>
                  <Ionicons name="card-outline" size={20} color={colors.textSecondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.pickerTitle, { color: colors.text }]}>Standard Verification</Text>
                  <Text style={[styles.pickerSubtitle, { color: colors.textTertiary }]}>
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
              style={[styles.pickerCard, { backgroundColor: colors.surface, borderColor: 'rgba(234,186,88,0.4)', borderWidth: 1.5 }]}
            >
              <LinearGradient
                colors={[colors.goldSurface, 'transparent']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <View style={styles.pickerHeader}>
                <View style={[styles.pickerIcon, { backgroundColor: colors.goldSurface }]}>
                  <Ionicons name="shield-checkmark" size={20} color={colors.gold} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, flexWrap: 'wrap' }}>
                    <Text style={[styles.pickerTitle, { color: colors.text }]}>Citizen Verification</Text>
                    <View style={[styles.pickerBadge, { backgroundColor: colors.goldFill }]}>
                      <Text style={styles.pickerBadgeText}>UNLOCKS MORE</Text>
                    </View>
                  </View>
                  <Text style={[styles.pickerSubtitle, { color: colors.textTertiary }]}>
                    Passport + proof of address
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.gold} />
              </View>
              <Text style={[styles.pickerDesc, { color: colors.textSecondary }]}>
                Everything Standard unlocks, <Text style={{ color: colors.gold, fontFamily: FONTS.sansSemiBold }}>plus citizens-only proposals</Text> like the Alberta separation referendum.
              </Text>
            </TouchableOpacity>
          </Animated.View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    );
  }

  // ── Flow-specific "Why verify" view (03a treatment) ────────────────
  const requirements = isCitizenFlow ? CITIZEN_REQUIREMENTS : STANDARD_REQUIREMENTS;
  const benefits = isCitizenFlow ? CITIZEN_BENEFITS : VERIFICATION_BENEFITS;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top row */}
      <View style={styles.topRow}>
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
          style={[styles.circleButton, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
        >
          <Ionicons name={initialFlow === null ? 'arrow-back' : 'close'} size={18} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={[styles.stepLabel, { color: colors.textTertiary }]}>STEP 1 OF 3</Text>
      </View>

      {/* Progress */}
      <View style={styles.progressRow}>
        <View style={[styles.progressSeg, { backgroundColor: colors.goldFill }]} />
        <View style={[styles.progressSeg, { backgroundColor: colors.surfaceHighlight }]} />
        <View style={[styles.progressSeg, { backgroundColor: colors.surfaceHighlight }]} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.heroSection}>
          <Text style={[styles.heroTitle, { color: colors.text }]}>
            {isCitizenFlow ? 'Verify Your Citizenship' : 'Verify Your Identity'}
          </Text>
          <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
            {isCitizenFlow
              ? 'Every count on Represent is one verified citizen. Citizen verification unlocks citizens-only proposals — confirmed with your passport and a proof-of-address document.'
              : 'Every count on Represent is one verified citizen. Verification is what makes your ballot impossible to fake — and impossible to ignore.'}
          </Text>
          {isOrgPaid && (
            <View style={[styles.orgChip, { backgroundColor: colors.successSurface }]}>
              <Ionicons name="checkmark-circle" size={14} color={colors.success} />
              <Text style={[styles.orgChipText, { color: colors.success }]}>
                Covered by {originatingOrgName ?? 'your organization'} — no payment needed
              </Text>
            </View>
          )}
        </Animated.View>

        {/* What you will need */}
        <Animated.View entering={FadeInUp.delay(100).duration(400)} style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>WHAT YOU WILL NEED</Text>
          {requirements.map((req) => (
            <View
              key={req.title}
              style={[styles.reqCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
            >
              <View style={[styles.reqIcon, { backgroundColor: colors.goldSurface }]}>
                <Ionicons name={req.icon} size={19} color={colors.gold} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.reqTitle, { color: colors.text }]}>{req.title}</Text>
                <Text style={[styles.reqSub, { color: colors.textTertiary }]}>{req.sub}</Text>
              </View>
            </View>
          ))}
        </Animated.View>

        {/* Trust note — copy verbatim */}
        <Animated.View
          entering={FadeInUp.delay(200).duration(400)}
          style={[styles.trustCard, { backgroundColor: colors.goldSurface, borderColor: colors.goldSurfaceStrong }]}
        >
          <Ionicons name="shield-outline" size={18} color={colors.gold} style={{ marginTop: 1 }} />
          <Text style={[styles.trustText, { color: colors.textSecondary }]}>
            <Text style={[styles.trustLead, { color: colors.text }]}>Checked, never kept.</Text>
            {' '}Your documents are verified in about 1.4 seconds, then discarded. Represent stores only the fact that you are verified — never your ID.
          </Text>
        </Animated.View>

        {/* What it unlocks */}
        <Animated.View entering={FadeInUp.delay(300).duration(400)} style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>WHAT IT UNLOCKS</Text>
          <View style={[styles.benefitsCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
            {benefits.map((benefit, index) => (
              <View
                key={benefit}
                style={[
                  styles.benefitRow,
                  index < benefits.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderSubtle },
                ]}
              >
                <Ionicons name="checkmark" size={15} color={colors.gold} />
                <Text style={[styles.benefitText, { color: colors.textSecondary }]}>{benefit}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* Premium Upsell — hidden in the org-paid flow (the user isn't
            paying, the org is, so the cross-sell would just confuse). */}
        {!isOrgPaid && (
          <Animated.View
            entering={FadeInUp.delay(400).duration(400)}
            style={[styles.upsellCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
          >
            <View style={styles.upsellHeader}>
              <Ionicons name="star-outline" size={16} color={colors.textSecondary} />
              <Text style={[styles.upsellTitle, { color: colors.text }]}>Or go Premium</Text>
            </View>
            <Text style={[styles.upsellText, { color: colors.textSecondary }]}>
              Get verification included + unlimited proposals, analytics dashboard, and more for $7.99/month.
            </Text>
            <TouchableOpacity onPress={handleViewPremium} style={styles.upsellLink}>
              <Text style={[styles.upsellLinkText, { color: colors.textSecondary }]}>View Premium</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
            </TouchableOpacity>
          </Animated.View>
        )}

        <View style={{ height: 150 }} />
      </ScrollView>

      {/* Fixed CTA — the screen's single gold moment */}
      <View style={[styles.ctaContainer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <TouchableOpacity
          onPress={handleStartVerification}
          activeOpacity={0.8}
          style={[styles.ctaButton, { backgroundColor: colors.goldFill }]}
        >
          <Text style={styles.ctaButtonText}>Begin Verification</Text>
        </TouchableOpacity>
        <Text style={[styles.ctaDisclaimer, { color: colors.textTertiary }]}>Takes about two minutes</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.screenPadding,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.md,
  },
  circleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLabel: {
    fontFamily: FONTS.mono,
    fontSize: 10.5,
    letterSpacing: 1.7,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: SPACING.screenPadding,
    marginBottom: SPACING.lg,
  },
  progressSeg: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.screenPadding,
  },
  heroSection: {
    gap: 10,
    marginBottom: SPACING.xl,
  },
  heroTitle: {
    fontFamily: FONTS.serif,
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -0.4,
  },
  heroSubtitle: {
    fontFamily: FONTS.sans,
    fontSize: 15,
    lineHeight: 23,
  },
  orgChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.chip,
    marginTop: SPACING.xs,
  },
  orgChipText: {
    ...TYPOGRAPHY.labelSmall,
  },
  section: {
    gap: 10,
    marginBottom: SPACING.lg,
  },
  sectionLabel: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
    letterSpacing: 1.5,
  },
  reqCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  reqIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reqTitle: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 14.5,
  },
  reqSub: {
    fontFamily: FONTS.sans,
    fontSize: 12.5,
  },
  trustCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 16,
    marginBottom: SPACING.lg,
  },
  trustText: {
    flex: 1,
    fontFamily: FONTS.sans,
    fontSize: 13,
    lineHeight: 20,
  },
  trustLead: {
    fontFamily: FONTS.sansSemiBold,
  },
  benefitsCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 4,
    paddingHorizontal: 16,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 11,
  },
  benefitText: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  upsellCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: SPACING.lg,
  },
  upsellHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  upsellTitle: {
    fontFamily: FONTS.serif,
    fontSize: 16,
  },
  upsellText: {
    fontFamily: FONTS.sans,
    fontSize: 12.5,
    lineHeight: 19,
    marginBottom: SPACING.sm,
  },
  upsellLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xxs,
  },
  upsellLinkText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 13,
  },
  ctaContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: SPACING.screenPadding,
    paddingBottom: SPACING.xxxl,
    borderTopWidth: 1,
    gap: 10,
  },
  ctaButton: {
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaButtonText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 17,
    color: '#040707',
  },
  ctaDisclaimer: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    textAlign: 'center',
  },
  // Picker cards
  pickerCard: {
    padding: SPACING.lg,
    borderRadius: RADIUS.card,
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
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerTitle: {
    fontFamily: FONTS.serif,
    fontSize: 18,
  },
  pickerSubtitle: {
    fontFamily: FONTS.sans,
    fontSize: 12.5,
    marginTop: 2,
  },
  pickerDesc: {
    fontFamily: FONTS.sans,
    fontSize: 13.5,
    lineHeight: 20,
  },
  pickerBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.badge,
  },
  pickerBadgeText: {
    ...TYPOGRAPHY.labelSmall,
    color: '#040707',
    fontSize: 9,
  },
});
