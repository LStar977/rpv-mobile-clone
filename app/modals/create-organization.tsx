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
} from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInDown, FadeInUp, FadeOut } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../../lib/auth';
import { organizationsApi, uploadsApi } from '../../lib/api';
import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../../lib/theme';
import {
  fetchOrganizationPaymentIntent,
  processPayment,
  showPaymentError,
} from '../../lib/stripe';

type Step = 'details' | 'tier' | 'payment';

type OrgTier = 'community' | 'professional' | 'enterprise';

const ORG_TIERS: Record<OrgTier, {
  name: string;
  price: string;
  priceValue: number;
  description: string;
  features: string[];
  icon: keyof typeof Ionicons.glyphMap;
  popular?: boolean;
}> = {
  community: {
    name: 'Community',
    price: '$29',
    priceValue: 29,
    description: 'Perfect for small groups and local organizations',
    icon: 'people-outline',
    features: [
      'Up to 50 members',
      'Internal proposals & voting',
      'Basic announcements',
      'Invite code management',
      'Community support',
    ],
  },
  professional: {
    name: 'Professional',
    price: '$49',
    priceValue: 49,
    description: 'For growing organizations with advanced needs',
    icon: 'business-outline',
    popular: true,
    features: [
      'Up to 500 members',
      'Everything in Community',
      'Advanced analytics',
      'Custom branding',
      'Priority support',
      'API access',
    ],
  },
  enterprise: {
    name: 'Enterprise',
    price: '$99',
    priceValue: 99,
    description: 'For large organizations and institutions',
    icon: 'globe-outline',
    features: [
      'Unlimited members',
      'Everything in Professional',
      'Dedicated account manager',
      'Custom integrations',
      'SLA guarantees',
      'White-label options',
    ],
  },
};

