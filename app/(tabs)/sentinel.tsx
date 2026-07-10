import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Linking,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import * as Crypto from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../../lib/auth';
import { restorePurchases } from '../../lib/iap';
import { PremiumPromoSheet, markPromoShown } from '../../components/ui';
import { useTheme, SPACING, RADIUS, FONTS } from '../../lib/theme';
import { useTutorialTarget } from '../../components/tutorial';
import Svg, { Circle, Path } from 'react-native-svg';

const API_URL = 'https://representportal.com';
const STORAGE_KEY = 'sentinel_analysis_history';
const AI_CONSENT_KEY = 'sentinel_ai_consent';
const ISSUE_TYPES = ['Policy', 'Statute', 'Charter', 'Treaty', 'Bylaw', 'Other'];
const MAX_CHARS = 50000;
const CRITERIA_VERSION = 'V1';
const ON_GOLD = '#040707'; // text/icons on gold fills — same in both themes

// Sample demo analysis for non-premium users to preview the UI
const DEMO_ANALYSIS: Analysis = {
  id: 'demo',
  title: 'Sample: Public Safety Reform Act 2026',
  issueType: 'Law',
  timestamp: 'Demo',
  analysis: {
    summary: 'This legislation proposes significant changes to public safety protocols, including increased community oversight and revised use-of-force guidelines. While the intent aligns with transparency principles, several provisions lack adequate due process protections and citizen appeal mechanisms.',
    reasoning: 'The analysis identified strong alignment with community engagement principles but found gaps in accountability structures and privacy safeguards that need addressing before implementation.',
    categoryScores: [
      { category: 'Individual Rights', score: 82 },
      { category: 'Due Process', score: 65 },
      { category: 'Transparency', score: 88 },
      { category: 'Accountability', score: 71 },
      { category: 'Privacy Protection', score: 58 },
      { category: 'Community Engagement', score: 91 },
    ],
    overallVerdict: 'At Risk',
    flaggedPrinciples: [
      {
        principleId: 'P-47',
        name: 'Right to Appeal',
        status: 'Partially Violated',
        explanation: 'The legislation does not provide clear mechanisms for citizens to appeal decisions made under the new protocols.',
      },
      {
        principleId: 'P-112',
        name: 'Data Privacy Standards',
        status: 'Violated',
        explanation: 'Collection of biometric data lacks proper consent frameworks and retention limits.',
      },
      {
        principleId: 'P-23',
        name: 'Public Transparency',
        status: 'Aligned',
        explanation: 'Reporting requirements meet transparency standards with quarterly public disclosures.',
      },
    ],
    sentinelCorrections: [
      'Add Section 4.2: Citizen Appeal Process with 30-day response requirement',
      'Amend Section 7: Include data retention limits of 90 days for non-criminal records',
      'Insert privacy consent requirements in Section 3.1 for biometric collection',
      'Establish independent oversight committee with citizen representatives',
    ],
    mainProposal: 'Amend Public Safety Reform Act to include citizen appeal rights and privacy protections',
  },
};

type AnalysisResult = {
  summary: string;
  reasoning: string;
  categoryScores: Array<{ category: string; score: number }>;
  overallVerdict: 'Aligned' | 'At Risk' | 'Violating';
  flaggedPrinciples: Array<{
    principleId: string;
    name: string;
    status: 'Violated' | 'Partially Violated' | 'Aligned';
    explanation: string;
  }>;
  sentinelCorrections: string[];
  mainProposal: string;
};

type Analysis = {
  id: string;
  title: string;
  issueType: string;
  timestamp: string;
  sha256?: string;
  analysis: AnalysisResult;
};

// ── Grading helpers ──────────────────────────────────────────────────

// Calculate average score from category scores
function calculateAverageScore(categoryScores: { score: number }[]): number {
  if (!categoryScores || categoryScores.length === 0) return 0;
  return Math.round(categoryScores.reduce((sum, c) => sum + c.score, 0) / categoryScores.length);
}

// Letter grade with +/− steps. Bands preserve the legacy scale
// (90 A / 80 B / 70 C / 60 D / below F).
function scoreToLetterGrade(score: number): string {
  if (score >= 97) return 'A+';
  if (score >= 93) return 'A';
  if (score >= 90) return 'A−';
  if (score >= 87) return 'B+';
  if (score >= 83) return 'B';
  if (score >= 80) return 'B−';
  if (score >= 77) return 'C+';
  if (score >= 73) return 'C';
  if (score >= 70) return 'C−';
  if (score >= 67) return 'D+';
  if (score >= 63) return 'D';
  if (score >= 60) return 'D−';
  return 'F';
}

// Ring color for history cards: green / gold / amber / red by score
function scoreRingColor(
  score: number,
  colors: { success: string; gold: string; warning: string; error: string },
): string {
  if (score >= 85) return colors.success;
  if (score >= 70) return colors.gold;
  if (score >= 55) return colors.warning;
  return colors.error;
}

function shortSha(sha: string): string {
  if (sha.length < 8) return sha.toUpperCase();
  return `${sha.slice(0, 4)}…${sha.slice(-4)}`.toUpperCase();
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

// ══════════════════════════════════════════════════════════════════════
// ══ SHARED UI PIECES ══════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════

// ── SentinelGlyph — scan/focus mark used across all Sentinel states ──
function SentinelGlyph({ size = 20, color, strokeWidth = 1.8 }: { size?: number; color: string; strokeWidth?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={5} stroke={color} strokeWidth={strokeWidth} />
      <Path d="M12 3v2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M12 19v2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M3 12h2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Path d="M19 12h2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Circle cx={12} cy={12} r={1.6} fill={color} />
    </Svg>
  );
}

// ── SentinelBadge — gold pill in screen corners ──────────────────────
function SentinelBadge({ label }: { label: string }) {
  const { colors } = useTheme();
  return (
    <View style={[st.snBadge, { backgroundColor: colors.goldSurface, borderColor: `${colors.goldFill}33` }]}>
      <SentinelGlyph size={10} color={colors.gold} strokeWidth={2} />
      <Text style={[st.snBadgeText, { color: colors.gold }]}>{label}</Text>
    </View>
  );
}

// ── CircleButton — 40px circular icon button ─────────────────────────
function CircleButton({
  icon,
  onPress,
  size = 40,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  size?: number;
}) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={[
        st.circleBtn,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surface, borderColor: colors.borderSubtle },
      ]}
    >
      <Ionicons name={icon} size={size * 0.45} color={colors.textSecondary} />
    </TouchableOpacity>
  );
}

// ── Eyebrow label ────────────────────────────────────────────────────
function Eyebrow({ children, color }: { children: React.ReactNode; color?: string }) {
  const { colors } = useTheme();
  return <Text style={[st.eyebrow, { color: color || colors.textTertiary }]}>{children}</Text>;
}

