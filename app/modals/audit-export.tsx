import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { organizationsApi } from '../../lib/api';
import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS, FONTS } from '../../lib/theme';
import { UpgradeModal } from '../../components/ui/UpgradeModal';

type Format = 'csv' | 'json';

export default function AuditExportScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { orgId, orgName } = useLocalSearchParams<{ orgId: string; orgName?: string }>();

  const [format, setFormat] = useState<Format>('csv');
  const [includeVoterIdentity, setIncludeVoterIdentity] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [lastExport, setLastExport] = useState<{
    exportId: string | null;
    bundleSignature: string | null;
    uri: string;
  } | null>(null);
  const [upgradeVisible, setUpgradeVisible] = useState(false);

  const handleExport = async () => {
    if (!orgId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setExporting(true);
    setLastExport(null);
    try {
      const result = await organizationsApi.exportAuditLog(orgId, { format, includeVoterIdentity });
      if (!result.success) {
        if (result.errorCode === 'FEATURE_NOT_AVAILABLE_ON_TIER') {
          setUpgradeVisible(true);
          return;
        }
        Alert.alert('Export failed', result.error || 'Try again later.');
        return;
      }
      setLastExport({
        exportId: result.exportId ?? null,
        bundleSignature: result.bundleSignature ?? null,
        uri: result.uri!,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Immediately open the share sheet so the admin can save to Files,
      // email it, or send to an external auditor.
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(result.uri!, {
          mimeType: format === 'json' ? 'application/json' : 'text/csv',
          dialogTitle: 'Share audit log',
        });
      }
    } finally {
      setExporting(false);
    }
  };

  const handleReshare = async () => {
    if (!lastExport) return;
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(lastExport.uri, {
        mimeType: format === 'json' ? 'application/json' : 'text/csv',
        dialogTitle: 'Share audit log',
      });
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border, paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          Audit log export
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + SPACING['3xl'] }}>
        <Animated.View entering={FadeIn.duration(300)}>
          <View style={[styles.iconCircle, { backgroundColor: `${colors.gold}15` }]}>
            <Ionicons name="document-text-outline" size={36} color={colors.gold} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>
            {orgName ? `Export ${orgName} vote record` : 'Export vote record'}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Every vote on every proposal in this organization, with HMAC-signed receipts. The signature on each row lets external auditors confirm the file hasn't been altered.
          </Text>

          {/* Format toggle */}
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>FORMAT</Text>
            <View style={styles.formatRow}>
              <FormatPill label="CSV" sub="Spreadsheets" active={format === 'csv'} onPress={() => setFormat('csv')} />
              <FormatPill label="JSON" sub="Programmatic" active={format === 'json'} onPress={() => setFormat('json')} />
            </View>
          </View>

          {/* Privacy toggle */}
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.toggleRow}>
              <View style={{ flex: 1, paddingRight: SPACING.md }}>
                <Text style={[styles.toggleTitle, { color: colors.text }]}>Include voter identity</Text>
                <Text style={[styles.toggleSubtitle, { color: colors.textSecondary }]}>
                  {includeVoterIdentity
                    ? 'Email and name will be in the export. Use only when required by audit policy.'
                    : 'Voter IDs are hashed. You can still correlate one voter across proposals without exposing identity.'}
                </Text>
              </View>
              <Switch
                value={includeVoterIdentity}
                onValueChange={setIncludeVoterIdentity}
                trackColor={{ false: colors.border, true: colors.gold }}
              />
            </View>
          </View>

          {/* Export button */}
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.gold }]}
            onPress={handleExport}
            disabled={exporting}
            activeOpacity={0.8}
          >
            {exporting ? (
              <ActivityIndicator color="#000" />
            ) : (
              <>
                <Ionicons name="download-outline" size={20} color="#000" />
                <Text style={styles.primaryButtonText}>Export and share</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Last export card */}
          {lastExport && (
            <View style={[styles.successCard, { backgroundColor: `${colors.success}10`, borderColor: colors.success, ...SHADOWS.sm }]}>
              <Text style={[styles.successTitle, { color: colors.success }]}>Export saved</Text>
              {lastExport.exportId && (
                <Text style={[styles.successField, { color: colors.text }]}>
                  Export ID: <Text style={styles.mono}>{lastExport.exportId.slice(0, 8)}…</Text>
                </Text>
              )}
              {lastExport.bundleSignature && (
                <Text style={[styles.successField, { color: colors.text }]}>
                  Bundle signature: <Text style={styles.mono}>{lastExport.bundleSignature.slice(0, 16)}…</Text>
                </Text>
              )}
              <TouchableOpacity
                style={[styles.secondaryButton, { borderColor: colors.success }]}
                onPress={handleReshare}
                activeOpacity={0.7}
              >
                <Ionicons name="share-outline" size={18} color={colors.success} />
                <Text style={[styles.secondaryButtonText, { color: colors.success }]}>Share again</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={[styles.helpText, { color: colors.textSecondary }]}>
            To verify integrity: send the file to support@representvote.com and we'll recompute the signatures, or use the published verification spec to do it yourself with the bundle signature.
          </Text>
        </Animated.View>
      </ScrollView>

      <UpgradeModal
        visible={upgradeVisible}
        onClose={() => setUpgradeVisible(false)}
        type="orgTier"
        title="Audit log requires Premium"
        message="Tamper-evident vote records with HMAC receipts are available on the Premium plan and above. Upgrade your organization's plan to enable exports."
        ctaLabel="See plans"
        onCta={() => router.push({
          pathname: '/modals/organization-billing',
          params: { orgId, orgName },
        })}
      />
    </View>
  );
}

function FormatPill({ label, sub, active, onPress }: { label: string; sub: string; active: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={[
        styles.formatPill,
        {
          backgroundColor: active ? `${colors.gold}20` : 'transparent',
          borderColor: active ? colors.gold : colors.border,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.formatLabel, { color: active ? colors.gold : colors.text }]}>{label}</Text>
      <Text style={[styles.formatSub, { color: colors.textSecondary }]}>{sub}</Text>
    </TouchableOpacity>
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
    flex: 1,
    textAlign: 'center',
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  title: {
    ...TYPOGRAPHY.headlineMedium,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  subtitle: {
    ...TYPOGRAPHY.bodyMedium,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.xl,
    paddingHorizontal: SPACING.sm,
  },
  card: {
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  cardLabel: {
    ...TYPOGRAPHY.labelSmall,
    letterSpacing: 1.5,
    marginBottom: SPACING.sm,
  },
  formatRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  formatPill: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  formatLabel: {
    ...TYPOGRAPHY.labelLarge,
  },
  formatSub: {
    ...TYPOGRAPHY.bodySmall,
    marginTop: 2,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleTitle: {
    ...TYPOGRAPHY.bodyMedium,
    marginBottom: 4,
  },
  toggleSubtitle: {
    ...TYPOGRAPHY.bodySmall,
    lineHeight: 18,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    marginTop: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  primaryButtonText: {
    ...TYPOGRAPHY.labelLarge,
    color: '#000',
  },
  successCard: {
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  successTitle: {
    ...TYPOGRAPHY.labelLarge,
    marginBottom: SPACING.sm,
  },
  successField: {
    ...TYPOGRAPHY.bodySmall,
    marginBottom: 4,
  },
  mono: {
    fontFamily: FONTS.mono,
    fontSize: 12,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    marginTop: SPACING.sm,
  },
  secondaryButtonText: {
    ...TYPOGRAPHY.labelMedium,
  },
  helpText: {
    ...TYPOGRAPHY.bodySmall,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: SPACING.md,
  },
});
