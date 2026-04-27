import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { useAuthStore } from '../../lib/auth';
import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS, responsive } from '../../lib/theme';
import { analyticsApi, AnalyticsData, ProposalAnalytics } from '../../lib/api';
import { FeaturedStat, StatsGrid, ProgressStat, UpgradeModal } from '../../components/ui';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://representportal.com';

// Sample data for non-premium users to see what the dashboard looks like
const SAMPLE_ANALYTICS: AnalyticsData = {
  totalProposals: 12,
  totalVotes: 847,
  supportVotes: 523,
  opposeVotes: 324,
  proposals: [
    {
      id: 1,
      title: 'Community Park Renovation Project',
      views: 1250,
      supportVotes: 234,
      opposeVotes: 89,
      engagementRate: 0.258,
      createdAt: '2024-01-15',
    },
    {
      id: 2,
      title: 'Local Transit Improvement Initiative',
      views: 890,
      supportVotes: 156,
      opposeVotes: 112,
      engagementRate: 0.301,
      createdAt: '2024-01-10',
    },
    {
      id: 3,
      title: 'Green Energy Incentive Program',
      views: 678,
      supportVotes: 133,
      opposeVotes: 123,
      engagementRate: 0.378,
      createdAt: '2024-01-05',
    },
  ],
};

// Premium Upgrade Card Component
function PremiumUpgradeCard() {
  const { colors } = useTheme();

  const ANALYTICS_FEATURES = [
    { icon: 'bar-chart-outline', text: 'Track total votes on your proposals' },
    { icon: 'trending-up-outline', text: 'See support vs oppose ratios' },
    { icon: 'eye-outline', text: 'Monitor proposal views and engagement' },
    { icon: 'analytics-outline', text: 'Per-proposal performance metrics' },
    { icon: 'time-outline', text: 'Historical voting activity trends' },
  ];

  const handleUpgrade = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/modals/subscription');
  };

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Premium Badge */}
      <Animated.View
        entering={FadeInDown.duration(400)}
        style={[styles.premiumHero, { backgroundColor: `${colors.gold}10` }]}
      >
        <View style={[styles.premiumIconBg, { backgroundColor: colors.gold }]}>
          <Ionicons name="analytics" size={40} color="#000" />
        </View>
        <Text style={[styles.premiumTitle, { color: colors.gold }]}>
          Analytics Dashboard
        </Text>
        <Text style={[styles.premiumSubtitle, { color: colors.textSecondary }]}>
          Premium Feature
        </Text>
      </Animated.View>

      {/* Description Card */}
      <Animated.View
        entering={FadeInUp.delay(100).duration(400)}
        style={[styles.descriptionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <Text style={[styles.descriptionTitle, { color: colors.text }]}>
          Track Your Proposal Performance
        </Text>
        <Text style={[styles.descriptionText, { color: colors.textSecondary }]}>
          Get detailed insights into how your proposals are performing. See voting trends,
          engagement metrics, and understand what resonates with your community.
        </Text>
      </Animated.View>

      {/* Features List */}
      <Animated.View
        entering={FadeInUp.delay(200).duration(400)}
        style={[styles.featuresCard, { backgroundColor: colors.surface, borderColor: colors.gold }]}
      >
        <LinearGradient
          colors={[`${colors.gold}08`, 'transparent']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <Text style={[styles.featuresTitle, { color: colors.gold }]}>
          What You Get
        </Text>
        {ANALYTICS_FEATURES.map((feature, index) => (
          <Animated.View
            key={index}
            entering={FadeInUp.delay(300 + index * 50).duration(300)}
            style={styles.featureRow}
          >
            <View style={[styles.featureIconBg, { backgroundColor: `${colors.gold}15` }]}>
              <Ionicons name={feature.icon as any} size={18} color={colors.gold} />
            </View>
            <Text style={[styles.featureText, { color: colors.text }]}>
              {feature.text}
            </Text>
          </Animated.View>
        ))}
      </Animated.View>

      {/* Pricing Card */}
      <Animated.View
        entering={FadeInUp.delay(400).duration(400)}
        style={[styles.pricingCard, { backgroundColor: colors.gold }]}
      >
        <View style={styles.pricingContent}>
          <View style={styles.pricingLeft}>
            <Text style={styles.pricingLabel}>Premium</Text>
            <View style={styles.priceRow}>
              <Text style={styles.priceAmount}>$7.99</Text>
              <Text style={styles.pricePeriod}>/month</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.upgradeButton}
            onPress={handleUpgrade}
            activeOpacity={0.8}
          >
            <Text style={styles.upgradeButtonText}>Upgrade Now</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.gold} />
          </TouchableOpacity>
        </View>
        <Text style={styles.pricingNote}>
          Includes Analytics, Sentinel AI, unlimited proposals, and verification
        </Text>
      </Animated.View>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}

