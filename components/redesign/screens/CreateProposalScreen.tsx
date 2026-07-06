// Redesign · Screen 12 — Create a proposal
// A guided compose form: question, description, category, scope, vote type,
// options (for multi/ranked), citizens-only. Submits via proposalsApi.create().
// Kept confident and un-daunting: one decision at a time, clear validation.
import React, { useState } from 'react';
import { View, ScrollView, TextInput, Pressable, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../../lib/theme';
import { proposalsApi } from '../../../lib/api';
import { T, Eyebrow, Button } from '../index';
import { SPACE, RADIUS, FONTS } from '../../../lib/redesign';

const CATEGORIES = ['General', 'Governance', 'Local', 'Economy', 'Environment', 'Rights'];
type VType = 'yes-no' | 'multiple-choice' | 'ranked';
const VTYPES: { key: VType; label: string }[] = [
  { key: 'yes-no', label: 'Yes / No' },
  { key: 'multiple-choice', label: 'Choose one' },
  { key: 'ranked', label: 'Ranked' },
];

export function CreateProposalScreen() {
  const { colors } = useTheme();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('General');
  const [scope, setScope] = useState('');
  const [voteType, setVoteType] = useState<VType>('yes-no');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [citizensOnly, setCitizensOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsOptions = voteType !== 'yes-no';
  const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
  const valid =
    title.trim().length > 3 &&
    description.trim().length > 0 &&
    (!needsOptions || cleanOptions.length >= 2);

  const field = {
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: RADIUS.button,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.md,
    color: colors.text,
    fontFamily: FONTS.sansRegular,
    fontSize: 16,
  } as const;

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    const res = await proposalsApi.create({
      title: title.trim(),
      description: description.trim(),
      category,
      geoRestrictions: scope.trim() ? [scope.trim()] : undefined,
      voteType,
      options: needsOptions ? cleanOptions : undefined,
      requiresCitizenship: citizensOnly,
    });
    setBusy(false);
    if (res.error) return setError(res.error);
    router.replace('/redesign-feed');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: SPACE.xl, gap: SPACE.xl, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <View style={{ gap: SPACE.sm }}>
          <Eyebrow>New proposal</Eyebrow>
          <T variant="titleSerif" color={colors.text}>Ask your community</T>
        </View>

        {/* question */}
        <View style={{ gap: SPACE.sm }}>
          <T variant="monoLabel" color={colors.textTertiary}>The question</T>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="What should we decide?"
            placeholderTextColor={colors.textTertiary}
            style={field}
            multiline
          />
        </View>

        {/* description */}
        <View style={{ gap: SPACE.sm }}>
          <T variant="monoLabel" color={colors.textTertiary}>Context</T>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Give voters the background they need."
            placeholderTextColor={colors.textTertiary}
            style={[field, { minHeight: 110, textAlignVertical: 'top' }]}
            multiline
          />
        </View>

        {/* category chips */}
        <View style={{ gap: SPACE.sm }}>
          <T variant="monoLabel" color={colors.textTertiary}>Category</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm }}>
            {CATEGORIES.map((c) => {
              const on = category === c;
              return (
                <Pressable key={c} onPress={() => setCategory(c)}>
                  <View style={{ paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm, borderRadius: RADIUS.chip, backgroundColor: on ? colors.goldSurface : colors.surface, borderWidth: 1, borderColor: on ? colors.gold : colors.border }}>
                    <T variant="bodyMedium" color={on ? colors.gold : colors.textSecondary}>{c}</T>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* scope */}
        <View style={{ gap: SPACE.sm }}>
          <T variant="monoLabel" color={colors.textTertiary}>Scope (optional)</T>
          <TextInput
            value={scope}
            onChangeText={setScope}
            placeholder="e.g. Alberta, or your city / riding"
            placeholderTextColor={colors.textTertiary}
            style={field}
          />
          <T variant="caption" color={colors.textTertiary}>Only verified people in this area can vote. Leave blank for global.</T>
        </View>

        {/* vote type */}
        <View style={{ gap: SPACE.sm }}>
          <T variant="monoLabel" color={colors.textTertiary}>Ballot type</T>
          <View style={{ flexDirection: 'row', gap: SPACE.sm }}>
            {VTYPES.map((v) => {
              const on = voteType === v.key;
              return (
                <Pressable key={v.key} onPress={() => setVoteType(v.key)} style={{ flex: 1 }}>
                  <View style={{ alignItems: 'center', paddingVertical: SPACE.md, borderRadius: RADIUS.button, backgroundColor: on ? colors.goldSurface : colors.surface, borderWidth: 1, borderColor: on ? colors.gold : colors.border }}>
                    <T variant="bodyMedium" color={on ? colors.gold : colors.textSecondary}>{v.label}</T>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* options for multi/ranked */}
        {needsOptions && (
          <View style={{ gap: SPACE.sm }}>
            <T variant="monoLabel" color={colors.textTertiary}>Options</T>
            {options.map((opt, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: SPACE.sm, alignItems: 'center' }}>
                <TextInput
                  value={opt}
                  onChangeText={(t) => setOptions((o) => o.map((x, j) => (j === i ? t : x)))}
                  placeholder={`Option ${i + 1}`}
                  placeholderTextColor={colors.textTertiary}
                  style={[field, { flex: 1 }]}
                />
                {options.length > 2 && (
                  <Pressable onPress={() => setOptions((o) => o.filter((_, j) => j !== i))} hitSlop={10}>
                    <T variant="body" color={colors.textTertiary}>✕</T>
                  </Pressable>
                )}
              </View>
            ))}
            <Pressable onPress={() => setOptions((o) => [...o, ''])}>
              <T variant="bodyMedium" color={colors.gold}>+ Add option</T>
            </Pressable>
          </View>
        )}

        {/* citizens only */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.surface, borderRadius: RADIUS.card, borderWidth: 1, borderColor: colors.border, padding: SPACE.lg }}>
          <View style={{ flex: 1, gap: 2, paddingRight: SPACE.md }}>
            <T variant="bodyMedium" color={colors.text}>Citizens only</T>
            <T variant="caption" color={colors.textTertiary}>Require verified citizenship to vote.</T>
          </View>
          <Switch value={citizensOnly} onValueChange={setCitizensOnly} trackColor={{ true: colors.gold }} thumbColor={colors.text} />
        </View>

        {error && <T variant="body" color={colors.error}>{error}</T>}

        <Button label="Publish proposal" onPress={submit} disabled={!valid} loading={busy} />
      </ScrollView>
    </SafeAreaView>
  );
}
