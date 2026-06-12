import { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { referralsApi, type ReferralStats } from '../../lib/api';
import { shareReferralInvite } from '../../lib/share';
import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY } from '../../lib/theme';

/**
 * Profile card for the referral program. Lazily fetches stats; first tap
 * generates a code (the backend replaces existing codes on regenerate, so
 * we only ever call generate when there is no code yet). Rewards accrue
 * server-side once referees complete identity verification.
 */
export function InviteFriendsCard({ delay = 275 }: { delay?: number }) {
  const { colors } = useTheme();
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const result = await referralsApi.stats();
      if (!alive) return;
      if (result.data) setStats(result.data);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  const hasCode = !!stats && stats.code !== 'NO_CODE';
  const threshold = stats?.config?.referrerThreshold ?? 3;
  const towardNext = stats ? stats.referredCount % threshold : 0;

  const handleGenerate = useCallback(async () => {
    if (generating) return;
    setGenerating(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const result = await referralsApi.generate();
    if (result.data) setStats(result.data);
    setGenerating(false);
  }, [generating]);

  const handleCopy = useCallback(async () => {
    if (!stats || stats.code === 'NO_CODE') return;
    await Clipboard.setStringAsync(stats.code);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }, [stats]);

  const handleShare = useCallback(() => {
    if (!stats || stats.code === 'NO_CODE') return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    shareReferralInvite(stats.code);
  }, [stats]);

  return (
    <Animated.View entering={FadeInUp.delay(delay).duration(400)} style={styles.section}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.headerRow}>
          <View style={[styles.iconBg, { backgroundColor: `${colors.gold}15` }]}>
            <Ionicons name="gift-outline" size={18} color={colors.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.text }]}>Invite friends</Text>
            <Text style={[styles.sub, { color: colors.textTertiary }]}>
              You each get a free month of Premium when they verify
            </Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.gold} style={{ marginVertical: SPACING.md }} />
        ) : !hasCode ? (
          <TouchableOpacity
            onPress={handleGenerate}
            disabled={generating}
            style={[styles.generateBtn, { backgroundColor: colors.gold }]}
            accessibilityRole="button"
            accessibilityLabel="Get your invite code"
          >
            {generating ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Text style={styles.generateBtnText}>Get your invite code</Text>
            )}
          </TouchableOpacity>
        ) : (
          <>
            <View style={styles.codeRow}>
              <TouchableOpacity
                onPress={handleCopy}
                style={[styles.codeBox, { borderColor: colors.border, backgroundColor: colors.background }]}
                accessibilityRole="button"
                accessibilityLabel={`Your invite code is ${stats!.code}. Tap to copy.`}
              >
                <Text style={[styles.codeText, { color: colors.gold }]}>{stats!.code}</Text>
                <Ionicons
                  name={copied ? 'checkmark' : 'copy-outline'}
                  size={15}
                  color={copied ? colors.success : colors.textTertiary}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleShare}
                style={[styles.shareBtn, { backgroundColor: colors.gold }]}
                accessibilityRole="button"
                accessibilityLabel="Share invite"
              >
                <Ionicons name="share-outline" size={16} color="#000" />
                <Text style={styles.shareBtnText}>Share</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.progressRow}>
              <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
                <View
                  style={[
                    styles.progressFill,
                    { backgroundColor: colors.gold, width: `${Math.min(100, (towardNext / threshold) * 100)}%` },
                  ]}
                />
              </View>
              <Text style={[styles.progressText, { color: colors.textTertiary }]}>
                {towardNext}/{threshold} to next reward
              </Text>
            </View>
            {stats!.referredCount > 0 && (
              <Text style={[styles.statsLine, { color: colors.textSecondary }]}>
                {stats!.referredCount} verified {stats!.referredCount === 1 ? 'friend' : 'friends'} joined
                {stats!.rewardsEarned > 0
                  ? ` · ${stats!.rewardsEarned} ${stats!.rewardsEarned === 1 ? 'month' : 'months'} earned`
                  : ''}
              </Text>
            )}
          </>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: SPACING.lg },
  card: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  iconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...TYPOGRAPHY.labelLarge, fontWeight: '600' },
  sub: { ...TYPOGRAPHY.bodySmall, marginTop: 2 },
  generateBtn: {
    borderRadius: BORDER_RADIUS.full,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  generateBtnText: { ...TYPOGRAPHY.labelMedium, fontWeight: '700', color: '#000' },
  codeRow: { flexDirection: 'row', gap: SPACING.sm },
  codeBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
  },
  codeText: {
    ...TYPOGRAPHY.labelLarge,
    fontWeight: '700',
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.lg,
  },
  shareBtnText: { ...TYPOGRAPHY.labelMedium, fontWeight: '700', color: '#000' },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginTop: SPACING.md,
  },
  progressTrack: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3 },
  progressText: { ...TYPOGRAPHY.labelSmall },
  statsLine: { ...TYPOGRAPHY.bodySmall, marginTop: SPACING.sm },
});

export default InviteFriendsCard;
