import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { proposalsApi, type Proposal } from '../../lib/api';
import { useAuthStore } from '../../lib/auth';
import {
  canUserVoteOnProposal,
  getLocationLabel,
  getTierLabel,
  normalizeCountryName,
} from '../../lib/proposalGeo';
import { WorldMap } from '../../components/discover/WorldMap';
import { CountryBottomSheet } from '../../components/discover/CountryBottomSheet';
import { GlobalsPill } from '../../components/discover/GlobalsPill';

const O_BG = '#040707';
const O_BG_RAISED = '#15181C';
const O_LINE = '#1E2228';
const O_GOLD = '#EABA58';
const O_FG = '#F4F5F6';
const O_FG_MUTED = '#C7CACD';
const O_FG_FAINT = '#8E9297';
const SERIF = 'Georgia';
const TRENDING_COUNT = 5;

type CountryStat = {
  name: string;
  proposalCount: number;
  totalVotes: number;
};

function isActive(p: Proposal): boolean {
  if (!p.deadline) return true;
  const t = Date.parse(p.deadline);
  if (isNaN(t)) return true;
  return t > Date.now();
}

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [showGlobals, setShowGlobals] = useState(false);

  const loadData = useCallback(async () => {
    const res = await proposalsApi.getAll();
    if (res.data) setProposals(res.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  // Aggregate active proposals by country.
  // Globals (length 0) are not put on the map; they live in the pill.
  const { countryStats, proposalsByCountry, globalProposals } = useMemo(() => {
    const stats = new Map<string, CountryStat>();
    const byCountry = new Map<string, Proposal[]>();
    const globals: Proposal[] = [];

    for (const p of proposals) {
      if (!isActive(p)) continue;
      const geo = p.geoRestrictions || [];
      if (geo.length === 0) {
        globals.push(p);
        continue;
      }
      const country = normalizeCountryName(geo[0]);
      const existing = stats.get(country) ?? {
        name: country,
        proposalCount: 0,
        totalVotes: 0,
      };
      existing.proposalCount += 1;
      existing.totalVotes += (p.supportVotes || 0) + (p.opposeVotes || 0);
      stats.set(country, existing);

      const list = byCountry.get(country) ?? [];
      list.push(p);
      byCountry.set(country, list);
    }

    return {
      countryStats: stats,
      proposalsByCountry: byCountry,
      globalProposals: globals,
    };
  }, [proposals]);

  const handleSelectCountry = useCallback((countryName: string) => {
    setSelectedCountry(countryName);
  }, []);

  const handleCloseSheet = useCallback(() => {
    setSelectedCountry(null);
    setShowGlobals(false);
  }, []);

  const selectedProposals = selectedCountry
    ? proposalsByCountry.get(selectedCountry) ?? []
    : [];

  // Top N active proposals worldwide by total votes — fills the area below
  // the map and gives the user something to scroll to even if they don't
  // tap a country.
  const trending = useMemo(() => {
    return proposals
      .filter(isActive)
      .sort(
        (a, b) =>
          (b.supportVotes || 0) + (b.opposeVotes || 0) -
          ((a.supportVotes || 0) + (a.opposeVotes || 0)),
      )
      .slice(0, TRENDING_COUNT);
  }, [proposals]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: O_BG }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={O_GOLD}
          />
        }
      >
        <View style={styles.headerBlock}>
          <Text style={styles.eyebrow}>DISCOVER</Text>
          <Text style={styles.title}>Civic life, worldwide</Text>
          <Text style={styles.subtitle}>
            What's happening across geos right now
          </Text>
        </View>

        <View style={styles.pillRow}>
          <GlobalsPill
            count={globalProposals.length}
            onPress={() => setShowGlobals(true)}
          />
        </View>

        {loading ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator color={O_GOLD} />
          </View>
        ) : (
          <WorldMap
            countryStats={countryStats}
            onSelectCountry={handleSelectCountry}
          />
        )}

        {!loading && trending.length > 0 && (
          <View style={styles.trendingBlock}>
            <View style={styles.trendingHeader}>
              <Text style={styles.sectionLabel}>TRENDING WORLDWIDE</Text>
              <Text style={styles.sectionMeta}>by total votes</Text>
            </View>
            {trending.map((p) => (
              <TrendingRow key={p.id} proposal={p} user={user} />
            ))}
          </View>
        )}
      </ScrollView>

      {selectedCountry && (
        <CountryBottomSheet
          countryName={selectedCountry}
          proposals={selectedProposals}
          user={user}
          onClose={handleCloseSheet}
        />
      )}

      {showGlobals && (
        <CountryBottomSheet
          countryName="Global Proposals"
          eyebrow="GLOBAL · DISCOVER"
          proposals={globalProposals}
          user={user}
          onClose={handleCloseSheet}
        />
      )}
    </GestureHandlerRootView>
  );
}

