import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Animated, Dimensions, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme, responsive } from '../../lib/theme';
import { useAuthStore } from '../../lib/auth';

const { width } = Dimensions.get('window');

interface Badge {
  id: string; name: string; description: string; icon: string;
  tier: 'common' | 'rare' | 'epic' | 'legendary'; category: string; earnedAt?: string; unlocked: boolean;
}

const ALL_BADGES: Badge[] = [
  { id: 'first_vote', name: 'First Vote', description: 'Cast your first vote on a proposal', icon: '🗳️', tier: 'common', category: 'voting', unlocked: false },
  { id: 'first_vote_country', name: 'National Voice', description: 'Cast your first vote on a national proposal', icon: '🏛️', tier: 'common', category: 'voting', unlocked: false },
  { id: 'first_vote_state', name: 'State Advocate', description: 'Cast your first vote on a state proposal', icon: '🗺️', tier: 'rare', category: 'voting', unlocked: false },
  { id: 'first_vote_city', name: 'Local Champion', description: 'Cast your first vote on a city proposal', icon: '🏙️', tier: 'rare', category: 'voting', unlocked: false },
  { id: 'vote_streak_5', name: 'Consistent Voter', description: 'Vote on 5 different proposals', icon: '🔥', tier: 'common', category: 'streak', unlocked: false },
  { id: 'vote_streak_25', name: 'Dedicated Citizen', description: 'Vote on 25 different proposals', icon: '⭐', tier: 'rare', category: 'streak', unlocked: false },
  { id: 'vote_streak_100', name: 'Democracy Hero', description: 'Vote on 100 different proposals', icon: '🏆', tier: 'legendary', category: 'streak', unlocked: false },
  { id: 'first_proposal', name: 'Proposal Pioneer', description: 'Create your first proposal', icon: '📝', tier: 'common', category: 'creator', unlocked: false },
  { id: 'proposal_5', name: 'Active Legislator', description: 'Create 5 proposals', icon: '📋', tier: 'epic', category: 'creator', unlocked: false },
  { id: 'referral_5', name: 'Community Builder', description: 'Refer 5 new users', icon: '🤝', tier: 'rare', category: 'social', unlocked: false },
  { id: 'referral_20', name: 'Movement Leader', description: 'Refer 20 new users', icon: '👥', tier: 'epic', category: 'social', unlocked: false },
  { id: 'passport_minted', name: 'Verified Citizen', description: 'Mint your Represent Passport NFT', icon: '🛂', tier: 'epic', category: 'identity', unlocked: false },
  { id: 'early_adopter', name: 'Early Adopter', description: 'Join during the beta period', icon: '🚀', tier: 'legendary', category: 'special', unlocked: false },
  { id: 'democratic_spirit', name: 'Democratic Spirit', description: 'Vote on both sides of the aisle', icon: '⚖️', tier: 'rare', category: 'special', unlocked: false },
  { id: 'global_citizen', name: 'Global Citizen', description: 'Participate in governance across multiple regions', icon: '🌍', tier: 'legendary', category: 'special', unlocked: false },
];

const TIER_COLORS = {
  common: { bg: '#6b7280', glow: 'rgba(107, 114, 128, 0.3)' },
  rare: { bg: '#3b82f6', glow: 'rgba(59, 130, 246, 0.4)' },
  epic: { bg: '#8b5cf6', glow: 'rgba(139, 92, 246, 0.5)' },
  legendary: { bg: '#f59e0b', glow: 'rgba(245, 158, 11, 0.6)' },
};

function BadgeCard({ badge, index, colors }: { badge: Badge; index: number; colors: any }) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const tierColor = TIER_COLORS[badge.tier];

  useEffect(() => {
    Animated.sequence([
      Animated.delay(index * 60),
      Animated.spring(scaleAnim, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
    ]).start();
    if (badge.unlocked) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 1500, useNativeDriver: false }),
          Animated.timing(glowAnim, { toValue: 0, duration: 1500, useNativeDriver: false }),
        ])
      ).start();
    }
  }, []);

  return (
    <Animated.View style={[
      styles.badgeCard,
      { backgroundColor: colors.cardBg, borderColor: badge.unlocked ? tierColor.bg : colors.border,
        transform: [{ scale: scaleAnim }], opacity: badge.unlocked ? 1 : 0.4,
        shadowColor: tierColor.bg, shadowOpacity: badge.unlocked ? 0.5 : 0, shadowRadius: 10,
        shadowOffset: { width: 0, height: 0 }, elevation: badge.unlocked ? 8 : 0 },
    ]}>
      <View style={styles.badgeIconContainer}>
        <Text style={[styles.badgeIcon, { opacity: badge.unlocked ? 1 : 0.5 }]}>{badge.icon}</Text>
        {badge.unlocked && (
          <View style={[styles.checkmark, { backgroundColor: colors.success }]}>
            <Ionicons name="checkmark" size={10} color="#fff" />
          </View>
        )}
      </View>
      <Text style={[styles.badgeName, { color: badge.unlocked ? colors.text : colors.textSecondary }]} numberOfLines={1}>{badge.name}</Text>
      <View style={[styles.tierBadge, { backgroundColor: tierColor.bg + (badge.unlocked ? '40' : '20') }]}>
        <Text style={[styles.tierText, { color: tierColor.bg }]}>{badge.tier.toUpperCase()}</Text>
      </View>
      <Text style={[styles.badgeDesc, { color: colors.textSecondary }]} numberOfLines={2}>{badge.description}</Text>
      {badge.earnedAt && <Text style={[styles.earnedDate, { color: colors.gold }]}>{new Date(badge.earnedAt).toLocaleDateString()}</Text>}
    </Animated.View>
  );
}

