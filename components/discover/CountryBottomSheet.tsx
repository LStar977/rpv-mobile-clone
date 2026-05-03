import { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import type { Proposal } from '../../lib/api';
import {
  getTierLabel,
  getLocationLabel,
  canUserVoteOnProposal,
} from '../../lib/proposalGeo';

const O_GOLD = '#EABA58';
const O_BG_CARD = '#0D0F12';
const O_BG_RAISED = '#15181C';
const O_LINE = '#1E2228';
const O_LINE_STRONG = '#2A2F37';
const O_FG = '#F4F5F6';
const O_FG_MUTED = '#C7CACD';
const O_FG_FAINT = '#8E9297';
const SERIF = 'Georgia';

export type CountryBottomSheetProps = {
  countryName: string;
  proposals: Proposal[];
  user: {
    country: string | null;
    state: string | null;
    city: string | null;
    verified: boolean | null;
  } | null;
  onClose: () => void;
  eyebrow?: string;
};

type Bucket = 'Global' | 'Federal' | 'Provincial' | 'Municipal';

function tierBucket(tier: string): Bucket {
  if (tier === 'GLOBAL') return 'Global';
  if (tier === 'FEDERAL') return 'Federal';
  if (tier === 'PROVINCIAL') return 'Provincial';
  return 'Municipal';
}

export function CountryBottomSheet({
  countryName,
  proposals,
  user,
  onClose,
  eyebrow = 'COUNTRY · DISCOVER',
}: CountryBottomSheetProps) {
  const insets = useSafeAreaInsets();

  const grouped = useMemo(() => {
    const buckets: Record<Bucket, Proposal[]> = {
      Global: [],
      Federal: [],
      Provincial: [],
      Municipal: [],
    };
    for (const p of proposals) {
      const tier = getTierLabel(p.geoRestrictions);
      buckets[tierBucket(tier)].push(p);
    }
    return buckets;
  }, [proposals]);

  const total = proposals.length;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable
        onPress={onClose}
        style={[StyleSheet.absoluteFill, styles.scrim]}
      />
      <View
        style={[
          styles.sheet,
          { paddingBottom: 28 + insets.bottom, maxHeight: '78%' },
        ]}
      >
        <View style={styles.handle} />

        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>{eyebrow}</Text>
            <Text style={styles.title}>{countryName}</Text>
            <Text style={styles.subtitle}>
              {total} active proposal{total === 1 ? '' : 's'}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={22} color={O_FG_MUTED} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {(['Global', 'Federal', 'Provincial', 'Municipal'] as const).map((bucket) => {
            const items = grouped[bucket];
            if (items.length === 0) return null;
            return (
              <View key={bucket} style={styles.section}>
                <Text style={styles.sectionLabel}>{bucket}</Text>
                {items.map((p) => (
                  <ProposalRow
                    key={p.id}
                    proposal={p}
                    user={user}
                  />
                ))}
              </View>
            );
          })}
          {total === 0 && (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                No active proposals here yet.
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

function ProposalRow({
  proposal,
  user,
}: {
  proposal: Proposal;
  user: CountryBottomSheetProps['user'];
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
  const supportPct = total > 0 ? (support / total) * 100 : 50;
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
      activeOpacity={0.8}
      onPress={handlePress}
      style={styles.row}
    >
      <View style={styles.rowHeader}>
        <Text style={styles.tierLabel}>{tier}</Text>
        <Text style={styles.locationLabel}>· {location}</Text>
      </View>
      <Text style={styles.rowTitle} numberOfLines={2}>
        {proposal.title}
      </Text>

      <View style={styles.voteBar}>
        <View
          style={[
            styles.voteBarFill,
            { width: `${supportPct}%`, backgroundColor: O_GOLD },
          ]}
        />
      </View>
      <View style={styles.voteRow}>
        <Text style={styles.voteText}>
          {support.toLocaleString()} support
        </Text>
        <Text style={styles.voteTextMuted}>·</Text>
        <Text style={styles.voteText}>
          {oppose.toLocaleString()} oppose
        </Text>
      </View>

      {!canVote && (
        <View style={styles.lockBadge}>
          <Ionicons name="lock-closed" size={11} color={O_FG_FAINT} />
          <Text style={styles.lockText}>
            Vote restricted to {location} residents
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  scrim: {
    backgroundColor: 'rgba(2,4,6,0.72)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: O_BG_CARD,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderTopColor: O_LINE,
    paddingTop: 14,
    paddingHorizontal: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 24,
  },
  handle: {
    width: 36,
    height: 3,
    borderRadius: 2,
    backgroundColor: O_LINE_STRONG,
    alignSelf: 'center',
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  eyebrow: {
    color: O_GOLD,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  title: {
    color: O_FG,
    fontFamily: SERIF,
    fontSize: 24,
    fontWeight: '600',
    letterSpacing: -0.4,
    marginBottom: 2,
  },
  subtitle: {
    color: O_FG_MUTED,
    fontSize: 12.5,
    letterSpacing: -0.05,
  },
  section: {
    marginBottom: 16,
  },
  sectionLabel: {
    color: O_FG_FAINT,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  row: {
    backgroundColor: O_BG_RAISED,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: O_LINE,
    marginBottom: 8,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 4,
  },
  tierLabel: {
    color: O_GOLD,
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  locationLabel: {
    color: O_FG_FAINT,
    fontSize: 10.5,
    letterSpacing: 0.2,
  },
  rowTitle: {
    color: O_FG,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 19,
    marginBottom: 10,
  },
  voteBar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: O_LINE,
    overflow: 'hidden',
    marginBottom: 6,
  },
  voteBarFill: {
    height: '100%',
  },
  voteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  voteText: {
    color: O_FG_MUTED,
    fontSize: 11,
  },
  voteTextMuted: {
    color: O_FG_FAINT,
    fontSize: 11,
  },
  lockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: O_LINE,
  },
  lockText: {
    color: O_FG_FAINT,
    fontSize: 11,
    fontStyle: 'italic',
  },
  empty: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  emptyText: {
    color: O_FG_FAINT,
    fontSize: 13,
  },
});