// Step Indicator Component
function StepIndicator({ currentStep }: { currentStep: Step }) {
  const { colors } = useTheme();
  const steps: { key: Step; label: string }[] = [
    { key: 'details', label: 'Details' },
    { key: 'tier', label: 'Plan' },
    { key: 'payment', label: 'Payment' },
  ];

  const currentIndex = steps.findIndex(s => s.key === currentStep);

  return (
    <View style={styles.stepIndicator}>
      {steps.map((step, index) => {
        const isActive = index === currentIndex;
        const isCompleted = index < currentIndex;

        return (
          <View key={step.key} style={styles.stepItem}>
            <View
              style={[
                styles.stepCircle,
                {
                  backgroundColor: isActive || isCompleted ? colors.gold : colors.surfaceHighlight,
                  borderColor: isActive ? colors.gold : 'transparent',
                },
              ]}
            >
              {isCompleted ? (
                <Ionicons name="checkmark" size={14} color="#000" />
              ) : (
                <Text style={[styles.stepNumber, { color: isActive ? '#000' : colors.textTertiary }]}>
                  {index + 1}
                </Text>
              )}
            </View>
            <Text
              style={[
                styles.stepLabel,
                { color: isActive ? colors.gold : colors.textSecondary },
              ]}
            >
              {step.label}
            </Text>
            {index < steps.length - 1 && (
              <View
                style={[
                  styles.stepLine,
                  { backgroundColor: isCompleted ? colors.gold : colors.border },
                ]}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}

// Tier Card Component
function TierCard({
  tier,
  tierKey,
  selected,
  onSelect,
}: {
  tier: typeof ORG_TIERS.community;
  tierKey: OrgTier;
  selected: boolean;
  onSelect: () => void;
}) {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      style={[
        styles.tierCard,
        {
          backgroundColor: colors.surface,
          borderColor: selected ? colors.gold : colors.border,
          borderWidth: selected ? 2 : 1,
        },
      ]}
      onPress={onSelect}
      activeOpacity={0.8}
    >
      {tier.popular && (
        <View style={[styles.popularBadge, { backgroundColor: colors.gold }]}>
          <Text style={styles.popularText}>MOST POPULAR</Text>
        </View>
      )}

      <View style={styles.tierHeader}>
        <View style={[styles.tierIcon, { backgroundColor: `${colors.gold}15` }]}>
          <Ionicons name={tier.icon} size={24} color={colors.gold} />
        </View>
        <View style={styles.tierInfo}>
          <Text style={[styles.tierName, { color: colors.text }]}>{tier.name}</Text>
          <View style={styles.tierPriceRow}>
            <Text style={[styles.tierPrice, { color: colors.gold }]}>{tier.price}</Text>
            <Text style={[styles.tierPeriod, { color: colors.textSecondary }]}>/month</Text>
          </View>
        </View>
        <View
          style={[
            styles.radioOuter,
            { borderColor: selected ? colors.gold : colors.border },
          ]}
        >
          {selected && <View style={[styles.radioInner, { backgroundColor: colors.gold }]} />}
        </View>
      </View>

      <Text style={[styles.tierDescription, { color: colors.textSecondary }]}>
        {tier.description}
      </Text>

      <View style={styles.tierFeatures}>
        {tier.features.map((feature, index) => (
          <View key={index} style={styles.featureRow}>
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <Text style={[styles.featureText, { color: colors.text }]}>{feature}</Text>
          </View>
        ))}
      </View>
    </TouchableOpacity>
  );
}

export default function CreateOrganizationScreen() {
  const { colors } = useTheme();
  const { token, user } = useAuthStore();

  // Step state
  const [currentStep, setCurrentStep] = useState<Step>('details');

  // Details form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Tier selection state
  const [selectedTier, setSelectedTier] = useState<OrgTier>('professional');

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

    if (currentStep === 'details') {
      if (!name.trim()) {
        Alert.alert('Missing Information', 'Please enter your organization name.');
        return;
      }
      if (!description.trim()) {
        Alert.alert('Missing Information', 'Please enter a description for your organization.');
        return;
      }
      setCurrentStep('tier');
    } else if (currentStep === 'tier') {
      setCurrentStep('payment');
    }
  };

  const handlePreviousStep = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (currentStep === 'tier') {
      setCurrentStep('details');
    } else if (currentStep === 'payment') {
      setCurrentStep('tier');
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

      if (createResult.error || !createResult.data?.organization?.id) {
        Alert.alert('Error', createResult.error || 'Failed to create organization');
        return;
      }

      const organizationId = createResult.data.organization.id;

      // Demo account: skip payment and show success immediately
      if (isDemoAccount) {
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
                  params: { orgId: organizationId, orgName: name },
                });
              },
            },
          ]
        );
        return;
      }

      // STEP 2: Get payment intent with org ID
      const paymentIntent = await fetchOrganizationPaymentIntent(
        token,
        selectedTier,
        organizationId
      );

      if (paymentIntent.clientSecret) {
        // STEP 3: Process payment with native Payment Sheet
        const result = await processPayment({
          clientSecret: paymentIntent.clientSecret,
          ephemeralKey: paymentIntent.ephemeralKey,
          customerId: paymentIntent.customerId,
          merchantDisplayName: 'Represent Wallet',
        });

        if (result.success) {
          // STEP 4: Payment successful - webhook will activate subscription
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
                    params: { orgId: organizationId, orgName: name },
                  });
                },
              },
            ]
          );
        } else if (result.cancelled) {
          // User cancelled - org exists but subscription is pending
          Alert.alert(
            'Payment Cancelled',
            'Your organization has been created but is pending payment. You can complete payment later from your organizations list.',
            [{ text: 'OK', onPress: () => router.back() }]
          );
        } else {
          showPaymentError(result.error || 'Payment failed');
        }
      } else if (paymentIntent.url) {
        // Fallback to web checkout
        Alert.alert(
          'Web Checkout',
          'You will be redirected to complete payment in your browser.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Continue',
              onPress: async () => {
                const { Linking } = await import('react-native');
                await Linking.openURL(paymentIntent.url!);
              },
            },
          ]
        );
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create organization. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const renderDetailsStep = () => (
    <Animated.View entering={FadeIn.duration(300)} style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: colors.text }]}>Organization Details</Text>
      <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
        Tell us about your organization
      </Text>

      {/* Logo Picker */}
      <TouchableOpacity
        style={[styles.logoPicker, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={handlePickLogo}
        disabled={uploadingLogo}
      >
        {uploadingLogo ? (
          <ActivityIndicator size="large" color={colors.gold} />
        ) : logoUri ? (
          <Image source={{ uri: logoUri }} style={styles.logoPreview} />
        ) : (
          <>
            <View style={[styles.logoPlaceholder, { backgroundColor: `${colors.gold}15` }]}>
              <Ionicons name="camera-outline" size={32} color={colors.gold} />
            </View>
            <Text style={[styles.logoHint, { color: colors.textSecondary }]}>
              Tap to upload logo (optional)
            </Text>
          </>
        )}
        {logoUri && (
          <View style={[styles.logoEditBadge, { backgroundColor: colors.gold }]}>
            <Ionicons name="pencil" size={12} color="#000" />
          </View>
        )}
      </TouchableOpacity>

      {/* Name Input */}
      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Organization Name *</Text>
        <TextInput
          style={[styles.textInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
          placeholder="e.g., Local Teachers Union"
          placeholderTextColor={colors.textTertiary}
          value={name}
          onChangeText={setName}
          maxLength={60}
        />
        <Text style={[styles.charCount, { color: colors.textTertiary }]}>{name.length}/60</Text>
      </View>

      {/* Description Input */}
      <View style={styles.inputGroup}>
        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Description *</Text>
        <TextInput
          style={[styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
          placeholder="Describe your organization's mission and purpose..."
          placeholderTextColor={colors.textTertiary}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          maxLength={500}
        />
        <Text style={[styles.charCount, { color: colors.textTertiary }]}>{description.length}/500</Text>
      </View>
    </Animated.View>
  );

  const renderTierStep = () => (
    <Animated.View entering={FadeIn.duration(300)} style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: colors.text }]}>Choose Your Plan</Text>
      <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
        Select the plan that fits your organization's needs
      </Text>

      {(Object.entries(ORG_TIERS) as [OrgTier, typeof ORG_TIERS.community][]).map(([key, tier]) => (
        <TierCard
          key={key}
          tierKey={key}
          tier={tier}
          selected={selectedTier === key}
          onSelect={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setSelectedTier(key);
          }}
        />
      ))}
    </Animated.View>
  );

  const renderPaymentStep = () => {
    const tier = ORG_TIERS[selectedTier];

    return (
      <Animated.View entering={FadeIn.duration(300)} style={styles.stepContent}>
        <Text style={[styles.stepTitle, { color: colors.text }]}>Review & Pay</Text>
        <Text style={[styles.stepSubtitle, { color: colors.textSecondary }]}>
          Review your organization details and complete payment
        </Text>

        {/* Summary Card */}
        <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.summaryHeader}>
            {logoUri ? (
              <Image source={{ uri: logoUri }} style={styles.summaryLogo} />
            ) : (
              <View style={[styles.summaryLogoPlaceholder, { backgroundColor: `${colors.gold}15` }]}>
                <Ionicons name="business" size={24} color={colors.gold} />
              </View>
            )}
            <View style={styles.summaryInfo}>
              <Text style={[styles.summaryName, { color: colors.text }]}>{name}</Text>
              <Text style={[styles.summaryDescription, { color: colors.textSecondary }]} numberOfLines={2}>
                {description}
              </Text>
            </View>
          </View>

          <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />

          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Plan</Text>
            <View style={styles.summaryValue}>
              <Ionicons name={tier.icon} size={16} color={colors.gold} />
              <Text style={[styles.summaryValueText, { color: colors.text }]}>{tier.name}</Text>
            </View>
          </View>

          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Billing</Text>
            <Text style={[styles.summaryValueText, { color: colors.text }]}>Monthly</Text>
          </View>

          <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />

          <View style={styles.summaryRow}>
            <Text style={[styles.summaryTotalLabel, { color: colors.text }]}>Total Today</Text>
            <Text style={[styles.summaryTotalValue, { color: colors.gold }]}>{tier.price}</Text>
          </View>
        </View>

        {/* Info Note */}
        <View style={[styles.infoNote, { backgroundColor: `${colors.info}10`, borderColor: `${colors.info}25` }]}>
          <Ionicons name="information-circle-outline" size={18} color={colors.info} />
          <Text style={[styles.infoNoteText, { color: colors.textSecondary }]}>
            You'll be charged {tier.price}/month. Cancel anytime from your organization settings.
          </Text>
        </View>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Create Organization</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Step Indicator */}
      <StepIndicator currentStep={currentStep} />

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
          {currentStep === 'details' && renderDetailsStep()}
          {currentStep === 'tier' && renderTierStep()}
          {currentStep === 'payment' && renderPaymentStep()}

          <View style={styles.bottomSpacer} />
        </ScrollView>

        {/* Bottom Actions */}
        <View style={[styles.bottomActions, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
          {currentStep !== 'details' && (
            <TouchableOpacity
              style={[styles.backStepButton, { borderColor: colors.border }]}
              onPress={handlePreviousStep}
              disabled={processing}
            >
              <Ionicons name="chevron-back" size={20} color={colors.text} />
              <Text style={[styles.backStepText, { color: colors.text }]}>Back</Text>
            </TouchableOpacity>
          )}

          {currentStep === 'payment' ? (
            <TouchableOpacity
              style={[styles.actionButton, currentStep !== 'details' && styles.actionButtonFlex]}
              onPress={handleCreateOrganization}
              disabled={processing}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[colors.gold, colors.goldDark || '#A68523']}
                style={styles.gradientButton}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {processing ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <>
                    <Ionicons name="card-outline" size={20} color="#000" />
                    <Text style={styles.actionButtonText}>Pay {ORG_TIERS[selectedTier].price}</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.actionButton, currentStep !== 'details' && styles.actionButtonFlex]}
              onPress={handleNextStep}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[colors.gold, colors.goldDark || '#A68523']}
                style={styles.gradientButton}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.actionButtonText}>Continue</Text>
                <Ionicons name="chevron-forward" size={20} color="#000" />
              </LinearGradient>
            </TouchableOpacity>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  stepNumber: {
    ...TYPOGRAPHY.labelSmall,
    fontWeight: '600',
  },
  stepLabel: {
    ...TYPOGRAPHY.labelSmall,
    marginLeft: SPACING.xs,
    fontWeight: '500',
  },
  stepLine: {
    width: 40,
    height: 2,
    marginHorizontal: SPACING.sm,
  },
  keyboardAvoid: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: SPACING.lg,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    ...TYPOGRAPHY.headlineMedium,
    marginBottom: SPACING.xs,
  },
  stepSubtitle: {
    ...TYPOGRAPHY.bodyMedium,
    marginBottom: SPACING.xl,
  },

  // Logo Picker
  logoPicker: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    marginBottom: SPACING.xl,
    overflow: 'hidden',
  },
  logoPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  logoHint: {
    ...TYPOGRAPHY.labelSmall,
    textAlign: 'center',
  },
  logoPreview: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
  },
  logoEditBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Input styles
  inputGroup: {
    marginBottom: SPACING.lg,
  },
  inputLabel: {
    ...TYPOGRAPHY.labelMedium,
    marginBottom: SPACING.sm,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    ...TYPOGRAPHY.bodyMedium,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    ...TYPOGRAPHY.bodyMedium,
    minHeight: 120,
  },
  charCount: {
    ...TYPOGRAPHY.labelSmall,
    textAlign: 'right',
    marginTop: SPACING.xs,
  },

  // Tier Card
  tierCard: {
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  popularBadge: {
    position: 'absolute',
    top: -10,
    alignSelf: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xxs,
    borderRadius: BORDER_RADIUS.full,
  },
  popularText: {
    ...TYPOGRAPHY.labelSmall,
    color: '#000',
    fontWeight: '700',
    fontSize: 10,
  },
  tierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  tierIcon: {
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
    ...TYPOGRAPHY.labelLarge,
    fontWeight: '600',
  },
  tierPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  tierPrice: {
    ...TYPOGRAPHY.headlineSmall,
    fontWeight: '700',
  },
  tierPeriod: {
    ...TYPOGRAPHY.labelSmall,
    marginLeft: 2,
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  tierDescription: {
    ...TYPOGRAPHY.bodySmall,
    marginBottom: SPACING.md,
  },
  tierFeatures: {
    gap: SPACING.sm,
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

  // Summary Card
  summaryCard: {
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  summaryHeader: {
    flexDirection: 'row',
    marginBottom: SPACING.lg,
  },
  summaryLogo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: SPACING.md,
  },
  summaryLogoPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  summaryInfo: {
    flex: 1,
  },
  summaryName: {
    ...TYPOGRAPHY.labelLarge,
    fontWeight: '600',
    marginBottom: SPACING.xxs,
  },
  summaryDescription: {
    ...TYPOGRAPHY.bodySmall,
    lineHeight: 18,
  },
  summaryDivider: {
    height: 1,
    marginVertical: SPACING.md,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
  },
  summaryLabel: {
    ...TYPOGRAPHY.bodyMedium,
  },
  summaryValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  summaryValueText: {
    ...TYPOGRAPHY.labelMedium,
    fontWeight: '500',
  },
  summaryTotalLabel: {
    ...TYPOGRAPHY.labelLarge,
    fontWeight: '600',
  },
  summaryTotalValue: {
    ...TYPOGRAPHY.headlineSmall,
    fontWeight: '700',
  },

  // Info Note
  infoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    gap: SPACING.md,
  },
  infoNoteText: {
    ...TYPOGRAPHY.bodySmall,
    flex: 1,
    lineHeight: 20,
  },

  // Bottom Actions
  bottomActions: {
    flexDirection: 'row',
    padding: SPACING.lg,
    paddingBottom: SPACING.xl,
    borderTopWidth: 1,
    gap: SPACING.md,
  },
  backStepButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    gap: SPACING.xs,
  },
  backStepText: {
    ...TYPOGRAPHY.labelMedium,
    fontWeight: '500',
  },
  actionButton: {
    flex: 1,
  },
  actionButtonFlex: {
    flex: 2,
  },
  gradientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    gap: SPACING.sm,
  },
  actionButtonText: {
    ...TYPOGRAPHY.labelLarge,
    color: '#000',
    fontWeight: '600',
  },

  bottomSpacer: {
    height: 40,
  },
});
