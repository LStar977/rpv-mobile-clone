// Detail screen for non-yes-no global proposals (RCV / multiple-choice).
// Yes-no proposals stay on the swipe deck — they never route here.
//
// Mirrors app/modals/org-proposal-detail.tsx but without org-specific
// scaffolding (no orgId, no orgName, no organizationsApi.voteOnProposal —
// uses proposalsApi.submitVote with the unified RCV/MC payloads).
import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn } from 'react-native-reanimated';
import { proposalsApi } from '../../lib/api';
import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '../../lib/theme';
import { RCVBallotInput } from '../../components/ui/RCVBallotInput';
import { RCVResults } from '../../components/ui/RCVResults';
import { MultipleChoiceBallot } from '../../components/ui/MultipleChoiceBallot';
import { MultipleChoiceResults } from '../../components/ui/MultipleChoiceResults';
import { ProposalModerationMenu } from '../../components/moderation/ProposalModerationMenu';

function isVotingEnded(deadline: string | null): boolean {
  if (!deadline) return false;
  return new Date(deadline).getTime() < Date.now();
}

export default function ProposalDetailScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    proposalId: string;
    title: string;
    description: string;
    category: string;
    deadline: string;
    voteType: string;
    // options is JSON-encoded array of strings (URL params can't carry arrays)
    options: string;
    creatorId: string;
    creatorName: string;
  }>();

  const proposalId = params.proposalId || '';
  const title = params.title || 'Proposal';
  const description = params.description || '';
  const category = params.category || 'General';
  const deadline = params.deadline || null;
  const creatorId = params.creatorId || null;
  const creatorName = params.creatorName || 'Community Member';
  const voteType: 'multiple-choice' | 'ranked-choice' =
    params.voteType === 'ranked-choice' ? 'ranked-choice' : 'multiple-choice';
  const proposalOptions: string[] = (() => {
    try {
      const parsed = JSON.parse(params.options || '[]');
      return Array.isArray(parsed) ? parsed.filter((p) => typeof p === 'string') : [];
    } catch {
      return [];
    }
  })();

  const isEnded = isVotingEnded(deadline);

  const [voting, setVoting] = useState(false);
  const [showModerationMenu, setShowModerationMenu] = useState(false);
  const [rcvResults, setRcvResults] = useState<any | null>(null);
  const [rcvSubmitted, setRcvSubmitted] = useState(false);
  const [mcResults, setMcResults] = useState<{ options: string[]; counts: Record<string, number> } | null>(null);
  const [mcSubmitted, setMcSubmitted] = useState(false);

  const fetchResults = useCallback(async () => {
    const result = await proposalsApi.getResults(proposalId);
    if (!result.data) return;
    if (result.data.type === 'ranked-choice') {
      setRcvResults(result.data);
    } else if (result.data.type === 'multiple-choice') {
      setMcResults({ options: result.data.options ?? [], counts: result.data.counts ?? {} });
    }
  }, [proposalId]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  // UPDATE 26: org-mandated verification can fire on shared/global proposals
  // that live inside a verify-required org. Route the user to org-paid
  // verification (the org has paid the one-time unlock fee, so members
  // never see a payment prompt).
  const handleOrgVerificationError = useCallback((result: { errorCode?: string; errorDetails?: any }): boolean => {
    if (result.errorCode === 'VERIFICATION_REQUIRED_BY_ORG') {
      const orgName = result.errorDetails?.orgName ?? 'This organization';
      const orgIdParam = result.errorDetails?.orgId;
      Alert.alert(
        'Verification required',
        `${orgName} requires identity verification before voting. Verification is covered by your organization.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Verify now',
            onPress: () => router.push({
              pathname: '/modals/verification-payment',
              params: {
                ...(orgIdParam ? { originatingOrgId: orgIdParam } : {}),
                originatingOrgName: orgName,
              },
            }),
          },
        ],
      );
      return true;
    }
    return false;
  }, []);

  const handleRcvVote = useCallback(async (rankings: string[]) => {
    if (rcvSubmitted || isEnded || voting) return;
    setVoting(true);
    try {
      const result = await proposalsApi.submitVote(proposalId, 'ranked-choice', { rankings });
      if (result.error) {
        if (handleOrgVerificationError(result)) return;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Vote failed', result.error);
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setRcvSubmitted(true);
      await fetchResults();
    } finally {
      setVoting(false);
    }
  }, [proposalId, rcvSubmitted, isEnded, voting, fetchResults, handleOrgVerificationError]);

  const handleMcVote = useCallback(async (selectedOption: string) => {
    if (mcSubmitted || isEnded || voting) return;
    setVoting(true);
    try {
      const result = await proposalsApi.submitVote(proposalId, 'multiple-choice', { selectedOption });
      if (result.error) {
        if (handleOrgVerificationError(result)) return;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Vote failed', result.error);
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMcSubmitted(true);
      await fetchResults();
    } finally {
      setVoting(false);
    }
  }, [proposalId, mcSubmitted, isEnded, voting, fetchResults, handleOrgVerificationError]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border, paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          Proposal
        </Text>
        <TouchableOpacity
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowModerationMenu(true); }}
          style={{ width: 40, alignItems: 'center', justifyContent: 'center' }}
          accessibilityLabel="Proposal options"
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ProposalModerationMenu
        visible={showModerationMenu}
        onClose={() => setShowModerationMenu(false)}
        proposalId={proposalId || null}
        creatorId={creatorId}
        creatorName={creatorName}
        onMuted={() => router.back()}
      />

      <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + SPACING['3xl'] }}>
        <Animated.View entering={FadeIn.duration(200)}>
          {/* Category chip */}
          <View style={[styles.categoryChip, { backgroundColor: `${colors.gold}15`, borderColor: colors.gold }]}>
            <Text style={[styles.categoryText, { color: colors.gold }]}>{category}</Text>
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>

          {/* Description */}
          {description ? (
            <Text style={[styles.description, { color: colors.textSecondary }]}>{description}</Text>
          ) : null}

          {/* Deadline */}
          {deadline && (
            <View style={[styles.deadlineRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name={isEnded ? 'time-outline' : 'hourglass-outline'} size={16} color={isEnded ? colors.textTertiary : colors.gold} />
              <Text style={[styles.deadlineText, { color: isEnded ? colors.textTertiary : colors.text }]}>
                {isEnded ? 'Voting ended' : `Closes ${new Date(deadline).toLocaleDateString()}`}
              </Text>
            </View>
          )}

          {/* Vote-cast or results area */}
          <View style={{ marginTop: SPACING.xl }}>
            {voteType === 'ranked-choice' ? (
              rcvSubmitted || isEnded ? (
                rcvResults ? (
                  <RCVResults
                    totalBallots={rcvResults.totalBallots ?? 0}
                    exhaustedBallots={rcvResults.exhaustedBallots ?? 0}
                    rounds={rcvResults.rounds ?? []}
                    winner={rcvResults.winner ?? null}
                    winningRound={rcvResults.winningRound ?? null}
                  />
                ) : (
                  <ActivityIndicator color={colors.gold} />
                )
              ) : (
                <RCVBallotInput
                  options={proposalOptions}
                  onSubmit={handleRcvVote}
                  submitting={voting}
                />
              )
            ) : (
              mcSubmitted || isEnded ? (
                mcResults ? (
                  <MultipleChoiceResults options={mcResults.options} counts={mcResults.counts} />
                ) : (
                  <ActivityIndicator color={colors.gold} />
                )
              ) : (
                <MultipleChoiceBallot
                  options={proposalOptions}
                  onSubmit={handleMcVote}
                  submitting={voting}
                />
              )
            )}
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    ...TYPOGRAPHY.headlineSmall,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  categoryChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  categoryText: {
    ...TYPOGRAPHY.labelSmall,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  title: {
    ...TYPOGRAPHY.headlineLarge,
    fontWeight: '700',
    marginBottom: SPACING.md,
  },
  description: {
    ...TYPOGRAPHY.bodyMedium,
    lineHeight: 22,
    marginBottom: SPACING.lg,
  },
  deadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  deadlineText: {
    ...TYPOGRAPHY.bodySmall,
    fontWeight: '500',
  },
});