// ── GradeRing — letter grade + mono score inside an SVG ring ─────────
function GradeRing({
  size,
  strokeWidth,
  score,
  grade,
  color,
  showScore = true,
}: {
  size: number;
  strokeWidth: number;
  score: number;
  grade: string;
  color: string;
  showScore?: boolean;
}) {
  const { colors } = useTheme();
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, score));
  const arc = (clamped / 100) * c;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={colors.surfaceHighlight} strokeWidth={strokeWidth} />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${arc} ${c}`}
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, st.center]}>
        <Text style={{ fontFamily: FONTS.serif, fontSize: size * 0.35, lineHeight: size * 0.4, color: colors.text }}>
          {grade}
        </Text>
        {showScore && (
          <Text
            style={{
              fontFamily: FONTS.mono,
              fontSize: Math.max(8.5, size * 0.095),
              letterSpacing: 0.6,
              color: colors.textTertiary,
              fontVariant: ['tabular-nums'],
            }}
          >
            {clamped}/100
          </Text>
        )}
      </View>
    </View>
  );
}

// ── ShimmerBar — honest in-flight indicator ──────────────────────────
function ShimmerBar({ width = 64 }: { width?: number }) {
  const { colors } = useTheme();
  const opacity = useSharedValue(0.45);
  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.45, { duration: 700, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [opacity]);
  const aStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[{ width, height: 8, borderRadius: 4, backgroundColor: colors.surfaceHighlight }, aStyle]} />;
}

// ── AnalyzingRing — rotating gold arc with Sentinel glyph ────────────
function AnalyzingRing({ size = 108 }: { size?: number }) {
  const { colors } = useTheme();
  const rotation = useSharedValue(0);
  useEffect(() => {
    rotation.value = withRepeat(withTiming(360, { duration: 1400, easing: Easing.linear }), -1, false);
  }, [rotation]);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));

  const strokeWidth = 5;
  const r = size / 2 - strokeWidth - 1;
  const c = 2 * Math.PI * r;

  return (
    <View style={{ width: size, height: size }}>
      <Animated.View style={[StyleSheet.absoluteFill, aStyle]}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={colors.surfaceHighlight} strokeWidth={strokeWidth} />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={colors.goldFill}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${c * 0.65} ${c}`}
            rotation={-90}
            origin={`${size / 2}, ${size / 2}`}
          />
        </Svg>
      </Animated.View>
      <View style={[StyleSheet.absoluteFill, st.center]}>
        <SentinelGlyph size={36} color={colors.gold} strokeWidth={1.6} />
      </View>
    </View>
  );
}

