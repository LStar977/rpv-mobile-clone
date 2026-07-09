import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Switch,
  Image,
  ActivityIndicator,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme, FONTS } from '../lib/theme';
import { proposalsApi, Proposal } from '../lib/api';
import { registerForPushNotifications } from '../lib/notifications';

// ═══════════════════════════════════════════════════════════════════════════════
// ONBOARDING — the post-signin two-step primer (design6 mocks a1–a4, b1/b2).
//
// STEP 1 · REGION: "Where should we look for your ballots?" — country /
// province / city progressively disclosed, with a live gold payoff count
// derived from the real open proposals (same geoRestrictions math the Vote
// tab uses). Committing writes the observer display region to
// '@represent_observer_region' — the exact key/shape proposals.tsx (2a)
// reads. Display scoping ONLY; it never touches voting eligibility.
//
// STEP 2 · NOTIFICATIONS: permission earned with relevance — the headline
// names the region step's answer. Per-type toggles persist to
// '@represent_notification_prefs' (same key/shape as app/modals/
// notifications.tsx). "Enable Notifications" fires the one-shot iOS system
// prompt via registerForPushNotifications(); "Not now" preserves it.
// ═══════════════════════════════════════════════════════════════════════════════

const ONBOARDING_KEY = '@represent_onboarding_complete';
// Mirrors OBSERVER_REGION_KEY in app/(tabs)/proposals.tsx — shape
// { country?: string; state?: string; city?: string }.
const OBSERVER_REGION_KEY = '@represent_observer_region';
// Mirrors NOTIFICATION_PREFS_KEY in app/modals/notifications.tsx.
const NOTIFICATION_PREFS_KEY = '@represent_notification_prefs';

const GOLD_BORDER = 'rgba(234, 186, 88, 0.4)';
const GOLD_BORDER_SOFT = 'rgba(234, 186, 88, 0.3)';

type ObserverRegion = { country?: string; state?: string; city?: string };

