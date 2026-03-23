import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../../lib/theme';
import { useBallotStore, formatTimeRemaining } from '../../lib/ballots';
import { BallotIcon, BallotIconFilled } from '../../components/icons';

const PURCHASE_PACKS = [
  { id: 'pack_5', ballots: 5, price: '$3.99', perBallot: '$0.80' },
  { id: 'pack_10', ballots: 10, price: '$6.99', perBallot: '$0.70', popular: true },
  { id: 'pack_25', ballots: 25, price: '$14.99', perBallot: '$0.60', bestValue: true },
];

export default function OutOfBallotsModal() {
  const { colors } = useTheme();
  const { tier, getTimeUntilNextBallot, checkRegeneration } = useBallotStore();
  const [timeRemaining, setTimeRemaining] = useState(0);

  // Update timer every second
  useEffect(() => {
    if (tier === 'premium') return;

    const interval = setInterval(() => {
      checkRegeneration();
      setTimeRemaining(getTimeUntilNextBallot());
    }, 1000);

    setTimeRemaining(getTimeUntilNextBallot());

    return () => clearInterval(interval);
  }, [tier]);

  const handlePurchase = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.replace('/modals/purchase-ballots');
  };

  const handleWait = () => {
    Haptics.selectionAsync();
    router.back();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Out of Ballots</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        {/* Hero Icon */}
        <Animated.View
          entering={FadeInDown.delay(100).springify()}
          style={[styles.iconContainer, { backgroundColor: `${colors.warning}15` }]}
        >
          <BallotIconFilled size={64} color={colors.warning} secondaryColor={colors.background} />
        </Animated.View>

        {/* Title */}
        <Animated.Text
          entering={FadeInDown.delay(200).springify()}
          style={[styles.title, { color: colors.text }]}
        >
          You're out of ballots!
        </Animated.Text>

        {/* Subtitle with timer */}
        <Animated.View entering={FadeInDown.delay(300).springify()}>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {tier === 'premium'
              ? 'As a Premium member, you have unlimited ballots!'
              : `Your next free ballot regenerates in:`}
          </Text>

          {tier !== 'premium' && timeRemaining > 0 && (
            <View style={[styles.timerContainer, { backgroundColor: `${colors.gold}15`, borderColor: `${colors.gold}30` }]}>
              <Ionicons name="time-outline" size={20} color={colors.gold} />
              <Text style={[styles.timerText, { color: colors.gold }]}>
                {formatTimeRemaining(timeRemaining)}
              </Text>
            </View>
          )}
        </Animated.View>

        {/* Purchase Options */}
        <Animated.View entering={FadeInUp.delay(400).springify()} style={styles.purchaseSection}>
          <Text style={[styles.purchaseTitle, { color: colors.text }]}>
            Need ballots now?
          </Text>

          {PURCHASE_PACKS.map((pack, index) => (
            <TouchableOpacity
              key={pack.id}
              style={[
                styles.packCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: pack.bestValue ? colors.gold : colors.border,
                  borderWidth: pack.bestValue ? 2 : 1,
                },
              ]}
              onPress={handlePurchase}
              activeOpacity={0.8}
            >
              {pack.bestValue && (
                <View style={[styles.bestValueBadge, { backgroundColor: colors.gold }]}>
                  <Text style={styles.bestValueText}>BEST VALUE</Text>
                </View>
              )}
              {pack.popular && (
                <View style={[styles.popularBadge, { backgroundColor: colors.success }]}>
                  <Text style={styles.popularText}>POPULAR</Text>
                </View>
              )}

              <View style={styles.packLeft}>
                <BallotIcon size={24} color={colors.gold} />
                <Text style={[styles.packBallots, { color: colors.text }]}>
                  {pack.ballots} Ballots
                </Text>
              </View>

              <View style={styles.packRight}>
                <Text style={[styles.packPrice, { color: colors.gold }]}>{pack.price}</Text>
                <Text style={[styles.packPerBallot, { color: colors.textSecondary }]}>
                  {pack.perBallot}/ea
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </Animated.View>
      </View>

      {/* Bottom Actions */}
      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <TouchableOpacity onPress={handlePurchase} style={styles.primaryButton}>
          <LinearGradient
            colors={[colors.gold, colors.goldDark || '#A68523']}
            style={styles.gradientButton}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Ionicons name="cart-outline" size={20} color="#000" />
            <Text style={styles.primaryButtonText}>Buy Ballots</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleWait} style={styles.secondaryButton}>
          <Text style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>
            Wait for free ballot
          </Text>
        </TouchableOpacity>
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
  closeButton: {
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
    padding: SPACING.xl,
    alignItems: 'center',
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xl,
  },
  title: {
    ...TYPOGRAPHY.headlineLarge,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  subtitle: {
    ...TYPOGRAPHY.bodyMedium,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    marginBottom: SPACING.xl,
  },
  timerText: {
    ...TYPOGRAPHY.headlineSmall,
    fontWeight: '700',
  },
  purchaseSection: {
    width: '100%',
  },
  purchaseTitle: {
    ...TYPOGRAPHY.labelLarge,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  packCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    marginBottom: SPACING.md,
    position: 'relative',
    overflow: 'hidden',
  },
  bestValueBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderBottomLeftRadius: BORDER_RADIUS.md,
  },
  bestValueText: {
    ...TYPOGRAPHY.labelSmall,
    color: '#000',
    fontWeight: '700',
    fontSize: 9,
  },
  popularBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderBottomLeftRadius: BORDER_RADIUS.md,
  },
  popularText: {
    ...TYPOGRAPHY.labelSmall,
    color: '#000',
    fontWeight: '700',
    fontSize: 9,
  },
  packLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  packBallots: {
    ...TYPOGRAPHY.labelLarge,
    fontWeight: '600',
  },
  packRight: {
    alignItems: 'flex-end',
  },
  packPrice: {
    ...TYPOGRAPHY.headlineSmall,
    fontWeight: '700',
  },
  packPerBallot: {
    ...TYPOGRAPHY.labelSmall,
  },
  footer: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxxl,
    borderTopWidth: 1,
  },
  primaryButton: {
    marginBottom: SPACING.md,
  },
  gradientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    gap: SPACING.sm,
    ...SHADOWS.md,
  },
  primaryButtonText: {
    ...TYPOGRAPHY.labelLarge,
    color: '#000',
    fontWeight: '600',
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  secondaryButtonText: {
    ...TYPOGRAPHY.bodyMedium,
  },
});
