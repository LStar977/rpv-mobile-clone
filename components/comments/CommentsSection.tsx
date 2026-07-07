import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { commentsApi, type ProposalComment } from '../../lib/api';
import { useAuthStore } from '../../lib/auth';
import { useModerationStore } from '../../lib/moderation';
import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY, FONTS } from '../../lib/theme';

const MAX_LEN = 500;

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 'now';
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString();
}

/**
 * Flat comment thread for a proposal. Designed to sit at the bottom of a
 * detail ScrollView — renders its own header, input, and list (plain Views,
 * no nested VirtualizedList). Handles: optimistic posting, delete-own,
 * report, mute-aware filtering, demo/seed sandboxing (via commentsApi).
 */
export function CommentsSection({ proposalId }: { proposalId: number | string }) {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const mutedUserIds = useModerationStore((s) => s.mutedUserIds);

  const [comments, setComments] = useState<ProposalComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    const result = await commentsApi.list(proposalId);
    if (result.data) setComments(result.data);
    setLoading(false);
  }, [proposalId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const result = await commentsApi.list(proposalId);
      if (!alive) return;
      if (result.data) setComments(result.data);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [proposalId]);

  const handlePost = useCallback(async () => {
    const body = draft.trim();
    if (!body || posting) return;
    setPosting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const result = await commentsApi.create(proposalId, body);
    setPosting(false);
    if (result.error || !result.data) {
      Alert.alert('Could not post', result.error || 'Please try again.');
      return;
    }
    setDraft('');
    setComments((prev) => [result.data!, ...prev]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [draft, posting, proposalId]);

  const handleLongPress = useCallback((comment: ProposalComment) => {
    const isOwn = user?.id && String(comment.userId) === String(user.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isOwn) {
      Alert.alert('Your comment', undefined, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const r = await commentsApi.remove(comment.id, proposalId);
            if (r.error) { Alert.alert('Could not delete', r.error); return; }
            setComments((prev) => prev.filter((c) => c.id !== comment.id));
          },
        },
      ]);
    } else {
      Alert.alert(`Comment by ${comment.authorName || 'a member'}`, undefined, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          style: 'destructive',
          onPress: async () => {
            const r = await commentsApi.report(comment.id, 'other');
            if (r.error) { Alert.alert('Could not report', r.error); return; }
            // Hide locally right away — reporter shouldn't keep seeing it.
            setComments((prev) => prev.filter((c) => c.id !== comment.id));
            Alert.alert('Reported', 'Thanks — our team reviews reports within 24 hours.');
          },
        },
      ]);
    }
  }, [user?.id, proposalId]);

  const visible = comments.filter((c) => !mutedUserIds.includes(String(c.userId)));

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>
          Discussion{visible.length > 0 ? ` (${visible.length})` : ''}
        </Text>
      </View>

      {/* Composer */}
      <View style={[styles.composer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TextInput
          style={[styles.input, { color: colors.text }]}
          placeholder="Add your voice to the discussion…"
          placeholderTextColor={colors.textTertiary}
          value={draft}
          onChangeText={(t) => setDraft(t.slice(0, MAX_LEN))}
          multiline
          maxLength={MAX_LEN}
          accessibilityLabel="Write a comment"
        />
        <TouchableOpacity
          onPress={handlePost}
          disabled={!draft.trim() || posting}
          style={[
            styles.postBtn,
            { backgroundColor: draft.trim() ? colors.gold : colors.border },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Post comment"
          accessibilityState={{ disabled: !draft.trim() || posting }}
        >
          {posting ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <Ionicons name="arrow-up" size={18} color={draft.trim() ? '#000' : colors.textTertiary} />
          )}
        </TouchableOpacity>
      </View>
      {draft.length > MAX_LEN - 60 && (
        <Text style={[styles.counter, { color: colors.textTertiary }]}>
          {MAX_LEN - draft.length} characters left
        </Text>
      )}

      {/* List */}
      {loading ? (
        <ActivityIndicator color={colors.gold} style={{ marginVertical: SPACING.xl }} />
      ) : visible.length === 0 ? (
        <Text style={[styles.empty, { color: colors.textTertiary }]}>
          No comments yet. Start the discussion.
        </Text>
      ) : (
        visible.map((comment) => {
          const isOwn = user?.id && String(comment.userId) === String(user.id);
          return (
            <TouchableOpacity
              key={comment.id}
              onLongPress={() => handleLongPress(comment)}
              delayLongPress={350}
              activeOpacity={0.8}
              style={[styles.comment, { borderBottomColor: colors.border }]}
              accessibilityHint={isOwn ? 'Long-press to delete' : 'Long-press to report'}
            >
              <View style={styles.commentHeader}>
                <Text style={[styles.author, { color: colors.text }]} numberOfLines={1}>
                  {isOwn ? 'You' : (comment.authorName || 'Member')}
                </Text>
                {comment.authorVerified && (
                  <Ionicons name="checkmark-circle" size={13} color={colors.success} />
                )}
                <Text style={[styles.time, { color: colors.textTertiary }]}>
                  {timeAgo(comment.createdAt)}
                </Text>
              </View>
              <Text style={[styles.body, { color: colors.textSecondary }]}>{comment.body}</Text>
            </TouchableOpacity>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: SPACING.xl },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.md },
  title: { ...TYPOGRAPHY.headlineSmall, fontFamily: FONTS.serif },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.lg,
    paddingLeft: SPACING.md,
    paddingRight: SPACING.xs,
    paddingVertical: SPACING.xs,
    gap: SPACING.xs,
  },
  input: {
    flex: 1,
    ...TYPOGRAPHY.bodyMedium,
    maxHeight: 110,
    paddingVertical: SPACING.sm,
  },
  postBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  counter: { ...TYPOGRAPHY.labelSmall, fontFamily: FONTS.mono, fontVariant: ['tabular-nums'], marginTop: 4, textAlign: 'right' },
  empty: { ...TYPOGRAPHY.bodyMedium, textAlign: 'center', marginVertical: SPACING.xl },
  comment: { paddingVertical: SPACING.md, borderBottomWidth: 1 },
  commentHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  author: { ...TYPOGRAPHY.labelMedium, maxWidth: '60%' },
  time: { ...TYPOGRAPHY.labelSmall, fontFamily: FONTS.mono, fontVariant: ['tabular-nums'], marginLeft: 'auto' },
  body: { ...TYPOGRAPHY.bodyMedium, lineHeight: 21 },
});

export default CommentsSection;