interface NotificationPrefs {
  newProposals: boolean;
  deadlineReminders: boolean;
  results: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = {
  newProposals: true,
  deadlineReminders: true,
  results: true,
};

// This app's content is Canada-first; the region step offers Canada.
const COUNTRY = 'Canada';

const norm = (s?: string) => (s ?? '').trim().toLowerCase();

// A proposal is open until its deadline passes (mirrors proposals.tsx —
// undated / unparseable deadlines count as open there too).
function isOpen(p: Proposal): boolean {
  if (!p.deadline) return true;
  const t = new Date(p.deadline).getTime();
  return Number.isNaN(t) || t > Date.now();
}

const geoOf = (p: Proposal): string[] => p.geoRestrictions || [];

export function Onboarding({ onComplete }: { onComplete: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<1 | 2>(1);

  // ── Step 1 · region state ──────────────────────────────────────────────────
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [province, setProvince] = useState<string | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [cityQuery, setCityQuery] = useState('');
  // True when the user skipped the region step ("I'll browse everything").
  const [skipped, setSkipped] = useState(false);

  // ── Step 2 · notification prefs (all default on) ──────────────────────────
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);

  // Open-proposal region counts come from the real feed data — the payoff
  // number is the same count the Vote tab will show on arrival (c1).
  useEffect(() => {
    let alive = true;
    proposalsApi
      .getAll()
      .then((res) => {
        if (!alive) return;
        if (res.data) setProposals(res.data);
        setLoaded(true);
      })
      .catch(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const openBallots = useMemo(() => proposals.filter(isOpen), [proposals]);

  // Level counts, mirroring the Vote tab's derivation from geoRestrictions:
  // ['Canada'] = federal · ['Canada','Alberta'] = provincial · 3 levels =
  // municipal · [] = global (always in scope).
  const globalCount = useMemo(
    () => openBallots.filter((p) => geoOf(p).length === 0).length,
    [openBallots],
  );
  const federalCount = useMemo(
    () => openBallots.filter((p) => geoOf(p).length === 1 && norm(geoOf(p)[0]) === norm(COUNTRY)).length,
    [openBallots],
  );
  const canadaTotal = useMemo(
    () => openBallots.filter((p) => geoOf(p).length === 0 || norm(geoOf(p)[0]) === norm(COUNTRY)).length,
    [openBallots],
  );

  // Province chips — only provinces that actually have open ballots.
  const provinceList = useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of openBallots) {
      const g = geoOf(p);
      if (g.length >= 2 && norm(g[0]) === norm(COUNTRY) && !seen.has(norm(g[1]))) {
        seen.set(norm(g[1]), g[1]);
      }
    }
    return [...seen.values()].sort((a, b) => a.localeCompare(b));
  }, [openBallots]);

  const provincialCount = useMemo(() => {
    if (!province) return 0;
    return openBallots.filter((p) => {
      const g = geoOf(p);
      return g.length === 2 && norm(g[0]) === norm(COUNTRY) && norm(g[1]) === norm(province);
    }).length;
  }, [openBallots, province]);

  // City type-ahead options — ONLY cities with open ballots, with counts.
  const cityOptions = useMemo(() => {
    if (!province) return [];
    const m = new Map<string, { name: string; count: number }>();
    for (const p of openBallots) {
      const g = geoOf(p);
      if (g.length >= 3 && norm(g[0]) === norm(COUNTRY) && norm(g[1]) === norm(province)) {
        const existing = m.get(norm(g[2]));
        if (existing) existing.count += 1;
        else m.set(norm(g[2]), { name: g[2], count: 1 });
      }
    }
    return [...m.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [openBallots, province]);

  const citySuggestions = useMemo(() => {
    const q = norm(cityQuery);
    if (!q) return [];
    const matches = cityOptions.filter((c) => norm(c.name).includes(q));
    if (matches.length > 0) return matches.slice(0, 5);
    // Honest zero-ballot path (a4): the typed city can still be watched —
    // its first ballot will find the user.
    if (q.length >= 2) return [{ name: cityQuery.trim(), count: 0 }];
    return [];
  }, [cityOptions, cityQuery]);

  const cityMunicipalCount = useMemo(() => {
    if (!city) return 0;
    return cityOptions.find((c) => norm(c.name) === norm(city))?.count ?? 0;
  }, [city, cityOptions]);

  const otherCities = useMemo(
    () => cityOptions.filter((c) => norm(c.name) !== norm(city ?? '')).slice(0, 3),
    [cityOptions, city],
  );

  // Payoff numbers. Scope count = what the Vote tab feed will show
  // (global ballots always match).
  const provinceScopeCount = provincialCount + federalCount + globalCount;
  const payoffCount = city ? cityMunicipalCount + provinceScopeCount : province ? provinceScopeCount : canadaTotal;

  const breakdownParts = useMemo(() => {
    const parts: string[] = [];
    if (city) parts.push(`${cityMunicipalCount} municipal`);
    if (province) parts.push(`${provincialCount} provincial`);
    parts.push(`${federalCount} federal`);
    if (globalCount > 0) parts.push(`${globalCount} global`);
    return parts;
  }, [city, province, cityMunicipalCount, provincialCount, federalCount, globalCount]);

  const zeroBallotCity = !!city && cityMunicipalCount === 0;
  const canContinue = !!province && loaded;

  // ── Handlers ───────────────────────────────────────────────────────────────
  const toggleProvince = (name: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCity(null);
    setCityQuery('');
    setProvince((prev) => (norm(prev ?? '') === norm(name) ? null : name));
  };

  const selectCity = (name: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCity(name);
    setCityQuery('');
  };

  const clearCity = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCity(null);
    setCityQuery('');
  };

  // Continue: persist the declared region — the exact shape the Vote tab's
  // observer mode reads. Zero-ballot cities are persisted too, so the
  // city's first ballot actually finds the user.
  const commitRegion = () => {
    if (!canContinue) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const region: ObserverRegion = {
      country: COUNTRY,
      ...(province ? { state: province } : {}),
      ...(city ? { city } : {}),
    };
    AsyncStorage.setItem(OBSERVER_REGION_KEY, JSON.stringify(region)).catch(() => {
      // Display-only preference — never block onboarding on storage.
    });
    setSkipped(false);
    setStep(2);
  };

  // Skip: nothing is persisted — the feed stays unscoped.
  const skipRegion = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSkipped(true);
    setStep(2);
  };

  const togglePref = (key: keyof NotificationPrefs) => {
    Haptics.selectionAsync();
    setPrefs((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      AsyncStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const handleComplete = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, 'completed');
    } catch (e) {
      console.error('Error saving onboarding state:', e);
    }
    onComplete();
  };

  // Enable: persist the prefs, fire the one-shot system prompt (fire and
  // forget — (tabs)/_layout re-registers after onboarding anyway), complete.
  const handleEnableNotifications = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    AsyncStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(prefs)).catch(() => {});
    registerForPushNotifications().catch(() => {});
    handleComplete();
  };

  // Not now: prefs still persist; the iOS permission one-shot is preserved.
  const handleNotNow = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    AsyncStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(prefs)).catch(() => {});
    handleComplete();
  };

  // Localized step-2 copy — Screen A's answer does the persuading (b1/b2).
  const notifyPlace = skipped ? null : city || province;

  const toggleRows: { key: keyof NotificationPrefs; title: string; description: string }[] = [
    {
      key: 'newProposals',
      title: notifyPlace ? `New proposals in ${notifyPlace}` : 'New proposals',
      description: 'The moment one opens in your scope',
    },
    {
      key: 'deadlineReminders',
      title: 'Closing soon',
      description: "24h before a deadline you haven't voted on",
    },
    {
      key: 'results',
      title: 'Results in',
      description: 'When a ballot you watched is decided',
    },
  ];

  // ── Shared chip renderers ──────────────────────────────────────────────────
  const renderSelectedChip = (label: string, onPress?: () => void) => (
    <TouchableOpacity
      key={label}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.8}
      style={[styles.chipSelected, { backgroundColor: colors.goldSurface, borderColor: GOLD_BORDER }]}
      accessibilityRole="button"
      accessibilityState={{ selected: true }}
      accessibilityLabel={label}
    >
      <Ionicons name="checkmark" size={12} color={colors.gold} />
      <Text style={[styles.chipSelectedText, { color: colors.gold }]}>{label}</Text>
    </TouchableOpacity>
  );

  const renderProvinceChips = () => (
    <View style={styles.chipsWrap}>
      {provinceList.map((name) =>
        norm(name) === norm(province ?? '') ? (
          renderSelectedChip(name, () => toggleProvince(name))
        ) : (
          <TouchableOpacity
            key={name}
            onPress={() => toggleProvince(name)}
            activeOpacity={0.8}
            style={[styles.chip, { backgroundColor: colors.surface, borderColor: colors.border }]}
            accessibilityRole="button"
            accessibilityState={{ selected: false }}
            accessibilityLabel={name}
          >
            <Text style={[styles.chipText, { color: colors.textSecondary }]}>{name}</Text>
          </TouchableOpacity>
        ),
      )}
    </View>
  );

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + 8,
          paddingBottom: Math.max(insets.bottom, 24) + 8,
        },
      ]}
    >
      {/* Top bar — the Represent mark */}
      <View style={styles.topBar}>
        <Animated.View entering={FadeIn.duration(500)} style={styles.brandRow}>
          <Image source={require('../assets/logo.png')} style={styles.logo} resizeMode="cover" />
          <Text style={[styles.brandText, { color: colors.gold }]}>REPRESENT</Text>
        </Animated.View>
      </View>

      {/* Step chrome — 40px circular back + mono STEP label, 2-segment bar */}
      <View style={styles.stepChrome}>
        <View style={styles.stepRow}>
          {step === 2 ? (
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setStep(1);
              }}
              style={[styles.backBtn, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Back to region step"
            >
              <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : (
            <View style={styles.backBtnPlaceholder} />
          )}
          <Text style={[styles.stepLabel, { color: colors.textTertiary }]}>STEP {step} OF 2</Text>
        </View>
        <View style={styles.progressRow}>
          <View style={[styles.progressSeg, { backgroundColor: colors.goldFill }]} />
          <View
            style={[
              styles.progressSeg,
              { backgroundColor: step === 2 ? colors.goldFill : colors.surfaceHighlight },
            ]}
          />
        </View>
      </View>

      {step === 1 ? (
        // ═══════════ STEP 1 · REGION (a1–a4) ═══════════
        <Animated.View key="step-region" entering={FadeIn.duration(240)} style={styles.stepBody}>
          <ScrollView
            style={styles.stepScroll}
            contentContainerStyle={styles.stepContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Animated.Text
              entering={FadeInDown.duration(350)}
              style={[styles.headline, { color: colors.text }]}
            >
              Where should we look for your ballots?
            </Animated.Text>

            {!province ? (
              // a1 · nothing selected — country + province sections
              <>
                <View style={styles.section}>
                  <Text style={[styles.eyebrow, { color: colors.textTertiary }]}>COUNTRY</Text>
                  <View style={styles.countryRow}>
                    {renderSelectedChip(COUNTRY)}
                    <Text style={[styles.countryCaption, { color: colors.textTertiary }]}>
                      detected from your device
                    </Text>
                  </View>
                </View>
                {provinceList.length > 0 && (
                  <View style={styles.section}>
                    <Text style={[styles.eyebrow, { color: colors.textTertiary }]}>
                      PROVINCE OR TERRITORY
                    </Text>
                    {renderProvinceChips()}
                  </View>
                )}
              </>
            ) : !city ? (
              // a2 · province selected — province chips + optional city type-ahead
              <>
                <View style={styles.section}>
                  <Text style={[styles.eyebrow, { color: colors.textTertiary }]}>
                    PROVINCE OR TERRITORY
                  </Text>
                  {renderProvinceChips()}
                </View>
                <View style={styles.section}>
                  <Text style={[styles.eyebrow, { color: colors.textTertiary }]}>
                    CITY <Text style={styles.eyebrowLight}>· optional</Text>
                  </Text>
                  <View
                    style={[styles.cityInput, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  >
                    <Ionicons name="search-outline" size={16} color={colors.textTertiary} />
                    <TextInput
                      style={[
                        styles.cityInputField,
                        {
                          color: colors.text,
                          // Mock: serif-italic placeholder, sans once typing.
                          fontFamily: cityQuery ? FONTS.sansMedium : FONTS.serifItalic,
                        },
                      ]}
                      placeholder="Search cities with open ballots…"
                      placeholderTextColor={colors.textTertiary}
                      value={cityQuery}
                      onChangeText={setCityQuery}
                      autoCorrect={false}
                      accessibilityLabel="Search cities with open ballots"
                    />
                  </View>
                  {citySuggestions.length > 0 && (
                    <View
                      style={[styles.suggestCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
                    >
                      {citySuggestions.map((c, i) => (
                        <TouchableOpacity
                          key={c.name}
                          onPress={() => selectCity(c.name)}
                          style={[
                            styles.suggestRow,
                            i < citySuggestions.length - 1 && {
                              borderBottomWidth: 1,
                              borderBottomColor: colors.borderSubtle,
                            },
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={`${c.name}, ${c.count} open ballots`}
                        >
                          <Text style={[styles.suggestName, { color: colors.textSecondary }]}>{c.name}</Text>
                          <Text style={[styles.suggestCount, { color: colors.textTertiary }]}>
                            {c.count} OPEN
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              </>
            ) : !zeroBallotCity ? (
              // a3 · province + city — YOUR REGION with the committed input
              <View style={styles.section}>
                <Text style={[styles.eyebrow, { color: colors.textTertiary }]}>YOUR REGION</Text>
                <View style={styles.chipsWrap}>
                  {renderSelectedChip(COUNTRY)}
                  {renderSelectedChip(province, () => toggleProvince(province))}
                </View>
                <View style={[styles.cityInput, { backgroundColor: colors.surface, borderColor: GOLD_BORDER, borderWidth: 1.5 }]}>
                  <Ionicons name="location-outline" size={16} color={colors.gold} />
                  <Text style={[styles.cityCommittedName, { color: colors.text }]} numberOfLines={1}>
                    {city}
                  </Text>
                  <Text style={[styles.cityCommittedCount, { color: colors.textTertiary }]}>
                    {cityMunicipalCount} MUNICIPAL
                  </Text>
                  <TouchableOpacity
                    onPress={clearCity}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityRole="button"
                    accessibilityLabel={`Clear ${city}`}
                  >
                    <Ionicons name="close" size={15} color={colors.textTertiary} />
                  </TouchableOpacity>
                </View>
                {otherCities.length > 0 && (
                  <View
                    style={[styles.suggestCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
                  >
                    {otherCities.map((c, i) => (
                      <TouchableOpacity
                        key={c.name}
                        onPress={() => selectCity(c.name)}
                        style={[
                          styles.suggestRow,
                          i < otherCities.length - 1 && {
                            borderBottomWidth: 1,
                            borderBottomColor: colors.borderSubtle,
                          },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`Switch to ${c.name}, ${c.count} open ballots`}
                      >
                        <Text style={[styles.suggestName, { color: colors.textSecondary }]}>{c.name}</Text>
                        <Text style={[styles.suggestCount, { color: colors.textTertiary }]}>
                          {c.count} OPEN
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            ) : (
              // a4 · zero-ballot city — the city collapses to a removable chip
              <View style={styles.section}>
                <Text style={[styles.eyebrow, { color: colors.textTertiary }]}>YOUR REGION</Text>
                <View style={styles.chipsWrap}>
                  {renderSelectedChip(province, () => toggleProvince(province))}
                  <TouchableOpacity
                    onPress={clearCity}
                    activeOpacity={0.8}
                    style={[styles.chipNeutral, { backgroundColor: colors.surfaceHighlight }]}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${city}`}
                  >
                    <Text style={[styles.chipNeutralText, { color: colors.text }]}>{city}</Text>
                    <Ionicons name="close" size={12} color={colors.textTertiary} />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* THE PAYOFF — giant gold mono count, live-updating */}
            <View style={styles.payoff}>
              {!loaded ? (
                <ActivityIndicator size="small" color={colors.gold} />
              ) : zeroBallotCity ? (
                // a4 · honest, not apologetic
                <View style={styles.zeroBlock}>
                  <View style={styles.zeroCopy}>
                    <Text style={[styles.zeroTitle, { color: colors.text }]}>
                      No open ballots in {city} yet.
                    </Text>
                    <Text style={[styles.zeroSub, { color: colors.textSecondary }]}>
                      You'll watch {province} and {COUNTRY} instead — and {city}'s first ballot will
                      find you.
                    </Text>
                  </View>
                  <View style={styles.zeroCount}>
                    <Text style={[styles.payoffCountSmall, { color: colors.gold }]}>
                      {provinceScopeCount}
                    </Text>
                    <Text style={[styles.payoffCaptionSmall, { color: colors.gold }]}>
                      OPEN BALLOTS IN YOUR SCOPE
                    </Text>
                    <Text style={[styles.payoffBreakdown, { color: colors.textTertiary }]}>
                      {breakdownParts.join(' · ')}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.bellPill, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
                    onPress={commitRegion}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={`Tell me when ${city}'s first ballot opens`}
                  >
                    <Ionicons name="notifications-outline" size={15} color={colors.textSecondary} />
                    <Text style={[styles.bellPillText, { color: colors.textSecondary }]}>
                      Tell me when {city}'s first ballot opens
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <Text
                    style={[
                      styles.payoffCount,
                      { color: colors.gold, fontSize: city ? 64 : province ? 56 : 42, lineHeight: city ? 68 : province ? 60 : 46 },
                    ]}
                  >
                    {payoffCount}
                  </Text>
                  <Text style={[styles.payoffCaption, { color: colors.gold }]}>
                    {city
                      ? `OPEN BALLOTS IN ${city.toUpperCase()}`
                      : province
                        ? `OPEN BALLOTS IN ${province.toUpperCase()}`
                        : `OPEN BALLOTS ACROSS ${COUNTRY.toUpperCase()}`}
                  </Text>
                  <Text style={[styles.payoffBreakdown, { color: colors.textTertiary }]}>
                    {city
                      ? breakdownParts.join(' · ')
                      : province
                        ? `${breakdownParts.join(' · ')} — add a city for municipal ballots`
                        : 'pick a province to see yours'}
                  </Text>
                </>
              )}
            </View>

            {/* Trust line */}
            <Text style={[styles.trustLine, { color: colors.textTertiary }]}>
              This points your feed only. Where your ballot counts is set by your verified ID — not
              by choice.
            </Text>

            {/* CTA — Continue goes gold once a province is picked (a1 note) */}
            <View style={styles.ctaBlock}>
              <TouchableOpacity
                onPress={commitRegion}
                disabled={!canContinue}
                activeOpacity={0.9}
                style={[
                  styles.primaryButton,
                  { backgroundColor: canContinue ? colors.goldFill : colors.surfaceHighlight },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Continue"
                accessibilityState={{ disabled: !canContinue }}
              >
                <Text style={[styles.primaryButtonText, !canContinue && { color: colors.textTertiary }]}>
                  Continue
                </Text>
              </TouchableOpacity>
              {/* Skip collapses once a region is committed (a3 note) */}
              {!city && (
                <TouchableOpacity
                  onPress={skipRegion}
                  activeOpacity={0.7}
                  style={styles.ghostButton}
                  accessibilityRole="button"
                  accessibilityLabel="Skip and browse everything"
                >
                  <Text style={[styles.ghostButtonText, { color: colors.textSecondary }]}>
                    I'll browse everything →
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </Animated.View>
      ) : (
        // ═══════════ STEP 2 · NOTIFICATIONS (b1/b2) ═══════════
        <Animated.View key="step-notify" entering={FadeIn.duration(240)} style={styles.stepBody}>
          <ScrollView
            style={styles.stepScroll}
            contentContainerStyle={styles.stepContent}
            showsVerticalScrollIndicator={false}
          >
            <Animated.View entering={FadeInDown.duration(350)}>
              <View style={[styles.bellTile, { backgroundColor: colors.goldSurface, borderColor: GOLD_BORDER_SOFT }]}>
                <Ionicons name="notifications-outline" size={28} color={colors.gold} />
              </View>
            </Animated.View>

            <Text style={[styles.notifyHeadline, { color: colors.text }]}>
              {notifyPlace
                ? `Know the moment a ballot opens in ${notifyPlace}.`
                : 'Know the moment a ballot opens in your scope.'}
            </Text>

            {/* Skipped-location variant explains where scope comes from (b2) */}
            {!notifyPlace && (
              <Text style={[styles.notifySub, { color: colors.textSecondary }]}>
                Once you verify, your scope is set by your residence — we'll only ever notify you
                about ballots you can actually cast or watch.
              </Text>
            )}

            {/* Per-type toggles — same visual pattern + storage as
                app/modals/notifications.tsx */}
            <View style={[styles.prefsCard, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}>
              {toggleRows.map((row, i) => (
                <View
                  key={row.key}
                  style={[
                    styles.prefRow,
                    i < toggleRows.length - 1 && {
                      borderBottomWidth: 1,
                      borderBottomColor: colors.borderSubtle,
                    },
                  ]}
                >
                  <View style={styles.prefText}>
                    <Text style={[styles.prefTitle, { color: colors.text }]}>{row.title}</Text>
                    <Text style={[styles.prefDescription, { color: colors.textTertiary }]}>
                      {row.description}
                    </Text>
                  </View>
                  <Switch
                    value={prefs[row.key]}
                    onValueChange={() => togglePref(row.key)}
                    trackColor={{ false: colors.surfaceHighlight, true: colors.goldFill }}
                    thumbColor={prefs[row.key] ? colors.black : colors.textTertiary}
                    ios_backgroundColor={colors.surfaceHighlight}
                    accessibilityLabel={`${row.title} notifications`}
                  />
                </View>
              ))}
            </View>

            <Text style={[styles.notifyFooter, { color: colors.textTertiary }]}>
              Never promotional. Never persuasion. Change anytime.
            </Text>
          </ScrollView>

          {/* Primary gold CTA gates the one-shot system dialog (b1/b2) */}
          <View style={[styles.ctaBlock, styles.ctaBlockPinned]}>
            <TouchableOpacity
              onPress={handleEnableNotifications}
              activeOpacity={0.9}
              style={[styles.primaryButton, { backgroundColor: colors.goldFill }]}
              accessibilityRole="button"
              accessibilityLabel="Enable notifications"
            >
              <Text style={styles.primaryButtonText}>Enable Notifications</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleNotNow}
              activeOpacity={0.7}
              style={styles.ghostButton}
              accessibilityRole="button"
              accessibilityLabel="Not now"
            >
              <Text style={[styles.ghostButtonText, { color: colors.textSecondary }]}>Not now</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

export async function hasCompletedOnboarding(): Promise<boolean> {
  try {
    const status = await AsyncStorage.getItem(ONBOARDING_KEY);
    return status === 'completed';
  } catch (e) {
    console.error('Error checking onboarding status:', e);
    return false;
  }
}

export async function resetOnboarding(): Promise<void> {
  try {
    await AsyncStorage.removeItem(ONBOARDING_KEY);
  } catch (e) {
    console.error('Error resetting onboarding:', e);
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    minHeight: 40,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logo: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  brandText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
    letterSpacing: 1.98, // .18em
  },
  // Step chrome — back circle + STEP X OF 2 + segmented progress (a1/a3)
  stepChrome: {
    paddingHorizontal: 28,
    paddingTop: 8,
    gap: 18,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnPlaceholder: {
    width: 40,
    height: 40,
  },
  stepLabel: {
    fontFamily: FONTS.mono,
    fontSize: 10.5,
    letterSpacing: 1.68, // .16em
    fontVariant: ['tabular-nums'],
  },
  progressRow: {
    flexDirection: 'row',
    gap: 6,
  },
  progressSeg: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  stepBody: {
    flex: 1,
  },
  stepScroll: {
    flex: 1,
  },
  stepContent: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 18,
    gap: 18,
  },
  // Serif 34 headline (mock a1)
  headline: {
    fontFamily: FONTS.serif,
    fontSize: 34,
    lineHeight: 39, // 1.14
    letterSpacing: -0.41, // -.012em
  },
  section: {
    gap: 8,
  },
  eyebrow: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 10.5,
    letterSpacing: 1.47, // .14em
  },
  eyebrowLight: {
    fontFamily: FONTS.sans,
    letterSpacing: 0,
  },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countryCaption: {
    fontFamily: FONTS.sans,
    fontSize: 11,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 100,
    borderWidth: 1,
  },
  chipText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 13.5,
  },
  chipSelected: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 100,
    borderWidth: 1.5,
  },
  chipSelectedText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 13.5,
  },
  chipNeutral: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 100,
  },
  chipNeutralText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 13.5,
  },
  // City type-ahead — 52px, radius 15; gold border once committed
  cityInput: {
    height: 52,
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 16,
  },
  cityInputField: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  cityCommittedName: {
    flex: 1,
    fontFamily: FONTS.sansMedium,
    fontSize: 15.5,
  },
  cityCommittedCount: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  suggestCard: {
    borderRadius: 15,
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 16,
  },
  suggestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 11,
  },
  suggestName: {
    fontFamily: FONTS.sansMedium,
    fontSize: 13.5,
  },
  suggestCount: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  // THE PAYOFF — centered in the remaining space
  payoff: {
    flex: 1,
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  payoffCount: {
    fontFamily: FONTS.monoSemiBold,
    letterSpacing: -0.5, // -.01em
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  payoffCaption: {
    fontFamily: FONTS.monoSemiBold,
    fontSize: 13,
    letterSpacing: 2.6, // .2em
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  payoffBreakdown: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    textAlign: 'center',
  },
  payoffCountSmall: {
    fontFamily: FONTS.monoSemiBold,
    fontSize: 42,
    lineHeight: 46,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  payoffCaptionSmall: {
    fontFamily: FONTS.monoSemiBold,
    fontSize: 12,
    letterSpacing: 2.4, // .2em
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  // a4 · zero-ballot honest state
  zeroBlock: {
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 6,
  },
  zeroCopy: {
    gap: 8,
  },
  zeroTitle: {
    fontFamily: FONTS.serif,
    fontSize: 26,
    lineHeight: 34, // 1.3
    textAlign: 'center',
  },
  zeroSub: {
    fontFamily: FONTS.sans,
    fontSize: 14.5,
    lineHeight: 22, // 1.55
    textAlign: 'center',
  },
  zeroCount: {
    alignItems: 'center',
    gap: 6,
  },
  bellPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    alignSelf: 'stretch',
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1,
  },
  bellPillText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 13,
  },
  trustLine: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    lineHeight: 17, // 1.55
    textAlign: 'center',
  },
  ctaBlock: {
    gap: 10,
  },
  // Step 2's CTA block is pinned below the scroll area, outside the padded
  // content container — it carries its own horizontal padding.
  ctaBlockPinned: {
    paddingHorizontal: 28,
    paddingTop: 12,
  },
  primaryButton: {
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 17,
    color: '#040707',
  },
  ghostButton: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostButtonText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 14.5,
  },
  // Step 2 · notifications
  bellTile: {
    width: 64,
    height: 64,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifyHeadline: {
    fontFamily: FONTS.serif,
    fontSize: 33,
    lineHeight: 38, // 1.16
    letterSpacing: -0.4, // -.012em
  },
  notifySub: {
    fontFamily: FONTS.sans,
    fontSize: 14,
    lineHeight: 22, // 1.55
    marginTop: -6,
  },
  prefsCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 4,
    paddingHorizontal: 16,
  },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    paddingVertical: 13,
  },
  prefText: {
    flex: 1,
    gap: 1,
  },
  prefTitle: {
    fontFamily: FONTS.sansMedium,
    fontSize: 14,
    lineHeight: 19,
  },
  prefDescription: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    lineHeight: 15,
  },
  notifyFooter: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    textAlign: 'center',
  },
});
