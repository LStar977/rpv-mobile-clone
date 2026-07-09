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
import { useTheme, SPACING, FONTS } from '../../lib/theme';

// E2 mock: 280-char limit with a live mono counter.
const MAX_LEN = 280;

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 'now';
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function initialOf(name: string | null | undefined): string {
  const trimmed = (name || '').trim();
  return trimmed ? trimmed[0].toUpperCase() : 'M';
}

/**
 * "Voices" — flat comment thread for a proposal (E2). Designed to sit at the
 * bottom of a detail ScrollView — renders its own header, composer, and list
 * (plain Views, no nested VirtualizedList). Handles: optimistic posting,
 * delete-own, report, mute-aware filtering, demo/seed sandboxing (via
 * commentsApi).
 *
 * Data honesty: the comments API (`commentsApi` / `ProposalComment`) provides
 * no commenter stance/ballot and no helpful/like endpoint, so the mock's
 * stance chips, Support/Oppose filters, and helpful counts are intentionally
 * omitted — we never guess a stance.
 */
export function CommentsSection({ proposalId }: { proposalId: number | string }) {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const mutedUserIds = useModerationStore((s) => s.mutedUserIds);

  const [comments, setComments] = useState<ProposalComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);

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

  const handleDelete = useCallback((comment: ProposalComment) => {
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
  }, [proposalId]);

  const handleReport = useCallback((comment: ProposalComment) => {
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
  }, []);

  const handleLongPress = useCallback((comment: ProposalComment) => {
    const isOwn = user?.id && String(comment.userId) === String(user.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isOwn) handleDelete(comment);
    else handleReport(comment);
  }, [user?.id, handleDelete, handleReport]);

  const visible = comments.filter((c) => !mutedUserIds.includes(String(c.userId)));
  const remaining = MAX_LEN - draft.length;

  return (
    <View style={styles.wrap}>
      {/* Header — serif "Voices" + mono count */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Voices</Text>
        <Text style={[styles.headerCount, { color: colors.textTertiary }]}>
          {loading ? '· —' : `· ${visible.length}`}
        </Text>
      </View>

      {/* Composer — avatar, italic-serif placeholder, mono live counter */}
      <View
        style={[
          styles.composer,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View
          style={[
            styles.composerAvatar,
            { backgroundColor: colors.goldSurface, borderColor: colors.goldSurfaceIntense },
          ]}
        >
          <Text style={[styles.composerAvatarText, { color: colors.gold }]}>
            {initialOf(user?.name)}
          </Text>
        </View>
        <TextInput
          style={[
            styles.input,
            { color: colors.text },
            // Italic-serif placeholder per mock; regular sans once typing.
            draft.length === 0 && { fontFamily: FONTS.serifItalic, fontSize: 14.5 },
          ]}
          placeholder="Add your voice…"
          placeholderTextColor={colors.textTertiary}
          value={draft}
          onChangeText={(t) => setDraft(t.slice(0, MAX_LEN))}
          multiline
          maxLength={MAX_LEN}
          accessibilityLabel="Write a comment"
        />
        <View style={styles.composerRight}>
          <Text
            style={[
              styles.counter,
              { color: remaining <= 20 ? colors.error : colors.textTertiary },
            ]}
          >
            {remaining}
          </Text>
          <TouchableOpacity
            onPress={handlePost}
            disabled={!draft.trim() || posting}
            style={[
              styles.postBtn,
              { backgroundColor: draft.trim() ? colors.goldFill : colors.border },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Post comment"
            accessibilityState={{ disabled: !draft.trim() || posting }}
          >
            {posting ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Ionicons
                name="arrow-up"
                size={16}
                color={draft.trim() ? '#000' : colors.textTertiary}
              />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* List */}
      {loading ? (
        <ActivityIndicator color={colors.gold} style={{ marginVertical: SPACING.xl }} />
      ) : visible.length === 0 ? (
        <Text style={[styles.empty, { color: colors.textTertiary }]}>
          No voices yet. Start the discussion.
        </Text>
      ) : (
        <View style={styles.list}>
          {visible.map((comment) => {
            const isOwn = !!(user?.id && String(comment.userId) === String(user.id));
            return (
              <TouchableOpacity
                key={comment.id}
                onLongPress={() => handleLongPress(comment)}
                delayLongPress={350}
                activeOpacity={0.85}
                style={[
                  styles.card,
                  { backgroundColor: colors.surface, borderColor: colors.borderSubtle },
                ]}
                accessibilityHint={isOwn ? 'Long-press to delete' : 'Long-press to report'}
              >
                <View style={styles.cardHeader}>
                  <View style={[styles.avatar, { backgroundColor: colors.surfaceHighlight }]}>
                    <Text style={[styles.avatarText, { color: colors.text }]}>
                      {isOwn ? initialOf(user?.name) : initialOf(comment.authorName)}
                    </Text>
                  </View>
                  <View style={styles.authorCol}>
                    <View style={styles.authorRow}>
                      <Text style={[styles.author, { color: colors.text }]} numberOfLines={1}>
                        {isOwn ? 'You' : (comment.authorName || 'Member')}
                      </Text>
                      {comment.authorVerified && (
                        <Ionicons name="shield-checkmark" size={11} color={colors.gold} />
                      )}
                    </View>
                    <Text style={[styles.time, { color: colors.textTertiary }]}>
                      {timeAgo(comment.createdAt).toUpperCase()}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.body, { color: colors.textSecondary }]}>
                  {comment.body}
                </Text>
                <View style={styles.cardFooter}>
                  {isOwn ? (
                    <TouchableOpacity
                      onPress={() => handleDelete(comment)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityRole="button"
                      accessibilityLabel="Delete your comment"
                    >
                      <Text style={[styles.action, { color: colors.textTertiary }]}>Delete</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      onPress={() => handleReport(comment)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityRole="button"
                      accessibilityLabel="Report this comment"
                    >
                      <Text style={[styles.action, { color: colors.textTertiary }]}>Report</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
          <Text style={[styles.trustNote, { color: colors.textTertiary }]}>
            Moderated for civility, never for position.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: SPACING.xl },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 13,
  },
  title: {
    fontFamily: FONTS.serif,
    fontSize: 19,
    lineHeight: 24,
  },
  headerCount: {
    fontFamily: FONTS.mono,
    fontSize: 10.5,
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderWidth: 1,
    borderRadius: 15,
    paddingLeft: 13,
    paddingRight: 8,
    paddingVertical: 8,
    gap: 11,
    marginBottom: 13,
  },
  composerAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  composerAvatarText: {
    fontFamily: FONTS.serif,
    fontSize: 12,
  },
  input: {
    flex: 1,
    fontFamily: FONTS.sans,
    fontSize: 13.5,
    lineHeight: 19,
    maxHeight: 110,
    paddingVertical: 9,
  },
  composerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  counter: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    fontVariant: ['tabular-nums'],
  },
  postBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginVertical: SPACING.xl,
  },
  list: { gap: 9 },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 15,
    gap: 9,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: FONTS.serif,
    fontSize: 13,
  },
  authorCol: { flex: 1, gap: 1 },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  author: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 13,
    lineHeight: 17,
    maxWidth: '80%',
  },
  time: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    letterSpacing: 0.54,
    fontVariant: ['tabular-nums'],
  },
  body: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    lineHeight: 20,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  action: {
    fontFamily: FONTS.sansMedium,
    fontSize: 11,
    lineHeight: 15,
  },
  trustNote: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 4,
  },
});

export default CommentsSection;
