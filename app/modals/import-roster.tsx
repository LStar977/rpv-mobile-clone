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
import { useTheme, SPACING, RADIUS, FONTS } from '../../lib/theme';
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
  const [fileName, setFileName] = useState<string | null>(null);
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
  const matchedColumns = Object.values(mapping).filter(Boolean).length;

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
      setFileName(file.name ?? 'roster.csv');
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

  const handleReplaceFile = () => {
    setStage('pick');
    setHeaders([]);
    setRawRows([]);
    setFileName(null);
    setErrorMsg(null);
  };

  const labelForRole = (r: ReturnType<typeof classifyHeader>) => {
    if (r === 'email') return 'Email';
    if (r === 'firstName') return 'First name';
    if (r === 'lastName') return 'Last name';
    if (r === 'role') return 'Role';
    return 'Skip';
  };

  const stepNumber = stage === 'pick' ? 1 : stage === 'done' ? 3 : 2;

  // ---------- Render ----------

  const renderStepHeader = () => (
    <View style={{ gap: 16 }}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={handleClose}
          disabled={stage === 'importing'}
          style={[styles.closeButton, { backgroundColor: colors.surface, borderColor: colors.borderSubtle, opacity: stage === 'importing' ? 0.4 : 1 }]}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={[styles.stepLabel, { color: colors.textTertiary }]}>STEP {stepNumber} OF 3</Text>
      </View>
      <View style={styles.stepBars}>
        {[1, 2, 3].map(n => (
          <View
            key={n}
            style={[styles.stepBar, { backgroundColor: n <= stepNumber ? colors.goldFill : colors.surfaceHighlight }]}
          />
        ))}
      </View>
    </View>
  );

  const renderPick = () => (
    <Animated.View entering={FadeIn.duration(300)} style={styles.stageBody}>
      <View style={{ gap: 8 }}>
        <Text style={[styles.title, { color: colors.text }]}>Import Your Roster</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Upload a CSV with member emails. Each invited person gets an email with a magic link to join {orgName ? `"${orgName}"` : 'your organization'} — and verifies their own identity before they can vote.
        </Text>
      </View>

      <View style={[styles.requirementsBox, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
        <Text style={[styles.requirementsTitle, { color: colors.textTertiary }]}>YOUR CSV NEEDS</Text>
        <View style={styles.requirementRow}>
          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
          <Text style={[styles.requirementText, { color: colors.text }]}>An <Text style={{ fontFamily: FONTS.sansSemiBold }}>Email</Text> column (required)</Text>
        </View>
        <View style={styles.requirementRow}>
          <Ionicons name="checkmark-circle" size={16} color={colors.textTertiary} />
          <Text style={[styles.requirementText, { color: colors.textSecondary }]}>First Name and Last Name columns (optional)</Text>
        </View>
        <View style={styles.requirementRow}>
          <Ionicons name="checkmark-circle" size={16} color={colors.textTertiary} />
          <Text style={[styles.requirementText, { color: colors.textSecondary }]}>Up to {MAX_ROWS} rows per upload</Text>
        </View>
      </View>

      <TouchableOpacity
        onPress={handlePickFile}
        style={[styles.uploadCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        activeOpacity={0.7}
      >
        <View style={[styles.uploadIconBox, { backgroundColor: colors.goldSurface }]}>
          <Ionicons name="cloud-upload-outline" size={22} color={colors.gold} />
        </View>
        <View style={{ flex: 1, gap: 1 }}>
          <Text style={[styles.uploadCardTitle, { color: colors.text }]}>Choose a CSV file</Text>
          <Text style={[styles.uploadCardMeta, { color: colors.textTertiary }]}>UP TO {MAX_ROWS} ROWS · UTF-8</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
      </TouchableOpacity>

      {errorMsg && (
        <View style={[styles.errorBanner, { backgroundColor: colors.errorSurface, borderColor: colors.error }]}>
          <Ionicons name="alert-circle-outline" size={16} color={colors.error} style={{ flexShrink: 0 }} />
          <Text style={[styles.errorBannerText, { color: colors.text }]}>{errorMsg}</Text>
        </View>
      )}

      <View style={{ marginTop: 'auto' }}>
        <TouchableOpacity onPress={handlePickFile} style={[styles.primaryButton, { backgroundColor: colors.goldFill }]} activeOpacity={0.8}>
          <Text style={styles.primaryButtonText}>Choose CSV File</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  const renderPreview = () => {
    // Mixed row preview — ready rows plus flagged rows, honestly labeled.
    const flaggedShown = Math.min(invalid.length, 2);
    const readyShown = Math.min(parsed.length, 4 - flaggedShown);
    const previewRows: Array<{ name: string; detail: string; flagged: boolean }> = [
      ...parsed.slice(0, readyShown).map(r => ({
        name: [r.firstName, r.lastName].filter(Boolean).join(' ') || '—',
        detail: r.email,
        flagged: false,
      })),
      ...invalid.slice(0, flaggedShown).map(r => ({
        name: '—',
        detail: r.email ? `${r.email} — ${r.reason}` : r.reason,
        flagged: true,
      })),
    ];

    return (
      <ScrollView contentContainerStyle={styles.previewContent} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeIn.duration(300)} style={{ gap: 16 }}>
          <View style={{ gap: 8 }}>
            <Text style={[styles.title, { color: colors.text }]}>Review Your Roster</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              We matched your CSV columns. Members get an invite — each verifies their own identity before they can vote.
            </Text>
          </View>

          {/* File card */}
          <View style={[styles.fileCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.fileIconBox, { backgroundColor: colors.goldSurface }]}>
              <Ionicons name="document-text-outline" size={18} color={colors.gold} />
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <Text style={[styles.fileName, { color: colors.text }]} numberOfLines={1}>
                {fileName ?? 'roster.csv'}
              </Text>
              <Text style={[styles.fileMeta, { color: colors.textTertiary }]}>
                {rawRows.length.toLocaleString()} ROWS · {matchedColumns} {matchedColumns === 1 ? 'COLUMN' : 'COLUMNS'} MATCHED
              </Text>
            </View>
            <TouchableOpacity onPress={handleReplaceFile} activeOpacity={0.7}>
              <Text style={[styles.replaceText, { color: colors.textSecondary }]}>Replace</Text>
            </TouchableOpacity>
          </View>

          {/* Column mapping — tap a column to cycle how it's used */}
          <View style={{ gap: 7 }}>
            <Text style={[styles.sectionEyebrow, { color: colors.textTertiary }]}>COLUMN MAPPING · TAP TO CHANGE</Text>
            <View style={[styles.mappingCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
              {headers.map((header, i) => (
                <TouchableOpacity
                  key={`${header}-${i}`}
                  onPress={() => cycleMapping(i)}
                  activeOpacity={0.7}
                  style={[styles.columnRow, i < headers.length - 1 && { borderBottomColor: colors.borderSubtle, borderBottomWidth: 1 }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.columnHeaderName, { color: colors.text }]} numberOfLines={1}>
                      {header || `(column ${i + 1})`}
                    </Text>
                    <Text style={[styles.columnSample, { color: colors.textTertiary }]} numberOfLines={1}>
                      e.g. {String(rawRows[0]?.[i] ?? '').slice(0, 30) || '—'}
                    </Text>
                  </View>
                  <View style={[
                    styles.columnRoleBadge,
                    {
                      backgroundColor: mapping[i] ? colors.goldSurface : colors.surfaceHighlight,
                      borderColor: mapping[i] ? 'rgba(234,186,88,0.3)' : 'transparent',
                    },
                  ]}>
                    <Text style={[styles.columnRoleText, { color: mapping[i] ? colors.gold : colors.textTertiary }]}>
                      {labelForRole(mapping[i])}
                    </Text>
                    <Ionicons name="chevron-forward" size={12} color={mapping[i] ? colors.gold : colors.textTertiary} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {!emailMapped && (
            <View style={[styles.warnBanner, { backgroundColor: colors.warningSurface, borderColor: colors.warning }]}>
              <Ionicons name="warning-outline" size={16} color={colors.warning} style={{ flexShrink: 0 }} />
              <Text style={[styles.warnBannerText, { color: colors.textSecondary }]}>
                <Text style={{ fontFamily: FONTS.sansSemiBold, color: colors.text }}>No email column mapped.</Text> Tap a column above to mark it as Email — at least one is required.
              </Text>
            </View>
          )}

          {/* Row preview table */}
          {emailMapped && previewRows.length > 0 && (
            <View style={[styles.table, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
              <View style={[styles.tableHeader, { backgroundColor: colors.backgroundSecondary, borderBottomColor: colors.borderSubtle }]}>
                <Text style={[styles.tableHeaderCell, { color: colors.textTertiary, flex: 1.2 }]}>NAME</Text>
                <Text style={[styles.tableHeaderCell, { color: colors.textTertiary, flex: 1.6 }]}>EMAIL</Text>
                <Text style={[styles.tableHeaderCell, { color: colors.textTertiary, flex: 0.8, textAlign: 'right' }]}>STATUS</Text>
              </View>
              {previewRows.map((row, i) => (
                <View
                  key={i}
                  style={[styles.tableRow, i < previewRows.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderSubtle }]}
                >
                  <Text style={[styles.tableName, { color: colors.text, flex: 1.2 }]} numberOfLines={1}>{row.name}</Text>
                  <Text
                    style={[styles.tableEmail, { color: row.flagged ? colors.error : colors.textTertiary, flex: 1.6 }]}
                    numberOfLines={1}
                  >
                    {row.detail}
                  </Text>
                  <Text style={[styles.tableStatus, { color: row.flagged ? colors.warning : colors.success, flex: 0.8 }]}>
                    {row.flagged ? 'FIX' : 'READY'}
                  </Text>
                </View>
              ))}
            </View>
          )}
          {emailMapped && (parsed.length + invalid.length) > previewRows.length && (
            <Text style={[styles.tableFootnote, { color: colors.textTertiary }]}>
              SHOWING {previewRows.length} OF {(parsed.length + invalid.length).toLocaleString()} ROWS
            </Text>
          )}

          {/* Invalid-rows banner — honest about what's wrong and what happens */}
          {invalid.length > 0 && (
            <View style={[styles.warnBanner, { backgroundColor: colors.warningSurface, borderColor: colors.warning }]}>
              <Ionicons name="warning-outline" size={16} color={colors.warning} style={{ flexShrink: 0 }} />
              <Text style={[styles.warnBannerText, { color: colors.textSecondary }]}>
                <Text style={{ fontFamily: FONTS.sansSemiBold, color: colors.text }}>{invalid.length} {invalid.length === 1 ? 'row needs' : 'rows need'} attention.</Text> {invalid.length === 1 ? 'It has an invalid email and will be skipped' : 'They have invalid emails and will be skipped'} — fix the CSV and re-upload, or import the {parsed.length.toLocaleString()} ready {parsed.length === 1 ? 'row' : 'rows'}.
              </Text>
            </View>
          )}

          {errorMsg && (
            <View style={[styles.errorBanner, { backgroundColor: colors.errorSurface, borderColor: colors.error }]}>
              <Ionicons name="alert-circle-outline" size={16} color={colors.error} style={{ flexShrink: 0 }} />
              <Text style={[styles.errorBannerText, { color: colors.text }]}>{errorMsg}</Text>
            </View>
          )}

          <View style={{ gap: 9, marginTop: SPACING.sm }}>
            <TouchableOpacity
              onPress={handleConfirmImport}
              disabled={!emailMapped || parsed.length === 0}
              activeOpacity={0.8}
              style={[
                styles.primaryButton,
                { backgroundColor: !emailMapped || parsed.length === 0 ? colors.surfacePressed : colors.goldFill },
              ]}
            >
              <Text style={[styles.primaryButtonText, (!emailMapped || parsed.length === 0) && { color: colors.textTertiary }]}>
                Import {parsed.length.toLocaleString()} {parsed.length === 1 ? 'Member' : 'Members'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleReplaceFile} style={styles.textButton} activeOpacity={0.7}>
              <Text style={[styles.textButtonLabel, { color: colors.textSecondary }]}>Choose a Different File</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>
    );
  };

  const renderImporting = () => (
    <View style={styles.centerContent}>
      <ActivityIndicator size="large" color={colors.gold} />
      <Text style={[styles.title, { color: colors.text, textAlign: 'center', marginTop: SPACING.lg }]}>Sending invites…</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary, textAlign: 'center' }]}>
        This usually takes a few seconds.
      </Text>
    </View>
  );

  const renderDone = () => {
    if (!result) return null;
    const skipped = result.skippedExistingMembers.length + result.skippedAlreadyInvited.length;
    return (
      <ScrollView contentContainerStyle={styles.previewContent}>
        <Animated.View entering={FadeInUp.duration(400)} style={{ gap: 16 }}>
          <View style={{ alignItems: 'center', gap: 8, paddingVertical: SPACING.lg }}>
            <View style={[styles.doneIconCircle, { backgroundColor: colors.successSurface }]}>
              <Ionicons name="checkmark" size={30} color={colors.success} />
            </View>
            <Text style={[styles.title, { color: colors.text, textAlign: 'center' }]}>Import Complete</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary, textAlign: 'center' }]}>
              {result.created.toLocaleString()} {result.created === 1 ? 'invite' : 'invites'} sent. Members will receive an email with a link to join.
            </Text>
          </View>

          <View style={{ gap: 7 }}>
            <Text style={[styles.sectionEyebrow, { color: colors.textTertiary }]}>IMPORT SUMMARY</Text>
            <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
              <View style={[styles.summaryRow, (skipped > 0 || result.invalid.length > 0) && { borderBottomWidth: 1, borderBottomColor: colors.borderSubtle }]}>
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>INVITES SENT</Text>
                <Text style={[styles.summaryValue, { color: colors.success }]}>{result.created.toLocaleString()}</Text>
              </View>
              {skipped > 0 && (
                <View style={[styles.summaryRow, result.invalid.length > 0 && { borderBottomWidth: 1, borderBottomColor: colors.borderSubtle }]}>
                  <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>ALREADY IN ORG / INVITED</Text>
                  <Text style={[styles.summaryValue, { color: colors.textSecondary }]}>{skipped.toLocaleString()}</Text>
                </View>
              )}
              {result.invalid.length > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>INVALID ROWS</Text>
                  <Text style={[styles.summaryValue, { color: colors.error }]}>{result.invalid.length.toLocaleString()}</Text>
                </View>
              )}
            </View>
          </View>

          {result.invalid.length > 0 && (
            <TouchableOpacity
              onPress={() => Alert.alert(
                'Invalid rows',
                result.invalid.slice(0, 20).map(r => `${r.email || '(empty)'} — ${r.reason}`).join('\n') + (result.invalid.length > 20 ? `\n…and ${result.invalid.length - 20} more` : '')
              )}
              style={styles.textButton}
              activeOpacity={0.7}
            >
              <Text style={[styles.textButtonLabel, { color: colors.textSecondary }]}>View Invalid Rows</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={() => router.back()} style={[styles.primaryButton, { backgroundColor: colors.goldFill }]} activeOpacity={0.8}>
            <Text style={styles.primaryButtonText}>Done</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 8 }]}>
      <View style={{ paddingHorizontal: SPACING.screenPadding, gap: 16, paddingBottom: 16 }}>
        {renderStepHeader()}
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLabel: {
    fontFamily: FONTS.mono,
    fontSize: 10.5,
    letterSpacing: 1.68,
    fontVariant: ['tabular-nums'],
  },
  stepBars: {
    flexDirection: 'row',
    gap: 6,
  },
  stepBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  stageBody: {
    flex: 1,
    paddingHorizontal: SPACING.screenPadding,
    paddingBottom: 34,
    gap: 16,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.screenPadding,
    gap: SPACING.sm,
  },
  title: {
    fontFamily: FONTS.serif,
    fontSize: 27,
    lineHeight: 30,
    letterSpacing: -0.32,
  },
  subtitle: {
    fontFamily: FONTS.sans,
    fontSize: 13.5,
    lineHeight: 20,
  },
  requirementsBox: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  requirementsTitle: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10,
    letterSpacing: 1.4,
    marginBottom: SPACING.xs,
  },
  requirementRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  requirementText: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    lineHeight: 19,
    flex: 1,
  },
  uploadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  uploadIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadCardTitle: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 13.5,
  },
  uploadCardMeta: {
    fontFamily: FONTS.mono,
    fontSize: 10.5,
    fontVariant: ['tabular-nums'],
  },
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  fileIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileName: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 13.5,
  },
  fileMeta: {
    fontFamily: FONTS.mono,
    fontSize: 10.5,
    fontVariant: ['tabular-nums'],
  },
  replaceText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 12,
  },
  sectionEyebrow: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10.5,
    letterSpacing: 1.47,
  },
  mappingCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    paddingHorizontal: 16,
  },
  columnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    gap: SPACING.md,
  },
  columnHeaderName: {
    fontFamily: FONTS.sansMedium,
    fontSize: 13,
  },
  columnSample: {
    fontFamily: FONTS.mono,
    fontSize: 10.5,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  columnRoleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: RADIUS.chip,
    borderWidth: 1,
    gap: 4,
  },
  columnRoleText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
  },
  table: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  tableHeaderCell: {
    fontFamily: FONTS.monoSemiBold,
    fontSize: 9,
    letterSpacing: 1.08,
    fontVariant: ['tabular-nums'],
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  tableName: {
    fontFamily: FONTS.sansMedium,
    fontSize: 12,
    paddingRight: 6,
  },
  tableEmail: {
    fontFamily: FONTS.monoRegular,
    fontSize: 11,
    paddingRight: 6,
    fontVariant: ['tabular-nums'],
  },
  tableStatus: {
    fontFamily: FONTS.monoSemiBold,
    fontSize: 9,
    textAlign: 'right',
    letterSpacing: 0.5,
  },
  tableFootnote: {
    fontFamily: FONTS.mono,
    fontSize: 9.5,
    letterSpacing: 0.5,
    fontVariant: ['tabular-nums'],
  },
  warnBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 15,
  },
  warnBannerText: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    lineHeight: 17,
    flex: 1,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 15,
  },
  errorBannerText: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    lineHeight: 17,
    flex: 1,
  },
  primaryButton: {
    height: 54,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 16,
    color: '#040707',
  },
  textButton: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textButtonLabel: {
    fontFamily: FONTS.sansMedium,
    fontSize: 14,
  },
  doneIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewContent: {
    paddingHorizontal: SPACING.screenPadding,
    paddingBottom: 34,
  },
  summaryCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  summaryLabel: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    letterSpacing: 0.3,
    fontVariant: ['tabular-nums'],
    flex: 1,
  },
  summaryValue: {
    fontFamily: FONTS.monoSemiBold,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
});