// Proposal Analytics Card
function ProposalAnalyticsCard({ proposal, index }: { proposal: ProposalAnalytics; index: number }) {
  const { colors } = useTheme();
  const totalVotes = proposal.supportVotes + proposal.opposeVotes;
  const supportPercent = totalVotes > 0 ? Math.round((proposal.supportVotes / totalVotes) * 100) : 50;

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 80).duration(400)}
      style={[styles.proposalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <Text style={[styles.proposalTitle, { color: colors.text }]} numberOfLines={2}>
        {proposal.title}
      </Text>

      <View style={styles.proposalStats}>
        <View style={styles.proposalStat}>
          <Ionicons name="eye-outline" size={14} color={colors.textSecondary} />
          <Text style={[styles.proposalStatText, { color: colors.textSecondary }]}>
            {proposal.views} views
          </Text>
        </View>
        <View style={styles.proposalStat}>
          <Ionicons name="thumbs-up-outline" size={14} color={colors.success} />
          <Text style={[styles.proposalStatText, { color: colors.success }]}>
            {proposal.supportVotes}
          </Text>
        </View>
        <View style={styles.proposalStat}>
          <Ionicons name="thumbs-down-outline" size={14} color={colors.error} />
          <Text style={[styles.proposalStatText, { color: colors.error }]}>
            {proposal.opposeVotes}
          </Text>
        </View>
      </View>

      <View style={styles.voteBarContainer}>
        <View style={[styles.voteBarBg, { backgroundColor: colors.error }]}>
          <View style={[styles.voteBarFill, { width: `${supportPercent}%`, backgroundColor: colors.success }]} />
        </View>
        <Text style={[styles.voteBarLabel, { color: colors.textSecondary }]}>
          {supportPercent}% support
        </Text>
      </View>

      <View style={styles.engagementRow}>
        <Text style={[styles.engagementLabel, { color: colors.textTertiary }]}>Engagement Rate</Text>
        <Text style={[styles.engagementValue, { color: colors.gold }]}>
          {(proposal.engagementRate * 100).toFixed(1)}%
        </Text>
      </View>
    </Animated.View>
  );
}

