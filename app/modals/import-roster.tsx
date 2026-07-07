import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useState, useMemo } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Papa from 'papaparse';
import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY, FONTS } from '../../lib/theme';
import { organizationsApi } from '../../lib/api';
import { UpgradeModal } from '../../components/ui/UpgradeModal';

type Stage = 'pick' | 'preview' | 'importing' | 'done';

interface ParsedRow {
  email: string;
  firstName?: string;
  lastName?: string;
  role?: 'admin' | 'member';
  metadata?: Record<string, string>;
}

interface ImportResult {
  created: number;
  skippedExistingMembers: string[];
  skippedAlreadyInvited: string[];
  invalid: Array<{ email: string; reason: string }>;
}

const MAX_ROWS = 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Auto-detect column purpose from header name. Strips non-alphanumeric and
// lowercases before comparing — handles "First Name", "first_name", "FIRST-NAME"
// uniformly.
function classifyHeader(h: string): 'email' | 'firstName' | 'lastName' | 'role' | null {
  const k = h.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (['email', 'emailaddress', 'mail', 'eaddress'].includes(k)) return 'email';
  if (['firstname', 'first', 'fname', 'givenname'].includes(k)) return 'firstName';
  if (['lastname', 'last', 'lname', 'surname', 'familyname'].includes(k)) return 'lastName';
  if (k === 'role') return 'role';
  return null;
}

function parseCsvText(text: string): { headers: string[]; rows: string[][]; error?: string } {
  const result = Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: 'greedy',
  });
  if (result.errors.length > 0) {
    const fatal = result.errors.find((e: any) => e.type === 'Quotes' || e.type === 'Delimiter');
    if (fatal) return { headers: [], rows: [], error: fatal.message };
  }
  const data = result.data;
  if (data.length === 0) return { headers: [], rows: [], error: 'CSV is empty' };
  const headers = (data[0] || []).map((h: any) => String(h ?? '').trim());
  const rows = data.slice(1);
  return { headers, rows };
}

function applyMapping(
  headers: string[],
  rows: string[][],
  mapping: Record<number, ReturnType<typeof classifyHeader>>
): { parsed: ParsedRow[]; invalid: Array<{ email: string; reason: string }> } {
  const emailIdx = Object.keys(mapping).find(i => mapping[Number(i)] === 'email');
  const firstIdx = Object.keys(mapping).find(i => mapping[Number(i)] === 'firstName');
  const lastIdx = Object.keys(mapping).find(i => mapping[Number(i)] === 'lastName');
  const roleIdx = Object.keys(mapping).find(i => mapping[Number(i)] === 'role');
  const unmappedIndices = headers
    .map((_, i) => i)
    .filter(i => mapping[i] === null || mapping[i] === undefined);

  if (emailIdx === undefined) return { parsed: [], invalid: [] };

  const parsed: ParsedRow[] = [];
  const invalid: Array<{ email: string; reason: string }> = [];

  for (const row of rows) {
    const email = String(row[Number(emailIdx)] ?? '').trim().toLowerCase();
    if (!email) continue;
    if (!EMAIL_RE.test(email)) {
      invalid.push({ email, reason: 'invalid email format' });
      continue;
    }

    const metadata: Record<string, string> = {};
    for (const i of unmappedIndices) {
      const v = String(row[i] ?? '').trim();
      if (v) metadata[headers[i] || `column_${i}`] = v;
    }

    parsed.push({
      email,
      firstName: firstIdx !== undefined ? String(row[Number(firstIdx)] ?? '').trim() || undefined : undefined,
      lastName: lastIdx !== undefined ? String(row[Number(lastIdx)] ?? '').trim() || undefined : undefined,
      role: roleIdx !== undefined && String(row[Number(roleIdx)] ?? '').trim().toLowerCase() === 'admin' ? 'admin' : undefined,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    });
  }

  return { parsed, invalid };
}

