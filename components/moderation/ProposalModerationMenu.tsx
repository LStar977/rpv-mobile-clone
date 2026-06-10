import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { moderationApi, proposalsApi, type ReportReason } from '../../lib/api';
import { useModerationStore } from '../../lib/moderation';

const O_GOLD = '#EABA58';
const O_BG_CARD = '#0D0F12';
const O_BG_RAISED = '#15181C';
const O_LINE = '#1E2228';
const O_LINE_STRONG = '#2A2F37';
const O_FG = '#F4F5F6';
const O_FG_MUTED = '#C7CACD';
const O_FG_FAINT = '#8E9297';
const O_RED = '#FF6B5B';
const SERIF = 'Georgia';

const REASONS: Array<{ key: ReportReason; label: string; sub: string }> = [
  { key: 'spam', label: 'Spam or scam', sub: 'Repetitive, commercial, or fraudulent' },
  { key: 'hate_speech', label: 'Hate speech', sub: 'Attacks based on identity or group' },
  { key: 'threat', label: 'Threat or violence', sub: 'Targeted threats, calls for harm' },
  { key: 'sexual', label: 'Sexual content', sub: 'Explicit or inappropriate material' },
  { key: 'illegal', label: 'Illegal activity', sub: 'Promotes or organizes illegal acts' },
  { key: 'misinformation', label: 'Misinformation', sub: 'Knowingly false or misleading claims' },
  { key: 'other', label: 'Something else', sub: 'Doesn\'t fit the categories above' },
];

export type ProposalModerationMenuProps = {
  visible: boolean;
  onClose: () => void;
  proposalId: number | string | null;
  creatorId: string | null;
  creatorName: string;
  /** Called after a mute action. Lets parents refresh feeds optimistically. */
  onMuted?: () => void;
  /** When true, shows a "Delete proposal" row (the viewer is the creator).
      Server enforces creator-only deletion; this only controls visibility. */
  isOwnProposal?: boolean;
  /** Called after a successful delete so parents can refresh feeds. */
  onDeleted?: () => void;
};

type Stage = 'menu' | 'reportReason' | 'reportNote' | 'submitting';