type TrendingUser = {
  country: string | null;
  state: string | null;
  city: string | null;
  verified: boolean | null;
} | null;

function TrendingRow({
  proposal,
  user,
}: {
  proposal: Proposal;
  user: TrendingUser;
}) {
  const canVote = canUserVoteOnProposal(
    proposal,
    user?.country || '',
    user?.state || '',
    user?.city || '',
    user?.verified ?? false,
  );
  const support = proposal.supportVotes || 0;
  const oppose = proposal.opposeVotes || 0;
  const total = support + oppose;
  const tier = getTierLabel(proposal.geoRestrictions);
  const location = getLocationLabel(proposal.geoRestrictions);

  const handlePress = () => {
    Haptics.selectionAsync();
    router.push({
      pathname: '/(tabs)/proposals',
      params: { proposalId: String(proposal.id) },
    });
  };

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={handlePress}
      style={styles.trendingRow}
    >
      <View style={styles.trendingMeta}>
        <Text style={styles.trendingTier}>{tier}</Text>
        <Text style={styles.trendingLocation}>· {location}</Text>
        {!canVote && (
          <Ionicons
            name="lock-closed"
            size={11}
            color={O_FG_FAINT}
            style={{ marginLeft: 4 }}
          />
        )}
      </View>
      <Text style={styles.trendingTitle} numberOfLines={2}>
        {proposal.title}
      </Text>
      <Text style={styles.trendingVotes}>
        <Text style={styles.trendingVotesNum}>{total.toLocaleString()}</Text>
        {' '}votes · {support.toLocaleString()} support · {oppose.toLocaleString()} oppose
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  headerBlock: {
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  eyebrow: {
    color: O_GOLD,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    marginBottom: 6,
  },
  title: {
    color: O_FG,
    fontFamily: SERIF,
    fontSize: 30,
    fontWeight: '600',
    letterSpacing: -0.6,
    marginBottom: 4,
  },
  subtitle: {
    color: O_FG_MUTED,
    fontSize: 13,
    letterSpacing: -0.05,
  },
  pillRow: {
    paddingHorizontal: 18,
    marginBottom: 8,
    alignItems: 'center',
  },
  loadingBlock: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  trendingBlock: {
    paddingHorizontal: 18,
    marginTop: 24,
  },
  trendingHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionLabel: {
    color: O_GOLD,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  sectionMeta: {
    color: O_FG_FAINT,
    fontSize: 10.5,
    fontStyle: 'italic',
    letterSpacing: 0.2,
  },
  trendingRow: {
    backgroundColor: O_BG_RAISED,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: O_LINE,
    marginBottom: 8,
  },
  trendingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 4,
  },
  trendingTier: {
    color: O_GOLD,
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  trendingLocation: {
    color: O_FG_FAINT,
    fontSize: 10.5,
    letterSpacing: 0.2,
  },
  trendingTitle: {
    color: O_FG,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 19,
    marginBottom: 6,
  },
  trendingVotes: {
    color: O_FG_FAINT,
    fontSize: 11.5,
  },
  trendingVotesNum: {
    color: O_FG_MUTED,
    fontWeight: '700',
  },
});