export default function ImportRosterScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { orgId, orgName } = useLocalSearchParams<{ orgId: string; orgName?: string }>();

  const [stage, setStage] = useState<Stage>('pick');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<number, ReturnType<typeof classifyHeader>>>({});
  const [result, setResult] = useState<ImportResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Tier-related errors get a dedicated upgrade modal instead of inline text.
  // The admin CAN fix these (member cap or CSV-import gating), so the modal
  // shows an actionable CTA pointing at org billing.
  const [tierUpgrade, setTierUpgrade] = useState<{
    visible: boolean;
    title: string;
    message: string;
  }>({ visible: false, title: '', message: '' });

  const { parsed, invalid } = useMemo(
    () => applyMapping(headers, rawRows, mapping),
    [headers, rawRows, mapping]
  );

  const emailMapped = Object.values(mapping).includes('email');

  const handlePickFile = async () => {
    setErrorMsg(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/csv', 'text/plain', '*/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const file = result.assets?.[0];
      if (!file?.uri) {
        setErrorMsg('No file selected');
        return;
      }

      const content = await FileSystem.readAsStringAsync(file.uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      // Strip UTF-8 BOM if present — common on Excel exports.
      const text = content.startsWith('﻿') ? content.slice(1) : content;

      const { headers: hs, rows, error } = parseCsvText(text);
      if (error) {
        setErrorMsg(`Could not parse CSV: ${error}`);
        return;
      }
      if (rows.length === 0) {
        setErrorMsg('No data rows found in CSV');
        return;
      }
      if (rows.length > MAX_ROWS) {
        setErrorMsg(`This CSV has ${rows.length} rows. Max is ${MAX_ROWS}. Split into smaller files.`);
        return;
      }

      // Auto-detect column mapping from headers.
      const initialMapping: Record<number, ReturnType<typeof classifyHeader>> = {};
      hs.forEach((h, i) => {
        initialMapping[i] = classifyHeader(h);
      });

      setHeaders(hs);
      setRawRows(rows);
      setMapping(initialMapping);
      setStage('preview');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setErrorMsg(e?.message || 'Failed to read file');
    }
  };

  const cycleMapping = (colIdx: number) => {
    Haptics.selectionAsync();
    const order: Array<ReturnType<typeof classifyHeader>> = [null, 'email', 'firstName', 'lastName', 'role'];
    const current = mapping[colIdx] ?? null;
    const next = order[(order.indexOf(current) + 1) % order.length];

    // Enforce uniqueness for email/firstName/lastName/role: if assigning,
    // unset the same role from any other column first.
    setMapping(prev => {
      const updated = { ...prev };
      if (next !== null) {
        for (const k of Object.keys(updated)) {
          const idx = Number(k);
          if (idx !== colIdx && updated[idx] === next) updated[idx] = null;
        }
      }
      updated[colIdx] = next;
      return updated;
    });
  };

  const handleConfirmImport = async () => {
    if (!orgId || parsed.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStage('importing');
    try {
      const apiResult = await organizationsApi.importRoster(orgId, parsed);
      if (apiResult.error || !apiResult.data) {
        // Tier-gated errors get the upgrade modal; everything else falls
        // through to the inline error path.
        if (apiResult.errorCode === 'MEMBER_LIMIT_EXCEEDED') {
          const d = apiResult.errorDetails ?? {};
          setTierUpgrade({
            visible: true,
            title: 'Member limit reached',
            message: d.limit
              ? `Adding ${parsed.length} ${parsed.length === 1 ? 'member' : 'members'} would exceed your ${d.tier ?? 'current'} plan limit of ${d.limit} (${d.currentMembers} currently). Upgrade to continue importing.`
              : 'This import would exceed your organization\'s member limit. Upgrade your plan to continue.',
          });
          setStage('preview');
          return;
        }
        if (apiResult.errorCode === 'FEATURE_NOT_AVAILABLE_ON_TIER') {
          setTierUpgrade({
            visible: true,
            title: 'CSV import requires Professional',
            message: 'Bulk roster import via CSV is available on the Professional plan and above. Upgrade your organization\'s plan, or invite members one at a time using invite codes.',
          });
          setStage('preview');
          return;
        }
        setErrorMsg(apiResult.error || 'Import failed');
        setStage('preview');
        return;
      }
      // Backend may have its own invalid list (server-side validation).
      // Merge with our client-side invalid count. Default array fields so
      // the done screen renders even if the backend omits them.
      const d: any = apiResult.data;
      const merged: ImportResult = {
        created: typeof d.created === 'number' ? d.created : 0,
        skippedExistingMembers: Array.isArray(d.skippedExistingMembers) ? d.skippedExistingMembers : [],
        skippedAlreadyInvited: Array.isArray(d.skippedAlreadyInvited) ? d.skippedAlreadyInvited : [],
        invalid: [...invalid, ...(Array.isArray(d.invalid) ? d.invalid : [])],
      };
      setResult(merged);
      setStage('done');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      setErrorMsg(e?.message || 'Import failed');
      setStage('preview');
    }
  };

  const handleClose = () => {
    if (stage === 'importing') return;
    router.back();
  };

  const labelForRole = (r: ReturnType<typeof classifyHeader>) => {
    if (r === 'email') return 'Email';
    if (r === 'firstName') return 'First name';
    if (r === 'lastName') return 'Last name';
    if (r === 'role') return 'Role';
    return 'Skip';
  };

  // ---------- Render ----------

  const renderPick = () => (
    <Animated.View entering={FadeIn.duration(300)} style={styles.centerContent}>
      <View style={[styles.iconCircle, { backgroundColor: `${colors.gold}15` }]}>
        <Ionicons name="cloud-upload-outline" size={48} color={colors.gold} />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>Import members from CSV</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Upload a CSV with member emails. Each invited person gets an email with a magic link to join {orgName ? `"${orgName}"` : 'your organization'}.
      </Text>

      <View style={[styles.requirementsBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.requirementsTitle, { color: colors.text }]}>Your CSV needs:</Text>
        <View style={styles.requirementRow}>
          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
          <Text style={[styles.requirementText, { color: colors.text }]}>An <Text style={{ fontFamily: FONTS.sansBold }}>Email</Text> column (required)</Text>
        </View>
        <View style={styles.requirementRow}>
          <Ionicons name="checkmark-circle" size={16} color={colors.textSecondary} />
          <Text style={[styles.requirementText, { color: colors.textSecondary }]}>First Name and Last Name columns (optional)</Text>
        </View>
        <View style={styles.requirementRow}>
          <Ionicons name="checkmark-circle" size={16} color={colors.textSecondary} />
          <Text style={[styles.requirementText, { color: colors.textSecondary }]}>Up to {MAX_ROWS} rows per upload</Text>
        </View>
      </View>

      <TouchableOpacity onPress={handlePickFile} style={[styles.primaryButton, { backgroundColor: colors.gold }]}>
        <Ionicons name="document-attach-outline" size={20} color="#000" />
        <Text style={styles.primaryButtonText}>Choose CSV file</Text>
      </TouchableOpacity>

      {errorMsg && (
        <Text style={[styles.errorText, { color: colors.error }]}>{errorMsg}</Text>
      )}
    </Animated.View>
  );

  const renderPreview = () => (
    <ScrollView contentContainerStyle={styles.previewContent} showsVerticalScrollIndicator={false}>
      <Animated.View entering={FadeIn.duration(300)}>
        <Text style={[styles.title, { color: colors.text }]}>Review and import</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {rawRows.length} rows in your file. Tap a column header to change how it's used.
        </Text>

        {/* Counts summary */}
        <View style={styles.countsRow}>
          <View style={[styles.countCard, { backgroundColor: `${colors.success}15`, borderColor: colors.success }]}>
            <Text style={[styles.countNumber, { color: colors.success }]}>{parsed.length}</Text>
            <Text style={[styles.countLabel, { color: colors.text }]}>Will invite</Text>
          </View>
          {invalid.length > 0 && (
            <View style={[styles.countCard, { backgroundColor: `${colors.error}15`, borderColor: colors.error }]}>
              <Text style={[styles.countNumber, { color: colors.error }]}>{invalid.length}</Text>
              <Text style={[styles.countLabel, { color: colors.text }]}>Invalid email</Text>
            </View>
          )}
        </View>

        {/* Column mapping */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Column mapping</Text>
        <View style={[styles.columnsList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {headers.map((header, i) => (
            <TouchableOpacity
              key={`${header}-${i}`}
              onPress={() => cycleMapping(i)}
              style={[styles.columnRow, i < headers.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: 1 }]}
            >
              <View style={styles.columnHeaderInfo}>
                <Text style={[styles.columnHeaderName, { color: colors.text }]} numberOfLines={1}>
                  {header || `(column ${i + 1})`}
                </Text>
                <Text style={[styles.columnSample, { color: colors.textSecondary }]} numberOfLines={1}>
                  e.g. {String(rawRows[0]?.[i] ?? '').slice(0, 30) || '—'}
                </Text>
              </View>
              <View style={[
                styles.columnRoleBadge,
                {
                  backgroundColor: mapping[i] ? `${colors.gold}25` : `${colors.textSecondary}15`,
                  borderColor: mapping[i] ? colors.gold : 'transparent',
                },
              ]}>
                <Text style={[styles.columnRoleText, { color: mapping[i] ? colors.gold : colors.textSecondary }]}>
                  {labelForRole(mapping[i])}
                </Text>
                <Ionicons name="chevron-forward" size={14} color={mapping[i] ? colors.gold : colors.textSecondary} />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {!emailMapped && (
          <View style={[styles.warningBox, { backgroundColor: `${colors.warning}15`, borderColor: colors.warning }]}>
            <Ionicons name="warning-outline" size={18} color={colors.warning} />
            <Text style={[styles.warningText, { color: colors.text }]}>
              Tap a column to mark it as <Text style={{ fontFamily: FONTS.sansBold }}>Email</Text>. At least one email column is required.
            </Text>
          </View>
        )}

        {/* Preview rows */}
        {parsed.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: SPACING.lg }]}>
              First {Math.min(5, parsed.length)} of {parsed.length}
            </Text>
            <View style={[styles.previewRowsList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {parsed.slice(0, 5).map((row, i) => (
                <View
                  key={i}
                  style={[styles.previewRow, i < Math.min(5, parsed.length) - 1 && { borderBottomColor: colors.border, borderBottomWidth: 1 }]}
                >
                  <Text style={[styles.previewEmail, { color: colors.text }]} numberOfLines={1}>{row.email}</Text>
                  {(row.firstName || row.lastName) && (
                    <Text style={[styles.previewName, { color: colors.textSecondary }]} numberOfLines={1}>
                      {[row.firstName, row.lastName].filter(Boolean).join(' ')}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          </>
        )}

        <TouchableOpacity
          onPress={handleConfirmImport}
          disabled={!emailMapped || parsed.length === 0}
          style={[
            styles.primaryButton,
            {
              backgroundColor: !emailMapped || parsed.length === 0 ? colors.surfacePressed : colors.gold,
              marginTop: SPACING.xl,
            },
          ]}
        >
          <Ionicons name="send-outline" size={20} color="#000" />
          <Text style={styles.primaryButtonText}>
            Send {parsed.length} {parsed.length === 1 ? 'invite' : 'invites'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => { setStage('pick'); setHeaders([]); setRawRows([]); }} style={styles.secondaryButton}>
          <Text style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>Choose a different file</Text>
        </TouchableOpacity>

        {errorMsg && <Text style={[styles.errorText, { color: colors.error }]}>{errorMsg}</Text>}
      </Animated.View>
    </ScrollView>
  );

  const renderImporting = () => (
    <View style={styles.centerContent}>
      <ActivityIndicator size="large" color={colors.gold} />
      <Text style={[styles.title, { color: colors.text, marginTop: SPACING.lg }]}>Sending invites…</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        This usually takes a few seconds.
      </Text>
    </View>
  );

  const renderDone = () => {
    if (!result) return null;
    const skipped = result.skippedExistingMembers.length + result.skippedAlreadyInvited.length;
    return (
      <ScrollView contentContainerStyle={styles.previewContent}>
        <Animated.View entering={FadeInUp.duration(400)} style={styles.centerContent}>
          <View style={[styles.iconCircle, { backgroundColor: `${colors.success}15` }]}>
            <Ionicons name="checkmark-circle" size={48} color={colors.success} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>Import complete</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {result.created} {result.created === 1 ? 'invite' : 'invites'} sent. Members will receive an email with a link to join.
          </Text>
        </Animated.View>

        <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.text }]}>Invites sent</Text>
            <Text style={[styles.summaryValue, { color: colors.success }]}>{result.created}</Text>
          </View>
          {skipped > 0 && (
            <View style={[styles.summaryRow, { borderTopColor: colors.border, borderTopWidth: 1 }]}>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Already in org / already invited</Text>
              <Text style={[styles.summaryValue, { color: colors.textSecondary }]}>{skipped}</Text>
            </View>
          )}
          {result.invalid.length > 0 && (
            <View style={[styles.summaryRow, { borderTopColor: colors.border, borderTopWidth: 1 }]}>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Invalid rows</Text>
              <Text style={[styles.summaryValue, { color: colors.error }]}>{result.invalid.length}</Text>
            </View>
          )}
        </View>

        {result.invalid.length > 0 && (
          <TouchableOpacity
            onPress={() => Alert.alert(
              'Invalid rows',
              result.invalid.slice(0, 20).map(r => `${r.email || '(empty)'} — ${r.reason}`).join('\n') + (result.invalid.length > 20 ? `\n…and ${result.invalid.length - 20} more` : '')
            )}
            style={styles.secondaryButton}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>View invalid rows</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity onPress={() => router.back()} style={[styles.primaryButton, { backgroundColor: colors.gold, marginTop: SPACING.lg }]}>
          <Text style={styles.primaryButtonText}>Done</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border, paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={handleClose} style={styles.backButton} disabled={stage === 'importing'}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Import members</Text>
        <View style={{ width: 40 }} />
      </View>

      {stage === 'pick' && renderPick()}
      {stage === 'preview' && renderPreview()}
      {stage === 'importing' && renderImporting()}
      {stage === 'done' && renderDone()}

      <UpgradeModal
        visible={tierUpgrade.visible}
        onClose={() => setTierUpgrade({ ...tierUpgrade, visible: false })}
        type="orgTier"
        title={tierUpgrade.title}
        message={tierUpgrade.message}
        ctaLabel="Manage plan"
        onCta={() => {
          router.push({
            pathname: '/modals/organization-billing',
            params: { orgId, orgName },
          });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: FONTS.serif, fontSize: 20 },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.md,
  },
  iconCircle: {
    width: 96, height: 96, borderRadius: 48,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  title: {
    fontFamily: FONTS.serif,
    fontSize: 22,
    textAlign: 'center',
  },
  subtitle: {
    ...TYPOGRAPHY.bodyMedium,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  requirementsBox: {
    width: '100%',
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  requirementsTitle: {
    ...TYPOGRAPHY.labelMedium,
    marginBottom: SPACING.xs,
  },
  requirementRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  requirementText: { ...TYPOGRAPHY.bodySmall, flex: 1 },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    gap: SPACING.sm,
    minWidth: '60%',
  },
  primaryButtonText: {
    ...TYPOGRAPHY.labelLarge,
    color: '#000',
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  secondaryButtonText: {
    ...TYPOGRAPHY.labelMedium,
  },
  errorText: {
    ...TYPOGRAPHY.bodySmall,
    textAlign: 'center',
    marginTop: SPACING.md,
  },
  previewContent: { padding: SPACING.lg, paddingBottom: SPACING.xl },
  countsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginVertical: SPACING.lg,
  },
  countCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
  },
  countNumber: {
    fontFamily: FONTS.mono,
    fontVariant: ['tabular-nums'],
    fontSize: 28,
  },
  countLabel: {
    ...TYPOGRAPHY.labelSmall,
    marginTop: SPACING.xxs,
  },
  sectionLabel: {
    ...TYPOGRAPHY.labelSmall,
    fontFamily: FONTS.sansSemiBold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: SPACING.sm,
  },
  columnsList: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  columnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    gap: SPACING.md,
  },
  columnHeaderInfo: { flex: 1 },
  columnHeaderName: {
    ...TYPOGRAPHY.labelMedium,
  },
  columnSample: {
    ...TYPOGRAPHY.bodySmall,
    marginTop: 2,
  },
  columnRoleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    gap: 4,
  },
  columnRoleText: {
    ...TYPOGRAPHY.labelSmall,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginTop: SPACING.md,
  },
  warningText: { ...TYPOGRAPHY.bodySmall, flex: 1 },
  previewRowsList: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  previewRow: {
    padding: SPACING.md,
  },
  previewEmail: {
    ...TYPOGRAPHY.labelMedium,
  },
  previewName: {
    ...TYPOGRAPHY.bodySmall,
    marginTop: 2,
  },
  summaryCard: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.lg,
    marginVertical: SPACING.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
  },
  summaryLabel: {
    ...TYPOGRAPHY.labelMedium,
    flex: 1,
  },
  summaryValue: {
    ...TYPOGRAPHY.labelLarge,
    fontFamily: FONTS.monoSemiBold,
    fontVariant: ['tabular-nums'],
  },
});
