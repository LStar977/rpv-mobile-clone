import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Dimensions,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../../lib/auth';
import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS, responsive, FONTS } from '../../lib/theme';
import { UpgradeModal } from '../../components/ui';
import { useTutorialTarget } from '../../components/tutorial';
import Svg, { Circle, Path, Line } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ── Sentinel Premium Design Tokens (static fallbacks for StyleSheet) ───
const SN_G = '#EABA58';       // Gold primary
const SN_GD = '#C89A3E';      // Gold dark
const SN_GL = '#F4D28C';      // Gold light
const SN_BG = '#040707';      // Background
const SN_BG_CARD = '#0D0F12'; // Card background
const SN_BG_RAISED = '#15181C'; // Raised surface
const SN_LINE = '#1E2228';    // Border/line
const SN_LINE_STRONG = '#2A2F37'; // Strong border
const SN_FG = '#F4F5F6';      // Primary text
const SN_FG_MUTED = '#C7CACD'; // Secondary text
const SN_FG_FAINT = '#8E9297'; // Tertiary text
const SN_GREEN = '#34C759';   // Success/aligned
const SN_RED = '#E5605A';     // Error/violating
const SN_AMBER = '#F0A542';   // Warning/at risk
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

// Dynamic hook for components to get theme-aware colors
function useSentinelColors() {
  const { colors, isDark } = useTheme();
  return {
    G: colors.gold,
    GD: colors.goldDark,
    GL: colors.goldLight,
    BG: colors.background,
    BG_CARD: colors.surface,
    BG_RAISED: colors.surfaceElevated,
    LINE: colors.border,
    LINE_STRONG: colors.borderStrong,
    FG: colors.text,
    FG_MUTED: colors.textSecondary,
    FG_FAINT: colors.textTertiary,
    GREEN: colors.success,
    RED: colors.error,
    AMBER: colors.warning,
    isDark,
  };
}

const API_URL = 'https://representportal.com';
const STORAGE_KEY = 'sentinel_analysis_history';
const AI_CONSENT_KEY = 'sentinel_ai_consent';
const ISSUE_TYPES = ['Law', 'Policy', 'Regulation', 'Executive Order', 'Budget Decision', 'Other'];

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

// Score-based colors (credit score style)
const getScoreColor = (score: number): string => {
  if (score >= 80) return '#34C759'; // Green - Excellent
  if (score >= 65) return '#30D158'; // Light green - Good
  if (score >= 50) return '#FF9500'; // Orange - Fair
  if (score >= 35) return '#FF6B35'; // Dark orange - Poor
  return '#FF3B30'; // Red - Critical
};

const getScoreLabel = (score: number): string => {
  if (score >= 80) return 'Excellent';
  if (score >= 65) return 'Good';
  if (score >= 50) return 'Fair';
  if (score >= 35) return 'Poor';
  return 'Critical';
};

// Legacy grade colors for backwards compatibility
const GRADE_COLORS = {
  A: '#34C759',
  B: '#007AFF',
  C: '#FF9500',
  D: '#FF3B30',
  F: '#8E8E93',
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
  analysis: AnalysisResult;
};

// Calculate average score from category scores
function calculateAverageScore(categoryScores: { score: number }[]): number {
  if (!categoryScores || categoryScores.length === 0) return 0;
  return Math.round(categoryScores.reduce((sum, c) => sum + c.score, 0) / categoryScores.length);
}

// Calculate letter grade from average score (kept for history cards)
function calculateLetterGrade(categoryScores: { score: number }[]): string {
  if (!categoryScores || categoryScores.length === 0) return 'N/A';
  const avg = categoryScores.reduce((sum, c) => sum + c.score, 0) / categoryScores.length;
  if (avg >= 90) return 'A';
  if (avg >= 80) return 'B';
  if (avg >= 70) return 'C';
  if (avg >= 60) return 'D';
  return 'F';
}

// Get grade color
function getGradeColor(grade: string): string {
  return GRADE_COLORS[grade as keyof typeof GRADE_COLORS] || GRADE_COLORS.F;
}

// Get verdict icon
function getVerdictIcon(verdict: string): string {
  if (verdict === 'Aligned') return 'checkmark-circle';
  if (verdict === 'At Risk') return 'warning';
  return 'alert-circle';
}

// Get verdict color for premium UI
function getVerdictColorPremium(verdict: string): string {
  if (verdict === 'Aligned') return SN_GREEN;
  if (verdict === 'At Risk') return SN_AMBER;
  return SN_RED;
}

