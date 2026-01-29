import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../lib/auth';
import { useTheme } from '../../lib/theme';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://representportal.com';

interface VotedProposal { id: number; title: string; position: 'support' | 'oppose'; supportVotes: number; opposeVotes: number; votedAt: string; }

export default function VotingHistoryScreen() {
  const { colors } = useTheme();
  const { token } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [votedProposals, setVotedProposals] = useState<VotedProposal[]>([]);

  useEffect(() => { fetchVotingHistory(); }, []);

  const fetchVotingHistory = async () => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const response = await fetch(`${API_URL}/api/user/voted-proposals`, { headers });
      if (response.ok) {
        const data = await response.json();
        const proposals = data.votedProposals || data || [];
        setVotedProposals(proposals.map((p: any) => ({
          id: p.proposalId || p.id,
          title: p.title || 'Untitled Proposal',
          position: p.position,
          supportVotes: p.supportVotes || 0,
          opposeVotes: p.opposeVotes || 0,
          votedAt: p.votedAt || p.timestamp,
        })));
      }
    } catch (error) { console.error('Failed to fetch voting history:', error); }
    finally { setLoading(false); setRefreshing(false); }
  };

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  if (loading) return <View style={[styles.container, { backgroundColor: colors.background }]}><ActivityIndicator size="large" color={colors.gold} style={{ marginTop: 40 }} /></View>;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchVotingHistory(); }} tintColor={colors.gold} />}>
        {votedProposals.length > 0 ? (
          <>
            <View style={[styles.statsCard, { backgroundColor: colors.cardBg, borderColor: colors.gold }]}><Text style={[styles.statsNumber, { color: colors.gold }]}>{votedProposals.length}</Text><Text style={[styles.statsLabel, { color: colors.textSecondary }]}>Total Votes Cast</Text></View>
            {votedProposals.map((proposal) => {
              const totalVotes = (proposal.supportVotes || 0) + (proposal.opposeVotes || 0);
              const supportPercent = totalVotes > 0 ? ((proposal.supportVotes || 0) / totalVotes) * 100 : 0;
              const isSupport = proposal.position === 'support';
              return (
                <View key={proposal.id} style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                  <View style={styles.cardHeader}>
                    <Text style={[styles.proposalTitle, { color: colors.text }]} numberOfLines={2}>{proposal.title}</Text>
                    <View style={[styles.voteBadge, { backgroundColor: isSupport ? colors.successLight : colors.errorLight }]}><Ionicons name={isSupport ? "thumbs-up" : "thumbs-down"} size={12} color={isSupport ? colors.success : colors.error} /><Text style={[styles.voteBadgeText, { color: isSupport ? colors.success : colors.error }]}>{isSupport ? 'SUPPORTED' : 'OPPOSED'}</Text></View>
                  </View>
                  <View style={styles.progressContainer}><View style={[styles.progressBar, { backgroundColor: colors.border }]}><View style={[styles.progressFill, { width: `${supportPercent}%`, backgroundColor: colors.success }]} /></View><Text style={[styles.progressText, { color: colors.textSecondary }]}>{supportPercent.toFixed(0)}% support</Text></View>
                  <View style={styles.statsRow}><View style={styles.stat}><Ionicons name="thumbs-up-outline" size={14} color={colors.success} /><Text style={[styles.statText, { color: colors.success }]}>{proposal.supportVotes || 0}</Text></View><View style={styles.stat}><Ionicons name="thumbs-down-outline" size={14} color={colors.error} /><Text style={[styles.statText, { color: colors.error }]}>{proposal.opposeVotes || 0}</Text></View>{proposal.votedAt && <Text style={[styles.dateText, { color: colors.textSecondary }]}>{formatDate(proposal.votedAt)}</Text>}</View>
                </View>
              );
            })}
          </>
        ) : (
          <View style={styles.emptyState}><Ionicons name="document-text-outline" size={48} color={colors.textSecondary} /><Text style={[styles.emptyText, { color: colors.textSecondary }]}>No votes cast yet</Text><Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>Vote on proposals to see your history here</Text></View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  statsCard: { borderRadius: 12, padding: 20, marginBottom: 20, borderWidth: 1, alignItems: 'center' },
  statsNumber: { fontSize: 36, fontWeight: 'bold' },
  statsLabel: { fontSize: 14, marginTop: 4 },
  card: { borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  proposalTitle: { fontSize: 15, fontWeight: '600', flex: 1, marginRight: 10 },
  voteBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, gap: 4 },
  voteBadgeText: { fontSize: 10, fontWeight: 'bold' },
  progressContainer: { marginBottom: 12 },
  progressBar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  progressText: { fontSize: 12, marginTop: 4 },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 13, fontWeight: '600' },
  dateText: { fontSize: 12, marginLeft: 'auto' },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptySubtext: { fontSize: 14, marginTop: 8, textAlign: 'center' },
});
