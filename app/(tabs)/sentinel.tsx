import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
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
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { useAuthStore } from '../../lib/auth';
import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS, ANIMATION } from '../../lib/theme';
import { UpgradeModal } from '../../components/ui';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

const API_URL = 'https://representportal.com';
const ISSUE_TYPES = ['Law', 'Policy', 'Regulation', 'Executive Order', 'Budget Decision', 'Other'];

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

// Animated Tab Component
function TabButton({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    Haptics.selectionAsync();
    scale.value = withSpring(0.95, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedTouchable
      style={[
        styles.tab,
        {
          backgroundColor: active ? colors.gold : 'transparent',
          borderColor: active ? colors.gold : colors.border,
        },
        animatedStyle,
      ]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
    >
      <Text style={styles.tabIcon}>{icon}</Text>
      <Text style={[styles.tabText, { color: active ? '#000' : colors.text }]}>{label}</Text>
    </AnimatedTouchable>
  );
}

// Score Bar Component
function ScoreBar({
  category,
  score,
  index,
}: {
  category: string;
  score: number;
  index: number;
}) {
  const { colors } = useTheme();
  const progress = useSharedValue(0);

  const getScoreColor = () => {
    if (score >= 70) return colors.success;
    if (score >= 40) return colors.warning;
    return colors.error;
  };

  // Animate the progress bar
  progress.value = withTiming(score / 100, {
    duration: 800,
    easing: Easing.out(Easing.cubic),
  });

  const animatedWidth = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 80).duration(400)}
      style={[styles.scoreItem, { backgroundColor: colors.surfaceHighlight, borderColor: colors.border }]}
    >
      <View style={styles.scoreHeader}>
        <Text style={[styles.scoreName, { color: colors.text }]} numberOfLines={1}>
          {category}
        </Text>
        <View style={[styles.scoreBadge, { backgroundColor: `${getScoreColor()}20` }]}>
          <Text style={[styles.scoreValue, { color: getScoreColor() }]}>{score}</Text>
        </View>
      </View>
      <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
        <Animated.View
          style={[styles.progressFill, { backgroundColor: getScoreColor() }, animatedWidth]}
        />
      </View>
    </Animated.View>
  );
}

