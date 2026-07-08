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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../lib/auth';
import { useTheme, SPACING, RADIUS, TYPOGRAPHY, responsive, FONTS } from '../../lib/theme';
import { analyticsApi, AnalyticsData, ProposalAnalytics } from '../../lib/api';
import { UpgradeModal } from '../../components/ui';

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

// Group ballots by the month each proposal was created — the only time
// dimension the analytics payload carries. Rendered honestly with a caption
// saying exactly that.
function ballotsByMonth(proposals: ProposalAnalytics[]): Array<{ label: string; total: number }> {
  const buckets = new Map<number, { label: string; total: number }>();
  for (const p of proposals) {
    const d = new Date(p.createdAt);
    if (isNaN(d.getTime())) continue;
    const key = d.getFullYear() * 12 + d.getMonth();
    const label = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    const bucket = buckets.get(key) ?? { label, total: 0 };
    bucket.total += (p.supportVotes || 0) + (p.opposeVotes || 0);
    buckets.set(key, bucket);
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .slice(-6)
    .map(([, v]) => v);
}

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
        style={[styles.premiumHero, { backgroundColor: colors.goldSurface }]}
      >
        <View style={[styles.premiumIconBg, { backgroundColor: colors.goldFill }]}>
          <Ionicons name="analytics" size={40} color="#040707" />
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
        style={[styles.descriptionCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
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
          colors={[colors.goldSurface, 'transparent']}
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
            <View style={[styles.featureIconBg, { backgroundColor: colors.goldSurface }]}>
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
        style={[styles.pricingCard, { backgroundColor: colors.goldFill }]}
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

// Proposal Analytics Card — two-tone tally bar (support fill on oppose track)
// with explicit labels + exact counts, mono numerals throughout.
function ProposalAnalyticsCard({ proposal, index }: { proposal: ProposalAnalytics; index: number }) {
  const { colors } = useTheme();
  const totalVotes = proposal.supportVotes + proposal.opposeVotes;
  const supportPercent = totalVotes > 0 ? Math.round((proposal.supportVotes / totalVotes) * 100) : 50;

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 80).duration(400)}
      style={[styles.proposalCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
    >
      <Text style={[styles.proposalTitle, { color: colors.text }]} numberOfLines={2}>
        {proposal.title}
      </Text>

      {totalVotes > 0 ? (
        <View style={[styles.tallyTrack, { backgroundColor: colors.oppose }]}>
          <View style={[styles.tallyFill, { width: `${supportPercent}%`, backgroundColor: colors.support }]} />
        </View>
      ) : (
        <View style={[styles.tallyTrack, { backgroundColor: colors.surfaceHighlight }]} />
      )}

      <View style={styles.tallyLegendRow}>
        <Text style={[styles.tallyLegend, { color: colors.support }]}>
          Support <Text style={styles.tallyLegendCount}>{proposal.supportVotes.toLocaleString()}</Text>
        </Text>
        <Text style={[styles.tallyLegendPct, { color: colors.textSecondary }]}>
          {totalVotes > 0 ? `${supportPercent}% support` : 'No ballots yet'}
        </Text>
        <Text style={[styles.tallyLegend, { color: colors.oppose, textAlign: 'right' }]}>
          Oppose <Text style={styles.tallyLegendCount}>{proposal.opposeVotes.toLocaleString()}</Text>
        </Text>
      </View>

      <View style={[styles.proposalMetaRow, { borderTopColor: colors.borderSubtle }]}>
        <Text style={[styles.proposalMeta, { color: colors.textTertiary }]}>
          {proposal.views.toLocaleString()} VIEWS
        </Text>
        <Text style={[styles.proposalMeta, { color: colors.textTertiary }]}>
          ENGAGEMENT <Text style={{ color: colors.gold }}>{(proposal.engagementRate * 100).toFixed(1)}%</Text>
        </Text>
      </View>
    </Animated.View>
  );
}

export default function AnalyticsScreen() {
  const { colors } = useTheme();
  const { token, user } = useAuthStore();
  const insets = useSafeAreaInsets();

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
      // Demo account — show seeded analytics for App Store review.
      if (user?.email === 'demo@represent.app') {
        const now = Date.now();
        const day = 24 * 60 * 60 * 1000;
        setAnalytics({
          totalProposals: 6,
          totalVotes: 4842,
          supportVotes: 3318,
          opposeVotes: 1524,
          proposals: [
            { id: 2001, title: 'Increase funding for student mental health services', views: 3104, supportVotes: 2104, opposeVotes: 88, engagementRate: 0.71, createdAt: new Date(now - 24 * day).toISOString() },
            { id: 2002, title: 'Extend library hours to 24/7 during finals week', views: 2380, supportVotes: 1336, opposeVotes: 184, engagementRate: 0.64, createdAt: new Date(now - 2 * day).toISOString() },
            { id: 2003, title: 'Replace dining hall vendor with local sustainable provider', views: 2018, supportVotes: 1125, opposeVotes: 312, engagementRate: 0.71, createdAt: new Date(now - 8 * day).toISOString() },
            { id: 2004, title: 'Adopt 4-day class week pilot for spring semester', views: 1742, supportVotes: 891, opposeVotes: 423, engagementRate: 0.75, createdAt: new Date(now - 32 * day).toISOString() },
            { id: 2005, title: 'Mandate AI ethics course in CS curriculum', views: 980, supportVotes: 479, opposeVotes: 92, engagementRate: 0.58, createdAt: new Date(now - 5 * day).toISOString() },
            { id: 2006, title: 'Build new engineering lab in Bessemer Hall', views: 1310, supportVotes: 567, opposeVotes: 491, engagementRate: 0.81, createdAt: new Date(now - 12 * day).toISOString() },
          ],
        });
        setLoading(false);
        setRefreshing(false);
        return;
      }

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
  }, [user?.email]);

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

  const monthBuckets = displayData?.proposals ? ballotsByMonth(displayData.proposals) : [];
  const monthMax = Math.max(1, ...monthBuckets.map(b => b.total));

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.gold}
          />
        }
      >
        {/* Header — back circle + serif title + status chip */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={[styles.backButton, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Your Analytics</Text>
          </View>
          <View style={[
            styles.headerChip,
            isPremium
              ? { backgroundColor: colors.goldSurface, borderColor: 'rgba(234,186,88,0.2)' }
              : { backgroundColor: colors.surfaceHighlight, borderColor: colors.border },
          ]}>
            {isPremium && <Ionicons name="sunny-outline" size={10} color={colors.gold} />}
            <Text style={[styles.headerChipText, { color: isPremium ? colors.gold : colors.textTertiary }]}>
              {isPremium ? 'PREMIUM' : 'SAMPLE'}
            </Text>
          </View>
        </View>

        {/* Premium Banner for non-premium users */}
        {!isPremium && (
          <Animated.View entering={FadeInDown.duration(300)}>
            <TouchableOpacity
              style={[styles.premiumBanner, { backgroundColor: colors.goldFill }]}
              onPress={() => setShowUpgradeModal(true)}
              activeOpacity={0.9}
            >
              <View style={styles.premiumBannerContent}>
                <Ionicons name="sparkles" size={18} color="#040707" />
                <Text style={styles.premiumBannerText}>
                  Sample data — upgrade to see your real analytics
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#040707" />
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Stat tiles — mono numerals */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.tilesRow}>
          <View style={[styles.statTile, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
            <Text style={[styles.statTileValue, { color: colors.text }]}>
              {(displayData?.totalVotes || 0).toLocaleString()}
            </Text>
            <Text style={[styles.statTileLabel, { color: colors.textTertiary }]}>BALLOTS ON YOUR PROPOSALS</Text>
          </View>
          <View style={[styles.statTile, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
            <Text style={[styles.statTileValue, { color: colors.text }]}>
              {(displayData?.totalProposals || 0).toLocaleString()}
            </Text>
            <Text style={[styles.statTileLabel, { color: colors.textTertiary }]}>PROPOSALS PUBLISHED</Text>
          </View>
        </Animated.View>

        {/* Support vs Oppose — two-tone tally, labels + exact counts */}
        <Animated.View
          entering={FadeInUp.delay(100).duration(400)}
          style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
        >
          <Text style={[styles.sectionCardEyebrow, { color: colors.textTertiary }]}>SUPPORT VS OPPOSE · ALL PROPOSALS</Text>
          {displayData && displayData.totalVotes > 0 ? (
            <>
              <View style={[styles.tallyTrack, { backgroundColor: colors.oppose }]}>
                <View style={[styles.tallyFill, { width: `${supportPercent}%`, backgroundColor: colors.support }]} />
              </View>
              <View style={styles.tallyLegendRow}>
                <Text style={[styles.tallyLegend, { color: colors.support }]}>
                  Support <Text style={styles.tallyLegendCount}>{(displayData.supportVotes || 0).toLocaleString()}</Text>
                </Text>
                <Text style={[styles.tallyLegendPct, { color: colors.textSecondary }]}>
                  {supportPercent}% · {100 - supportPercent}%
                </Text>
                <Text style={[styles.tallyLegend, { color: colors.oppose, textAlign: 'right' }]}>
                  Oppose <Text style={styles.tallyLegendCount}>{(displayData.opposeVotes || 0).toLocaleString()}</Text>
                </Text>
              </View>
            </>
          ) : (
            <Text style={[styles.mutedNote, { color: colors.textTertiary }]}>
              No ballots recorded yet — tallies appear once voting starts.
            </Text>
          )}
        </Animated.View>

        {/* Ballots by month — grouped by proposal creation month (the only
            time dimension in the payload), captioned honestly below. */}
        {monthBuckets.length > 1 && (
          <Animated.View
            entering={FadeInUp.delay(200).duration(400)}
            style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
          >
            <Text style={[styles.sectionCardEyebrow, { color: colors.textTertiary }]}>BALLOTS BY MONTH</Text>
            <View style={styles.chartRow}>
              {monthBuckets.map((bucket, i) => {
                const isLatest = i === monthBuckets.length - 1;
                return (
                  <View key={`${bucket.label}-${i}`} style={styles.chartCol}>
                    <View
                      style={[
                        styles.chartBar,
                        {
                          height: `${Math.max(6, Math.round((bucket.total / monthMax) * 100))}%`,
                          backgroundColor: isLatest ? colors.goldFill : colors.surfaceHighlight,
                        },
                      ]}
                    />
                    <Text style={[styles.chartBarLabel, { color: isLatest ? colors.gold : colors.textTertiary }]}>
                      {bucket.label}
                    </Text>
                  </View>
                );
              })}
            </View>
            <Text style={[styles.mutedNote, { color: colors.textTertiary }]}>
              Ballots grouped by the month each proposal was created.
            </Text>
          </Animated.View>
        )}

        {/* Per-Proposal Analytics */}
        {displayData?.proposals && displayData.proposals.length > 0 && (
          <Animated.View entering={FadeInUp.delay(300).duration(400)} style={{ gap: 7 }}>
            <Text style={[styles.sectionEyebrow, { color: colors.textTertiary }]}>PROPOSAL PERFORMANCE</Text>
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
            <View style={[styles.emptyIcon, { backgroundColor: colors.goldSurface }]}>
              <Ionicons name="bar-chart-outline" size={32} color={colors.gold} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              No Proposals Yet
            </Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Create proposals to start tracking your analytics
            </Text>
            <TouchableOpacity
              style={[styles.createBtn, { backgroundColor: colors.goldFill }]}
              onPress={() => router.push('/(tabs)/proposals')}
              activeOpacity={0.8}
            >
              <Text style={styles.createBtnText}>Create Proposal</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        <Text style={[styles.privacyNote, { color: colors.textTertiary }]}>
          Analytics are private to you. Nothing here is public or shared.
        </Text>

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
    fontFamily: FONTS.sans,
    fontSize: 13.5,
    lineHeight: 20,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.screenPadding,
  },
  content: {
    paddingHorizontal: SPACING.screenPadding,
    gap: 15,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: FONTS.serif,
    fontSize: 26,
    lineHeight: 29,
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  headerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: RADIUS.chip,
    borderWidth: 1,
  },
  headerChipText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 9.5,
    letterSpacing: 1.33,
  },

  premiumBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.button,
  },
  premiumBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  premiumBannerText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12.5,
    color: '#040707',
    flex: 1,
  },

  // Stat tiles
  tilesRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statTile: {
    flex: 1,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    padding: 16,
    gap: 3,
  },
  statTileValue: {
    fontFamily: FONTS.monoSemiBold,
    fontSize: 30,
    lineHeight: 38,
    fontVariant: ['tabular-nums'],
  },
  statTileLabel: {
    fontFamily: FONTS.sansMedium,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1,
  },

  // Section cards
  sectionCard: {
    borderRadius: RADIUS.card,
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
  sectionCardEyebrow: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    letterSpacing: 1.4,
  },
  sectionEyebrow: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10.5,
    letterSpacing: 1.47,
  },

  // Two-tone tally bar (support fill on oppose track)
  tallyTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  tallyFill: {
    height: '100%',
  },
  tallyLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  tallyLegend: {
    fontFamily: FONTS.sansMedium,
    fontSize: 12,
    flex: 1,
  },
  tallyLegendCount: {
    fontFamily: FONTS.monoSemiBold,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  tallyLegendPct: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  mutedNote: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    lineHeight: 16.5,
  },

  // Ballots-by-month chart
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 7,
    height: 72,
  },
  chartCol: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 4,
  },
  chartBar: {
    width: '100%',
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  chartBarLabel: {
    fontFamily: FONTS.mono,
    fontSize: 8.5,
    fontVariant: ['tabular-nums'],
  },

  // Proposal cards
  proposalCard: {
    borderRadius: RADIUS.card,
    borderWidth: 1,
    padding: 18,
    gap: 10,
  },
  proposalTitle: {
    fontFamily: FONTS.serif,
    fontSize: 16,
    lineHeight: 21,
  },
  proposalMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 10,
  },
  proposalMeta: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 0.5,
    fontVariant: ['tabular-nums'],
  },

  // Premium Upgrade Card Styles (secondary sub-view, kept + restyled)
  premiumHero: {
    alignItems: 'center',
    paddingVertical: SPACING.xxxl,
    borderRadius: RADIUS['2xl'],
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
    fontFamily: FONTS.serif,
    fontSize: responsive(28, 32, 36),
    marginBottom: SPACING.xs,
  },
  premiumSubtitle: {
    ...TYPOGRAPHY.bodyLarge,
  },
  descriptionCard: {
    padding: SPACING.xl,
    borderRadius: RADIUS['2xl'],
    borderWidth: 1,
    marginBottom: SPACING.lg,
  },
  descriptionTitle: {
    fontFamily: FONTS.serif,
    fontSize: 18,
    marginBottom: SPACING.md,
  },
  descriptionText: {
    ...TYPOGRAPHY.bodyMedium,
    lineHeight: 24,
  },
  featuresCard: {
    padding: SPACING.xl,
    borderRadius: RADIUS['2xl'],
    borderWidth: 1,
    marginBottom: SPACING.lg,
    overflow: 'hidden',
  },
  featuresTitle: {
    fontFamily: FONTS.serif,
    fontSize: 18,
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
    borderRadius: RADIUS['2xl'],
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
    color: '#040707',
    opacity: 0.7,
    marginBottom: SPACING.xxs,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  priceAmount: {
    fontFamily: FONTS.monoSemiBold,
    fontVariant: ['tabular-nums'],
    fontSize: responsive(28, 32, 36),
    color: '#040707',
  },
  pricePeriod: {
    ...TYPOGRAPHY.bodyMedium,
    color: '#040707',
    opacity: 0.7,
    marginLeft: SPACING.xxs,
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#040707',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.full,
    gap: SPACING.sm,
  },
  upgradeButtonText: {
    ...TYPOGRAPHY.labelLarge,
    color: '#F4F5F6',
  },
  pricingNote: {
    ...TYPOGRAPHY.bodySmall,
    color: '#040707',
    opacity: 0.7,
    textAlign: 'center',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xxxl,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  emptyTitle: {
    fontFamily: FONTS.serif,
    fontSize: 22,
    marginBottom: SPACING.sm,
  },
  emptyText: {
    fontFamily: FONTS.sans,
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: SPACING.xl,
  },
  createBtn: {
    height: 52,
    paddingHorizontal: SPACING['3xl'],
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createBtnText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 15,
    color: '#040707',
  },
  privacyNote: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    lineHeight: 16.5,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },

  bottomPadding: {
    height: 100,
  },
});