export default function AnalyticsScreen() {
  const { colors } = useTheme();
  const { token, user } = useAuthStore();

  const [isPremium, setIsPremium] = useState(false);
  const [loadingSubscription, setLoadingSubscription] = useState(true);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Check if user has Premium subscription
  useEffect(() => {
    const checkSubscription = async () => {
      // Demo account should appear as premium (for App Store review)
      const isDemoAccount = user?.email === 'demo@represent.app';
      if (isDemoAccount) {
        setIsPremium(true);
        setLoadingSubscription(false);
        return;
      }

      if (!token) {
        setLoadingSubscription(false);
        return;
      }
      try {
        const response = await fetch(`${API_URL}/api/stripe/subscription`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          setIsPremium(data.tier === 'premium' && data.status === 'active');
        }
      } catch (error) {
        console.error('Error checking subscription:', error);
      } finally {
        setLoadingSubscription(false);
      }
    };
    checkSubscription();
  }, [token, user?.email]);

  const fetchAnalytics = useCallback(async () => {
    try {
      const result = await analyticsApi.getProposalAnalytics();
      if (result.data) {
        setAnalytics(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isPremium) {
      setLoading(true);
      fetchAnalytics();
    }
  }, [isPremium, fetchAnalytics]);

  const onRefresh = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!isPremium) {
      setShowUpgradeModal(true);
      return;
    }
    setRefreshing(true);
    fetchAnalytics();
  };

  const handlePremiumAction = () => {
    if (!isPremium) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setShowUpgradeModal(true);
      return false;
    }
    return true;
  };

  // Show loading state while checking subscription
  if (loadingSubscription) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.gold} />
        </View>
      </View>
    );
  }

  // Show loading state while fetching analytics (only for premium users)
  if (isPremium && loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.gold} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Loading analytics...
          </Text>
        </View>
      </View>
    );
  }

  // Use real data for premium, sample data for non-premium
  const displayData = isPremium ? analytics : SAMPLE_ANALYTICS;

  const supportPercent = displayData && displayData.totalVotes > 0
    ? Math.round((displayData.supportVotes / displayData.totalVotes) * 100)
    : 50;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.gold}
          />
        }
      >
        {/* Premium Banner for non-premium users */}
        {!isPremium && (
          <Animated.View entering={FadeInDown.duration(300)}>
            <TouchableOpacity
              style={[styles.premiumBanner, { backgroundColor: colors.gold }]}
              onPress={() => setShowUpgradeModal(true)}
              activeOpacity={0.9}
            >
              <View style={styles.premiumBannerContent}>
                <Ionicons name="sparkles" size={20} color="#000" />
                <Text style={styles.premiumBannerText}>
                  Sample Data - Upgrade to see your real analytics
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#000" />
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Hero Stats */}
        <Animated.View entering={FadeInDown.duration(400)}>
          <FeaturedStat
            value={displayData?.totalVotes || 0}
            label="Total Votes Received"
            description="Across all your proposals"
            icon="checkmark-done-circle"
            gradient
            style={{ marginBottom: SPACING.lg }}
          />
        </Animated.View>

        {/* Stats Grid */}
        <Animated.View entering={FadeInUp.delay(100).duration(400)}>
          <StatsGrid
            stats={[
              {
                value: displayData?.totalProposals || 0,
                label: 'Proposals',
                icon: 'document-text-outline',
                iconColor: colors.info,
              },
              {
                value: displayData?.supportVotes || 0,
                label: 'Support',
                icon: 'thumbs-up-outline',
                iconColor: colors.success,
              },
              {
                value: displayData?.opposeVotes || 0,
                label: 'Oppose',
                icon: 'thumbs-down-outline',
                iconColor: colors.error,
              },
            ]}
            columns={3}
            compact
            style={{ marginBottom: SPACING.xl }}
          />
        </Animated.View>

        {/* Support/Oppose Ratio */}
        <Animated.View
          entering={FadeInUp.delay(200).duration(400)}
          style={[styles.ratioCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Text style={[styles.ratioTitle, { color: colors.text }]}>Support Ratio</Text>
          <ProgressStat
            value={displayData?.supportVotes || 0}
            max={displayData?.totalVotes || 1}
            label="Support vs Total Votes"
            color={colors.success}
            size="lg"
          />
          <View style={styles.ratioLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
              <Text style={[styles.legendText, { color: colors.textSecondary }]}>
                Support ({supportPercent}%)
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.error }]} />
              <Text style={[styles.legendText, { color: colors.textSecondary }]}>
                Oppose ({100 - supportPercent}%)
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Per-Proposal Analytics */}
        {displayData?.proposals && displayData.proposals.length > 0 && (
          <Animated.View entering={FadeInUp.delay(300).duration(400)}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Proposal Performance
            </Text>
            {displayData.proposals.map((proposal, index) => (
              <ProposalAnalyticsCard key={proposal.id} proposal={proposal} index={index} />
            ))}
          </Animated.View>
        )}

        {/* Empty State - only for premium users with no data */}
        {isPremium && (!displayData?.proposals || displayData.proposals.length === 0) && (
          <Animated.View
            entering={FadeIn.delay(300).duration(400)}
            style={styles.emptyState}
          >
            <View style={[styles.emptyIcon, { backgroundColor: `${colors.gold}15` }]}>
              <Ionicons name="bar-chart-outline" size={40} color={colors.gold} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              No Proposals Yet
            </Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Create proposals to start tracking your analytics
            </Text>
            <TouchableOpacity
              style={[styles.createBtn, { backgroundColor: colors.gold }]}
              onPress={() => router.push('/(tabs)/proposals')}
            >
              <Ionicons name="add-circle" size={20} color="#000" />
              <Text style={styles.createBtnText}>Create Proposal</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Upgrade Modal */}
      <UpgradeModal
        visible={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        type="premium"
        title="Unlock Analytics"
        message="Get detailed insights into your proposal performance with Premium. Track votes, engagement rates, and see what resonates with your community."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.md,
  },
  loadingText: {
    ...TYPOGRAPHY.bodyMedium,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
  },
  content: {
    padding: SPACING.lg,
  },
  premiumBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.lg,
  },
  premiumBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  premiumBannerText: {
    ...TYPOGRAPHY.labelMedium,
    color: '#000',
    fontWeight: '600',
    flex: 1,
  },

  // Premium Upgrade Card Styles
  premiumHero: {
    alignItems: 'center',
    paddingVertical: SPACING.xxxl,
    borderRadius: BORDER_RADIUS.xxl,
    marginBottom: SPACING.lg,
  },
  premiumIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  premiumTitle: {
    fontFamily: 'Georgia',
    fontSize: responsive(28, 32, 36),
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  premiumSubtitle: {
    ...TYPOGRAPHY.bodyLarge,
  },
  descriptionCard: {
    padding: SPACING.xl,
    borderRadius: BORDER_RADIUS.xxl,
    borderWidth: 1,
    marginBottom: SPACING.lg,
  },
  descriptionTitle: {
    fontFamily: 'Georgia',
    fontSize: 18,
    fontWeight: '500',
    marginBottom: SPACING.md,
  },
  descriptionText: {
    ...TYPOGRAPHY.bodyMedium,
    lineHeight: 24,
  },
  featuresCard: {
    padding: SPACING.xl,
    borderRadius: BORDER_RADIUS.xxl,
    borderWidth: 1.5,
    marginBottom: SPACING.lg,
    overflow: 'hidden',
  },
  featuresTitle: {
    fontFamily: 'Georgia',
    fontSize: 18,
    fontWeight: '500',
    marginBottom: SPACING.lg,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  featureIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  featureText: {
    ...TYPOGRAPHY.bodyMedium,
    flex: 1,
  },
  pricingCard: {
    padding: SPACING.xl,
    borderRadius: BORDER_RADIUS.xxl,
    marginBottom: SPACING.lg,
  },
  pricingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  pricingLeft: {},
  pricingLabel: {
    ...TYPOGRAPHY.labelMedium,
    color: '#000',
    opacity: 0.7,
    marginBottom: SPACING.xxs,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  priceAmount: {
    fontFamily: 'Georgia',
    fontSize: responsive(28, 32, 36),
    color: '#000',
    fontWeight: '600',
  },
  pricePeriod: {
    ...TYPOGRAPHY.bodyMedium,
    color: '#000',
    opacity: 0.7,
    marginLeft: SPACING.xxs,
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
    gap: SPACING.sm,
  },
  upgradeButtonText: {
    ...TYPOGRAPHY.labelLarge,
    color: '#fff',
    fontWeight: '600',
  },
  pricingNote: {
    ...TYPOGRAPHY.bodySmall,
    color: '#000',
    opacity: 0.7,
    textAlign: 'center',
  },

  // Analytics Dashboard Styles
  ratioCard: {
    padding: SPACING.xl,
    borderRadius: BORDER_RADIUS.xxl,
    borderWidth: 1,
    marginBottom: SPACING.xl,
  },
  ratioTitle: {
    fontFamily: 'Georgia',
    fontSize: 18,
    fontWeight: '500',
    marginBottom: SPACING.lg,
  },
  ratioLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.xl,
    marginTop: SPACING.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    ...TYPOGRAPHY.labelSmall,
  },
  sectionTitle: {
    fontFamily: 'Georgia',
    fontSize: 18,
    fontWeight: '500',
    marginBottom: SPACING.lg,
  },
  proposalCard: {
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  proposalTitle: {
    fontFamily: 'Georgia',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: SPACING.md,
  },
  proposalStats: {
    flexDirection: 'row',
    gap: SPACING.lg,
    marginBottom: SPACING.md,
  },
  proposalStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  proposalStatText: {
    ...TYPOGRAPHY.labelSmall,
  },
  voteBarContainer: {
    marginBottom: SPACING.md,
  },
  voteBarBg: {
    height: 6,
    borderRadius: BORDER_RADIUS.full,
    overflow: 'hidden',
    marginBottom: SPACING.xs,
  },
  voteBarFill: {
    height: '100%',
    borderRadius: BORDER_RADIUS.full,
  },
  voteBarLabel: {
    ...TYPOGRAPHY.labelSmall,
  },
  engagementRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  engagementLabel: {
    ...TYPOGRAPHY.labelSmall,
  },
  engagementValue: {
    ...TYPOGRAPHY.labelMedium,
    fontWeight: '700',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xxxl,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  emptyTitle: {
    fontFamily: 'Georgia',
    fontSize: 22,
    fontWeight: '500',
    marginBottom: SPACING.sm,
  },
  emptyText: {
    ...TYPOGRAPHY.bodyMedium,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
    gap: SPACING.sm,
  },
  createBtnText: {
    ...TYPOGRAPHY.labelLarge,
    color: '#000',
    fontWeight: '600',
  },

  bottomPadding: {
    height: 100,
  },
});
