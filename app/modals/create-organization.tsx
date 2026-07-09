// CREATE ORGANIZATION — a 3-step founding (design7 mocks CO1–CO3).
//
// CO1 · IDENTITY: name (live counter, gold focus ring), purpose, monogram
//       tile that doubles as the existing logo picker.
// CO2 · MEMBERSHIP: "Who can join?" — member capacity by plan. The mock's
//       admission models (invite / roster / region) and governance toggles
//       have no backing API fields, so the step maps to the existing tier
//       selection: caps, verification unlocks, and invite codes are what the
//       plans actually control.
// CO3 · CHARTER REVIEW: the founding record re-stated as a charter card with
//       mono facts, billing stated before the one gold action, then the
//       existing create-org + payment flow (unchanged).
//
// All pre-existing logic is preserved verbatim: field validation, logo
// upload, tier selection, government mailto, free-tier shortcut semantics
// (free skips payment processing inside handleCreateOrganization), org
// creation API call, IAP/Stripe payment, demo-account bypass, error handling.

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Linking,
} from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../lib/auth';
import { organizationsApi, uploadsApi } from '../../lib/api';
import { useTheme, SPACING, FONTS } from '../../lib/theme';
import { showPaymentError, showPaymentSuccess } from '../../lib/stripe';
import { processOrganizationPayment } from '../../lib/payment';
import { ORG_TIERS, type OrgTier } from '../../lib/org-tiers';
import { SubscriptionLegal } from '../../components/ui/SubscriptionLegal';
import { TierCard } from '../../components/ui/TierCard';

// 1 = identity · 2 = membership (plan) · 3 = charter review
type Step = 1 | 2 | 3;

