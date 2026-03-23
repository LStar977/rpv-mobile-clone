import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeInDown, FadeInUp, useSharedValue, useAnimatedStyle, withSpring, withRepeat, withSequence } from 'react-native-reanimated';
import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../../lib/theme';
import { useBallotStore } from '../../lib/ballots';
import { useAuthStore } from '../../lib/auth';
import { IAP_PRODUCTS, BALLOT_PACKS, purchaseBallots, iapAvailable } from '../../lib/iap';
import { BallotIcon, BallotIconFilled } from '../../components/icons';

interface BallotPack {
  id: string;
  ballots: number;
  price: string;
  perBallot: string;
  popular?: boolean;
  bestValue?: boolean;
}

const PACKS: BallotPack[] = [
  {
    id: IAP_PRODUCTS.ballots5,
    ballots: 5,
    price: '$3.99',
    perBallot: '$0.80',
  },
  {
    id: IAP_PRODUCTS.ballots10,
    ballots: 10,
    price: '$6.99',
    perBallot: '$0.70',
    popular: true,
  },
  {
    id: IAP_PRODUCTS.ballots25,
    ballots: 25,
    price: '$14.99',
    perBallot: '$0.60',
    bestValue: true,
  },
];

export default function PurchaseBallotsScreen() {
  const { colors } = useTheme();
  const { balance, tier, syncFromChain } = useBallotStore();
  const { isAuthenticated, user } = useAuthStore();
  const [purchasing, setPurchasing] = useState<string | null>(null);

  // Animation for the hero icon
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withSpring(1.05, { damping: 10 }),
        withSpring(1, { damping: 10 })
      ),
      -1,
      true
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const handlePurchase = async (pack: BallotPack) => {
    if (!isAuthenticated) {
      Alert.alert('Sign In Required', 'Please sign in to purchase RPV tokens.');
      return;
    }

    if (!iapAvailable && Platform.OS === 'ios') {
      Alert.alert('Not Available', 'In-app purchases are not available in this build.');
      return;
    }

    setPurchasing(pack.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const result = await purchaseBallots(pack.id as keyof typeof BALLOT_PACKS);

      if (result.success) {
        // Sync balance from chain (backend mints tokens to user's wallet)
        if (user?.walletAddress) {
          await syncFromChain(user.walletAddress);
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          'Purchase Complete!',
          `${pack.ballots} RPV tokens have been sent to your wallet. Happy voting!`,
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } else if (result.cancelled) {
        // User cancelled - do nothing
      } else {
        Alert.alert('Purchase Failed', result.error || 'Something went wrong. Please try again.');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to complete purchase.');
    } finally {
      setPurchasing(null);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Get RPV Tokens</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.heroSection}>
          <Animated.View style={[styles.heroIconContainer, { backgroundColor: `${colors.gold}15` }, pulseStyle]}>
            <BallotIconFilled size={48} color={colors.gold} secondaryColor={colors.background} />
          </Animated.View>

          <Text style={[styles.heroTitle, { color: colors.text }]}>
            Power Your Voice
          </Text>
          <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
            Each vote requires 1 RPV token. Buy tokens to participate in more proposals.
          </Text>

          {/* Current Balance */}
          <View style={[styles.balanceCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.balanceLeft}>
              <Text style={[styles.balanceLabel, { color: colors.textSecondary }]}>Current Balance</Text>
              <View style={styles.balanceRow}>
                <BallotIcon size={24} color={colors.gold} />
                <Text style={[styles.balanceValue, { color: colors.gold }]}>
                  {tier === 'premium' ? '∞' : balance}
                </Text>
                <Text style={[styles.balanceUnit, { color: colors.textSecondary }]}>RPV</Text>
              </View>
            </View>

            {tier === 'premium' && (
              <View style={[styles.premiumBadge, { backgroundColor: `${colors.gold}20` }]}>
                <Ionicons name="star" size={14} color={colors.gold} />
                <Text style={[styles.premiumText, { color: colors.gold }]}>Unlimited</Text>
              </View>
            )}
          </View>
        </Animated.View>

        {/* Pack Options */}
        <View style={styles.packsSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Choose a Pack</Text>

          {PACKS.map((pack, index) => (
            <Animated.View
              key={pack.id}
              entering={FadeInUp.delay(100 + index * 100).springify()}
            >
              <TouchableOpacity
                style={[
                  styles.packCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: pack.bestValue ? colors.gold : colors.border,
                    borderWidth: pack.bestValue ? 2 : 1,
                  },
                ]}
                onPress={() => handlePurchase(pack)}
                disabled={purchasing !== null}
                activeOpacity={0.8}
              >
                {pack.bestValue && (
                  <View style={[styles.packBadge, { backgroundColor: colors.gold }]}>
                    <Text style={styles.packBadgeText}>BEST VALUE</Text>
                  </View>
                )}
                {pack.popular && !pack.bestValue && (
                  <View style={[styles.packBadge, { backgroundColor: colors.success }]}>
                    <Text style={styles.packBadgeText}>POPULAR</Text>
                  </View>
                )}

                <View style={styles.packContent}>
                  <View style={styles.packLeft}>
                    <View style={[styles.packIconContainer, { backgroundColor: `${colors.gold}15` }]}>
                      <BallotIcon size={28} color={colors.gold} />
                    </View>
                    <View>
                      <Text style={[styles.packBallots, { color: colors.text }]}>
                        {pack.ballots} RPV Tokens
                      </Text>
                      <Text style={[styles.packPerBallot, { color: colors.textSecondary }]}>
                        {pack.perBallot} per token
                      </Text>
                    </View>
                  </View>

                  <View style={styles.packRight}>
                    {purchasing === pack.id ? (
                      <ActivityIndicator color={colors.gold} />
                    ) : (
                      <View style={[styles.priceButton, { backgroundColor: pack.bestValue ? colors.gold : `${colors.gold}20` }]}>
                        <Text style={[styles.priceText, { color: pack.bestValue ? '#000' : colors.gold }]}>
                          {pack.price}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            </Animated.View>
          ))}
        </View>

        {/* Info Section */}
        <Animated.View
          entering={FadeInUp.delay(500).springify()}
          style={[styles.infoCard, { backgroundColor: `${colors.info}10`, borderColor: `${colors.info}25` }]}
        >
          <Ionicons name="information-circle-outline" size={20} color={colors.info} />
          <View style={styles.infoContent}>
            <Text style={[styles.infoTitle, { color: colors.text }]}>On-Chain Tokens</Text>
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              RPV tokens are real blockchain assets on Base. When you vote, your token is transferred on-chain.
            </Text>
          </View>
        </Animated.View>

        {/* Premium Upsell (for non-premium users) */}
        {tier !== 'premium' && (
          <Animated.View
            entering={FadeInUp.delay(600).springify()}
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
              <Text style={[styles.upsellTitle, { color: colors.gold }]}>Go Premium</Text>
            </View>
            <Text style={[styles.upsellText, { color: colors.textSecondary }]}>
              Get unlimited voting power + Sentinel AI for $7.99/month
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/modals/subscription')}
              style={styles.upsellLink}
            >
              <Text style={[styles.upsellLinkText, { color: colors.gold }]}>Learn More</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.gold} />
            </TouchableOpacity>
          </Animated.View>
        )}

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
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...TYPOGRAPHY.headlineSmall,
  },
  scrollView: {
    flex: 1,
  },
  heroSection: {
    alignItems: 'center',
    padding: SPACING.xl,
  },
  heroIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  heroTitle: {
    ...TYPOGRAPHY.headlineLarge,
    marginBottom: SPACING.xs,
  },
  heroSubtitle: {
    ...TYPOGRAPHY.bodyMedium,
    textAlign: 'center',
    marginBottom: SPACING.xl,
    paddingHorizontal: SPACING.lg,
  },
  balanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
  },
  balanceLeft: {},
  balanceLabel: {
    ...TYPOGRAPHY.labelSmall,
    marginBottom: SPACING.xs,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  balanceValue: {
    ...TYPOGRAPHY.headlineLarge,
    fontWeight: '700',
  },
  balanceUnit: {
    ...TYPOGRAPHY.bodyMedium,
  },
  balanceRight: {
    alignItems: 'flex-end',
  },
  regenLabel: {
    ...TYPOGRAPHY.labelSmall,
  },
  regenTime: {
    ...TYPOGRAPHY.labelLarge,
    fontWeight: '600',
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
  },
  premiumText: {
    ...TYPOGRAPHY.labelSmall,
    fontWeight: '600',
  },
  packsSection: {
    padding: SPACING.lg,
  },
  sectionTitle: {
    ...TYPOGRAPHY.labelLarge,
    marginBottom: SPACING.md,
  },
  packCard: {
    borderRadius: BORDER_RADIUS.xl,
    marginBottom: SPACING.md,
    overflow: 'hidden',
    position: 'relative',
  },
  packBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderBottomLeftRadius: BORDER_RADIUS.md,
    zIndex: 1,
  },
  packBadgeText: {
    ...TYPOGRAPHY.labelSmall,
    color: '#000',
    fontWeight: '700',
    fontSize: 9,
  },
  packContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.lg,
  },
  packLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  packIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  packBallots: {
    ...TYPOGRAPHY.labelLarge,
    fontWeight: '600',
  },
  packPerBallot: {
    ...TYPOGRAPHY.labelSmall,
  },
  packRight: {
    alignItems: 'flex-end',
  },
  priceButton: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
  },
  priceText: {
    ...TYPOGRAPHY.labelLarge,
    fontWeight: '700',
  },
  infoCard: {
    flexDirection: 'row',
    marginHorizontal: SPACING.lg,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    gap: SPACING.md,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    ...TYPOGRAPHY.labelMedium,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  infoText: {
    ...TYPOGRAPHY.bodySmall,
  },
  upsellCard: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
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
    fontWeight: '700',
  },
  upsellText: {
    ...TYPOGRAPHY.bodySmall,
    marginBottom: SPACING.md,
  },
  upsellLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  upsellLinkText: {
    ...TYPOGRAPHY.labelMedium,
    fontWeight: '600',
  },
});