// ── StepRow — one line of the analyzing progress ledger ──────────────
function StepRow({ label, state, last }: { label: string; state: 'done' | 'active' | 'pending'; last?: boolean }) {
  const { colors } = useTheme();
  const labelColor = state === 'done' ? colors.textSecondary : state === 'active' ? colors.text : colors.textTertiary;
  return (
    <View style={[st.stepRow, !last && { borderBottomWidth: 1, borderBottomColor: colors.borderSubtle }]}>
      <Text style={[st.stepLabel, { color: labelColor }]}>{label}</Text>
      {state === 'done' && <Ionicons name="checkmark" size={16} color={colors.success} />}
      {state === 'active' && <ShimmerBar />}
      {state === 'pending' && <Text style={[st.stepPendingDash, { color: colors.textTertiary }]}>—</Text>}
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════
// ══ S1B · ANALYZING ═══════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════

function AnalyzingView({
  docTitle,
  wordCount,
  onCancel,
}: {
  docTitle: string;
  wordCount: number;
  onCancel: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Animated.View
      entering={FadeIn.duration(240)}
      style={[st.container, { backgroundColor: colors.background, paddingTop: insets.top + 12, paddingHorizontal: 28 }]}
    >
      <View style={{ alignItems: 'flex-end' }}>
        <SentinelBadge label="SENTINEL" />
      </View>

      <View style={st.analyzingCenter}>
        <AnalyzingRing />
        <View style={{ alignItems: 'center', gap: 8 }}>
          <Text style={[st.analyzingTitle, { color: colors.text }]}>Analyzing</Text>
          {!!docTitle && (
            <Text style={[st.analyzingDocTitle, { color: colors.textSecondary }]} numberOfLines={1}>
              {docTitle}
            </Text>
          )}
          <Text style={[st.analyzingBody, { color: colors.textSecondary }]}>
            Sentinel is reading the document against 155 principles of proper human governance.
          </Text>
        </View>

        <View style={[st.ledgerCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
          <StepRow label={`DOCUMENT PARSED · ${wordCount.toLocaleString()} WORDS`} state="done" />
          <StepRow label="SUBMITTED FOR ANALYSIS" state="done" />
          <StepRow label="GRADING AGAINST 155 PRINCIPLES" state="active" />
          <StepRow label="WRITING REPORT CARD" state="pending" last />
        </View>

        <Text style={[st.analyzingNote, { color: colors.textTertiary }]}>
          Usually under a minute — keep this screen open while Sentinel writes the report card.
        </Text>
      </View>

      <TouchableOpacity onPress={onCancel} activeOpacity={0.7} style={[st.cancelBtn, { marginBottom: insets.bottom + 100 }]}>
        <Text style={[st.cancelBtnText, { color: colors.textSecondary }]}>Cancel Analysis</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ══════════════════════════════════════════════════════════════════════
// ══ S2 + M3 · GOVERNANCE REPORT CARD ══════════════════════════════════
// ══════════════════════════════════════════════════════════════════════

function CriterionRow({
  category,
  score,
  index,
  last,
}: {
  category: string;
  score: number;
  index: number;
  last?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Animated.View
      entering={FadeInUp.delay(index * 60).duration(300)}
      style={[st.criterionRow, !last && { borderBottomWidth: 1, borderBottomColor: colors.borderSubtle }]}
    >
      <Text style={[st.criterionLabel, { color: colors.textSecondary }]} numberOfLines={1}>
        {category}
      </Text>
      <View style={[st.criterionTrack, { backgroundColor: colors.surfaceHighlight }]}>
        <View style={[st.criterionFill, { width: `${Math.max(0, Math.min(100, score))}%`, backgroundColor: colors.goldFill }]} />
      </View>
      <Text style={[st.criterionGrade, { color: colors.text }]}>{scoreToLetterGrade(score)}</Text>
    </Animated.View>
  );
}

function FindingRow({
  finding,
  index,
}: {
  finding: Analysis['analysis']['flaggedPrinciples'][0];
  index: number;
}) {
  const { colors } = useTheme();
  const tone =
    finding.status === 'Aligned'
      ? { color: colors.success, bg: colors.successSurface, icon: 'checkmark' as const }
      : finding.status === 'Partially Violated'
        ? { color: colors.warning, bg: colors.warningSurface, icon: 'alert' as const }
        : { color: colors.error, bg: colors.errorSurface, icon: 'close' as const };

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 60).duration(300)}
      style={[st.findingRow, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
    >
      <View style={[st.findingIconDisc, { backgroundColor: tone.bg }]}>
        <Ionicons name={tone.icon} size={13} color={tone.color} />
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={[st.findingName, { color: colors.text }]}>{finding.name}</Text>
        <Text style={[st.findingExplanation, { color: colors.textSecondary }]}>{finding.explanation}</Text>
      </View>
    </Animated.View>
  );
}

function ReportView({
  analysis,
  onClose,
  onShare,
  onCreateProposal,
  creatingProposal,
  proposalCreated,
}: {
  analysis: Analysis;
  onClose: () => void;
  onShare: () => void;
  onCreateProposal: () => void;
  creatingProposal: boolean;
  proposalCreated: boolean;
}) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const isDemo = analysis.id === 'demo';

  const averageScore = calculateAverageScore(analysis.analysis.categoryScores);
  const grade = scoreToLetterGrade(averageScore);
  const verdictColor =
    analysis.analysis.overallVerdict === 'Aligned'
      ? colors.success
      : analysis.analysis.overallVerdict === 'At Risk'
        ? colors.warning
        : colors.error;

  const strongest = analysis.analysis.flaggedPrinciples.find((f) => f.status === 'Aligned');
  const weakest = analysis.analysis.flaggedPrinciples.find((f) => f.status !== 'Aligned');

  const handleFlag = () => {
    const subject = encodeURIComponent('Sentinel analysis feedback');
    const body = encodeURIComponent(
      `I'd like to flag this Sentinel analysis as inaccurate or inappropriate.\n\n` +
      `Issue type: ${analysis.issueType ?? '(unknown)'}\n` +
      `Title: ${analysis.title ?? ''}\n` +
      `Reason (please describe):\n\n`,
    );
    Linking.openURL(`mailto:support@representvote.com?subject=${subject}&body=${body}`).catch(() => {
      Alert.alert('Could not open email', 'Email support@representvote.com to flag this analysis.');
    });
  };

  const provenance = isDemo
    ? 'SAMPLE REPORT · FOR PREVIEW ONLY'
    : `ANALYZED ${analysis.timestamp.toUpperCase()}${analysis.sha256 ? ` · SHA-256 ${shortSha(analysis.sha256)}` : ''} · CRITERIA ${CRITERIA_VERSION}`;

  return (
    <ScrollView
      style={st.container}
      contentContainerStyle={[st.reportContent, { paddingTop: insets.top + 12 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Top bar: back + share */}
      <View style={st.topBar}>
        <CircleButton icon="chevron-back" onPress={onClose} />
        <CircleButton icon="share-outline" onPress={onShare} />
      </View>

      {/* Title block */}
      <Animated.View entering={FadeInDown.duration(300)} style={{ gap: 5, marginBottom: 13 }}>
        <View style={st.reportEyebrowRow}>
          <Eyebrow color={colors.gold}>GOVERNANCE REPORT CARD · {analysis.issueType.toUpperCase()}</Eyebrow>
          {isDemo && (
            <View style={[st.demoChip, { backgroundColor: colors.warningSurface, borderColor: `${colors.warning}59` }]}>
              <Text style={[st.demoChipText, { color: colors.warning }]}>DEMO</Text>
            </View>
          )}
        </View>
        <Text style={[st.reportTitle, { color: colors.text }]}>{analysis.title}</Text>
      </Animated.View>

      {/* Grade hero — gold ring, sentinel assessment */}
      <Animated.View entering={FadeIn.duration(480)} style={[st.heroCard, { borderColor: `${colors.goldFill}66` }]}>
        <LinearGradient
          colors={isDark ? ['#141818', '#0A0D0D', '#040707'] : ['#FFFDF9', '#FAF8F5']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: 22 }]}
        />
        <GradeRing size={96} strokeWidth={6} score={averageScore} grade={grade} color={colors.goldFill} />
        <View style={{ flex: 1, gap: 7 }}>
          <View style={st.heroEyebrowRow}>
            <Eyebrow color={colors.gold}>SENTINEL ASSESSMENT</Eyebrow>
            <View style={[st.verdictChip, { backgroundColor: `${verdictColor}1F`, borderColor: `${verdictColor}59` }]}>
              <Text style={[st.verdictChipText, { color: verdictColor }]}>{analysis.analysis.overallVerdict}</Text>
            </View>
          </View>
          <Text style={[st.heroAssessment, { color: colors.textSecondary }]}>
            {analysis.analysis.reasoning || analysis.analysis.summary}
          </Text>
        </View>
      </Animated.View>

      {/* Graded criteria */}
      {analysis.analysis.categoryScores.length > 0 ? (
        <View style={[st.criteriaCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
          {analysis.analysis.categoryScores.map((cat, i) => (
            <CriterionRow
              key={cat.category}
              category={cat.category}
              score={cat.score}
              index={i}
              last={i === analysis.analysis.categoryScores.length - 1}
            />
          ))}
        </View>
      ) : (
        <View style={[st.criteriaCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
          <Text style={[st.emptyText, { color: colors.textSecondary, paddingVertical: 12 }]}>No criteria scores returned</Text>
        </View>
      )}

      {/* Strongest clause / needs attention */}
      {(strongest || weakest) && (
        <View style={st.calloutGrid}>
          {strongest && (
            <View style={[st.calloutCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
              <View style={st.calloutHeader}>
                <Ionicons name="checkmark" size={11} color={colors.success} />
                <Text style={[st.calloutLabel, { color: colors.success }]}>STRONGEST CLAUSE</Text>
              </View>
              <Text style={[st.calloutBody, { color: colors.textSecondary }]} numberOfLines={4}>
                {strongest.name} — {strongest.explanation}
              </Text>
            </View>
          )}
          {weakest && (
            <View style={[st.calloutCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
              <View style={st.calloutHeader}>
                <Ionicons name="warning-outline" size={11} color={colors.warning} />
                <Text style={[st.calloutLabel, { color: colors.warning }]}>NEEDS ATTENTION</Text>
              </View>
              <Text style={[st.calloutBody, { color: colors.textSecondary }]} numberOfLines={4}>
                {weakest.name} — {weakest.explanation}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Key findings */}
      <Eyebrow>KEY FINDINGS</Eyebrow>
      {analysis.analysis.flaggedPrinciples.length > 0 ? (
        <View style={{ gap: 8 }}>
          {analysis.analysis.flaggedPrinciples.slice(0, 5).map((finding, i) => (
            <FindingRow key={finding.principleId} finding={finding} index={i} />
          ))}
        </View>
      ) : (
        <View style={[st.findingsEmpty, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
          <Ionicons name="shield-checkmark" size={28} color={colors.success} />
          <Text style={[st.emptyText, { color: colors.textSecondary }]}>No issues found - document is aligned</Text>
        </View>
      )}

      {/* Recommended fixes */}
      {analysis.analysis.sentinelCorrections.length > 0 && (
        <>
          <Eyebrow>RECOMMENDED FIXES</Eyebrow>
          <View style={{ gap: 8 }}>
            {analysis.analysis.sentinelCorrections.map((fix, i) => (
              <Animated.View
                key={i}
                entering={FadeInUp.delay(i * 60).duration(300)}
                style={[st.fixRow, { backgroundColor: colors.surface, borderColor: `${colors.goldFill}2E` }]}
              >
                <View style={[st.fixNumber, { backgroundColor: colors.goldFill }]}>
                  <Text style={st.fixNumberText}>{i + 1}</Text>
                </View>
                <Text style={[st.fixText, { color: colors.textSecondary }]}>{fix}</Text>
              </Animated.View>
            ))}
          </View>
        </>
      )}

      {/* Summary */}
      <Eyebrow>SUMMARY</Eyebrow>
      <Text style={[st.summaryText, { color: colors.textSecondary }]}>{analysis.analysis.summary}</Text>

      {/* AI-output report affordance. Sentinel analyses are AI-generated;
          users can flag inaccurate or harmful output here. Apple's
          generative-AI guidance expects user-reportable AI content. */}
      <TouchableOpacity onPress={handleFlag} activeOpacity={0.7} style={st.flagLink}>
        <Text style={[st.flagLinkText, { color: colors.textTertiary }]}>Flag this analysis</Text>
      </TouchableOpacity>

      {/* Action */}
      {proposalCreated ? (
        <View style={[st.successBanner, { backgroundColor: colors.successSurface, borderColor: `${colors.success}59` }]}>
          <Ionicons name="checkmark-circle" size={20} color={colors.success} />
          <Text style={[st.successBannerText, { color: colors.success }]}>Proposal Created!</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={[st.goldCta, { backgroundColor: colors.goldFill }, creatingProposal && { opacity: 0.6 }]}
          onPress={onCreateProposal}
          disabled={creatingProposal}
          activeOpacity={0.8}
        >
          {creatingProposal ? (
            <ActivityIndicator size="small" color={ON_GOLD} />
          ) : (
            <Ionicons name="add" size={18} color={ON_GOLD} />
          )}
          <Text style={st.goldCtaText}>{creatingProposal ? 'Creating...' : 'Create Proposal from Analysis'}</Text>
        </TouchableOpacity>
      )}

      {/* Provenance */}
      <Text style={[st.provenance, { color: colors.textTertiary }]}>{provenance}</Text>

      <View style={st.bottomPadding} />
    </ScrollView>
  );
}

// ══════════════════════════════════════════════════════════════════════
// ══ E3 · ANALYSIS HISTORY ═════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════

function HistoryRow({
  analysis,
  index,
  onPress,
}: {
  analysis: Analysis;
  index: number;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const avg = calculateAverageScore(analysis.analysis.categoryScores);
  const grade = scoreToLetterGrade(avg);
  const ringColor = scoreRingColor(avg, colors);
  const flagged = analysis.analysis.overallVerdict === 'Violating' ? ' · FLAGGED CRITICAL' : '';

  return (
    <Animated.View entering={FadeInUp.delay(index * 70).duration(300)}>
      <TouchableOpacity
        style={[st.historyRow, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View style={[st.historyRing, { borderColor: ringColor }]}>
          <Text style={[st.historyRingGrade, { color: colors.text }]}>{grade}</Text>
        </View>
        <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
          <Text style={[st.historyRowTitle, { color: colors.text }]} numberOfLines={1}>
            {analysis.title}
          </Text>
          <Text style={[st.historyRowMeta, { color: colors.textTertiary }]} numberOfLines={1}>
            {analysis.issueType.toUpperCase()} · {analysis.timestamp.toUpperCase()} · {avg}/100{flagged}
          </Text>
        </View>
        <Text style={[st.historyOpen, { color: colors.gold }]}>Open →</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

function HistoryView({
  analyses,
  isPremium,
  onBack,
  onNew,
  onOpen,
}: {
  analyses: Analysis[];
  isPremium: boolean;
  onBack: () => void;
  onNew: () => void;
  onOpen: (analysis: Analysis) => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[st.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={st.container}
        contentContainerStyle={[st.historyContent, { paddingTop: insets.top + 12 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(300)} style={st.topBar}>
          <View style={st.historyHeaderLeft}>
            <CircleButton icon="chevron-back" onPress={onBack} />
            <Text style={[st.historyTitle, { color: colors.text }]}>Sentinel</Text>
          </View>
          <TouchableOpacity
            onPress={onNew}
            activeOpacity={0.8}
            style={[st.historyNewBtn, { backgroundColor: colors.goldFill }]}
          >
            <Ionicons name="add" size={19} color={ON_GOLD} />
          </TouchableOpacity>
        </Animated.View>

        {/* Meta row */}
        <View style={st.historyMetaRow}>
          <Text style={[st.historyMetaText, { color: colors.textTertiary }]}>
            {analyses.length} {analyses.length === 1 ? 'ANALYSIS' : 'ANALYSES'} · PRIVATE TO YOU
          </Text>
          {isPremium && (
            <View style={[st.snBadge, { backgroundColor: colors.goldSurface, borderColor: `${colors.goldFill}40` }]}>
              <Text style={[st.snBadgeText, { color: colors.gold }]}>SENTINEL ACTIVE</Text>
            </View>
          )}
        </View>

        {/* Rows */}
        {analyses.length > 0 ? (
          <View style={{ gap: 12 }}>
            {analyses.map((analysis, index) => (
              <HistoryRow key={analysis.id} analysis={analysis} index={index} onPress={() => onOpen(analysis)} />
            ))}
          </View>
        ) : (
          <View style={[st.historyEmpty, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
            <SentinelGlyph size={28} color={colors.textTertiary} />
            <Text style={[st.emptyText, { color: colors.textSecondary }]}>
              No analyses yet — run your first analysis and the report card will be kept here.
            </Text>
          </View>
        )}

        {/* New analysis CTA */}
        <TouchableOpacity onPress={onNew} activeOpacity={0.8} style={[st.goldCta, { backgroundColor: colors.goldFill, marginTop: 20 }]}>
          <SentinelGlyph size={16} color={ON_GOLD} strokeWidth={2} />
          <Text style={st.goldCtaText}>New Analysis</Text>
        </TouchableOpacity>
        <Text style={[st.trustLine, { color: colors.textTertiary }]}>
          Analyses stay private until you share them or create a proposal
        </Text>

        <View style={st.bottomPadding} />
      </ScrollView>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════
// ══ 13 · SENTINEL PAYWALL ═════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════

function PaywallFeature({
  icon,
  title,
  body,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  body: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={[st.paywallFeature, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
      <Ionicons name={icon} size={17} color={colors.gold} style={{ marginTop: 1 }} />
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={[st.paywallFeatureTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[st.paywallFeatureBody, { color: colors.textTertiary }]}>{body}</Text>
      </View>
    </View>
  );
}

function PaywallView({
  onClose,
  onSubscribe,
  onRestore,
  restoring,
  onTerms,
}: {
  onClose: () => void;
  onSubscribe: () => void;
  onRestore: () => void;
  restoring: boolean;
  onTerms: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Animated.View entering={FadeIn.duration(240)} style={[st.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={st.container}
        contentContainerStyle={[st.paywallContent, { paddingTop: insets.top + 12 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ alignItems: 'flex-end' }}>
          <CircleButton icon="close" onPress={onClose} size={36} />
        </View>

        {/* Hero */}
        <View style={st.paywallHero}>
          <View style={[st.paywallGlyphTile, { backgroundColor: colors.goldSurface, borderColor: `${colors.goldFill}4D` }]}>
            <SentinelGlyph size={28} color={colors.gold} />
          </View>
          <View style={{ gap: 6, alignItems: 'center' }}>
            <Text style={[st.paywallEyebrow, { color: colors.gold }]}>SENTINEL</Text>
            <Text style={[st.paywallHeadline, { color: colors.text }]}>
              Understand every ballot before you cast it
            </Text>
          </View>
        </View>

        {/* Features */}
        <View style={{ gap: 9 }}>
          <PaywallFeature
            icon="scan-outline"
            title="Unlimited Sentinel analyses"
            body="Grade any bill, bylaw, or charter against 155 principles"
          />
          <PaywallFeature
            icon="analytics-outline"
            title="Advanced civic analytics"
            body="Deeper insight into your record and your community"
          />
          <PaywallFeature
            icon="megaphone-outline"
            title="Turn analyses into proposals"
            body="Run as many active proposals as you can champion"
          />
        </View>

        {/* Plan */}
        <View style={[st.planCard, { backgroundColor: colors.surface, borderColor: `${colors.goldFill}80` }]}>
          <View style={[st.planBadge, { backgroundColor: colors.goldFill }]}>
            <Text style={st.planBadgeText}>PREMIUM</Text>
          </View>
          <Text style={[st.planLabel, { color: colors.textTertiary }]}>MONTHLY</Text>
          <Text style={[st.planPrice, { color: colors.text }]}>$7.99</Text>
          <Text style={[st.planSub, { color: colors.textTertiary }]}>per month · cancel anytime</Text>
        </View>

        <View style={{ flex: 1 }} />

        {/* CTA + links */}
        <TouchableOpacity onPress={onSubscribe} activeOpacity={0.8} style={[st.goldCta, { backgroundColor: colors.goldFill, height: 56 }]}>
          <Text style={st.goldCtaText}>Continue to Subscribe</Text>
        </TouchableOpacity>
        <View style={st.paywallLinks}>
          <TouchableOpacity onPress={onRestore} disabled={restoring} activeOpacity={0.7}>
            {restoring ? (
              <ActivityIndicator size="small" color={colors.textTertiary} />
            ) : (
              <Text style={[st.paywallLinkText, { color: colors.textTertiary }]}>Restore Purchase</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={onTerms} activeOpacity={0.7}>
            <Text style={[st.paywallLinkText, { color: colors.textTertiary }]}>Terms</Text>
          </TouchableOpacity>
        </View>

        <View style={st.bottomPadding} />
      </ScrollView>
    </Animated.View>
  );
}

// ══════════════════════════════════════════════════════════════════════
// ══ MAIN SCREEN ═══════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════

export default function SentinelScreen() {
  const { colors } = useTheme();
  const { user, token } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [isPremium, setIsPremium] = useState(false);
  const [loadingSubscription, setLoadingSubscription] = useState(true);
  const [subRefresh, setSubRefresh] = useState(0);

  // Form state
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [issueType, setIssueType] = useState('Policy');
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzingDoc, setAnalyzingDoc] = useState<{ title: string; words: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Source helpers state
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [sourceUrl, setSourceUrl] = useState('');
  const [fetchingUrl, setFetchingUrl] = useState(false);

  // History and report state
  const [view, setView] = useState<'composer' | 'history'>('composer');
  const [analysisHistory, setAnalysisHistory] = useState<Analysis[]>([]);
  const [selectedReport, setSelectedReport] = useState<Analysis | null>(null);
  const [creatingProposal, setCreatingProposal] = useState(false);
  const [proposalCreated, setProposalCreated] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [restoring, setRestoring] = useState(false);
  // S2b · Sentinel gate sheet — shown instead of the full-screen paywall when
  // a non-premium user hits the analysis limit. Gate-triggered, so it bypasses
  // the weekly promo cap (contextual explanation, not an ad).
  const [showGateSheet, setShowGateSheet] = useState(false);

  // AI consent state
  const [aiConsented, setAiConsented] = useState(false);
  const [consentLoading, setConsentLoading] = useState(true);

  // Tutorial target refs
  const sentinelHeaderRef = useTutorialTarget('sentinel-header');
  const sentinelFormRef = useTutorialTarget('sentinel-form');

  // Check AI consent
  useEffect(() => {
    const checkConsent = async () => {
      try {
        const consent = await AsyncStorage.getItem(AI_CONSENT_KEY);
        setAiConsented(consent === 'true');
      } catch (error) {
        console.error('Error checking AI consent:', error);
      } finally {
        setConsentLoading(false);
      }
    };
    checkConsent();
  }, []);

  const handleAcceptConsent = async () => {
    await AsyncStorage.setItem(AI_CONSENT_KEY, 'true');
    setAiConsented(true);
  };

  // Load history from storage
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          setAnalysisHistory(JSON.parse(stored));
        }
      } catch (error) {
        console.error('Error loading history:', error);
      }
    };
    loadHistory();
  }, []);

  // Save history to storage
  const saveHistory = useCallback(async (history: Analysis[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (error) {
      console.error('Error saving history:', error);
    }
  }, []);

  // Check subscription
  useEffect(() => {
    const checkSubscription = async () => {
      // Demo account should appear as premium (for App Store review)
      const isDemoAccount = user?.email === 'demo@represent.app';
      if (isDemoAccount) {
        setIsPremium(true);
        setLoadingSubscription(false);
        return;
      }

      if (!token) {
        setLoadingSubscription(false);
        return;
      }
      try {
        const response = await fetch(`${API_URL}/api/stripe/subscription`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        if (response.ok) {
          const data = await response.json();
          setIsPremium(data.tier === 'premium' && data.status === 'active');
        }
      } catch (error) {
        console.error('Error checking subscription:', error);
      } finally {
        setLoadingSubscription(false);
      }
    };
    checkSubscription();
  }, [token, user?.email, subRefresh]);

  // Show demo report card for non-premium users
  const handleTryDemo = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedReport(DEMO_ANALYSIS);
    setProposalCreated(false);
  };

  // ── Source helpers ─────────────────────────────────────────────────
  const handlePaste = async () => {
    try {
      const clip = await Clipboard.getStringAsync();
      if (!clip) {
        Alert.alert('Clipboard is empty', 'Copy the document text first, then tap Paste.');
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setText((prev) => (prev ? `${prev}\n${clip}` : clip).slice(0, MAX_CHARS));
    } catch {
      Alert.alert('Error', 'Could not read the clipboard.');
    }
  };

  const handleImportFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['text/plain', 'text/markdown', 'application/pdf'],
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const asset = res.assets[0];
      const isPdf = asset.mimeType === 'application/pdf' || asset.name?.toLowerCase().endsWith('.pdf');
      if (isPdf) {
        Alert.alert(
          'PDF text extraction not supported yet',
          'Export the document as plain text, or paste the text directly.',
        );
        return;
      }
      const content = await FileSystem.readAsStringAsync(asset.uri);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setText(content.slice(0, MAX_CHARS));
      if (!title && asset.name) setTitle(asset.name.replace(/\.[^.]+$/, ''));
    } catch {
      Alert.alert('Error', 'Could not read that file.');
    }
  };

  const handleFetchUrl = async () => {
    const raw = sourceUrl.trim();
    if (!raw) return;
    setFetchingUrl(true);
    try {
      const target = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
      const response = await fetch(target);
      if (!response.ok) throw new Error('Fetch failed');
      const html = await response.text();
      const stripped = html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/\s+/g, ' ')
        .trim();
      if (!stripped) throw new Error('Empty');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setText(stripped.slice(0, MAX_CHARS));
      setShowUrlInput(false);
      setSourceUrl('');
    } catch {
      Alert.alert('Could not fetch that URL', 'Check the address, or paste the text directly.');
    } finally {
      setFetchingUrl(false);
    }
  };

  // ── Analyze ────────────────────────────────────────────────────────
  const handleAnalyze = async () => {
    // Non-premium analysis gate → S2b Sentinel-gate sheet (replaces the old
    // full-screen PaywallView takeover; "See Premium" routes to the paywall
    // modal, which carries purchase + restore). Gate-triggered, so it may
    // bypass the weekly promo cap — but it still records the showing.
    if (!isPremium) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      markPromoShown('sentinel-gate');
      setShowGateSheet(true);
      return;
    }

    if (!title.trim() || !text.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('Error', 'Please enter a title and text to analyze');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setAnalyzingDoc({ title: title.trim(), words: countWords(text) });
    setAnalyzing(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // Content fingerprint for the report card provenance line
      let sha256: string | undefined;
      try {
        sha256 = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text);
      } catch {
        sha256 = undefined;
      }

      const response = await fetch(`${API_URL}/api/sentinel/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, text, issueType }),
        signal: controller.signal,
      });

      if (!response.ok) throw new Error('Analysis failed');

      const data = await response.json();
      const analysis = {
        ...data.analysis,
        categoryScores: data.analysis.categoryScores || [],
        flaggedPrinciples: data.analysis.flaggedPrinciples || [],
        sentinelCorrections: data.analysis.sentinelCorrections || [],
        mainProposal: data.analysis.mainProposal || '',
      };

      const newAnalysis: Analysis = {
        id: Date.now().toString(),
        title,
        issueType,
        timestamp: new Date().toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
        sha256,
        analysis,
      };

      const updatedHistory = [newAnalysis, ...analysisHistory].slice(0, 20); // Keep last 20
      setAnalysisHistory(updatedHistory);
      saveHistory(updatedHistory);

      setSelectedReport(newAnalysis);
      setProposalCreated(false);
      setTitle('');
      setText('');

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      // User-cancelled analyses fail silently back to the composer
      if (error?.name !== 'AbortError') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Error', 'Failed to analyze document. Please try again.');
      }
    } finally {
      setAnalyzing(false);
      setAnalyzingDoc(null);
      abortRef.current = null;
    }
  };

  const handleCancelAnalysis = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    abortRef.current?.abort();
  };

  // ── Create proposal ────────────────────────────────────────────────
  const handleCreateProposal = async () => {
    // Check if this is a demo report
    if (selectedReport?.id === 'demo') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Alert.alert(
        'Premium Feature',
        'Upgrade to Premium to analyze your own documents and create proposals from the results.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upgrade', onPress: () => router.push('/modals/subscription') },
        ]
      );
      return;
    }

    if (!selectedReport || !user?.id) {
      Alert.alert('Error', 'Please sign in to create a proposal');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCreatingProposal(true);

    try {
      const response = await fetch(`${API_URL}/api/proposals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: selectedReport.analysis.mainProposal || `Reform: ${selectedReport.title}`,
          description: `Governance proposal generated by Sentinel analysis.\n\nOriginal Document: ${selectedReport.title}\nVerdict: ${selectedReport.analysis.overallVerdict}\n\nSummary: ${selectedReport.analysis.summary}`,
          category: 'governance',
          geoScope: 'global',
          geoRestrictions: [],
        }),
      });

      if (!response.ok) throw new Error('Failed to create proposal');

      setProposalCreated(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'Your proposal has been created and is now live for voting!');
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to create proposal. Please try again.');
    } finally {
      setCreatingProposal(false);
    }
  };

  // ── Share report ───────────────────────────────────────────────────
  const handleShareReport = async () => {
    if (!selectedReport) return;
    const avg = calculateAverageScore(selectedReport.analysis.categoryScores);
    const grade = scoreToLetterGrade(avg);
    try {
      await Share.share({
        message:
          `Sentinel Governance Report Card — ${selectedReport.title}\n` +
          `Grade ${grade} · ${avg}/100 · ${selectedReport.analysis.overallVerdict}\n\n` +
          `${selectedReport.analysis.summary}`,
      });
    } catch {
      // user dismissed the share sheet
    }
  };

  // ── Restore purchases (paywall) ────────────────────────────────────
  const handleRestore = async () => {
    setRestoring(true);
    try {
      const result = await restorePurchases(token);
      if (result.restored) {
        Alert.alert('Purchases Restored', 'Your previous purchases have been restored successfully.');
        setSubRefresh((n) => n + 1);
      } else {
        Alert.alert('No Purchases Found', result.error || 'No previous purchases were found to restore.');
      }
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to restore purchases');
    } finally {
      setRestoring(false);
    }
  };

  // ── Loading state (consent or subscription) ────────────────────────
  if (consentLoading || loadingSubscription) {
    return (
      <View style={[st.container, { backgroundColor: colors.background }]}>
        <View style={st.loadingContainer}>
          <SentinelGlyph size={32} color={colors.gold} />
          <ActivityIndicator size="large" color={colors.gold} />
          <Text style={[st.loadingText, { color: colors.textSecondary }]}>Loading Sentinel...</Text>
        </View>
      </View>
    );
  }

  // ── AI Consent Gate ────────────────────────────────────────────────
  if (!aiConsented) {
    return (
      <View style={[st.container, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={[st.consentContainer, { paddingTop: insets.top + 40 }]}>
          <View style={[st.consentIconTile, { backgroundColor: colors.goldSurface, borderColor: `${colors.goldFill}33` }]}>
            <Ionicons name="shield-checkmark" size={44} color={colors.gold} />
          </View>
          <Text style={[st.consentTitle, { color: colors.text }]}>AI Data Disclosure</Text>
          <Text style={[st.consentBody, { color: colors.textSecondary }]}>
            When you use Sentinel, the title, text, and category you enter are sent to our servers and processed using{' '}
            <Text style={{ fontFamily: FONTS.sansBold, color: colors.text }}>OpenAI</Text> to generate your governance analysis.
          </Text>
          <Text style={[st.consentBody, { color: colors.textSecondary }]}>
            This data is used solely for analysis and is not sold or shared with third parties. Your analysis history is stored locally on your device.
          </Text>
          <View style={[st.consentBullets, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
            <View style={st.consentBulletRow}>
              <Ionicons name="document-text-outline" size={18} color={colors.gold} />
              <Text style={[st.consentBulletText, { color: colors.text }]}>Data sent: Title, text, and issue type</Text>
            </View>
            <View style={st.consentBulletRow}>
              <Ionicons name="server-outline" size={18} color={colors.gold} />
              <Text style={[st.consentBulletText, { color: colors.text }]}>Processed by: OpenAI</Text>
            </View>
            <View style={st.consentBulletRow}>
              <Ionicons name="eye-off-outline" size={18} color={colors.gold} />
              <Text style={[st.consentBulletText, { color: colors.text }]}>Not sold or shared with third parties</Text>
            </View>
          </View>
          <TouchableOpacity
            style={[st.goldCta, { backgroundColor: colors.goldFill, height: 56, width: '100%' }]}
            onPress={handleAcceptConsent}
            activeOpacity={0.8}
          >
            <Text style={st.goldCtaText}>I Understand & Agree</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ── Paywall (13) ───────────────────────────────────────────────────
  if (showPaywall) {
    return (
      <View style={[st.container, { backgroundColor: colors.background }]}>
        <PaywallView
          onClose={() => setShowPaywall(false)}
          onSubscribe={() => {
            setShowPaywall(false);
            router.push('/modals/subscription');
          }}
          onRestore={handleRestore}
          restoring={restoring}
          onTerms={() => router.push('/modals/legal')}
        />
      </View>
    );
  }

  // ── Report Card (S2 + M3) ──────────────────────────────────────────
  if (selectedReport) {
    return (
      <View style={[st.container, { backgroundColor: colors.background }]}>
        <ReportView
          analysis={selectedReport}
          onClose={() => {
            setSelectedReport(null);
            setProposalCreated(false);
          }}
          onShare={handleShareReport}
          onCreateProposal={handleCreateProposal}
          creatingProposal={creatingProposal}
          proposalCreated={proposalCreated}
        />
      </View>
    );
  }

  // ── Analyzing (S1b) ────────────────────────────────────────────────
  if (analyzing) {
    return (
      <View style={[st.container, { backgroundColor: colors.background }]}>
        <AnalyzingView
          docTitle={analyzingDoc?.title ?? title}
          wordCount={analyzingDoc?.words ?? countWords(text)}
          onCancel={handleCancelAnalysis}
        />
      </View>
    );
  }

  // ── History (E3) ───────────────────────────────────────────────────
  if (view === 'history') {
    return (
      <HistoryView
        analyses={analysisHistory}
        isPremium={isPremium}
        onBack={() => setView('composer')}
        onNew={() => setView('composer')}
        onOpen={(analysis) => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setSelectedReport(analysis);
          setProposalCreated(false);
        }}
      />
    );
  }

  // ── Composer (S1) ──────────────────────────────────────────────────
  return (
    <View style={[st.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={st.container}
        contentContainerStyle={[st.composerContent, { paddingTop: insets.top + 12 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View ref={sentinelHeaderRef} collapsable={false}>
          <Animated.View entering={FadeInDown.duration(400)}>
            <View style={st.topBar}>
              {analysisHistory.length > 0 ? (
                <CircleButton icon="time-outline" onPress={() => setView('history')} />
              ) : (
                <View style={{ width: 40, height: 40 }} />
              )}
              <SentinelBadge label={isPremium ? 'SENTINEL ACTIVE' : 'SENTINEL'} />
            </View>
            <Text style={[st.screenTitle, { color: colors.text }]}>New Analysis</Text>
            <Text style={[st.screenSub, { color: colors.textSecondary }]}>
              Paste any governance text — a bill, bylaw, charter, treaty. Sentinel grades it against 155 principles and shows its work.
            </Text>
          </Animated.View>
        </View>

        {/* Form */}
        <View ref={sentinelFormRef} collapsable={false}>
          <Animated.View entering={FadeInUp.delay(120).duration(400)} style={{ gap: 16 }}>
            {/* Document title */}
            <View style={{ gap: 7 }}>
              <Eyebrow>DOCUMENT TITLE</Eyebrow>
              <TextInput
                style={[st.titleInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                placeholder="e.g. Tax Reform Act, 2026"
                placeholderTextColor={colors.textTertiary}
                value={title}
                onChangeText={setTitle}
              />
            </View>

            {/* Document type chips */}
            <View style={{ gap: 7 }}>
              <Eyebrow>DOCUMENT TYPE</Eyebrow>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chipsRow}>
                {ISSUE_TYPES.map((type) => {
                  const active = issueType === type;
                  return (
                    <TouchableOpacity
                      key={type}
                      onPress={() => setIssueType(type)}
                      activeOpacity={0.7}
                      style={[
                        st.typeChip,
                        active
                          ? { backgroundColor: colors.goldFill, borderColor: colors.goldFill }
                          : { backgroundColor: colors.surface, borderColor: colors.border },
                      ]}
                    >
                      <Text
                        style={[
                          active ? st.typeChipTextActive : st.typeChipText,
                          { color: active ? ON_GOLD : colors.textSecondary },
                        ]}
                      >
                        {type}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Document text */}
            <View style={{ gap: 7 }}>
              <View style={st.textLabelRow}>
                <Eyebrow>DOCUMENT TEXT</Eyebrow>
                <Text style={[st.charCount, { color: colors.textTertiary }]}>
                  {text.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}
                </Text>
              </View>
              <View style={[st.textAreaCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <TextInput
                  style={[st.textArea, { color: colors.text }]}
                  placeholder="Paste the governance text to analyze…"
                  placeholderTextColor={colors.textTertiary}
                  value={text}
                  onChangeText={setText}
                  multiline
                  textAlignVertical="top"
                  maxLength={MAX_CHARS}
                />
                {/* Source options */}
                <View style={st.sourceRow}>
                  <TouchableOpacity
                    onPress={handlePaste}
                    activeOpacity={0.7}
                    style={[st.sourceChip, { backgroundColor: colors.backgroundSecondary, borderColor: colors.borderSubtle }]}
                  >
                    <Ionicons name="clipboard-outline" size={12} color={colors.textSecondary} />
                    <Text style={[st.sourceChipText, { color: colors.textSecondary }]}>Paste</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleImportFile}
                    activeOpacity={0.7}
                    style={[st.sourceChip, { backgroundColor: colors.backgroundSecondary, borderColor: colors.borderSubtle }]}
                  >
                    <Ionicons name="document-outline" size={12} color={colors.textSecondary} />
                    <Text style={[st.sourceChipText, { color: colors.textSecondary }]}>Import File</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setShowUrlInput((v) => !v)}
                    activeOpacity={0.7}
                    style={[st.sourceChip, { backgroundColor: colors.backgroundSecondary, borderColor: colors.borderSubtle }]}
                  >
                    <Ionicons name="link-outline" size={12} color={colors.textSecondary} />
                    <Text style={[st.sourceChipText, { color: colors.textSecondary }]}>From URL</Text>
                  </TouchableOpacity>
                </View>
                {showUrlInput && (
                  <View style={st.urlRow}>
                    <TextInput
                      style={[st.urlInput, { backgroundColor: colors.backgroundSecondary, borderColor: colors.borderSubtle, color: colors.text }]}
                      placeholder="https://example.gov/bill-42"
                      placeholderTextColor={colors.textTertiary}
                      value={sourceUrl}
                      onChangeText={setSourceUrl}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="url"
                      onSubmitEditing={handleFetchUrl}
                    />
                    <TouchableOpacity
                      onPress={handleFetchUrl}
                      disabled={fetchingUrl}
                      activeOpacity={0.7}
                      style={[st.urlFetchBtn, { backgroundColor: colors.surfaceHighlight }]}
                    >
                      {fetchingUrl ? (
                        <ActivityIndicator size="small" color={colors.textSecondary} />
                      ) : (
                        <Text style={[st.sourceChipText, { color: colors.text }]}>Fetch</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>

            {/* Analyze CTA */}
            <View style={{ gap: 9 }}>
              <TouchableOpacity
                style={[st.goldCta, { backgroundColor: colors.goldFill, height: 56 }, analyzing && { opacity: 0.6 }]}
                onPress={handleAnalyze}
                disabled={analyzing}
                activeOpacity={0.8}
              >
                <SentinelGlyph size={17} color={ON_GOLD} strokeWidth={2} />
                <Text style={[st.goldCtaText, { fontSize: 17 }]}>Analyze with Sentinel</Text>
              </TouchableOpacity>
              <Text style={[st.trustLine, { color: colors.textTertiary }]}>
                Neutral criteria · processed by OpenAI · history stays on your device
              </Text>
              {!isPremium && (
                <TouchableOpacity onPress={handleTryDemo} activeOpacity={0.7} style={st.demoLink}>
                  <Text style={[st.demoLinkText, { color: colors.gold }]}>View a sample report card →</Text>
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>
        </View>

        <View style={st.bottomPadding} />
      </ScrollView>

      {/* S2b · Sentinel gate — the honest alternative first ("unlocks at
          midnight"), the real free→premium daily comparison in mono, one gold
          CTA to the paywall modal. */}
      <PremiumPromoSheet
        visible={showGateSheet}
        variant="sentinel-gate"
        onClose={() => setShowGateSheet(false)}
        onSeePremium={() => {
          setShowGateSheet(false);
          router.push('/modals/subscription');
        }}
      />
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════
// ══ STYLES ════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════

const st = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomPadding: {
    height: 100,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontFamily: FONTS.sans,
    fontSize: 14,
  },

  // Shared chrome
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  circleBtn: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  snBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.chip,
    borderWidth: 1,
  },
  snBadgeText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 9.5,
    letterSpacing: 1.3,
  },
  eyebrow: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10.5,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  goldCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    height: 54,
    borderRadius: 15,
  },
  goldCtaText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 16,
    color: ON_GOLD,
  },
  trustLine: {
    fontFamily: FONTS.sans,
    fontSize: 11.5,
    lineHeight: 16,
    textAlign: 'center',
  },
  emptyText: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },

  // ── Composer (S1) ──────────────────────────────────────────────────
  composerContent: {
    paddingHorizontal: SPACING.screenPadding,
  },
  screenTitle: {
    fontFamily: FONTS.serif,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  screenSub: {
    fontFamily: FONTS.sans,
    fontSize: 13.5,
    lineHeight: 20,
    marginBottom: 20,
  },
  titleInput: {
    height: 52,
    borderRadius: 15,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontFamily: FONTS.serifItalic,
    fontSize: 15,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 7,
    paddingVertical: 2,
  },
  typeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.chip,
    borderWidth: 1,
  },
  typeChipText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 12,
  },
  typeChipTextActive: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
  },
  textLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  charCount: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 0.4,
    fontVariant: ['tabular-nums'],
  },
  textAreaCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  textArea: {
    fontFamily: FONTS.serifItalic,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 190,
    padding: 0,
  },
  sourceRow: {
    flexDirection: 'row',
    gap: 8,
  },
  sourceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.chip,
    borderWidth: 1,
  },
  sourceChipText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
  },
  urlRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  urlInput: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontFamily: FONTS.mono,
    fontSize: 12,
  },
  urlFetchBtn: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoLink: {
    alignSelf: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  demoLinkText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12.5,
  },

  // ── Analyzing (S1b) ────────────────────────────────────────────────
  analyzingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  analyzingTitle: {
    fontFamily: FONTS.serif,
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -0.4,
  },
  analyzingDocTitle: {
    fontFamily: FONTS.serifItalic,
    fontSize: 13,
    maxWidth: 300,
  },
  analyzingBody: {
    fontFamily: FONTS.sans,
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 280,
  },
  ledgerCard: {
    width: '100%',
    borderRadius: RADIUS.card,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 6,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    gap: 12,
  },
  stepLabel: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
  },
  stepPendingDash: {
    fontFamily: FONTS.mono,
    fontSize: 11,
  },
  analyzingNote: {
    fontFamily: FONTS.sans,
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: 'center',
    maxWidth: 280,
  },
  cancelBtn: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 14.5,
  },

  // ── Report (S2 + M3) ───────────────────────────────────────────────
  reportContent: {
    paddingHorizontal: SPACING.screenPadding,
    gap: 13,
  },
  reportEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  demoChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
  },
  demoChipText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 9,
    letterSpacing: 1.4,
  },
  reportTitle: {
    fontFamily: FONTS.serif,
    fontSize: 22,
    lineHeight: 27,
    letterSpacing: -0.2,
  },
  heroCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 20,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    overflow: 'hidden',
  },
  heroEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  verdictChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
  },
  verdictChipText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 9,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  heroAssessment: {
    fontFamily: FONTS.sans,
    fontSize: 12.5,
    lineHeight: 19,
  },
  criteriaCard: {
    borderRadius: RADIUS.card,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 6,
  },
  criterionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
  },
  criterionLabel: {
    width: 104,
    fontFamily: FONTS.sansMedium,
    fontSize: 12,
  },
  criterionTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  criterionFill: {
    height: '100%',
    borderRadius: 3,
  },
  criterionGrade: {
    width: 28,
    textAlign: 'right',
    fontFamily: FONTS.mono,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  calloutGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  calloutCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 13,
    paddingHorizontal: 14,
    gap: 6,
  },
  calloutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  calloutLabel: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 9,
    letterSpacing: 1.1,
  },
  calloutBody: {
    fontFamily: FONTS.sans,
    fontSize: 11.5,
    lineHeight: 17,
  },
  findingRow: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
  },
  findingIconDisc: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  findingName: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12.5,
  },
  findingExplanation: {
    fontFamily: FONTS.sans,
    fontSize: 11.5,
    lineHeight: 17,
  },
  findingsEmpty: {
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    gap: 8,
  },
  fixRow: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
  },
  fixNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  fixNumberText: {
    fontFamily: FONTS.monoSemiBold,
    fontSize: 11,
    color: ON_GOLD,
    fontVariant: ['tabular-nums'],
  },
  fixText: {
    flex: 1,
    fontFamily: FONTS.sans,
    fontSize: 12,
    lineHeight: 18,
  },
  summaryText: {
    fontFamily: FONTS.sans,
    fontSize: 12.5,
    lineHeight: 20,
  },
  flagLink: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  flagLinkText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 11.5,
    textDecorationLine: 'underline',
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    height: 54,
    borderRadius: 15,
    borderWidth: 1,
  },
  successBannerText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 15,
  },
  provenance: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    letterSpacing: 1,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },

  // ── History (E3) ───────────────────────────────────────────────────
  historyContent: {
    paddingHorizontal: SPACING.screenPadding,
  },
  historyHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  historyTitle: {
    fontFamily: FONTS.serif,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.3,
  },
  historyNewBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  historyMetaText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    letterSpacing: 0.9,
    fontVariant: ['tabular-nums'],
  },
  historyRow: {
    borderRadius: RADIUS.card,
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 17,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  historyRing: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyRingGrade: {
    fontFamily: FONTS.serif,
    fontSize: 17,
  },
  historyRowTitle: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 14.5,
  },
  historyRowMeta: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 0.3,
    fontVariant: ['tabular-nums'],
  },
  historyOpen: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10.5,
  },
  historyEmpty: {
    borderRadius: RADIUS.card,
    borderWidth: 1,
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
    gap: 12,
  },

  // ── Paywall (13) ───────────────────────────────────────────────────
  paywallContent: {
    flexGrow: 1,
    paddingHorizontal: 26,
    gap: 16,
  },
  paywallHero: {
    alignItems: 'center',
    gap: 14,
  },
  paywallGlyphTile: {
    width: 64,
    height: 64,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paywallEyebrow: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10.5,
    letterSpacing: 2.1,
  },
  paywallHeadline: {
    fontFamily: FONTS.serif,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  paywallFeature: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderRadius: 15,
    borderWidth: 1,
    paddingVertical: 13,
    paddingHorizontal: 15,
  },
  paywallFeatureTitle: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 13.5,
  },
  paywallFeatureBody: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    lineHeight: 17,
  },
  planCard: {
    borderRadius: RADIUS.card,
    borderWidth: 1.5,
    paddingVertical: 15,
    paddingHorizontal: 16,
    gap: 3,
    marginTop: 8,
  },
  planBadge: {
    position: 'absolute',
    top: -9,
    left: 14,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.chip,
  },
  planBadgeText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 8.5,
    letterSpacing: 1,
    color: ON_GOLD,
  },
  planLabel: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    letterSpacing: 1.4,
  },
  planPrice: {
    fontFamily: FONTS.monoSemiBold,
    fontSize: 22,
    fontVariant: ['tabular-nums'],
  },
  planSub: {
    fontFamily: FONTS.sans,
    fontSize: 11,
  },
  paywallLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 18,
  },
  paywallLinkText: {
    fontFamily: FONTS.sans,
    fontSize: 11.5,
  },

  // ── Consent gate ───────────────────────────────────────────────────
  consentContainer: {
    paddingHorizontal: SPACING.screenPadding,
    alignItems: 'center',
    paddingBottom: 120,
  },
  consentIconTile: {
    width: 88,
    height: 88,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  consentTitle: {
    fontFamily: FONTS.serif,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.3,
    textAlign: 'center',
    marginBottom: 16,
  },
  consentBody: {
    fontFamily: FONTS.sans,
    fontSize: 13.5,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 12,
  },
  consentBullets: {
    width: '100%',
    borderRadius: RADIUS.card,
    borderWidth: 1,
    padding: 16,
    gap: 14,
    marginTop: 8,
    marginBottom: 24,
  },
  consentBulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  consentBulletText: {
    flex: 1,
    fontFamily: FONTS.sans,
    fontSize: 13,
    lineHeight: 18,
  },
});
