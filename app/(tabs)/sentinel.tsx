import { useState } from 'react';
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
import { useAuthStore } from '../../lib/auth';
import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../../lib/theme';
import { haptics } from '../../lib/haptics';

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

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={[
        styles.tab,
        {
          backgroundColor: active ? colors.gold : colors.cardBg,
          borderColor: active ? colors.gold : colors.border,
        },
      ]}
      onPress={onPress}
    >
      <Text style={[styles.tabText, { color: active ? colors.background : colors.text }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function SentinelScreen() {
  const { colors } = useTheme();
  const { isAuthenticated } = useAuthStore();

  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [issueType, setIssueType] = useState('Policy');
  const [showIssueTypePicker, setShowIssueTypePicker] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedAnalysis, setSelectedAnalysis] = useState<Analysis | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'categories' | 'findings' | 'corrections' | 'proposal'>('summary');
  const [creatingProposal, setCreatingProposal] = useState(false);
  const [proposalCreated, setProposalCreated] = useState(false);

  const analyzeText = async () => {
    if (!title || !text) {
      Alert.alert('Error', 'Please enter a title and text to analyze');
      return;
    }

    if (!isAuthenticated) {
      Alert.alert('Sign in required', 'Sign in to analyze with Sentinel.');
      return;
    }

    setAnalyzing(true);
    setProposalCreated(false);

    try {
      const response = await fetch(`${API_URL}/api/sentinel/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, text, issueType }),
      });

      if (!response.ok) throw new Error('Failed to analyze');

      const data = await response.json();

      const analysis: Analysis = {
        id: data.id || Date.now().toString(),
        title,
        issueType,
        timestamp: new Date().toISOString(),
        analysis: data.analysis,
      };

      setSelectedAnalysis(analysis);
      setActiveTab('summary');
      haptics.success();
    } catch (error) {
      console.error('Sentinel error:', error);
      Alert.alert('Error', 'Failed to analyze document.');
    } finally {
      setAnalyzing(false);
    }
  };

  const createProposal = async () => {
    if (!selectedAnalysis) return;

    setCreatingProposal(true);
    try {
      const response = await fetch(`${API_URL}/api/sentinel/create-proposal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysisId: selectedAnalysis.id }),
      });

      if (!response.ok) throw new Error('Failed to create proposal');

      setProposalCreated(true);
      haptics.success();
    } catch (error) {
      console.error('Create proposal error:', error);
      Alert.alert('Error', 'Unable to create proposal.');
    } finally {
      setCreatingProposal(false);
    }
  };

  const verdictColor = selectedAnalysis
    ? selectedAnalysis.analysis.overallVerdict === 'Aligned'
      ? colors.success
      : selectedAnalysis.analysis.overallVerdict === 'At Risk'
        ? colors.warning
        : colors.error
    : colors.textMuted;

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <LinearGradient colors={[colors.backgroundSecondary, colors.background]} style={styles.hero}>
        <Text style={[styles.heroTitle, { color: colors.text }]}>Sentinel</Text>
        <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}
        >Analyze policies, surface risks, and draft stronger proposals.</Text>
      </LinearGradient>

      <View style={[styles.inputCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
      >
        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Document title</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Executive order on transit"
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
        />

        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Issue type</Text>
        <TouchableOpacity
          style={[styles.input, styles.issuePicker, { borderColor: colors.border }]}
          onPress={() => setShowIssueTypePicker(!showIssueTypePicker)}
        >
          <Text style={[styles.issueText, { color: colors.text }]}>{issueType}</Text>
          <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
        </TouchableOpacity>
        {showIssueTypePicker && (
          <View style={styles.issueList}>
            {ISSUE_TYPES.map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.issueItem, { borderColor: colors.border }]}
                onPress={() => {
                  setIssueType(type);
                  setShowIssueTypePicker(false);
                }}
              >
                <Text style={[styles.issueText, { color: colors.text }]}>{type}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Paste text</Text>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Paste your policy text here..."
          placeholderTextColor={colors.textMuted}
          style={[styles.input, styles.textArea, { color: colors.text, borderColor: colors.border }]}
          multiline
        />

        <TouchableOpacity
          style={[styles.analyzeButton, { backgroundColor: colors.gold }]}
          onPress={analyzeText}
          disabled={analyzing}
        >
          {analyzing ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={[styles.analyzeButtonText, { color: colors.background }]}>Analyze with Sentinel</Text>
          )}
        </TouchableOpacity>
      </View>

      {selectedAnalysis && (
        <View style={styles.resultsSection}>
          <View style={[styles.resultsHeader, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
          >
            <View>
              <Text style={[styles.resultsTitle, { color: colors.text }]}>Analysis overview</Text>
              <Text style={[styles.resultsSubtitle, { color: colors.textSecondary }]}
              >{selectedAnalysis.analysis.summary}</Text>
            </View>
            <View style={[styles.verdictBadge, { backgroundColor: `${verdictColor}22` }]}
            >
              <Text style={[styles.verdictText, { color: verdictColor }]}>{selectedAnalysis.analysis.overallVerdict}</Text>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabRow}>
            <TabButton label="Summary" active={activeTab === 'summary'} onPress={() => setActiveTab('summary')} />
            <TabButton label="Scores" active={activeTab === 'categories'} onPress={() => setActiveTab('categories')} />
            <TabButton label="Findings" active={activeTab === 'findings'} onPress={() => setActiveTab('findings')} />
            <TabButton label="Corrections" active={activeTab === 'corrections'} onPress={() => setActiveTab('corrections')} />
            <TabButton label="Proposal" active={activeTab === 'proposal'} onPress={() => setActiveTab('proposal')} />
          </ScrollView>

          {activeTab === 'summary' && (
            <View style={[styles.panelCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
            >
              <Text style={[styles.panelTitle, { color: colors.text }]}>Reasoning</Text>
              <Text style={[styles.panelBody, { color: colors.textSecondary }]}
              >{selectedAnalysis.analysis.reasoning}</Text>
            </View>
          )}

          {activeTab === 'categories' && (
            <View style={[styles.panelCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
            >
              {selectedAnalysis.analysis.categoryScores.map((score) => (
                <View key={score.category} style={styles.scoreRow}>
                  <Text style={[styles.scoreLabel, { color: colors.text }]}>{score.category}</Text>
                  <View style={[styles.scoreTrack, { backgroundColor: colors.border }]}
                  >
                    <View
                      style={[
                        styles.scoreFill,
                        {
                          backgroundColor: score.score >= 70 ? colors.success : score.score >= 40 ? colors.warning : colors.error,
                          width: `${score.score}%`,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.scoreValue, { color: colors.text }]}>{score.score}</Text>
                </View>
              ))}
            </View>
          )}

          {activeTab === 'findings' && (
            <View style={[styles.panelCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
            >
              {selectedAnalysis.analysis.flaggedPrinciples.map((finding) => (
                <View key={finding.principleId} style={styles.findingRow}>
                  <View style={[styles.findingBadge, { backgroundColor: colors.border }]}>
                    <Text style={[styles.findingStatus, { color: colors.text }]}>{finding.status}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.findingTitle, { color: colors.text }]}>{finding.name}</Text>
                    <Text style={[styles.findingBody, { color: colors.textSecondary }]}>{finding.explanation}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {activeTab === 'corrections' && (
            <View style={[styles.panelCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
            >
              {selectedAnalysis.analysis.sentinelCorrections.map((correction, index) => (
                <View key={correction} style={styles.correctionRow}>
                  <Text style={[styles.correctionIndex, { color: colors.gold }]}>{index + 1}</Text>
                  <Text style={[styles.correctionText, { color: colors.textSecondary }]}>{correction}</Text>
                </View>
              ))}
            </View>
          )}

          {activeTab === 'proposal' && (
            <View style={[styles.panelCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
            >
              <Text style={[styles.panelBody, { color: colors.textSecondary }]}>{selectedAnalysis.analysis.mainProposal}</Text>
              <TouchableOpacity
                style={[styles.analyzeButton, { backgroundColor: colors.gold, marginTop: SPACING.md }]}
                onPress={createProposal}
                disabled={creatingProposal}
              >
                {creatingProposal ? (
                  <ActivityIndicator color={colors.background} />
                ) : (
                  <Text style={[styles.analyzeButtonText, { color: colors.background }]}
                  >{proposalCreated ? 'Proposal created' : 'Create proposal'}</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: SPACING.xl,
    paddingBottom: SPACING.xxl,
  },
  hero: {
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    marginBottom: SPACING.lg,
    ...SHADOWS.soft,
  },
  heroTitle: {
    ...TYPOGRAPHY.displaySmall,
  },
  heroSubtitle: {
    ...TYPOGRAPHY.bodyMedium,
    marginTop: SPACING.xs,
  },
  inputCard: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
    ...SHADOWS.soft,
  },
  inputLabel: {
    ...TYPOGRAPHY.labelLarge,
  },
  input: {
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    ...TYPOGRAPHY.bodyMedium,
  },
  textArea: {
    minHeight: 140,
    textAlignVertical: 'top',
  },
  issuePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  issueText: {
    ...TYPOGRAPHY.bodyMedium,
  },
  issueList: {
    gap: SPACING.xs,
  },
  issueItem: {
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    padding: SPACING.sm,
  },
  analyzeButton: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
    marginTop: SPACING.sm,
  },
  analyzeButtonText: {
    ...TYPOGRAPHY.labelLarge,
  },
  resultsSection: {
    gap: SPACING.md,
  },
  resultsHeader: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    ...SHADOWS.soft,
  },
  resultsTitle: {
    ...TYPOGRAPHY.headlineSmall,
  },
  resultsSubtitle: {
    ...TYPOGRAPHY.bodySmall,
    marginTop: SPACING.xs,
  },
  verdictBadge: {
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    alignSelf: 'flex-start',
  },
  verdictText: {
    ...TYPOGRAPHY.labelMedium,
  },
  tabRow: {
    marginBottom: SPACING.sm,
  },
  tab: {
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    marginRight: SPACING.sm,
  },
  tabText: {
    ...TYPOGRAPHY.labelMedium,
  },
  panelCard: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    gap: SPACING.sm,
    ...SHADOWS.soft,
  },
  panelTitle: {
    ...TYPOGRAPHY.headlineSmall,
  },
  panelBody: {
    ...TYPOGRAPHY.bodyMedium,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  scoreLabel: {
    flex: 1,
    ...TYPOGRAPHY.bodyMedium,
  },
  scoreTrack: {
    flex: 2,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  scoreFill: {
    height: 6,
    borderRadius: 3,
  },
  scoreValue: {
    width: 36,
    textAlign: 'right',
    ...TYPOGRAPHY.bodySmall,
  },
  findingRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  findingBadge: {
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  findingStatus: {
    ...TYPOGRAPHY.labelSmall,
  },
  findingTitle: {
    ...TYPOGRAPHY.bodyMedium,
  },
  findingBody: {
    ...TYPOGRAPHY.bodySmall,
  },
  correctionRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    alignItems: 'flex-start',
  },
  correctionIndex: {
    ...TYPOGRAPHY.labelLarge,
  },
  correctionText: {
    ...TYPOGRAPHY.bodyMedium,
    flex: 1,
  },
});