// Monogram from the org name — first character of the first two words
// ("Ward 8 Community League" → "W8"). No logo needed to found.
function monogramFromName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export default function CreateOrganizationScreen() {
  const { colors, isDark } = useTheme();
  const { token, user } = useAuthStore();
  const insets = useSafeAreaInsets();

  // Step state
  const [currentStep, setCurrentStep] = useState<Step>(1);

  // Details form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  // Which field is focused — drives the gold active-field border.
  const [focusField, setFocusField] = useState<'name' | 'purpose' | null>(null);

  // Tier selection state
  const [selectedTier, setSelectedTier] = useState<OrgTier>('free');

  // Payment state
  const [processing, setProcessing] = useState(false);

  const handlePickLogo = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Please allow access to your photo library to upload a logo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setUploadingLogo(true);
      try {
        // Upload the image
        const asset = result.assets[0];
        const uploadResult = await uploadsApi.uploadImage({
          uri: asset.uri,
          name: asset.fileName || `logo-${Date.now()}.jpg`,
          type: asset.mimeType || 'image/jpeg',
        });
        if (uploadResult) {
          setLogoUri(uploadResult);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          throw new Error('Upload failed');
        }
      } catch (error: any) {
        Alert.alert('Upload Failed', error.message || 'Failed to upload logo. Please try again.');
      } finally {
        setUploadingLogo(false);
      }
    }
  };

  const handleNextStep = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (currentStep === 1) {
      if (!name.trim()) {
        Alert.alert('Missing Information', 'Please enter your organization name.');
        return;
      }
      if (!description.trim()) {
        Alert.alert('Missing Information', 'Please enter a description for your organization.');
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      // Government tier opens email instead of payment.
      if (selectedTier === 'government') {
        const subject = encodeURIComponent(`Government Inquiry: ${name.trim()}`);
        const body = encodeURIComponent(`Hi,\n\nI'm interested in the Government plan for my organization "${name.trim()}".\n\nPlease contact me to discuss pricing and features.\n\nThank you`);
        Linking.openURL(`mailto:sales@representvote.com?subject=${subject}&body=${body}`);
        return;
      }
      // Every plan (free included) reviews the charter before founding.
      setCurrentStep(3);
    }
  };

  const handlePreviousStep = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (currentStep === 2) {
      setCurrentStep(1);
    } else if (currentStep === 3) {
      setCurrentStep(2);
    }
  };

  const handleCreateOrganization = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setProcessing(true);

    // Demo account bypasses payment (for App Store review)
    const isDemoAccount = user?.email === 'demo@represent.app';

    try {
      // STEP 1: Create org first (with pending subscription status)
      const createResult = await organizationsApi.createOrganization({
        name: name.trim(),
        description: description.trim(),
        logoUrl: logoUri || undefined,
        type: selectedTier,
      });

      const organizationId = createResult.data?.id;

      // Demo account: check for ID first, ignore errors if we have an org
      if (isDemoAccount) {
        if (organizationId) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert(
            'Organization Created!',
            `${name} has been created successfully. You are now the admin.`,
            [
              {
                text: 'View Organization',
                onPress: () => {
                  router.replace({
                    pathname: '/modals/organization-detail',
                    params: { orgId: organizationId, orgName: name, orgRole: 'admin' },
                  });
                },
              },
            ]
          );
          return;
        }
        // Only show error if we truly have no org ID
        Alert.alert('Error', 'Failed to create organization');
        return;
      }

      // Non-demo accounts: check for errors
      if (createResult.error || !organizationId) {
        Alert.alert('Error', createResult.error || 'Failed to create organization');
        return;
      }

      // STEP 2: Process payment (IAP on iOS, Stripe on Android)
      const result = await processOrganizationPayment(token, selectedTier, organizationId);

      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        showPaymentSuccess('organization', {
          amount: ORG_TIERS[selectedTier].price + '/mo',
          organizationName: name,
          tier: ORG_TIERS[selectedTier].name,
        });
        // Receipt modal will handle navigation
      } else if (result.cancelled) {
        Alert.alert(
          'Payment Cancelled',
          'Your organization has been created but is pending payment. You can complete payment later from your organizations list.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } else {
        showPaymentError(result.error || 'Payment failed');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create organization. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const tier = ORG_TIERS[selectedTier];
  const monogram = monogramFromName(name);
  const founderName = user?.name?.trim() || '';
  const founderVerified = !!user?.verified;

  // ── CO1 · Identity ─────────────────────────────────────────────────────────
  const renderIdentityStep = () => (
    <Animated.View entering={FadeIn.duration(300)} style={styles.stepContent}>
      <View style={styles.headBlock}>
        <Text style={[styles.headline, { color: colors.text }]}>Found an Organization</Text>
        <Text style={[styles.subhead, { color: colors.textSecondary }]}>
          Verified governance for a group you lead — a union, league, board, or association.
        </Text>
      </View>

      {/* Monogram / logo tile — same upload logic, no logo needed to found */}
      <View style={styles.monogramRow}>
        <TouchableOpacity
          style={[
            styles.monogramTile,
            {
              backgroundColor: colors.surfaceHighlight,
              borderColor: colors.borderStrong,
              borderStyle: logoUri ? 'solid' : 'dashed',
            },
          ]}
          onPress={handlePickLogo}
          disabled={uploadingLogo}
          accessibilityRole="button"
          accessibilityLabel="Add a logo"
        >
          {uploadingLogo ? (
            <ActivityIndicator size="small" color={colors.gold} />
          ) : logoUri ? (
            <Image source={{ uri: logoUri }} style={styles.monogramImage} />
          ) : monogram ? (
            <Text style={[styles.monogramText, { color: colors.textSecondary }]}>{monogram}</Text>
          ) : (
            <Ionicons name="business-outline" size={22} color={colors.textTertiary} />
          )}
        </TouchableOpacity>
        <View style={styles.monogramCopy}>
          <Text style={[styles.monogramTitle, { color: colors.text }]}>
            {logoUri ? 'Logo added' : 'Monogram from your name'}
          </Text>
          <Text style={[styles.monogramSub, { color: colors.textTertiary }]}>
            {logoUri ? 'Tap to change it anytime' : 'Add a logo anytime — no logo needed to found'}
          </Text>
        </View>
      </View>

      {/* Organization name */}
      <View style={styles.fieldBlock}>
        <View style={styles.fieldHeadRow}>
          <Text style={[styles.fieldLabel, { color: colors.textTertiary }]}>ORGANIZATION NAME</Text>
          <Text style={[styles.fieldCount, { color: colors.textTertiary }]}>{name.length} / 60</Text>
        </View>
        <View
          style={[
            styles.inputCard,
            {
              backgroundColor: colors.surface,
              borderColor: focusField === 'name' ? 'rgba(234, 186, 88, 0.4)' : colors.border,
            },
          ]}
        >
          <TextInput
            style={[styles.nameInput, { color: colors.text }]}
            placeholder="e.g., Local Teachers Union"
            placeholderTextColor={colors.textTertiary}
            value={name}
            onChangeText={setName}
            onFocus={() => setFocusField('name')}
            onBlur={() => setFocusField(null)}
            maxLength={60}
          />
        </View>
      </View>

      {/* Purpose */}
      <View style={styles.fieldBlock}>
        <View style={styles.fieldHeadRow}>
          <Text style={[styles.fieldLabel, { color: colors.textTertiary }]}>
            PURPOSE <Text style={styles.fieldLabelSoft}>· shown to every member</Text>
          </Text>
          <Text style={[styles.fieldCount, { color: colors.textTertiary }]}>{description.length} / 500</Text>
        </View>
        <View
          style={[
            styles.inputCard,
            {
              backgroundColor: colors.surface,
              borderColor: focusField === 'purpose' ? 'rgba(234, 186, 88, 0.4)' : colors.border,
            },
          ]}
        >
          <TextInput
            style={[styles.purposeInput, { color: colors.text }]}
            placeholder="Describe your organization's mission and purpose..."
            placeholderTextColor={colors.textTertiary}
            value={description}
            onChangeText={setDescription}
            onFocus={() => setFocusField('purpose')}
            onBlur={() => setFocusField(null)}
            multiline
            textAlignVertical="top"
            maxLength={500}
          />
        </View>
      </View>
    </Animated.View>
  );

  // ── CO2 · Membership (plan) ────────────────────────────────────────────────
  const renderMembershipStep = () => (
    <Animated.View entering={FadeIn.duration(300)} style={styles.stepContent}>
      <View style={styles.headBlock}>
        <Text style={[styles.headline, { color: colors.text }]}>Who can join?</Text>
        <Text style={[styles.subhead, { color: colors.textSecondary }]}>
          Every member verifies their own identity — pick the plan that fits your membership.
        </Text>
      </View>

      {/* Hide Government tier from the public picker — it's set by sales
          via direct DB update for cities, counties, and agencies. The
          "Need more?" link below opens a sales email. */}
      {(Object.entries(ORG_TIERS) as [OrgTier, typeof ORG_TIERS.free][])
        .filter(([key]) => key !== 'government')
        .map(([key, t]) => (
          <TierCard
            key={key}
            tierKey={key}
            tier={t}
            selected={selectedTier === key}
            onSelect={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelectedTier(key);
            }}
          />
        ))}

      <TouchableOpacity
        onPress={() => {
          const subject = encodeURIComponent(`Government / Agency inquiry`);
          Linking.openURL(`mailto:sales@representvote.com?subject=${subject}`);
        }}
        style={styles.salesLink}
        accessibilityRole="button"
        accessibilityLabel="Contact sales"
      >
        <Text style={[styles.salesLinkText, { color: colors.gold }]}>
          Need more than Business? Contact sales →
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );

  // ── CO3 · Charter review ───────────────────────────────────────────────────
  const renderCharterStep = () => (
    <Animated.View entering={FadeIn.duration(300)} style={styles.stepContent}>
      <View style={styles.headBlock}>
        <Text style={[styles.headline, { color: colors.text }]}>The charter.</Text>
        <Text style={[styles.subhead, { color: colors.textSecondary }]}>
          Your organization's founding record, exactly as members will see it.
        </Text>
      </View>

      {/* Founding charter card */}
      <LinearGradient
        colors={
          isDark
            ? [colors.surface, colors.backgroundElevated, colors.background]
            : [colors.surfaceElevated, colors.surface, colors.surface]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 0.6, y: 1 }}
        style={[styles.charterCard, { borderColor: 'rgba(234, 186, 88, 0.4)' }]}
      >
        <View style={styles.charterHeadRow}>
          <Text style={[styles.charterKicker, { color: colors.gold }]}>FOUNDING CHARTER</Text>
          <View style={[styles.charterTile, { backgroundColor: colors.surfaceHighlight }]}>
            {logoUri ? (
              <Image source={{ uri: logoUri }} style={styles.charterTileImage} />
            ) : (
              <Text style={[styles.charterTileText, { color: colors.text }]}>{monogram || '—'}</Text>
            )}
          </View>
        </View>

        <View style={styles.charterNameBlock}>
          <Text style={[styles.charterName, { color: colors.text }]}>{name.trim()}</Text>
          <Text style={[styles.charterPurpose, { color: colors.textSecondary }]} numberOfLines={3}>
            {description.trim()}
          </Text>
        </View>

        <View style={[styles.charterHairline, { backgroundColor: colors.borderSubtle }]} />

        <View style={styles.charterFacts}>
          <View style={styles.charterFactRow}>
            <Text style={[styles.charterFactLabel, { color: colors.textTertiary }]}>PLAN</Text>
            <Text style={[styles.charterFactValue, { color: colors.text }]}>
              {tier.name.toUpperCase()}
            </Text>
          </View>
          <View style={styles.charterFactRow}>
            <Text style={[styles.charterFactLabel, { color: colors.textTertiary }]}>SEATS</Text>
            <Text style={[styles.charterFactValue, { color: colors.text }]}>
              {tier.features[0].toUpperCase()}
            </Text>
          </View>
          <View style={styles.charterFactRow}>
            <Text style={[styles.charterFactLabel, { color: colors.textTertiary }]}>BILLING</Text>
            <Text style={[styles.charterFactValue, { color: colors.text }]}>
              {selectedTier === 'free' ? 'FREE' : `${tier.price}/MO`}
            </Text>
          </View>
          {!!founderName && (
            <View style={styles.charterFactRow}>
              <Text style={[styles.charterFactLabel, { color: colors.textTertiary }]}>FOUNDER</Text>
              <View style={styles.charterFounderValue}>
                <Text style={[styles.charterFactValue, { color: colors.text }]} numberOfLines={1}>
                  {founderName.toUpperCase()}
                </Text>
                {founderVerified && <Ionicons name="shield-checkmark" size={11} color={colors.gold} />}
              </View>
            </View>
          )}
        </View>
      </LinearGradient>

      {/* Billing stated before the gold action — no invented trials */}
      <View
        style={[
          styles.billingCard,
          { backgroundColor: colors.backgroundSecondary, borderColor: colors.borderSubtle },
        ]}
      >
        <Text style={[styles.billingKicker, { color: colors.textTertiary }]}>
          {selectedTier === 'free' ? 'FREE PLAN' : 'BILLED MONTHLY · CANCEL ANYTIME'}
        </Text>
        <View style={styles.billingRow}>
          <Text style={[styles.billingName, { color: colors.text }]}>
            {tier.name} plan · {tier.features[0].toLowerCase()}
          </Text>
          <Text style={[styles.billingPrice, { color: colors.text }]}>
            {tier.price}
            {selectedTier !== 'free' && (
              <Text style={[styles.billingPeriod, { color: colors.textTertiary }]}>/mo</Text>
            )}
          </Text>
        </View>
        <Text style={[styles.billingSub, { color: colors.textTertiary }]}>
          {selectedTier === 'free'
            ? 'No charge. Upgrade anytime from your organization settings.'
            : `You'll be charged ${tier.price}/month. Cancel anytime from your organization settings.`}
        </Text>
      </View>

      {/* Apple Guideline 3.1.2(c) — subscription disclosure (paid plans) */}
      {selectedTier !== 'free' && (
        <SubscriptionLegal
          mode="subscription"
          productTitle={`${tier.name} — Organization plan`}
          productLength="1 month"
          productPrice={`${tier.price}/month`}
        />
      )}
    </Animated.View>
  );

  // Footer copy per step
  const ctaLabel =
    currentStep === 1
      ? 'Continue'
      : currentStep === 2
      ? selectedTier === 'government'
        ? 'Contact Us'
        : 'Continue'
      : selectedTier === 'free'
      ? 'Found This Organization'
      : `Found This Organization · ${tier.price}/mo`;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Step chrome — 40px circular close/back, STEP X OF 3 mono label,
          3-segment progress bar (same pattern as onboarding). */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => {
            if (currentStep === 1) {
              router.back();
            } else {
              handlePreviousStep();
            }
          }}
          style={[styles.circleBtn, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
          disabled={processing}
          accessibilityRole="button"
          accessibilityLabel={currentStep === 1 ? 'Close' : 'Back'}
        >
          <Ionicons
            name={currentStep === 1 ? 'close' : 'chevron-back'}
            size={currentStep === 1 ? 18 : 20}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
        <Text style={[styles.stepLabel, { color: colors.textTertiary }]}>STEP {currentStep} OF 3</Text>
      </View>
      <View style={styles.progressRow}>
        {[1, 2, 3].map((seg) => (
          <View
            key={seg}
            style={[
              styles.progressSeg,
              { backgroundColor: currentStep >= seg ? colors.goldFill : colors.surfaceHighlight },
            ]}
          />
        ))}
      </View>

      {/* Content */}
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {currentStep === 1 && renderIdentityStep()}
          {currentStep === 2 && renderMembershipStep()}
          {currentStep === 3 && renderCharterStep()}
        </ScrollView>

        {/* Pinned footer — one gold CTA per screen */}
        <View
          style={[
            styles.footer,
            {
              backgroundColor: colors.background,
              borderTopColor: colors.borderSubtle,
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          <TouchableOpacity
            style={[styles.ctaBtn, { backgroundColor: colors.goldFill }, processing && styles.ctaDisabled]}
            onPress={currentStep === 3 ? handleCreateOrganization : handleNextStep}
            disabled={processing}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={ctaLabel}
          >
            {processing ? (
              <ActivityIndicator size="small" color="#040707" />
            ) : (
              <Text style={styles.ctaText} numberOfLines={1}>
                {ctaLabel}
              </Text>
            )}
          </TouchableOpacity>

          {currentStep === 1 && !!founderName ? (
            <View style={styles.founderRow}>
              {founderVerified && <Ionicons name="shield-checkmark" size={11} color={colors.gold} />}
              <Text style={[styles.footerNote, { color: colors.textTertiary }]} numberOfLines={1}>
                Founded by <Text style={[styles.footerNoteStrong, { color: colors.textSecondary }]}>{founderName}</Text>
                {founderVerified ? ' — verified founders only' : ''}
              </Text>
            </View>
          ) : (
            <Text style={[styles.footerNote, { color: colors.textTertiary }]}>
              {currentStep === 2
                ? 'You can change plans later from organization settings'
                : currentStep === 3
                ? 'Your name is attached to the founding record'
                : 'Verified governance for the group you lead'}
            </Text>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // ── Step chrome ──
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.screenPadding,
    paddingTop: 14,
  },
  circleBtn: {
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
    letterSpacing: 1.68, // .16em
    fontVariant: ['tabular-nums'],
  },
  progressRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: SPACING.screenPadding,
    paddingTop: 12,
  },
  progressSeg: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  keyboardAvoid: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: SPACING.screenPadding,
    paddingTop: 16,
    paddingBottom: 24,
  },
  stepContent: {
    gap: 16,
  },
  headBlock: {
    gap: 6,
  },
  headline: {
    fontFamily: FONTS.serif,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.36,
  },
  subhead: {
    fontFamily: FONTS.sans,
    fontSize: 13.5,
    lineHeight: 20,
  },

  // ── CO1 · monogram / logo tile ──
  monogramRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  monogramTile: {
    width: 64,
    height: 64,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  monogramImage: {
    width: '100%',
    height: '100%',
  },
  monogramText: {
    fontFamily: FONTS.serifSemiBold,
    fontSize: 22,
  },
  monogramCopy: {
    flex: 1,
    gap: 3,
  },
  monogramTitle: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 13,
  },
  monogramSub: {
    fontFamily: FONTS.sans,
    fontSize: 11.5,
    lineHeight: 15,
  },

  // ── CO1 · fields ──
  fieldBlock: {
    gap: 7,
  },
  fieldHeadRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  fieldLabel: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10.5,
    letterSpacing: 1.47, // .14em
  },
  fieldLabelSoft: {
    fontFamily: FONTS.sans,
    letterSpacing: 0,
  },
  fieldCount: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    fontVariant: ['tabular-nums'],
  },
  inputCard: {
    borderWidth: 1.5,
    borderRadius: 15,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  nameInput: {
    fontFamily: FONTS.sansMedium,
    fontSize: 17,
    padding: 0,
  },
  purposeInput: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    lineHeight: 19,
    padding: 0,
    minHeight: 96,
  },

  // ── CO2 · sales link ──
  salesLink: {
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  salesLinkText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 13,
  },

  // ── CO3 · charter card ──
  charterCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 22,
    gap: 15,
  },
  charterHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  charterKicker: {
    fontFamily: FONTS.monoSemiBold,
    fontSize: 9.5,
    letterSpacing: 1.9, // .2em
    fontVariant: ['tabular-nums'],
  },
  charterTile: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  charterTileImage: {
    width: '100%',
    height: '100%',
  },
  charterTileText: {
    fontFamily: FONTS.serifSemiBold,
    fontSize: 14,
  },
  charterNameBlock: {
    gap: 3,
  },
  charterName: {
    fontFamily: FONTS.serif,
    fontSize: 23,
    lineHeight: 26.5,
  },
  charterPurpose: {
    fontFamily: FONTS.sans,
    fontSize: 12.5,
    lineHeight: 19,
  },
  charterHairline: {
    height: 1,
  },
  charterFacts: {
    gap: 9,
  },
  charterFactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  charterFactLabel: {
    fontFamily: FONTS.mono,
    fontSize: 10.5,
    letterSpacing: 0.4,
    fontVariant: ['tabular-nums'],
  },
  charterFactValue: {
    fontFamily: FONTS.mono,
    fontSize: 10.5,
    letterSpacing: 0.4,
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
    textAlign: 'right',
  },
  charterFounderValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 1,
  },

  // ── CO3 · billing card ──
  billingCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 17,
    paddingVertical: 14,
    gap: 8,
  },
  billingKicker: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    letterSpacing: 1.4, // .14em
  },
  billingRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  billingName: {
    fontFamily: FONTS.sansMedium,
    fontSize: 14,
    flexShrink: 1,
  },
  billingPrice: {
    fontFamily: FONTS.monoSemiBold,
    fontSize: 16,
    fontVariant: ['tabular-nums'],
  },
  billingPeriod: {
    fontFamily: FONTS.sans,
    fontSize: 11,
  },
  billingSub: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    lineHeight: 16,
  },

  // ── Footer ──
  footer: {
    paddingHorizontal: SPACING.screenPadding,
    paddingTop: 12,
    gap: 9,
    borderTopWidth: 1,
  },
  ctaBtn: {
    height: 54,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  ctaDisabled: {
    opacity: 0.6,
  },
  ctaText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 16,
    color: '#040707',
  },
  founderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  footerNote: {
    fontFamily: FONTS.sans,
    fontSize: 11.5,
    textAlign: 'center',
  },
  footerNoteStrong: {
    fontFamily: FONTS.sansSemiBold,
  },
});