// Finding Card Component
function FindingCard({
  finding,
  index,
}: {
  finding: {
    principleId: string;
    name: string;
    status: string;
    explanation: string;
  };
  index: number;
}) {
  const { colors } = useTheme();

  const getStatusColor = () => {
    if (finding.status === 'Aligned') return colors.success;
    if (finding.status === 'Partially Violated') return colors.warning;
    return colors.error;
  };

  const getStatusIcon = () => {
    if (finding.status === 'Aligned') return 'checkmark-circle';
    if (finding.status === 'Partially Violated') return 'warning';
    return 'alert-circle';
  };

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 80).duration(400)}
      style={[styles.findingCard, { backgroundColor: colors.surfaceHighlight, borderColor: colors.border }]}
    >
      <View style={styles.findingHeader}>
        <View style={[styles.findingIconBg, { backgroundColor: `${getStatusColor()}20` }]}>
          <Ionicons name={getStatusIcon()} size={18} color={getStatusColor()} />
        </View>
        <View style={styles.findingInfo}>
          <View style={styles.findingTitleRow}>
            <Text style={[styles.principleId, { color: colors.gold }]}>{finding.principleId}</Text>
            <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor()}20` }]}>
              <Text style={[styles.statusText, { color: getStatusColor() }]}>{finding.status}</Text>
            </View>
          </View>
          <Text style={[styles.principleName, { color: colors.text }]}>{finding.name}</Text>
        </View>
      </View>
      <Text style={[styles.findingExplanation, { color: colors.textSecondary }]}>
        {finding.explanation}
      </Text>
    </Animated.View>
  );
}

// Correction Card Component
function CorrectionCard({
  correction,
  index,
}: {
  correction: string;
  index: number;
}) {
  const { colors } = useTheme();

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 80).duration(400)}
      style={[styles.correctionCard, { backgroundColor: `${colors.warning}15`, borderColor: `${colors.warning}40` }]}
    >
      <View style={[styles.correctionNumber, { backgroundColor: colors.warning }]}>
        <Text style={styles.correctionNumberText}>{index + 1}</Text>
      </View>
      <Text style={[styles.correctionText, { color: colors.text }]}>{correction}</Text>
    </Animated.View>
  );
}

// Premium Upgrade Card Component
function PremiumUpgradeCard() {
  const { colors } = useTheme();

  const SENTINEL_FEATURES = [
    { icon: 'document-text-outline', text: 'Analyze any government document' },
    { icon: 'shield-checkmark-outline', text: 'Evaluate against 155 governance principles' },
    { icon: 'bar-chart-outline', text: 'Get detailed category scores' },
    { icon: 'warning-outline', text: 'Identify principle violations' },
    { icon: 'construct-outline', text: 'Receive AI-powered correction suggestions' },
    { icon: 'create-outline', text: 'Auto-generate community proposals' },
  ];

  const handleUpgrade = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/modals/subscription');
  };

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Premium Badge */}
      <Animated.View
        entering={FadeInDown.duration(400)}
        style={[styles.premiumHero, { backgroundColor: `${colors.gold}10` }]}
      >
        <View style={[styles.premiumIconBg, { backgroundColor: colors.gold }]}>
          <Ionicons name="sparkles" size={40} color="#000" />
        </View>
        <Text style={[styles.premiumTitle, { color: colors.gold }]}>
          Sentinel AI
        </Text>
        <Text style={[styles.premiumSubtitle, { color: colors.textSecondary }]}>
          Premium Feature
        </Text>
      </Animated.View>

      {/* Description Card */}
      <Animated.View
        entering={FadeInUp.delay(100).duration(400)}
        style={[styles.descriptionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <Text style={[styles.descriptionTitle, { color: colors.text }]}>
          AI-Powered Governance Analysis
        </Text>
        <Text style={[styles.descriptionText, { color: colors.textSecondary }]}>
          Sentinel evaluates government documents, policies, and legislation against 155 principles
          of proper human governance. Get instant insights, identify violations, and generate
          proposals to improve civic outcomes.
        </Text>
      </Animated.View>

      {/* Features List */}
      <Animated.View
        entering={FadeInUp.delay(200).duration(400)}
        style={[styles.featuresCard, { backgroundColor: colors.surface, borderColor: colors.gold }]}
      >
        <LinearGradient
          colors={[`${colors.gold}08`, 'transparent']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <Text style={[styles.featuresTitle, { color: colors.gold }]}>
          What You Get
        </Text>
        {SENTINEL_FEATURES.map((feature, index) => (
          <Animated.View
            key={index}
            entering={FadeInUp.delay(300 + index * 50).duration(300)}
            style={styles.featureRow}
          >
            <View style={[styles.featureIconBg, { backgroundColor: `${colors.gold}15` }]}>
              <Ionicons name={feature.icon as any} size={18} color={colors.gold} />
            </View>
            <Text style={[styles.featureText, { color: colors.text }]}>
              {feature.text}
            </Text>
          </Animated.View>
        ))}
      </Animated.View>

      {/* Pricing Card */}
      <Animated.View
        entering={FadeInUp.delay(400).duration(400)}
        style={[styles.pricingCard, { backgroundColor: colors.gold }]}
      >
        <View style={styles.pricingContent}>
          <View style={styles.pricingLeft}>
            <Text style={styles.pricingLabel}>Premium</Text>
            <View style={styles.priceRow}>
              <Text style={styles.priceAmount}>$7.99</Text>
              <Text style={styles.pricePeriod}>/month</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.upgradeButton}
            onPress={handleUpgrade}
            activeOpacity={0.8}
          >
            <Text style={styles.upgradeButtonText}>Upgrade Now</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.gold} />
          </TouchableOpacity>
        </View>
        <Text style={styles.pricingNote}>
          Includes Sentinel AI, unlimited proposals, analytics, and verification
        </Text>
      </Animated.View>

      {/* Stats Preview */}
      <Animated.View
        entering={FadeInUp.delay(500).duration(400)}
        style={styles.statsPreview}
      >
        <View style={[styles.previewStatCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.previewStatValue, { color: colors.gold }]}>155</Text>
          <Text style={[styles.previewStatLabel, { color: colors.textSecondary }]}>Principles</Text>
        </View>
        <View style={[styles.previewStatCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.previewStatValue, { color: colors.gold }]}>11</Text>
          <Text style={[styles.previewStatLabel, { color: colors.textSecondary }]}>Categories</Text>
        </View>
        <View style={[styles.previewStatCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.previewStatValue, { color: colors.gold }]}>AI</Text>
          <Text style={[styles.previewStatLabel, { color: colors.textSecondary }]}>Powered</Text>
        </View>
      </Animated.View>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}

export default function SentinelScreen() {
  const { colors, isDark } = useTheme();
  const { user, token } = useAuthStore();
  const [isPremium, setIsPremium] = useState(false);
  const [loadingSubscription, setLoadingSubscription] = useState(true);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [issueType, setIssueType] = useState('Policy');
  const [showIssueTypePicker, setShowIssueTypePicker] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedAnalysis, setSelectedAnalysis] = useState<Analysis | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'categories' | 'findings' | 'corrections' | 'proposal'>('summary');
  const [creatingProposal, setCreatingProposal] = useState(false);
  const [proposalCreated, setProposalCreated] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Check if user has Premium subscription
  useEffect(() => {
    const checkSubscription = async () => {
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
  }, [token]);

  // Pulse animation for analyzing state
  const pulseScale = useSharedValue(1);
  if (analyzing) {
    pulseScale.value = withRepeat(
      withTiming(1.05, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }

  const handleAnalyze = async () => {
    // Check premium status first
    if (!isPremium) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setShowUpgradeModal(true);
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
      setSelectedAnalysis(newAnalysis);
      setActiveTab('summary');
      setTitle('');
      setText('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Analysis Complete', 'Swipe the tabs below to see Scores, Findings, Fixes, and Proposal!');
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to analyze document.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCreateProposal = async () => {
    if (!selectedAnalysis || !user?.id) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
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
          title: selectedAnalysis.analysis.mainProposal,
          description: `Governance proposal generated by Sentinel analysis of: ${selectedAnalysis.title}\n\nVerdict: ${selectedAnalysis.analysis.overallVerdict}\n\nSummary: ${selectedAnalysis.analysis.summary}`,
          category: 'governance',
          geoScope: 'global',
          geoRestrictions: [],
        }),
      });
      if (!response.ok) throw new Error('Failed to create proposal');
      setProposalCreated(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'Your proposal has been created!');
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to create proposal.');
    } finally {
      setCreatingProposal(false);
    }
  };

  const getVerdictColor = (verdict: string) => {
    if (verdict === 'Aligned') return colors.success;
    if (verdict === 'At Risk') return colors.warning;
    return colors.error;
  };

  const getVerdictIcon = (verdict: string) => {
    if (verdict === 'Aligned') return 'checkmark-circle';
    if (verdict === 'At Risk') return 'warning';
    return 'alert-circle';
  };

  // Show loading state while checking subscription
  if (loadingSubscription) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View style={styles.headerContent}>
            <View style={[styles.headerIconBg, { backgroundColor: `${colors.gold}15`, ...SHADOWS.glow }]}>
              <Ionicons name="sparkles" size={28} color={colors.gold} />
            </View>
            <View style={styles.headerText}>
              <Text style={[styles.headerTitle, { color: colors.gold }]}>Sentinel AI</Text>
              <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                Governance Analyzer
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.gold} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <Animated.View
        entering={FadeInDown.duration(400)}
        style={[styles.header, { borderBottomColor: colors.border }]}
      >
        <View style={styles.headerContent}>
          <View style={[styles.headerIconBg, { backgroundColor: `${colors.gold}15`, ...SHADOWS.glow }]}>
            <Ionicons name="sparkles" size={28} color={colors.gold} />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.headerTitle, { color: colors.gold }]}>Sentinel AI</Text>
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
              Governance Analyzer
            </Text>
          </View>
        </View>
      </Animated.View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Info Card */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(400)}
          style={[styles.infoCard, { backgroundColor: `${colors.gold}15`, borderColor: colors.gold }]}
        >
          <LinearGradient
            colors={[`${colors.gold}15`, 'transparent']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <Ionicons name="information-circle" size={20} color={colors.gold} />
          <Text style={[styles.infoText, { color: colors.text }]}>
            Sentinel evaluates government documents against 155 principles of proper human governance.
          </Text>
        </Animated.View>

        {/* Stats Row */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(400)}
          style={styles.statsRow}
        >
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.gold }]}>155</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Principles</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.gold }]}>11</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Categories</Text>
          </View>
        </Animated.View>

        {/* Submit Document Card */}
        <Animated.View
          entering={FadeInUp.delay(300).duration(400)}
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.gold }]}
        >
          <LinearGradient
            colors={[`${colors.gold}08`, 'transparent']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />

          <View style={styles.cardHeader}>
            <View style={[styles.cardIconBg, { backgroundColor: `${colors.gold}15` }]}>
              <Ionicons name="document-text-outline" size={20} color={colors.gold} />
            </View>
            <Text style={[styles.cardTitle, { color: colors.gold }]}>Submit Document</Text>
          </View>

          {/* Title Input */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.gold }]}>Title</Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: colors.surfaceHighlight, borderColor: colors.border, color: colors.text },
              ]}
              placeholder="e.g., Public Safety Act 2024"
              placeholderTextColor={colors.textTertiary}
              value={title}
              onChangeText={setTitle}
            />
          </View>

          {/* Issue Type Picker */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.gold }]}>Issue Type</Text>
            <TouchableOpacity
              style={[
                styles.picker,
                { backgroundColor: colors.surfaceHighlight, borderColor: colors.border },
              ]}
              onPress={() => setShowIssueTypePicker(!showIssueTypePicker)}
            >
              <Text style={[styles.pickerText, { color: colors.text }]}>{issueType}</Text>
              <Ionicons
                name={showIssueTypePicker ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={colors.gold}
              />
            </TouchableOpacity>
            {showIssueTypePicker && (
              <Animated.View
                entering={FadeIn.duration(200)}
                style={[
                  styles.pickerDropdown,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                {ISSUE_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.pickerOption,
                      issueType === type && { backgroundColor: `${colors.gold}15` },
                    ]}
                    onPress={() => {
                      setIssueType(type);
                      setShowIssueTypePicker(false);
                    }}
                  >
                    <Text style={[styles.pickerOptionText, { color: colors.text }]}>{type}</Text>
                    {issueType === type && (
                      <Ionicons name="checkmark" size={18} color={colors.gold} />
                    )}
                  </TouchableOpacity>
                ))}
              </Animated.View>
            )}
          </View>

          {/* Text Input */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.gold }]}>Text</Text>
            <TextInput
              style={[
                styles.textArea,
                { backgroundColor: colors.surfaceHighlight, borderColor: colors.border, color: colors.text },
              ]}
              placeholder="Paste governance text here..."
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
            style={[
              styles.analyzeButton,
              { backgroundColor: colors.gold, ...SHADOWS.glow },
              analyzing && styles.buttonDisabled,
            ]}
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

        {/* Analysis Results */}
        {selectedAnalysis && (
          <Animated.View
            entering={FadeInUp.duration(500)}
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.gold }]}
          >
            <LinearGradient
              colors={[`${colors.gold}08`, 'transparent']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />

            {/* Analysis Header */}
            <View style={styles.analysisHeader}>
              <View style={styles.analysisInfo}>
                <View style={[styles.cardIconBg, { backgroundColor: `${colors.success}15` }]}>
                  <Ionicons name="checkmark-done" size={20} color={colors.success} />
                </View>
                <View style={styles.analysisText}>
                  <Text style={[styles.cardTitle, { color: colors.gold }]}>Analysis Result</Text>
                  <Text style={[styles.analysisSubtitle, { color: colors.textSecondary }]}>
                    {selectedAnalysis.title}
                  </Text>
                </View>
              </View>
              <View
                style={[
                  styles.verdictBadge,
                  {
                    backgroundColor: `${getVerdictColor(selectedAnalysis.analysis.overallVerdict)}20`,
                    borderColor: getVerdictColor(selectedAnalysis.analysis.overallVerdict),
                  },
                ]}
              >
                <Ionicons
                  name={getVerdictIcon(selectedAnalysis.analysis.overallVerdict)}
                  size={14}
                  color={getVerdictColor(selectedAnalysis.analysis.overallVerdict)}
                />
                <Text
                  style={[
                    styles.verdictText,
                    { color: getVerdictColor(selectedAnalysis.analysis.overallVerdict) },
                  ]}
                >
                  {selectedAnalysis.analysis.overallVerdict}
                </Text>
              </View>
            </View>

            {/* Tabs */}
            <Text style={[styles.tabHint, { color: colors.textTertiary }]}>
              Tap to explore sections:
            </Text>
            <View style={[styles.tabsWrapper, { backgroundColor: colors.surfaceHighlight }]}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tabsContent}
              >
                <TabButton
                  label="Summary"
                  icon="📋"
                  active={activeTab === 'summary'}
                  onPress={() => setActiveTab('summary')}
                />
                <TabButton
                  label="Scores"
                  icon="📊"
                  active={activeTab === 'categories'}
                  onPress={() => setActiveTab('categories')}
                />
                <TabButton
                  label="Findings"
                  icon="🔍"
                  active={activeTab === 'findings'}
                  onPress={() => setActiveTab('findings')}
                />
                <TabButton
                  label="Fixes"
                  icon="✏️"
                  active={activeTab === 'corrections'}
                  onPress={() => setActiveTab('corrections')}
                />
                <TabButton
                  label="Proposal"
                  icon="📝"
                  active={activeTab === 'proposal'}
                  onPress={() => setActiveTab('proposal')}
                />
              </ScrollView>
            </View>

            {/* Tab Content */}
            <View style={styles.tabContent}>
              {activeTab === 'summary' && (
                <Animated.View entering={FadeIn.duration(300)} style={styles.tabPane}>
                  <View style={[styles.summaryBox, { backgroundColor: colors.surfaceHighlight, borderColor: colors.gold }]}>
                    <View style={styles.summaryHeader}>
                      <Ionicons name="document-text" size={16} color={colors.gold} />
                      <Text style={[styles.summaryLabel, { color: colors.gold }]}>Summary</Text>
                    </View>
                    <Text style={[styles.summaryText, { color: colors.text }]}>
                      {selectedAnalysis.analysis.summary}
                    </Text>
                  </View>
                  {selectedAnalysis.analysis.reasoning && (
                    <View style={[styles.summaryBox, { backgroundColor: colors.surfaceHighlight, borderColor: colors.border }]}>
                      <View style={styles.summaryHeader}>
                        <Ionicons name="bulb-outline" size={16} color={colors.gold} />
                        <Text style={[styles.summaryLabel, { color: colors.gold }]}>Reasoning</Text>
                      </View>
                      <Text style={[styles.summaryText, { color: colors.text }]}>
                        {selectedAnalysis.analysis.reasoning}
                      </Text>
                    </View>
                  )}
                </Animated.View>
              )}

              {activeTab === 'categories' && (
                <View style={styles.tabPane}>
                  {selectedAnalysis.analysis.categoryScores.length === 0 ? (
                    <View style={styles.emptyState}>
                      <Ionicons name="bar-chart-outline" size={40} color={colors.textTertiary} />
                      <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                        No category scores available
                      </Text>
                    </View>
                  ) : (
                    selectedAnalysis.analysis.categoryScores.map((cat, index) => (
                      <ScoreBar key={cat.category} category={cat.category} score={cat.score} index={index} />
                    ))
                  )}
                </View>
              )}

              {activeTab === 'findings' && (
                <View style={styles.tabPane}>
                  {selectedAnalysis.analysis.flaggedPrinciples.length === 0 ? (
                    <View style={styles.emptyState}>
                      <Ionicons name="shield-checkmark-outline" size={40} color={colors.success} />
                      <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                        No flagged principles - Document is fully aligned
                      </Text>
                    </View>
                  ) : (
                    selectedAnalysis.analysis.flaggedPrinciples.map((finding, index) => (
                      <FindingCard key={finding.principleId} finding={finding} index={index} />
                    ))
                  )}
                </View>
              )}

              {activeTab === 'corrections' && (
                <View style={styles.tabPane}>
                  <View style={styles.correctionsHeader}>
                    <View style={[styles.correctionsIconBg, { backgroundColor: `${colors.warning}15` }]}>
                      <Ionicons name="construct-outline" size={18} color={colors.warning} />
                    </View>
                    <Text style={[styles.correctionsTitle, { color: colors.gold }]}>
                      Sentinel Corrections
                    </Text>
                  </View>
                  {selectedAnalysis.analysis.sentinelCorrections.length === 0 ? (
                    <View style={styles.emptyState}>
                      <Ionicons name="checkmark-done-circle-outline" size={40} color={colors.success} />
                      <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                        No corrections needed
                      </Text>
                    </View>
                  ) : (
                    selectedAnalysis.analysis.sentinelCorrections.map((correction, index) => (
                      <CorrectionCard key={index} correction={correction} index={index} />
                    ))
                  )}
                </View>
              )}

              {activeTab === 'proposal' && (
                <View style={styles.tabPane}>
                  {proposalCreated ? (
                    <Animated.View
                      entering={FadeIn.duration(400)}
                      style={[styles.successBox, { backgroundColor: `${colors.success}15`, borderColor: colors.success }]}
                    >
                      <View style={[styles.successIconBg, { backgroundColor: colors.success }]}>
                        <Ionicons name="checkmark" size={24} color="#fff" />
                      </View>
                      <View style={styles.successContent}>
                        <Text style={[styles.successTitle, { color: colors.success }]}>
                          Proposal Created!
                        </Text>
                        <Text style={[styles.successText, { color: colors.textSecondary }]}>
                          Your proposal is now live for community voting.
                        </Text>
                      </View>
                    </Animated.View>
                  ) : (
                    <>
                      <View style={[styles.proposalBox, { backgroundColor: colors.surfaceHighlight, borderColor: colors.gold }]}>
                        <View style={styles.proposalHeader}>
                          <View style={[styles.proposalIconBg, { backgroundColor: `${colors.gold}15` }]}>
                            <Ionicons name="document-text" size={18} color={colors.gold} />
                          </View>
                          <Text style={[styles.proposalLabel, { color: colors.gold }]}>
                            Generated Proposal
                          </Text>
                        </View>
                        <Text style={[styles.proposalText, { color: colors.text }]}>
                          {selectedAnalysis.analysis.mainProposal || 'No proposal generated'}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.createProposalButton,
                          { backgroundColor: colors.gold, ...SHADOWS.glow },
                          creatingProposal && styles.buttonDisabled,
                        ]}
                        onPress={handleCreateProposal}
                        disabled={creatingProposal}
                        activeOpacity={0.8}
                      >
                        {creatingProposal ? (
                          <>
                            <ActivityIndicator size="small" color="#000" />
                            <Text style={styles.createProposalButtonText}>Creating...</Text>
                          </>
                        ) : (
                          <>
                            <Ionicons name="add-circle" size={20} color="#000" />
                            <Text style={styles.createProposalButtonText}>Create Proposal</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              )}
            </View>
          </Animated.View>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Premium Upgrade Modal */}
      <UpgradeModal
        visible={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        type="premium"
        title="Unlock Sentinel AI"
        message="Upgrade to Premium to analyze government documents against 155 principles of proper human governance. Get instant insights, identify violations, and generate proposals."
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
  },
  // Premium Upgrade Card Styles
  premiumHero: {
    alignItems: 'center',
    paddingVertical: SPACING.xxxl,
    borderRadius: BORDER_RADIUS.xxl,
    marginBottom: SPACING.lg,
  },
  premiumIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  premiumTitle: {
    ...TYPOGRAPHY.displaySmall,
    fontWeight: '700',
    marginBottom: SPACING.xs,
  },
  premiumSubtitle: {
    ...TYPOGRAPHY.bodyLarge,
  },
  descriptionCard: {
    padding: SPACING.xl,
    borderRadius: BORDER_RADIUS.xxl,
    borderWidth: 1,
    marginBottom: SPACING.lg,
  },
  descriptionTitle: {
    ...TYPOGRAPHY.headlineSmall,
    marginBottom: SPACING.md,
  },
  descriptionText: {
    ...TYPOGRAPHY.bodyMedium,
    lineHeight: 24,
  },
  featuresCard: {
    padding: SPACING.xl,
    borderRadius: BORDER_RADIUS.xxl,
    borderWidth: 1.5,
    marginBottom: SPACING.lg,
    overflow: 'hidden',
  },
  featuresTitle: {
    ...TYPOGRAPHY.headlineSmall,
    marginBottom: SPACING.lg,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  featureIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  featureText: {
    ...TYPOGRAPHY.bodyMedium,
    flex: 1,
  },
  pricingCard: {
    padding: SPACING.xl,
    borderRadius: BORDER_RADIUS.xxl,
    marginBottom: SPACING.lg,
  },
  pricingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  pricingLeft: {},
  pricingLabel: {
    ...TYPOGRAPHY.labelMedium,
    color: '#000',
    opacity: 0.7,
    marginBottom: SPACING.xxs,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  priceAmount: {
    ...TYPOGRAPHY.displaySmall,
    color: '#000',
    fontWeight: '700',
  },
  pricePeriod: {
    ...TYPOGRAPHY.bodyMedium,
    color: '#000',
    opacity: 0.7,
    marginLeft: SPACING.xxs,
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
    gap: SPACING.sm,
  },
  upgradeButtonText: {
    ...TYPOGRAPHY.labelLarge,
    color: '#fff',
    fontWeight: '600',
  },
  pricingNote: {
    ...TYPOGRAPHY.bodySmall,
    color: '#000',
    opacity: 0.7,
    textAlign: 'center',
  },
  statsPreview: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  previewStatCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
  },
  previewStatValue: {
    ...TYPOGRAPHY.headlineLarge,
    fontWeight: '700',
  },
  previewStatLabel: {
    ...TYPOGRAPHY.labelSmall,
    marginTop: SPACING.xxs,
  },
  // Header
  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: 60,
    paddingBottom: SPACING.lg,
    borderBottomWidth: 1,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
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
  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.lg,
  },
  // Info Card
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    marginBottom: SPACING.lg,
    gap: SPACING.md,
    overflow: 'hidden',
  },
  infoText: {
    ...TYPOGRAPHY.bodyMedium,
    flex: 1,
    lineHeight: 22,
  },
  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
  },
  statValue: {
    ...TYPOGRAPHY.displaySmall,
  },
  statLabel: {
    ...TYPOGRAPHY.labelMedium,
    marginTop: SPACING.xs,
  },
  // Card
  card: {
    borderRadius: BORDER_RADIUS.xxl,
    padding: SPACING.xl,
    marginBottom: SPACING.lg,
    borderWidth: 1.5,
    overflow: 'hidden',
    ...SHADOWS.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  cardIconBg: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  cardTitle: {
    ...TYPOGRAPHY.headlineSmall,
  },
  // Input
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
    minHeight: 140,
  },
  // Picker
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
  // Buttons
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
  // Analysis Header
  analysisHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.lg,
  },
  analysisInfo: {
    flexDirection: 'row',
    flex: 1,
  },
  analysisText: {
    flex: 1,
  },
  analysisSubtitle: {
    ...TYPOGRAPHY.bodySmall,
    marginTop: SPACING.xxs,
  },
  verdictBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    gap: SPACING.xs,
    marginLeft: SPACING.sm,
  },
  verdictText: {
    ...TYPOGRAPHY.labelSmall,
    fontWeight: '600',
  },
  // Tabs
  tabHint: {
    ...TYPOGRAPHY.bodySmall,
    marginBottom: SPACING.sm,
  },
  tabsWrapper: {
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  tabsContent: {
    gap: SPACING.sm,
    paddingRight: SPACING.sm,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    gap: SPACING.xs,
  },
  tabIcon: {
    fontSize: 14,
  },
  tabText: {
    ...TYPOGRAPHY.labelSmall,
    fontWeight: '600',
  },
  // Tab Content
  tabContent: {
    minHeight: 200,
  },
  tabPane: {},
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxxl,
    gap: SPACING.md,
  },
  emptyText: {
    ...TYPOGRAPHY.bodyMedium,
    textAlign: 'center',
  },
  // Summary
  summaryBox: {
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  summaryLabel: {
    ...TYPOGRAPHY.labelMedium,
  },
  summaryText: {
    ...TYPOGRAPHY.bodyMedium,
    lineHeight: 24,
  },
  // Score
  scoreItem: {
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.sm,
    borderWidth: 1,
  },
  scoreHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  scoreName: {
    ...TYPOGRAPHY.labelMedium,
    flex: 1,
    marginRight: SPACING.sm,
  },
  scoreBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xxs,
    borderRadius: BORDER_RADIUS.sm,
  },
  scoreValue: {
    ...TYPOGRAPHY.labelMedium,
    fontWeight: '700',
  },
  progressTrack: {
    height: 8,
    borderRadius: BORDER_RADIUS.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: BORDER_RADIUS.full,
  },
  // Finding
  findingCard: {
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
  },
  findingHeader: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
  },
  findingIconBg: {
    width: 36,
    height: 36,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  findingInfo: {
    flex: 1,
  },
  findingTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  principleId: {
    ...TYPOGRAPHY.labelSmall,
    fontWeight: '600',
    marginRight: SPACING.sm,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xxs,
    borderRadius: BORDER_RADIUS.sm,
  },
  statusText: {
    ...TYPOGRAPHY.labelSmall,
    fontWeight: '600',
    textTransform: 'uppercase',
    fontSize: 10,
  },
  principleName: {
    ...TYPOGRAPHY.bodyMedium,
    fontWeight: '600',
  },
  findingExplanation: {
    ...TYPOGRAPHY.bodySmall,
    lineHeight: 20,
  },
  // Corrections
  correctionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  correctionsIconBg: {
    width: 36,
    height: 36,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  correctionsTitle: {
    ...TYPOGRAPHY.headlineSmall,
    fontSize: 16,
  },
  correctionCard: {
    flexDirection: 'row',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
  },
  correctionNumber: {
    width: 28,
    height: 28,
    borderRadius: BORDER_RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  correctionNumberText: {
    ...TYPOGRAPHY.labelMedium,
    color: '#fff',
    fontWeight: '700',
  },
  correctionText: {
    ...TYPOGRAPHY.bodyMedium,
    flex: 1,
    lineHeight: 22,
  },
  // Proposal
  proposalBox: {
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
  },
  proposalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  proposalIconBg: {
    width: 32,
    height: 32,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  proposalLabel: {
    ...TYPOGRAPHY.labelMedium,
  },
  proposalText: {
    ...TYPOGRAPHY.bodyMedium,
    lineHeight: 24,
  },
  createProposalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.full,
    gap: SPACING.sm,
  },
  createProposalButtonText: {
    ...TYPOGRAPHY.labelLarge,
    color: '#000',
    fontWeight: '600',
  },
  // Success
  successBox: {
    flexDirection: 'row',
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    borderWidth: 1,
    alignItems: 'center',
  },
  successIconBg: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.lg,
  },
  successContent: {
    flex: 1,
  },
  successTitle: {
    ...TYPOGRAPHY.headlineSmall,
    marginBottom: SPACING.xs,
  },
  successText: {
    ...TYPOGRAPHY.bodyMedium,
  },
  bottomPadding: {
    height: 100,
  },
});
