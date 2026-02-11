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
import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS, responsive } from '../../lib/theme';
import { UpgradeModal } from '../../components/ui';
import { useTutorialTarget } from '../../components/tutorial';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

const API_URL = 'https://representportal.com';
const STORAGE_KEY = 'sentinel_analysis_history';
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

// Quick Stats Row Component
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
        <Text style={[styles.scoreBarValue, { color: scoreColor, fontWeight: '700' }]}>{score}</Text>
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
        <Text style={[styles.scoreHeroLabel, { color: colors.gold }]}>GOVERNANCE SCORE</Text>
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

  // Tutorial target refs
  const sentinelHeaderRef = useTutorialTarget('sentinel-header');
  const sentinelFormRef = useTutorialTarget('sentinel-form');

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

  // Loading state
  if (loadingSubscription) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.gold} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading Sentinel...</Text>
        </View>
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
        {/* Header */}
        <View ref={sentinelHeaderRef} collapsable={false}>
          <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
            <View style={[styles.headerIconBg, { backgroundColor: `${colors.gold}15` }]}>
              <Ionicons name="sparkles" size={28} color={colors.gold} />
            </View>
            <View style={styles.headerText}>
              <Text style={[styles.headerTitle, { color: colors.gold }]}>Sentinel AI</Text>
              <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                Governance Report Cards
              </Text>
            </View>
            {!isPremium && (
              <TouchableOpacity
                style={[styles.premiumBadge, { backgroundColor: colors.gold }]}
                onPress={() => router.push('/modals/subscription')}
              >
                <Text style={styles.premiumBadgeText}>Premium</Text>
              </TouchableOpacity>
            )}
          </Animated.View>
        </View>

        {/* Quick Stats */}
        <Animated.View entering={FadeInUp.delay(100).duration(400)}>
          <QuickStatsRow analyses={analysisHistory} />
        </Animated.View>

        {/* Recent Analyses */}
        {analysisHistory.length > 0 && (
          <Animated.View entering={FadeInUp.delay(200).duration(400)} style={styles.historySection}>
            <View style={styles.historySectionHeader}>
              <Text style={[styles.historySectionTitle, { color: colors.text }]}>Recent Analyses</Text>
              {analysisHistory.length > 3 && (
                <Text style={[styles.historyCount, { color: colors.textTertiary }]}>
                  {analysisHistory.length} total
                </Text>
              )}
            </View>
            {analysisHistory.slice(0, 5).map((analysis, index) => (
              <AnalysisHistoryCard
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

        {/* New Analysis Form */}
        <View ref={sentinelFormRef} collapsable={false}>
          <Animated.View
            entering={FadeInUp.delay(300).duration(400)}
            style={[styles.formCard, { backgroundColor: colors.surface, borderColor: colors.gold }]}
          >
            <LinearGradient
              colors={[`${colors.gold}08`, 'transparent']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />

            <View style={styles.formHeader}>
              <View style={[styles.formIconBg, { backgroundColor: `${colors.gold}15` }]}>
                <Ionicons name="add-circle-outline" size={20} color={colors.gold} />
              </View>
              <Text style={[styles.formTitle, { color: colors.gold }]}>New Analysis</Text>
            </View>

          {/* Title Input */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.gold }]}>Document Title</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surfaceHighlight, borderColor: colors.border, color: colors.text }]}
              placeholder="e.g., Tax Reform Act 2026"
              placeholderTextColor={colors.textTertiary}
              value={title}
              onChangeText={setTitle}
            />
          </View>

          {/* Issue Type Picker */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.gold }]}>Issue Type</Text>
            <TouchableOpacity
              style={[styles.picker, { backgroundColor: colors.surfaceHighlight, borderColor: colors.border }]}
              onPress={() => setShowIssueTypePicker(!showIssueTypePicker)}
            >
              <Text style={[styles.pickerText, { color: colors.text }]}>{issueType}</Text>
              <Ionicons name={showIssueTypePicker ? 'chevron-up' : 'chevron-down'} size={20} color={colors.gold} />
            </TouchableOpacity>
            {showIssueTypePicker && (
              <Animated.View
                entering={FadeIn.duration(200)}
                style={[styles.pickerDropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                {ISSUE_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.pickerOption, issueType === type && { backgroundColor: `${colors.gold}15` }]}
                    onPress={() => {
                      setIssueType(type);
                      setShowIssueTypePicker(false);
                    }}
                  >
                    <Text style={[styles.pickerOptionText, { color: colors.text }]}>{type}</Text>
                    {issueType === type && <Ionicons name="checkmark" size={18} color={colors.gold} />}
                  </TouchableOpacity>
                ))}
              </Animated.View>
            )}
          </View>

          {/* Text Input */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.gold }]}>Document Text</Text>
            <TextInput
              style={[styles.textArea, { backgroundColor: colors.surfaceHighlight, borderColor: colors.border, color: colors.text }]}
              placeholder="Paste the governance text to analyze..."
              placeholderTextColor={colors.textTertiary}
              value={text}
              onChangeText={setText}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
          </View>

          {/* Analyze Button */}
          <TouchableOpacity
            style={[styles.analyzeButton, { backgroundColor: colors.gold }, analyzing && styles.buttonDisabled]}
            onPress={handleAnalyze}
            disabled={analyzing}
            activeOpacity={0.8}
          >
            {analyzing ? (
              <>
                <ActivityIndicator size="small" color="#000" />
                <Text style={styles.analyzeButtonText}>Analyzing...</Text>
              </>
            ) : (
              <>
                <Ionicons name="sparkles" size={20} color="#000" />
                <Text style={styles.analyzeButtonText}>Analyze with Sentinel</Text>
              </>
            )}
          </TouchableOpacity>
          </Animated.View>
        </View>

        {/* Info Card */}
        <Animated.View
          entering={FadeInUp.delay(400).duration(400)}
          style={[styles.infoCard, { backgroundColor: `${colors.gold}10`, borderColor: colors.gold }]}
        >
          <Ionicons name="information-circle" size={20} color={colors.gold} />
          <Text style={[styles.infoText, { color: colors.text }]}>
            Sentinel evaluates documents against 155 principles of proper human governance and generates a report card with grades.
          </Text>
        </Animated.View>

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
    fontWeight: '700',
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
    fontWeight: '700',
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
    fontWeight: '600',
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
    fontWeight: '700',
  },
  gradeTextLarge: {
    fontSize: 36,
  },
  gradeTextSmall: {
    fontSize: 18,
  },

  // Form Card
  formCard: {
    borderRadius: BORDER_RADIUS.xxl,
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
    fontWeight: '600',
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
    fontWeight: '700',
    fontSize: 10,
  },

  // Score Hero (Circular Gauge)
  scoreHero: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    marginHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.xxl,
    borderWidth: 1.5,
    marginBottom: SPACING.lg,
    overflow: 'hidden',
  },
  scoreHeroLabel: {
    ...TYPOGRAPHY.labelMedium,
    letterSpacing: 2,
    marginBottom: SPACING.lg,
    fontWeight: '600',
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
    fontWeight: '700',
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
    fontWeight: '700',
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
    fontWeight: '700',
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
    fontWeight: '700',
  },

  // Legacy Grade Hero (kept for reference)
  gradeHero: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
    marginHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.xxl,
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
    fontWeight: '700',
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
    fontWeight: '600',
  },

  // Report Sections
  reportSection: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xxl,
    borderWidth: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    ...TYPOGRAPHY.labelLarge,
    fontWeight: '600',
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
    fontWeight: '700',
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
    fontWeight: '700',
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
    fontWeight: '600',
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
    fontWeight: '600',
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
});
