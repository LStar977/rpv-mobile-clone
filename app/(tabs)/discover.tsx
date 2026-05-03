import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { proposalsApi, type Proposal } from '../../lib/api';
import { useAuthStore } from '../../lib/auth';
import { normalizeCountryName } from '../../lib/proposalGeo';
import { WorldMap } from '../../components/discover/WorldMap';
import { CountryBottomSheet } from '../../components/discover/CountryBottomSheet';
import { GlobalsPill } from '../../components/discover/GlobalsPill';

const O_BG = '#040707';
const O_GOLD = '#EABA58';
const O_FG = '#F4F5F6';
const O_FG_MUTED = '#C7CACD';
const SERIF = 'Georgia';

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
});