// ── SentinelMark — sparkle/star icon ─────────────────────────────────
function SentinelMark({ size = 22, color = SN_G }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2L13.5 9.5L21 11L13.5 12.5L12 20L10.5 12.5L3 11L10.5 9.5L12 2Z"
        fill={`${color}25`}
        stroke={color}
        strokeWidth={1}
        strokeLinejoin="round"
      />
      <Path
        d="M19 4L19.6 6.4L22 7L19.6 7.6L19 10L18.4 7.6L16 7L18.4 6.4L19 4Z"
        fill={color}
        stroke={color}
        strokeWidth={0.5}
        strokeLinejoin="round"
      />
      <Path
        d="M5 14L5.4 15.6L7 16L5.4 16.4L5 18L4.6 16.4L3 16L4.6 15.6L5 14Z"
        fill={color}
        stroke={color}
        strokeWidth={0.5}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// ── ScoreDial — radial meter for verdict cards ───────────────────────
function ScoreDial({ score = 50, color = SN_RED, size = 56 }: { score?: number; color?: string; size?: number }) {
  const sn = useSentinelColors();
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - score / 100);

  return (
    <View style={{ width: size, height: size, position: 'relative' }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={sn.LINE_STRONG}
          strokeWidth={2}
        />
        {/* Score arc */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeDasharray={`${c}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
        {/* Inner dashed ring */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r - 4}
          fill="none"
          stroke={color}
          strokeWidth={0.4}
          strokeDasharray="1 2"
          opacity={0.4}
        />
      </Svg>
      <View style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Text style={{
          fontFamily: FONTS.serif,
          fontSize: size * 0.32,
          color: color,
          letterSpacing: -0.5,
        }}>{score}</Text>
      </View>
    </View>
  );
}

// ── Premium Eyebrow ──────────────────────────────────────────────────
function SnEyebrow({ children, color }: { children: React.ReactNode; color?: string }) {
  const sn = useSentinelColors();
  return (
    <Text style={{
      fontFamily: FONTS.sansSemiBold,
      fontSize: 10,
      letterSpacing: 2.2,
      textTransform: 'uppercase',
      color: color || sn.FG_FAINT,
    }}>{children}</Text>
  );
}

// Circular Score Gauge Component (Credit Score Style)
function CircularScoreGauge({ score, size = 'large' }: { score: number; size?: 'small' | 'large' }) {
  const { colors } = useTheme();
  const scoreColor = getScoreColor(score);
  const scoreLabel = getScoreLabel(score);
  const isLarge = size === 'large';

  if (!isLarge) {
    // Small badge version for history cards
    return (
      <View style={[styles.scoreGaugeSmall, { borderColor: scoreColor }]}>
        <Text style={[styles.scoreGaugeSmallText, { color: scoreColor }]}>{score}</Text>
      </View>
    );
  }

  // Create tick marks for the gauge
  const tickCount = 30;
  const ticks = [];
  for (let i = 0; i < tickCount; i++) {
    const angle = (i / tickCount) * 270 - 135; // 270 degree arc starting from bottom-left
    const isActive = (i / tickCount) <= (score / 100);
    const tickColor = isActive ? scoreColor : `${colors.border}60`;
    ticks.push(
      <View
        key={i}
        style={[
          styles.gaugeTick,
          {
            backgroundColor: tickColor,
            transform: [
              { rotate: `${angle}deg` },
              { translateY: -70 },
            ],
          },
        ]}
      />
    );
  }

  return (
    <View style={styles.circularGaugeContainer}>
      {/* Gauge ring with ticks */}
      <View style={styles.gaugeRing}>
        {ticks}
        {/* Inner circle */}
        <View style={[styles.gaugeInner, { backgroundColor: colors.surface }]}>
          <Text style={[styles.gaugeScore, { color: scoreColor }]}>{score}</Text>
          <Text style={[styles.gaugeLabel, { color: colors.textSecondary }]}>out of 100</Text>
        </View>
      </View>
      {/* Score label badge moved to ReportCard for side-by-side layout with verdict */}
    </View>
  );
}

// Small Score Badge for history cards
function ScoreBadge({ score }: { score: number }) {
  const scoreColor = getScoreColor(score);
  return (
    <View style={[styles.scoreBadgeSmall, { backgroundColor: `${scoreColor}15`, borderColor: `${scoreColor}40` }]}>
      <Text style={[styles.scoreBadgeText, { color: scoreColor }]}>{score}</Text>
    </View>
  );
}

// Letter Grade Badge Component (kept for backwards compat)
function LetterGradeBadge({ grade, size = 'large' }: { grade: string; size?: 'small' | 'large' }) {
  const color = getGradeColor(grade);
  const isLarge = size === 'large';

  return (
    <View style={[
      styles.gradeBadge,
      isLarge ? styles.gradeBadgeLarge : styles.gradeBadgeSmall,
      { backgroundColor: `${color}20`, borderColor: color }
    ]}>
      <Text style={[
        styles.gradeText,
        isLarge ? styles.gradeTextLarge : styles.gradeTextSmall,
        { color }
      ]}>
        {grade}
      </Text>
    </View>
  );
}

// Quick Stats Row Component (legacy)
function QuickStatsRow({ analyses }: { analyses: Analysis[] }) {
  const { colors } = useTheme();
  const total = analyses.length;
  const atRisk = analyses.filter(a => a.analysis.overallVerdict === 'At Risk').length;
  const violating = analyses.filter(a => a.analysis.overallVerdict === 'Violating').length;
  const aligned = analyses.filter(a => a.analysis.overallVerdict === 'Aligned').length;

  return (
    <View style={styles.statsRow}>
      <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.statValue, { color: colors.gold }]}>{total}</Text>
        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Analyzed</Text>
      </View>
      <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.statValue, { color: GRADE_COLORS.C }]}>{atRisk + violating}</Text>
        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>At Risk</Text>
      </View>
      <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.statValue, { color: GRADE_COLORS.A }]}>{aligned}</Text>
        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Aligned</Text>
      </View>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════
// ══ PREMIUM SENTINEL UI COMPONENTS ════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════

// ── Premium Header ───────────────────────────────────────────────────
function SnHeader({ isPremium }: { isPremium: boolean }) {
  const sn = useSentinelColors();
  return (
    <Animated.View entering={FadeInDown.duration(400)} style={snStyles.header}>
      {/* Premium badge */}
      {isPremium && (
        <View style={snStyles.headerTopRow}>
          <View style={snStyles.premiumHallmark}>
            <Svg width={9} height={9} viewBox="0 0 12 12">
              <Path d="M6 1l1.5 3 3.5.5-2.5 2.5.6 3.5L6 8.8 2.9 10.5l.6-3.5L1 4.5 4.5 4 6 1z" fill={sn.G} />
            </Svg>
            <Text style={[snStyles.premiumText, { color: sn.FG_FAINT }]}>Premium</Text>
          </View>
        </View>
      )}

      {/* Main header row: icon + title */}
      <View style={snStyles.headerMain}>
        <View style={snStyles.headerIconBox}>
          <SentinelMark size={28} color={sn.GL} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[snStyles.headerTitle, { color: sn.FG }]}>
            Sentinel AI
          </Text>
          <Text style={[snStyles.headerSubtitle, { color: sn.FG_MUTED }]}>
            Governance Report Cards
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

// ── Tribunal Tally (replaces QuickStatsRow) ���─────────────────────────
function Tribunal({ analyses }: { analyses: Analysis[] }) {
  const sn = useSentinelColors();
  const total = analyses.length;
  const atRisk = analyses.filter(a => a.analysis.overallVerdict === 'At Risk').length;
  const violating = analyses.filter(a => a.analysis.overallVerdict === 'Violating').length;
  const aligned = analyses.filter(a => a.analysis.overallVerdict === 'Aligned').length;

  const now = new Date();
  const sessionCode = `SESSION ${String(now.getMonth() + 1).padStart(2, '0')}·${String(now.getDate()).padStart(2, '0')}`;

  const items = [
    { label: 'Analyzed', count: String(total).padStart(2, '0'), color: sn.FG },
    { label: 'At Risk', count: String(atRisk + violating).padStart(2, '0'), color: sn.AMBER },
    { label: 'Aligned', count: String(aligned).padStart(2, '0'), color: sn.GREEN },
  ];

  return (
    <Animated.View entering={FadeInUp.delay(100).duration(400)} style={snStyles.tribunalContainer}>
      <View style={[snStyles.tribunalCard, { backgroundColor: sn.BG_CARD, borderColor: sn.LINE }]}>
        {items.map((item, i) => (
          <View
            key={item.label}
            style={[
              snStyles.tribunalCell,
              i < 2 && [snStyles.tribunalCellBorder, { borderRightColor: sn.LINE }],
            ]}
          >
            <Text style={[snStyles.tribunalNumber, { color: item.color }]}>
              {item.count}
            </Text>
            <Text style={[snStyles.tribunalLabel, { color: sn.FG_FAINT }]}>{item.label}</Text>
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

// ── Premium Verdict Card (dossier style) ─────────────────────────────
function VerdictDossierCard({
  analysis,
  onPress,
  index,
}: {
  analysis: Analysis;
  onPress: () => void;
  index: number;
}) {
  const sn = useSentinelColors();
  const averageScore = calculateAverageScore(analysis.analysis.categoryScores);
  const verdictColor = getVerdictColorPremium(analysis.analysis.overallVerdict);
  const now = new Date();
  const caseCode = `SC·${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}/${String(now.getFullYear()).slice(-2)}`;

  return (
    <Animated.View entering={FadeInUp.delay(index * 80).duration(300)}>
      <TouchableOpacity
        style={[snStyles.dossierCard, { borderLeftColor: verdictColor, backgroundColor: sn.BG_CARD, borderColor: sn.LINE }]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <ScoreDial score={averageScore} color={verdictColor} size={56} />
        <View style={snStyles.dossierContent}>
          <View style={snStyles.dossierMeta}>
            <Text style={[snStyles.dossierCode, { color: sn.FG_FAINT }]}>{caseCode}</Text>
            <View style={snStyles.dossierDot} />
            <Text style={[snStyles.dossierScope, { color: sn.FG_MUTED }]}>{analysis.issueType}</Text>
          </View>
          <Text style={[snStyles.dossierTitle, { color: sn.FG }]} numberOfLines={1}>
            {analysis.title}
          </Text>
          <View style={snStyles.dossierFooter}>
            <View style={[snStyles.verdictChip, { backgroundColor: `${verdictColor}1F`, borderColor: `${verdictColor}59` }]}>
              <Text style={[snStyles.verdictChipText, { color: verdictColor }]}>
                {analysis.analysis.overallVerdict}
              </Text>
            </View>
            <Text style={[snStyles.dossierDate, { color: sn.FG_FAINT }]}>{analysis.timestamp}</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={14} color={sn.FG_FAINT} />
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Issue Type Chip ──────────────────────────────────────────────────
function IssueChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const sn = useSentinelColors();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        snStyles.issueChip,
        { borderColor: sn.LINE_STRONG, backgroundColor: active ? sn.G : 'transparent' },
      ]}
      activeOpacity={0.7}
    >
      <Text style={[snStyles.issueChipText, { color: active ? '#1A1A1A' : sn.FG_MUTED }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ── Submission Desk (premium form) ───────────────────────────────────
function SubmissionDesk({
  title,
  setTitle,
  text,
  setText,
  issueType,
  setIssueType,
  analyzing,
  onAnalyze,
  isPremium,
}: {
  title: string;
  setTitle: (v: string) => void;
  text: string;
  setText: (v: string) => void;
  issueType: string;
  setIssueType: (v: string) => void;
  analyzing: boolean;
  onAnalyze: () => void;
  isPremium: boolean;
}) {
  const sn = useSentinelColors();
  const issueTypes = ['Policy', 'Statute', 'Charter', 'Treaty', 'Law', 'Other'];

  return (
    <Animated.View entering={FadeInUp.delay(300).duration(400)} style={[snStyles.deskContainer, { borderColor: sn.LINE_STRONG }]}>
      <LinearGradient
        colors={sn.isDark ? ['#0E1014', '#0A0C0F'] : ['#FFFFFF', '#F8F6F3']}
        style={[StyleSheet.absoluteFill, { borderRadius: 18 }]}
      />

      {/* Header */}
      <View style={snStyles.deskHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: sn.LINE, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: sn.FG, fontSize: 18, fontFamily: FONTS.sans }}>+</Text>
          </View>
          <Text style={[snStyles.deskTitle, { color: sn.FG }]}>New Analysis</Text>
        </View>
      </View>

      {/* Title field */}
      <View style={snStyles.fieldGroup}>
        <Text style={[snStyles.fieldLabel, { color: sn.FG_FAINT }]}>Document Title</Text>
        <TextInput
          style={[snStyles.titleInput, { color: sn.FG, borderColor: sn.LINE, backgroundColor: sn.isDark ? 'transparent' : sn.BG_RAISED }]}
          placeholder="e.g. Tax Reform Act, 2026"
          placeholderTextColor={sn.FG_FAINT}
          value={title}
          onChangeText={setTitle}
        />
      </View>

      {/* Issue type chips */}
      <View style={snStyles.fieldGroup}>
        <Text style={[snStyles.fieldLabel, { color: sn.FG_FAINT }]}>Issue Type</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={snStyles.chipsRow}
        >
          {issueTypes.map((type) => (
            <IssueChip
              key={type}
              label={type}
              active={issueType === type}
              onPress={() => setIssueType(type)}
            />
          ))}
        </ScrollView>
      </View>

      {/* Document text area with paper lines */}
      <View style={snStyles.fieldGroup}>
        <View style={snStyles.fieldLabelRow}>
          <Text style={[snStyles.fieldLabel, { color: sn.FG_FAINT }]}>Document Text</Text>
          <Text style={[snStyles.charCount, { color: sn.FG_FAINT }]}>{text.length.toLocaleString()} / 50,000</Text>
        </View>
        <View style={[snStyles.textAreaContainer, { borderColor: sn.LINE, backgroundColor: sn.isDark ? 'transparent' : sn.BG_RAISED }]}>
          {/* Paper rule lines */}
          <View style={snStyles.paperLines} />
          <TextInput
            style={[snStyles.textArea, { color: sn.FG }]}
            placeholder="Paste the governance text to analyze..."
            placeholderTextColor={sn.FG_FAINT}
            value={text}
            onChangeText={setText}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            maxLength={50000}
          />
        </View>
      </View>

      {/* Submit button */}
      <TouchableOpacity
        style={[snStyles.submitButton, analyzing && { opacity: 0.6 }]}
        onPress={onAnalyze}
        disabled={analyzing}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={[sn.GL, sn.GD]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        />
        {analyzing ? (
          <ActivityIndicator size="small" color="#1A1308" />
        ) : (
          <SentinelMark size={16} color="#1A1308" />
        )}
        <Text style={snStyles.submitText}>
          {analyzing ? 'Analyzing...' : 'Analyze with Sentinel'}
        </Text>
      </TouchableOpacity>

      {/* Provenance footer */}
      <View style={snStyles.provenanceRow}>
        <Text style={snStyles.provenanceText}>
          Powered by OpenAI.{' '}
          <Text style={snStyles.provenanceLink}>Privacy notice</Text>
        </Text>
      </View>
    </Animated.View>
  );
}

// ── Footer Signature ─────────────────────────────────────────────────
function SnFooterSig() {
  const sn = useSentinelColors();
  return (
    <Animated.View entering={FadeInUp.delay(400).duration(400)} style={snStyles.footerContainer}>
      <Text style={[snStyles.footerQuote, { color: sn.FG_FAINT }]}>Sentinel evaluates documents against 155 principles of proper human governance and generates a report card with grades.</Text>
    </Animated.View>
  );
}

// ── Premium Styles ───────────────────────────────────────────────────
const snStyles = StyleSheet.create({
  // Header
  header: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sessionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: SN_GREEN,
    shadowColor: SN_GREEN,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  sessionText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    color: SN_FG_FAINT,
  },
  premiumHallmark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: `${SN_G}66`,
    backgroundColor: `${SN_G}15`,
  },
  premiumText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 9.5,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: SN_G,
  },
  headerMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: SN_BG_RAISED,
    borderWidth: 1,
    borderColor: SN_LINE_STRONG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: FONTS.serif,
    fontSize: 26,
    letterSpacing: -0.6,
    lineHeight: 28,
    color: SN_FG,
    marginBottom: 2,
  },
  headerSubtitle: {
    fontFamily: FONTS.sans,
    fontSize: 11.5,
    color: SN_FG_MUTED,
    letterSpacing: -0.1,
  },
  headerSubtitleItalic: {
    fontFamily: FONTS.serifMediumItalic,
    fontSize: 12,
  },

  // Tribunal
  tribunalContainer: {
    paddingHorizontal: 24,
    marginBottom: 22,
  },
  tribunalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  sessionCode: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: SN_FG_FAINT,
    letterSpacing: 0.8,
  },
  tribunalCard: {
    backgroundColor: SN_BG_CARD,
    borderWidth: 1,
    borderColor: SN_LINE,
    borderRadius: 14,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  tribunalCell: {
    flex: 1,
    padding: 14,
  },
  tribunalCellBorder: {
    borderRightWidth: 1,
    borderRightColor: SN_LINE,
  },
  tribunalNumber: {
    fontFamily: FONTS.serif,
    fontSize: 30,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  tribunalLabel: {
    fontFamily: FONTS.sansMedium,
    fontSize: 11,
    color: SN_FG_MUTED,
    letterSpacing: -0.1,
    marginBottom: 2,
  },
  tribunalTag: {
    fontFamily: FONTS.sans,
    fontSize: 9,
    color: SN_FG_FAINT,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  // Dossier Card
  dossierCard: {
    backgroundColor: SN_BG_CARD,
    borderWidth: 1,
    borderColor: SN_LINE,
    borderLeftWidth: 2,
    borderRadius: 14,
    padding: 14,
    paddingLeft: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 10,
  },
  dossierContent: {
    flex: 1,
    minWidth: 0,
  },
  dossierMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  dossierCode: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: SN_FG_FAINT,
    letterSpacing: 1,
  },
  dossierDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: SN_LINE_STRONG,
  },
  dossierScope: {
    fontFamily: FONTS.sansMedium,
    fontSize: 10,
    color: SN_FG_FAINT,
    letterSpacing: 0.4,
  },
  dossierTitle: {
    fontFamily: FONTS.serif,
    fontSize: 19,
    color: SN_FG,
    letterSpacing: -0.1,
    marginBottom: 6,
  },
  dossierFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  verdictChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  verdictChipText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 9,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  dossierDate: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    color: SN_FG_MUTED,
  },

  // Issue Chip
  issueChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: SN_LINE_STRONG,
    marginRight: 8,
  },
  issueChipActive: {
    borderColor: SN_GD,
    backgroundColor: `${SN_G}1A`,
  },
  issueChipText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 11,
    color: SN_FG_MUTED,
    letterSpacing: -0.1,
  },
  issueChipTextActive: {
    fontFamily: FONTS.sansSemiBold,
    color: SN_G,
  },

  // Submission Desk
  deskContainer: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 28,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: SN_LINE_STRONG,
    padding: 22,
    overflow: 'hidden',
    position: 'relative',
  },
  formCode: {
    position: 'absolute',
    top: 14,
    right: 14,
    fontFamily: FONTS.mono,
    fontSize: 8.5,
    color: SN_FG_FAINT,
    letterSpacing: 1.2,
  },
  deskHeader: {
    marginBottom: 24,
  },
  deskTitle: {
    fontFamily: FONTS.serif,
    fontSize: 30,
    color: SN_FG,
    letterSpacing: -0.4,
    marginTop: 8,
    lineHeight: 34,
  },
  deskTitleItalic: {
    fontStyle: 'italic',
    color: SN_GL,
  },
  deskSubtitle: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    color: SN_FG_MUTED,
    letterSpacing: -0.1,
    marginTop: 8,
    lineHeight: 18,
  },
  fieldGroup: {
    marginBottom: 22,
  },
  fieldLabel: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 9.5,
    color: SN_FG_FAINT,
    letterSpacing: 2,
    marginBottom: 8,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  charCount: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: SN_FG_FAINT,
    letterSpacing: 0.5,
  },
  titleInput: {
    fontFamily: FONTS.serifMediumItalic,
    fontSize: 18,
    color: SN_FG,
    borderBottomWidth: 1,
    borderBottomColor: SN_LINE_STRONG,
    paddingVertical: 8,
    paddingHorizontal: 0,
  },
  chipsRow: {
    flexDirection: 'row',
    paddingVertical: 2,
  },
  textAreaContainer: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderWidth: 1,
    borderColor: SN_LINE,
    borderRadius: 12,
    minHeight: 320,
    position: 'relative',
    overflow: 'hidden',
  },
  paperLines: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.35,
  },
  textArea: {
    fontFamily: FONTS.serifMediumItalic,
    fontSize: 15,
    color: SN_FG,
    lineHeight: 24,
    padding: 16,
    paddingTop: 18,
    minHeight: 310,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 4,
  },
  submitText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 15,
    color: '#1A1308',
    letterSpacing: 0.3,
  },
  provenanceRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: SN_LINE,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  provenanceText: {
    fontFamily: FONTS.sans,
    fontSize: 10,
    color: SN_FG_FAINT,
    letterSpacing: -0.1,
    flex: 1,
  },
  provenanceLink: {
    color: SN_GL,
    textDecorationLine: 'underline',
  },
  versionText: {
    fontFamily: FONTS.mono,
    fontSize: 8.5,
    color: SN_FG_FAINT,
    letterSpacing: 1,
  },

  // Footer
  footerContainer: {
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 24,
    alignItems: 'center',
  },
  footerQuote: {
    fontFamily: FONTS.serifMediumItalic,
    fontSize: 13,
    color: SN_FG_FAINT,
    letterSpacing: -0.1,
    marginBottom: 4,
  },
  footerEstablished: {
    fontFamily: FONTS.mono,
    fontSize: 8.5,
    color: SN_FG_FAINT,
    letterSpacing: 2.2,
  },

  // Verdict Section
  verdictSection: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  verdictSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 14,
  },
  verdictSectionTitle: {
    fontFamily: FONTS.serif,
    fontSize: 22,
    color: SN_FG,
    letterSpacing: -0.2,
    lineHeight: 24,
    marginTop: 4,
  },
  archiveLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  archiveLinkText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 11,
    color: SN_FG_FAINT,
  },
});

// Analysis History Card Component
function AnalysisHistoryCard({
  analysis,
  onPress,
  index,
}: {
  analysis: Analysis;
  onPress: () => void;
  index: number;
}) {
  const { colors } = useTheme();
  const averageScore = calculateAverageScore(analysis.analysis.categoryScores);
  const verdictColor = analysis.analysis.overallVerdict === 'Aligned'
    ? colors.success
    : analysis.analysis.overallVerdict === 'At Risk'
      ? colors.warning
      : colors.error;

  return (
    <Animated.View entering={FadeInUp.delay(index * 80).duration(300)}>
      <TouchableOpacity
        style={[styles.historyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View style={styles.historyCardContent}>
          <View style={styles.historyCardLeft}>
            <Text style={[styles.historyTitle, { color: colors.text }]} numberOfLines={1}>
              {analysis.title}
            </Text>
            <View style={styles.historyMeta}>
              <View style={[styles.verdictPill, { backgroundColor: `${verdictColor}20` }]}>
                <Ionicons name={getVerdictIcon(analysis.analysis.overallVerdict) as any} size={12} color={verdictColor} />
                <Text style={[styles.verdictPillText, { color: verdictColor }]}>
                  {analysis.analysis.overallVerdict}
                </Text>
              </View>
              <Text style={[styles.historyDate, { color: colors.textTertiary }]}>
                {analysis.timestamp}
              </Text>
            </View>
          </View>
          <ScoreBadge score={averageScore} />
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
      </TouchableOpacity>
    </Animated.View>
  );
}

// Category Score Bar Component
function CategoryScoreBar({ category, score, index }: { category: string; score: number; index: number }) {
  const { colors } = useTheme();
  const scoreColor = getScoreColor(score);

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 60).duration(300)}
      style={styles.scoreBarContainer}
    >
      <View style={styles.scoreBarHeader}>
        <Text style={[styles.scoreBarCategory, { color: colors.text }]} numberOfLines={1}>
          {category}
        </Text>
        <Text style={[styles.scoreBarValue, { color: scoreColor, fontFamily: FONTS.monoSemiBold, fontVariant: ['tabular-nums'] }]}>{score}</Text>
      </View>
      <View style={[styles.scoreBarTrack, { backgroundColor: `${colors.border}80` }]}>
        <Animated.View style={[styles.scoreBarFill, { width: `${score}%`, backgroundColor: scoreColor }]} />
      </View>
    </Animated.View>
  );
}

// Finding Item Component
function FindingItem({ finding, index }: { finding: Analysis['analysis']['flaggedPrinciples'][0]; index: number }) {
  const { colors } = useTheme();
  const statusColor = finding.status === 'Aligned'
    ? colors.success
    : finding.status === 'Partially Violated'
      ? colors.warning
      : colors.error;
  const statusIcon = finding.status === 'Aligned'
    ? 'checkmark-circle'
    : finding.status === 'Partially Violated'
      ? 'warning'
      : 'close-circle';

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 60).duration(300)}
      style={[styles.findingItem, { backgroundColor: colors.surfaceHighlight, borderColor: colors.border }]}
    >
      <Ionicons name={statusIcon as any} size={18} color={statusColor} style={styles.findingIcon} />
      <View style={styles.findingContent}>
        <Text style={[styles.findingName, { color: colors.text }]}>{finding.name}</Text>
        <Text style={[styles.findingExplanation, { color: colors.textSecondary }]} numberOfLines={2}>
          {finding.explanation}
        </Text>
      </View>
    </Animated.View>
  );
}

// Report Card Component
function ReportCard({
  analysis,
  onClose,
  onCreateProposal,
  creatingProposal,
  proposalCreated,
}: {
  analysis: Analysis;
  onClose: () => void;
  onCreateProposal: () => void;
  creatingProposal: boolean;
  proposalCreated: boolean;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const averageScore = calculateAverageScore(analysis.analysis.categoryScores);
  const scoreColor = getScoreColor(averageScore);
  const scoreLabel = getScoreLabel(averageScore);
  const verdictColor = analysis.analysis.overallVerdict === 'Aligned'
    ? colors.success
    : analysis.analysis.overallVerdict === 'At Risk'
      ? colors.warning
      : colors.error;

  return (
    <ScrollView style={styles.reportCardScroll} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={[styles.reportHeader, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={onClose} style={styles.reportBackButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.reportHeaderText}>
          <View style={styles.reportTitleRow}>
            <Text style={[styles.reportHeaderTitle, { color: colors.gold }]}>Governance Report</Text>
            {analysis.id === 'demo' && (
              <View style={[styles.demoBadge, { backgroundColor: colors.warning }]}>
                <Text style={styles.demoBadgeText}>DEMO</Text>
              </View>
            )}
          </View>
          <Text style={[styles.reportHeaderSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
            {analysis.title}
          </Text>
        </View>
      </View>

      {/* Governance Score Hero */}
      <Animated.View
        entering={FadeIn.duration(500)}
        style={[styles.scoreHero, { backgroundColor: colors.surface, borderColor: colors.gold }]}
      >
        <LinearGradient
          colors={[`${colors.gold}10`, 'transparent']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <Text style={[styles.scoreHeroLabel, { color: colors.gold }]}>Governance Score</Text>
        <CircularScoreGauge score={averageScore} size="large" />
        <View style={styles.badgeRow}>
          <View style={[styles.scoreLabelBadge, { backgroundColor: `${scoreColor}15`, borderColor: `${scoreColor}40` }]}>
            <Text style={[styles.scoreLabelText, { color: scoreColor }]}>{scoreLabel}</Text>
          </View>
          <View style={[styles.verdictBadge, { backgroundColor: `${verdictColor}15`, borderColor: `${verdictColor}40` }]}>
            <Ionicons name={getVerdictIcon(analysis.analysis.overallVerdict) as any} size={16} color={verdictColor} />
            <Text style={[styles.verdictBadgeText, { color: verdictColor }]}>
              {analysis.analysis.overallVerdict}
            </Text>
          </View>
        </View>
      </Animated.View>

      {/* Category Scores */}
      <View style={[styles.reportSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <Ionicons name="bar-chart-outline" size={18} color={colors.gold} />
          <Text style={[styles.sectionTitle, { color: colors.gold }]}>Category Scores</Text>
        </View>
        {analysis.analysis.categoryScores.length > 0 ? (
          analysis.analysis.categoryScores.map((cat, i) => (
            <CategoryScoreBar key={cat.category} category={cat.category} score={cat.score} index={i} />
          ))
        ) : (
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No scores available</Text>
        )}
      </View>

      {/* Key Findings */}
      <View style={[styles.reportSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <Ionicons name="search-outline" size={18} color={colors.gold} />
          <Text style={[styles.sectionTitle, { color: colors.gold }]}>Key Findings</Text>
        </View>
        {analysis.analysis.flaggedPrinciples.length > 0 ? (
          analysis.analysis.flaggedPrinciples.slice(0, 5).map((finding, i) => (
            <FindingItem key={finding.principleId} finding={finding} index={i} />
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="shield-checkmark" size={32} color={colors.success} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No issues found - document is aligned
            </Text>
          </View>
        )}
      </View>

      {/* Recommended Fixes */}
      {analysis.analysis.sentinelCorrections.length > 0 && (
        <View style={[styles.reportSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="construct-outline" size={18} color={colors.gold} />
            <Text style={[styles.sectionTitle, { color: colors.gold }]}>Recommended Fixes</Text>
          </View>
          {analysis.analysis.sentinelCorrections.map((fix, i) => (
            <Animated.View
              key={i}
              entering={FadeInUp.delay(i * 60).duration(300)}
              style={[styles.fixItem, { backgroundColor: `${colors.warning}10`, borderColor: `${colors.warning}30` }]}
            >
              <View style={[styles.fixNumber, { backgroundColor: colors.warning }]}>
                <Text style={styles.fixNumberText}>{i + 1}</Text>
              </View>
              <Text style={[styles.fixText, { color: colors.text }]}>{fix}</Text>
            </Animated.View>
          ))}
        </View>
      )}

      {/* Summary */}
      <View style={[styles.reportSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <Ionicons name="document-text-outline" size={18} color={colors.gold} />
          <Text style={[styles.sectionTitle, { color: colors.gold }]}>Summary</Text>
        </View>
        <Text style={[styles.summaryText, { color: colors.text }]}>
          {analysis.analysis.summary}
        </Text>
      </View>

      {/* AI-output report affordance. Sentinel analyses are AI-generated;
          users can flag inaccurate or harmful output here. Apple's
          generative-AI guidance expects user-reportable AI content. */}
      <TouchableOpacity
        onPress={() => {
          const subject = encodeURIComponent('Sentinel analysis feedback');
          const body = encodeURIComponent(
            `I'd like to flag this Sentinel analysis as inaccurate or inappropriate.\n\n` +
            `Issue type: ${analysis.issueType ?? '(unknown)'}\n` +
            `Title: ${analysis.title ?? ''}\n` +
            `Reason (please describe):\n\n`,
          );
          Linking.openURL(`mailto:support@representvote.com?subject=${subject}&body=${body}`).catch(() => {
            Alert.alert(
              'Could not open email',
              'Email support@representvote.com to flag this analysis.',
            );
          });
        }}
        activeOpacity={0.7}
        style={{
          alignSelf: 'center',
          paddingVertical: 8,
          paddingHorizontal: 12,
          marginTop: 4,
        }}
      >
        <Text style={{ fontSize: 12, fontFamily: FONTS.sans, color: colors.textSecondary, textDecorationLine: 'underline' }}>
          Flag this analysis
        </Text>
      </TouchableOpacity>

      {/* Actions */}
      <View style={styles.reportActions}>
        {proposalCreated ? (
          <View style={[styles.successBanner, { backgroundColor: `${colors.success}15`, borderColor: colors.success }]}>
            <Ionicons name="checkmark-circle" size={24} color={colors.success} />
            <Text style={[styles.successText, { color: colors.success }]}>Proposal Created!</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.createProposalButton, { backgroundColor: colors.gold }]}
            onPress={onCreateProposal}
            disabled={creatingProposal}
            activeOpacity={0.8}
          >
            {creatingProposal ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Ionicons name="add-circle" size={20} color="#000" />
            )}
            <Text style={styles.createProposalText}>
              {creatingProposal ? 'Creating...' : 'Create Proposal from Analysis'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}

export default function SentinelScreen() {
  const { colors } = useTheme();
  const { user, token } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [isPremium, setIsPremium] = useState(false);
  const [loadingSubscription, setLoadingSubscription] = useState(true);

  // Form state
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [issueType, setIssueType] = useState('Policy');
  const [showIssueTypePicker, setShowIssueTypePicker] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  // History and report state
  const [analysisHistory, setAnalysisHistory] = useState<Analysis[]>([]);
  const [selectedReport, setSelectedReport] = useState<Analysis | null>(null);
  const [creatingProposal, setCreatingProposal] = useState(false);
  const [proposalCreated, setProposalCreated] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

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
  }, [token, user?.email]);

  // Show demo report card for non-premium users
  const handleTryDemo = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedReport(DEMO_ANALYSIS);
    setProposalCreated(false);
  };

  const handleAnalyze = async () => {
    // For non-premium users, prompt to upgrade
    if (!isPremium) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      router.push('/modals/subscription');
      return;
    }

    if (!title.trim() || !text.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('Error', 'Please enter a title and text to analyze');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setAnalyzing(true);

    try {
      const response = await fetch(`${API_URL}/api/sentinel/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, text, issueType }),
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
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to analyze document. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  };

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

  // Loading state (consent or subscription)
  if (consentLoading || loadingSubscription) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.gold} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading Sentinel...</Text>
        </View>
      </View>
    );
  }

  // Show AI Consent Gate
  if (!aiConsented) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={[styles.consentContainer, { paddingTop: insets.top + 40 }]}>
          <View style={[styles.consentIconBg, { backgroundColor: `${colors.gold}15` }]}>
            <Ionicons name="shield-checkmark" size={48} color={colors.gold} />
          </View>
          <Text style={[styles.consentTitle, { color: colors.text }]}>AI Data Disclosure</Text>
          <Text style={[styles.consentBody, { color: colors.textSecondary }]}>
            When you use Sentinel, the title, text, and category you enter are sent to our servers and processed using{' '}
            <Text style={{ fontFamily: FONTS.sansBold, color: colors.text }}>OpenAI</Text> to generate your governance analysis.
          </Text>
          <Text style={[styles.consentBody, { color: colors.textSecondary }]}>
            This data is used solely for analysis and is not sold or shared with third parties. Your analysis history is stored locally on your device.
          </Text>
          <View style={[styles.consentBullets, { backgroundColor: colors.surfaceHighlight, borderColor: colors.border }]}>
            <View style={styles.consentBulletRow}>
              <Ionicons name="document-text-outline" size={18} color={colors.gold} />
              <Text style={[styles.consentBulletText, { color: colors.text }]}>Data sent: Title, text, and issue type</Text>
            </View>
            <View style={styles.consentBulletRow}>
              <Ionicons name="server-outline" size={18} color={colors.gold} />
              <Text style={[styles.consentBulletText, { color: colors.text }]}>Processed by: OpenAI</Text>
            </View>
            <View style={styles.consentBulletRow}>
              <Ionicons name="eye-off-outline" size={18} color={colors.gold} />
              <Text style={[styles.consentBulletText, { color: colors.text }]}>Not sold or shared with third parties</Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.consentAcceptButton, { backgroundColor: colors.gold }]}
            onPress={handleAcceptConsent}
            activeOpacity={0.8}
          >
            <Text style={styles.consentAcceptText}>I Understand & Agree</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // Show Report Card if selected
  if (selectedReport) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ReportCard
          analysis={selectedReport}
          onClose={() => {
            setSelectedReport(null);
            setProposalCreated(false);
          }}
          onCreateProposal={handleCreateProposal}
          creatingProposal={creatingProposal}
          proposalCreated={proposalCreated}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Premium Header */}
        <View ref={sentinelHeaderRef} collapsable={false}>
          <SnHeader isPremium={isPremium} />
        </View>

        {/* Submission Desk Form — Hero */}
        <View ref={sentinelFormRef} collapsable={false}>
          <SubmissionDesk
            title={title}
            setTitle={setTitle}
            text={text}
            setText={setText}
            issueType={issueType}
            setIssueType={setIssueType}
            analyzing={analyzing}
            onAnalyze={handleAnalyze}
            isPremium={isPremium}
          />
        </View>

        {/* Tribunal Tally */}
        <Tribunal analyses={analysisHistory} />

        {/* Recent Verdicts */}
        {analysisHistory.length > 0 && (
          <Animated.View entering={FadeInUp.delay(200).duration(400)} style={snStyles.verdictSection}>
            <View style={snStyles.verdictSectionHeader}>
              <View>
                <Text style={snStyles.verdictSectionTitle}>Recent Analyses</Text>
              </View>
              <TouchableOpacity style={snStyles.archiveLink}>
                <Text style={snStyles.archiveLinkText}>Archive</Text>
                <Ionicons name="chevron-forward" size={10} color={SN_FG_FAINT} />
              </TouchableOpacity>
            </View>
            {analysisHistory.slice(0, 3).map((analysis, index) => (
              <VerdictDossierCard
                key={analysis.id}
                analysis={analysis}
                index={index}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSelectedReport(analysis);
                  setProposalCreated(false);
                }}
              />
            ))}
          </Animated.View>
        )}

        {/* Footer Signature */}
        <SnFooterSig />

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Premium Upgrade Modal */}
      <UpgradeModal
        visible={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        type="premium"
        title="Unlock Sentinel AI"
        message="Upgrade to Premium to analyze government documents and get detailed governance report cards with grades."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.md,
  },
  loadingText: {
    ...TYPOGRAPHY.bodyMedium,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    // paddingTop is set dynamically via insets
    paddingHorizontal: SPACING.lg,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  headerIconBg: {
    width: 56,
    height: 56,
    borderRadius: BORDER_RADIUS.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    ...TYPOGRAPHY.headlineLarge,
  },
  headerSubtitle: {
    ...TYPOGRAPHY.bodyMedium,
    marginTop: SPACING.xxs,
  },
  premiumBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
  },
  premiumBadgeText: {
    ...TYPOGRAPHY.labelSmall,
    color: '#000',
  },

  // Stats Row
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.xl,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
  },
  statValue: {
    ...TYPOGRAPHY.headlineLarge,
  },
  statLabel: {
    ...TYPOGRAPHY.labelSmall,
    marginTop: SPACING.xxs,
  },

  // History Section
  historySection: {
    marginBottom: SPACING.xl,
  },
  historySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  historySectionTitle: {
    ...TYPOGRAPHY.headlineSmall,
  },
  historyCount: {
    ...TYPOGRAPHY.labelSmall,
  },
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    marginBottom: SPACING.sm,
  },
  historyCardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  historyCardLeft: {
    flex: 1,
    marginRight: SPACING.md,
  },
  historyTitle: {
    ...TYPOGRAPHY.labelLarge,
    marginBottom: SPACING.xs,
  },
  historyMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  verdictPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.full,
    gap: 4,
  },
  verdictPillText: {
    ...TYPOGRAPHY.labelSmall,
  },
  historyDate: {
    ...TYPOGRAPHY.labelSmall,
  },

  // Grade Badge
  gradeBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  gradeBadgeLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  gradeBadgeSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  gradeText: {
    fontFamily: FONTS.monoSemiBold,
    fontVariant: ['tabular-nums'],
  },
  gradeTextLarge: {
    fontSize: 36,
  },
  gradeTextSmall: {
    fontSize: 18,
  },

  // Form Card
  formCard: {
    borderRadius: BORDER_RADIUS['2xl'],
    padding: SPACING.xl,
    marginBottom: SPACING.lg,
    borderWidth: 1.5,
    overflow: 'hidden',
    ...SHADOWS.md,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  formIconBg: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  formTitle: {
    ...TYPOGRAPHY.headlineSmall,
  },
  inputGroup: {
    marginBottom: SPACING.lg,
  },
  inputLabel: {
    ...TYPOGRAPHY.labelMedium,
    marginBottom: SPACING.sm,
  },
  input: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    ...TYPOGRAPHY.bodyMedium,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    ...TYPOGRAPHY.bodyMedium,
    minHeight: 120,
  },
  picker: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerText: {
    ...TYPOGRAPHY.bodyMedium,
  },
  pickerDropdown: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.lg,
    marginTop: SPACING.sm,
    overflow: 'hidden',
  },
  pickerOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  pickerOptionText: {
    ...TYPOGRAPHY.bodyMedium,
  },
  analyzeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.full,
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  analyzeButtonText: {
    ...TYPOGRAPHY.labelLarge,
    color: '#000',
  },
  buttonDisabled: {
    opacity: 0.6,
  },

  // Info Card
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    gap: SPACING.md,
  },
  infoText: {
    ...TYPOGRAPHY.bodySmall,
    flex: 1,
    lineHeight: 20,
  },

  // Report Card
  reportCardScroll: {
    flex: 1,
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    // paddingTop is set dynamically via insets
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
  },
  reportBackButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  reportHeaderText: {
    flex: 1,
  },
  reportHeaderTitle: {
    ...TYPOGRAPHY.headlineLarge,
  },
  reportHeaderSubtitle: {
    ...TYPOGRAPHY.bodyMedium,
    marginTop: SPACING.xxs,
  },
  reportTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  demoBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  demoBadgeText: {
    ...TYPOGRAPHY.labelSmall,
    color: '#000',
    fontSize: 10,
  },

  // Score Hero (Circular Gauge)
  scoreHero: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    marginHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS['2xl'],
    borderWidth: 1.5,
    marginBottom: SPACING.lg,
    overflow: 'hidden',
  },
  scoreHeroLabel: {
    fontFamily: FONTS.serif,
    fontSize: 14,
    letterSpacing: 1,
    marginBottom: SPACING.lg,
    textTransform: 'uppercase',
  },

  // Circular Gauge
  circularGaugeContainer: {
    alignItems: 'center',
  },
  gaugeRing: {
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  gaugeTick: {
    position: 'absolute',
    width: 4,
    height: 12,
    borderRadius: 2,
    top: '50%',
    left: '50%',
    marginLeft: -2,
    marginTop: -6,
  },
  gaugeInner: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugeScore: {
    fontSize: responsive(40, 44, 48),
    fontFamily: FONTS.monoSemiBold,
    fontVariant: ['tabular-nums'],
  },
  gaugeLabel: {
    ...TYPOGRAPHY.labelSmall,
    marginTop: 2,
  },
  scoreLabelBadge: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  scoreLabelText: {
    ...TYPOGRAPHY.labelMedium,
    letterSpacing: 1,
  },

  // Score Badge (Small)
  scoreBadgeSmall: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
  },
  scoreBadgeText: {
    ...TYPOGRAPHY.labelMedium,
    fontFamily: FONTS.monoSemiBold,
    fontVariant: ['tabular-nums'],
  },
  scoreGaugeSmall: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreGaugeSmallText: {
    ...TYPOGRAPHY.labelMedium,
    fontFamily: FONTS.monoSemiBold,
    fontVariant: ['tabular-nums'],
  },

  // Legacy Grade Hero (kept for reference)
  gradeHero: {
    alignItems: 'center',
    paddingVertical: SPACING['2xl'],
    marginHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS['2xl'],
    borderWidth: 1.5,
    marginBottom: SPACING.lg,
    overflow: 'hidden',
  },
  gradeHeroLabel: {
    ...TYPOGRAPHY.labelMedium,
    letterSpacing: 2,
    marginBottom: SPACING.sm,
  },
  gradeHeroGrade: {
    fontSize: 72,
    fontFamily: FONTS.monoSemiBold,
    fontVariant: ['tabular-nums'],
    marginBottom: SPACING.md,
  },
  verdictBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    gap: SPACING.sm,
  },
  verdictBadgeText: {
    ...TYPOGRAPHY.labelMedium,
  },

  // Report Sections
  reportSection: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS['2xl'],
    borderWidth: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontFamily: FONTS.serif,
    fontSize: 18,
  },

  // Score Bars
  scoreBarContainer: {
    marginBottom: SPACING.md,
  },
  scoreBarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  scoreBarCategory: {
    ...TYPOGRAPHY.bodyMedium,
    flex: 1,
    marginRight: SPACING.md,
  },
  scoreBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  scoreBarGrade: {
    ...TYPOGRAPHY.labelMedium,
    fontFamily: FONTS.monoSemiBold,
    fontVariant: ['tabular-nums'],
  },
  scoreBarValue: {
    ...TYPOGRAPHY.labelSmall,
  },
  scoreBarTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: '100%',
    borderRadius: 4,
  },

  // Findings
  findingItem: {
    flexDirection: 'row',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.sm,
  },
  findingIcon: {
    marginRight: SPACING.md,
    marginTop: 2,
  },
  findingContent: {
    flex: 1,
  },
  findingName: {
    ...TYPOGRAPHY.labelMedium,
    marginBottom: SPACING.xxs,
  },
  findingExplanation: {
    ...TYPOGRAPHY.bodySmall,
    lineHeight: 18,
  },

  // Fixes
  fixItem: {
    flexDirection: 'row',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.sm,
  },
  fixNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  fixNumberText: {
    ...TYPOGRAPHY.labelSmall,
    color: '#fff',
    fontFamily: FONTS.monoSemiBold,
    fontVariant: ['tabular-nums'],
  },
  fixText: {
    ...TYPOGRAPHY.bodyMedium,
    flex: 1,
    lineHeight: 22,
  },

  // Summary
  summaryText: {
    ...TYPOGRAPHY.bodyMedium,
    lineHeight: 24,
  },

  // Actions
  reportActions: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  createProposalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.full,
    gap: SPACING.sm,
  },
  createProposalText: {
    ...TYPOGRAPHY.labelLarge,
    color: '#000',
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    gap: SPACING.sm,
  },
  successText: {
    ...TYPOGRAPHY.labelLarge,
  },

  // Empty States
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    gap: SPACING.sm,
  },
  emptyText: {
    ...TYPOGRAPHY.bodyMedium,
    textAlign: 'center',
  },

  bottomPadding: {
    height: 100,
  },

  // AI Consent
  consentContainer: {
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
  },
  consentIconBg: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xl,
  },
  consentTitle: {
    ...TYPOGRAPHY.headlineLarge,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  consentBody: {
    ...TYPOGRAPHY.bodyMedium,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.md,
  },
  consentBullets: {
    width: '100%',
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    marginTop: SPACING.md,
    marginBottom: SPACING.xl,
    gap: SPACING.md,
  },
  consentBulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  consentBulletText: {
    ...TYPOGRAPHY.bodyMedium,
    flex: 1,
  },
  consentAcceptButton: {
    width: '100%',
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.full,
    alignItems: 'center',
  },
  consentAcceptText: {
    ...TYPOGRAPHY.labelLarge,
    color: '#000',
  },
  aiDisclosure: {
    ...TYPOGRAPHY.labelSmall,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
});