export default function BadgesScreen() {
  const { colors } = useTheme();
  const { user, token } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [selectedTier, setSelectedTier] = useState<string>('all');
  const headerAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://representportal.com';

  useEffect(() => {
    fetchBadges();
    Animated.timing(headerAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  const fetchBadges = async () => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const response = await fetch(`${API_URL}/api/badges/user/${user?.id}`, { headers });
      if (response.ok) {
        const earnedBadges = await response.json();
        const earnedIds = new Set(earnedBadges.map((b: any) => b.badgeId || b.badge?.id || b.id));
        const allWithStatus = ALL_BADGES.map(badge => ({
          ...badge,
          unlocked: earnedIds.has(badge.id),
          earnedAt: earnedBadges.find((b: any) => (b.badgeId || b.badge?.id || b.id) === badge.id)?.earnedAt,
        }));
        allWithStatus.sort((a, b) => {
          if (a.unlocked && !b.unlocked) return -1;
          if (!a.unlocked && b.unlocked) return 1;
          const tierOrder = { legendary: 0, epic: 1, rare: 2, common: 3 };
          return tierOrder[a.tier] - tierOrder[b.tier];
        });
        setBadges(allWithStatus);
        const unlockedCount = allWithStatus.filter(b => b.unlocked).length;
        Animated.timing(progressAnim, { toValue: unlockedCount / allWithStatus.length, duration: 1000, useNativeDriver: false }).start();
      } else {
        setBadges(ALL_BADGES);
      }
    } catch (error) {
      console.error('Error fetching badges:', error);
      setBadges(ALL_BADGES);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filteredBadges = selectedTier === 'all' ? badges : badges.filter(b => b.tier === selectedTier);
  const unlockedCount = badges.filter(b => b.unlocked).length;
  const totalCount = badges.length;
  const progressWidth = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Achievements</Text>
        <View style={{ width: 40 }} />
      </View>
      <Animated.View style={[styles.statsContainer, { backgroundColor: colors.cardBg, borderColor: colors.border, opacity: headerAnim }]}>
        <View style={styles.statsRow}>
          <View style={styles.statItem}><Text style={[styles.statValue, { color: colors.gold }]}>{unlockedCount}</Text><Text style={[styles.statLabel, { color: colors.textSecondary }]}>Unlocked</Text></View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}><Text style={[styles.statValue, { color: colors.text }]}>{totalCount}</Text><Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total</Text></View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}><Text style={[styles.statValue, { color: colors.success }]}>{totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0}%</Text><Text style={[styles.statLabel, { color: colors.textSecondary }]}>Complete</Text></View>
        </View>
        <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
          <Animated.View style={[styles.progressFill, { backgroundColor: colors.gold, width: progressWidth }]} />
        </View>
      </Animated.View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterContainer} contentContainerStyle={styles.filterContent}>
        {['all', 'legendary', 'epic', 'rare', 'common'].map(tier => (
          <TouchableOpacity key={tier} style={[styles.filterChip, { backgroundColor: selectedTier === tier ? colors.gold : colors.cardBg, borderColor: selectedTier === tier ? colors.gold : colors.border }]} onPress={() => setSelectedTier(tier)}>
            <Text style={[styles.filterText, { color: selectedTier === tier ? '#000' : colors.text }]}>{tier === 'all' ? 'All' : tier.charAt(0).toUpperCase() + tier.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {loading ? (
        <View style={styles.loadingContainer}><ActivityIndicator size="large" color={colors.gold} /></View>
      ) : (
        <ScrollView style={styles.badgesList} contentContainerStyle={styles.badgesGrid} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchBadges(); }} tintColor={colors.gold} />}>
          {filteredBadges.map((badge, index) => <BadgeCard key={badge.id} badge={badge} index={index} colors={colors} />)}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: 'Georgia', fontSize: 20, fontWeight: '500' },
  statsContainer: { marginHorizontal: 16, marginTop: 16, padding: 16, borderRadius: 16, borderWidth: 1 },
  statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginBottom: 16 },
  statItem: { alignItems: 'center' },
  statValue: { fontFamily: 'Georgia', fontSize: responsive(24, 26, 28), fontWeight: '500' },
  statLabel: { fontSize: 12, marginTop: 4 },
  statDivider: { width: 1, height: 40 },
  progressBar: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  filterContainer: { marginTop: 16, maxHeight: 50 },
  filterContent: { paddingHorizontal: 16, gap: 8, flexDirection: 'row' },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  filterText: { fontSize: 14, fontWeight: '500' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  badgesList: { flex: 1, marginTop: 16 },
  badgesGrid: { paddingHorizontal: 16, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  badgeCard: { width: (width - 48) / 2, padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 16, alignItems: 'center' },
  badgeIconContainer: { position: 'relative', marginBottom: 12 },
  badgeIcon: { fontSize: 40 },
  checkmark: { position: 'absolute', bottom: -4, right: -4, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  badgeName: { fontFamily: 'Georgia', fontSize: 14, fontWeight: '500', textAlign: 'center', marginBottom: 6 },
  tierBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginBottom: 8 },
  tierText: { fontSize: 10, fontWeight: 'bold' },
  badgeDesc: { fontSize: 11, textAlign: 'center', lineHeight: 16 },
  earnedDate: { fontSize: 10, marginTop: 8, fontWeight: '500' },
});