export function ProposalModerationMenu({
  visible,
  onClose,
  proposalId,
  creatorId,
  creatorName,
  onMuted,
  isOwnProposal,
  onDeleted,
}: ProposalModerationMenuProps) {
  const insets = useSafeAreaInsets();
  const muteAction = useModerationStore((s) => s.mute);
  const [stage, setStage] = useState<Stage>('menu');
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState('');
  const [kbHeight, setKbHeight] = useState(0);

  // Lift the bottom sheet above the keyboard while typing the note.
  // Without this the keyboard covers the sheet (Submit button hidden) and
  // tapping to dismiss the keyboard lands on the scrim behind it.
  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', (e) => setKbHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardWillHide', () => setKbHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  if (!visible) return null;

  const reset = () => {
    setStage('menu');
    setReason(null);
    setNote('');
  };

  const close = () => {
    reset();
    onClose();
  };

  const handleMute = () => {
    if (!creatorId) {
      Alert.alert('Cannot hide', 'Creator information unavailable.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      `Hide ${creatorName || 'this user'}'s proposals?`,
      'Their proposals will not appear in your feeds. You can undo this in Settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Hide',
          style: 'destructive',
          onPress: async () => {
            await muteAction(creatorId);
            onMuted?.();
            close();
          },
        },
      ],
    );
  };

  const handleDelete = () => {
    if (!proposalId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Delete this proposal?',
      'Voting closes immediately and this can\'t be undone. Existing votes are removed from the record.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await proposalsApi.deleteProposal(proposalId);
            if (result.error) {
              Alert.alert('Could not delete', result.error);
              return;
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onDeleted?.();
            close();
          },
        },
      ],
    );
  };

  const handleReportTap = () => {
    Haptics.selectionAsync();
    setStage('reportReason');
  };

  const submitReport = async (finalReason: ReportReason, finalNote: string) => {
    if (!proposalId) return;
    Keyboard.dismiss();
    setStage('submitting');
    const result = await moderationApi.reportProposal(proposalId, finalReason, finalNote);
    if (result.error) {
      Alert.alert('Could not submit', result.error);
      setStage('reportNote');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      'Report submitted',
      'Thanks — our team reviews reports within 24 hours.',
    );
    close();
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable
        onPress={() => {
          // While typing the note, a scrim tap should dismiss the keyboard,
          // not close the whole sheet (that was eating the report mid-entry).
          if (kbHeight > 0) {
            Keyboard.dismiss();
            return;
          }
          close();
        }}
        style={[StyleSheet.absoluteFill, styles.scrim]}
      />
      <View style={[styles.sheet, { bottom: kbHeight, paddingBottom: kbHeight > 0 ? 20 : 28 + insets.bottom }]}>
        <View style={styles.handle} />

        {stage === 'menu' && (
          <>
            <Text style={styles.title}>Proposal options</Text>
            <Text style={styles.subtitle}>
              Help keep Represent civil.
            </Text>

            {isOwnProposal && (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleDelete}
                style={styles.row}
              >
                <View style={[styles.rowIcon, { backgroundColor: 'rgba(255,107,91,0.12)' }]}>
                  <Ionicons name="trash-outline" size={20} color={O_RED} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>Delete this proposal</Text>
                  <Text style={styles.rowSub}>Permanent. Closes voting and removes existing votes.</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={O_FG_FAINT} />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleReportTap}
              style={styles.row}
            >
              <View style={[styles.rowIcon, { backgroundColor: 'rgba(255,107,91,0.12)' }]}>
                <Ionicons name="flag-outline" size={20} color={O_RED} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>Report this proposal</Text>
                <Text style={styles.rowSub}>Spam, hate speech, or other violations</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={O_FG_FAINT} />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleMute}
              style={styles.row}
              disabled={!creatorId}
            >
              <View style={[styles.rowIcon, { backgroundColor: 'rgba(234,186,88,0.12)' }]}>
                <Ionicons name="eye-off-outline" size={20} color={O_GOLD} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowLabel, !creatorId && { color: O_FG_FAINT }]}>
                  Hide proposals from {creatorName || 'this user'}
                </Text>
                <Text style={styles.rowSub}>You won't see their proposals in your feeds</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity onPress={close} style={styles.cancelBtn} activeOpacity={0.7}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </>
        )}

        {stage === 'reportReason' && (
          <>
            <View style={styles.reportHeader}>
              <TouchableOpacity onPress={() => setStage('menu')} hitSlop={10}>
                <Ionicons name="chevron-back" size={22} color={O_FG_MUTED} />
              </TouchableOpacity>
              <Text style={styles.reportHeaderTitle}>Why are you reporting?</Text>
              <View style={{ width: 22 }} />
            </View>

            <View style={{ marginTop: 4 }}>
              {REASONS.map((r) => {
                const selected = reason === r.key;
                return (
                  <TouchableOpacity
                    key={r.key}
                    activeOpacity={0.85}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setReason(r.key);
                      setStage('reportNote');
                    }}
                    style={[
                      styles.reasonRow,
                      selected && { borderColor: O_GOLD },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reasonLabel}>{r.label}</Text>
                      <Text style={styles.reasonSub}>{r.sub}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={O_FG_FAINT} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {stage === 'reportNote' && reason && (
          <>
            <View style={styles.reportHeader}>
              <TouchableOpacity onPress={() => setStage('reportReason')} hitSlop={10}>
                <Ionicons name="chevron-back" size={22} color={O_FG_MUTED} />
              </TouchableOpacity>
              <Text style={styles.reportHeaderTitle}>Add a note (optional)</Text>
              <View style={{ width: 22 }} />
            </View>

            <Text style={styles.noteHint}>
              Reason: {REASONS.find((r) => r.key === reason)?.label}
            </Text>

            <TextInput
              style={styles.noteInput}
              placeholder="Anything that helps our team review..."
              placeholderTextColor={O_FG_FAINT}
              multiline
              maxLength={500}
              value={note}
              onChangeText={setNote}
            />
            <Text style={styles.charCount}>{note.length} / 500</Text>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => submitReport(reason, note)}
              style={styles.submitBtn}
            >
              <Text style={styles.submitText}>Submit report</Text>
            </TouchableOpacity>
          </>
        )}

        {stage === 'submitting' && (
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <ActivityIndicator color={O_GOLD} />
            <Text style={[styles.subtitle, { marginTop: 14 }]}>Submitting report...</Text>
          </View>
        )}
      </View>
    </View>
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
  title: {
    color: O_FG,
    fontFamily: SERIF,
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  subtitle: {
    color: O_FG_MUTED,
    fontSize: 13,
    letterSpacing: -0.05,
    marginBottom: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: O_BG_RAISED,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: O_LINE,
    marginBottom: 8,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    color: O_FG,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  rowSub: {
    color: O_FG_MUTED,
    fontSize: 11.5,
  },
  cancelBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  cancelText: {
    color: O_FG_MUTED,
    fontSize: 14,
    fontWeight: '500',
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  reportHeaderTitle: {
    color: O_FG,
    fontFamily: SERIF,
    fontSize: 18,
    fontWeight: '600',
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: O_BG_RAISED,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: O_LINE,
    marginBottom: 6,
  },
  reasonLabel: {
    color: O_FG,
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  reasonSub: {
    color: O_FG_MUTED,
    fontSize: 11.5,
  },
  noteHint: {
    color: O_GOLD,
    fontSize: 11.5,
    fontWeight: '600',
    letterSpacing: 0.4,
    marginBottom: 8,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  noteInput: {
    minHeight: 100,
    backgroundColor: O_BG_RAISED,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: O_LINE,
    padding: 12,
    color: O_FG,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  charCount: {
    color: O_FG_FAINT,
    fontSize: 11,
    textAlign: 'right',
    marginTop: 6,
  },
  submitBtn: {
    backgroundColor: O_GOLD,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 14,
  },
  submitText: {
    color: '#040707',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
