import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, SPACING, RADIUS, EASING, FONTS } from '../lib/theme';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useAuthStore } from '../lib/auth';
import { referralsApi } from '../lib/api';
import { router, useRootNavigationState } from 'expo-router';
import { isBiometricAvailable, getBiometricType, authenticateWithBiometrics, isBiometricEnabled } from '../lib/biometrics';
import { Button, Input } from '../components/ui';
import { haptics } from '../lib/haptics';

GoogleSignin.configure({
  iosClientId: '945878560232-blus90hj4nqh6h32msts24971t72f8g7.apps.googleusercontent.com',
  webClientId: '945878560232-8ot8f3lr62436nlrm9qas82aras59koi.apps.googleusercontent.com',
  offlineAccess: true,
});

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

// ═══════════════════════════════════════════════════════════════════════════════
// Welcome page dots — active is a 22×6 gold pill, inactive 6×6 surface dots.
// ═══════════════════════════════════════════════════════════════════════════════
function PageDots({ count, index }: { count: number; index: number }) {
  const { colors } = useTheme();
  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            {
              width: i === index ? 22 : 6,
              backgroundColor: i === index ? colors.goldFill : colors.surfaceHighlight,
            },
          ]}
        />
      ))}
    </View>
  );
}

// Welcome page 2 — feature row: gold-surface icon tile + title + body.
function FeatureRow({
  icon,
  title,
  body,
  delay,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  delay: number;
}) {
  const { colors } = useTheme();
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(400)} style={styles.featureRow}>
      <View style={[styles.featureIconTile, { backgroundColor: colors.goldSurface }]}>
        <Ionicons name={icon} size={20} color={colors.gold} />
      </View>
      <View style={styles.featureRowText}>
        <Text style={[styles.featureRowTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.featureRowBody, { color: colors.textSecondary }]}>{body}</Text>
      </View>
    </Animated.View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Full-width social sign-in buttons per mock 02 — Apple: solid on-theme fill,
// Google: surface with hairline border. Loading/disabled logic preserved.
// ═══════════════════════════════════════════════════════════════════════════════
function SocialButton({
  provider,
  onPress,
  disabled,
  loading,
}: {
  provider: 'google' | 'apple';
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    if (!disabled) {
      haptics.light();
      scale.value = withSpring(0.97, EASING.springSnappy);
    }
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, EASING.springSnappy);
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const isGoogle = provider === 'google';
  // Apple button inverts the theme (light button on dark, dark on light);
  // Google is a bordered surface — both hold in either theme.
  const bgColor = isGoogle ? colors.surface : colors.text;
  const textColor = isGoogle ? colors.text : colors.background;

  return (
    <AnimatedTouchable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      activeOpacity={1}
      accessibilityRole="button"
      accessibilityLabel={isGoogle ? 'Continue with Google' : 'Continue with Apple'}
      style={[
        styles.socialButton,
        {
          backgroundColor: bgColor,
          borderColor: isGoogle ? colors.border : 'transparent',
          borderWidth: isGoogle ? 1 : 0,
          opacity: disabled ? 0.5 : 1,
        },
        animatedStyle,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <>
          <Ionicons name={isGoogle ? 'logo-google' : 'logo-apple'} size={18} color={textColor} />
          <Text style={[styles.socialButtonText, { color: textColor }]}>
            {isGoogle ? 'Continue with Google' : 'Continue with Apple'}
          </Text>
        </>
      )}
    </AnimatedTouchable>
  );
}

export default function AuthScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<'welcome' | 'login' | 'signup'>('welcome');
  const [welcomePage, setWelcomePage] = useState<0 | 1>(0);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState('Biometric');
  const [demoLoading, setDemoLoading] = useState(false);
  const demoTapCount = useRef(0);
  const demoTapTimeout = useRef<NodeJS.Timeout | null>(null);
  const { login, emailLogin, demoLogin, isAuthenticated, checkAuth } = useAuthStore();

  // Check biometric availability
  useEffect(() => {
    AppleAuthentication.isAvailableAsync().then(setAppleAvailable);

    const checkBiometric = async () => {
      const available = await isBiometricAvailable();
      const enabled = await isBiometricEnabled();

      if (available && enabled) {
        await checkAuth();
        const hasStoredSession = useAuthStore.getState().token !== null;
        setBiometricAvailable(hasStoredSession);
      } else {
        setBiometricAvailable(false);
      }

      if (available) {
        const type = await getBiometricType();
        setBiometricType(type);
      }
    };
    checkBiometric();
  }, []);

  // Redirect when authenticated. Gate on navigation root being mounted —
  // hydrate() can fire setState synchronously during the initial mount,
  // which fires this effect before Expo Router's nav tree is ready.
  const rootNavState = useRootNavigationState();
  useEffect(() => {
    if (!rootNavState?.key) return;
    if (isAuthenticated) {
      router.replace('/(tabs)/dashboard');
    }
  }, [isAuthenticated, rootNavState?.key]);

  // While authenticated, render nothing — the effect above is replacing
  // the route. Without this guard the sign-in UI flashes for one frame
  // on cold start when SecureStore-cached credentials are valid.
  if (isAuthenticated) {
    return null;
  }

  const handleBiometricLogin = async () => {
    const result = await authenticateWithBiometrics(`Use ${biometricType} to sign in`);
    if (result.success) {
      haptics.success();
      await checkAuth();
      if (useAuthStore.getState().isAuthenticated) {
        router.replace('/(tabs)/dashboard');
      } else {
        haptics.error();
        Alert.alert('Session Expired', 'Please sign in again.');
      }
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const tokens = await GoogleSignin.getTokens();

      const userData = (userInfo as any).data?.user || (userInfo as any).user;
      const success = await login('google', tokens.accessToken, {
        email: userData?.email || '',
        name: userData?.name || '',
        profileImageUrl: userData?.photo || '',
      });

      if (success) {
        haptics.success();
        router.replace('/(tabs)/dashboard');
      } else {
        haptics.error();
        Alert.alert('Login Failed', 'Could not authenticate. Please try again.');
      }
    } catch (err: any) {
      if (err.code === statusCodes.SIGN_IN_CANCELLED) {
        // User cancelled
      } else if (err.code === statusCodes.IN_PROGRESS) {
        haptics.warning();
        Alert.alert('Please wait', 'Sign in is already in progress');
      } else {
        haptics.error();
        Alert.alert('Error', err.message || 'Failed to sign in with Google');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleAppleLogin = async () => {
    setAppleLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      const fullName = credential.fullName
        ? `${credential.fullName.givenName || ''} ${credential.fullName.familyName || ''}`.trim()
        : null;

      const success = await login('apple', credential.identityToken || '', {
        id: credential.user,
        email: credential.email || undefined,
        name: fullName || undefined,
      });

      if (success) {
        haptics.success();
        router.replace('/(tabs)/dashboard');
      } else {
        haptics.error();
        Alert.alert('Login Failed', 'Could not authenticate. Please try again.');
      }
    } catch (err: any) {
      if (err.code !== 'ERR_REQUEST_CANCELED') {
        haptics.error();
        Alert.alert('Error', 'An error occurred during Apple sign in');
      }
    } finally {
      setAppleLoading(false);
    }
  };

  const handleEmailAuth = async () => {
    if (!email || !password || (view === 'signup' && !name)) {
      setError('Please fill in all fields');
      haptics.warning();
      return;
    }
    if (view === 'signup' && !acceptedTerms) {
      setError('Please accept the Terms and Privacy Policy to continue.');
      haptics.warning();
      return;
    }
    setError('');
    setIsLoading(true);

    const isSignup = view === 'signup';
    const result = await emailLogin(email, password, isSignup ? name : undefined, isSignup);

    setIsLoading(false);

    if (result.success) {
      haptics.success();
      // Record the referral after auth (the redeem endpoint needs the new
      // user's token). Fire-and-forget — a bad/missing code must never
      // block account creation.
      if (isSignup && referralCode.trim()) {
        referralsApi.redeem(referralCode).catch(() => {});
      }
      router.replace('/(tabs)/dashboard');
    } else {
      haptics.error();
      setError(result.error || 'Authentication failed. Please try again.');
    }
  };

  // Request a password-reset email. The reset itself happens on the web
  // (representportal.com serves the reset form from the emailed link), so
  // the app only needs to kick off the request. Always shows the same
  // confirmation regardless of whether the account exists — never confirm
  // or deny an email's existence.
  const handleForgotPassword = async () => {
    const target = email.trim();
    if (!target || !target.includes('@')) {
      setError('Enter your email above first, then tap "Forgot password?"');
      haptics.warning();
      return;
    }
    haptics.selection();
    try {
      await fetch('https://representportal.com/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: target }),
      });
    } catch {
      // Deliberately silent — same UX either way.
    }
    Alert.alert(
      'Check your email',
      `If an account exists for ${target}, we've sent a link to reset your password. The link expires in 1 hour.`,
    );
  };

  // Hidden demo login trigger - 5 taps on logo
  const handleLogoTap = async () => {
    demoTapCount.current += 1;

    // Clear existing timeout
    if (demoTapTimeout.current) {
      clearTimeout(demoTapTimeout.current);
    }

    // Reset tap count after 2 seconds of no taps
    demoTapTimeout.current = setTimeout(() => {
      demoTapCount.current = 0;
    }, 2000);

    // Trigger demo login on 5th tap
    if (demoTapCount.current >= 5) {
      demoTapCount.current = 0;
      if (demoTapTimeout.current) {
        clearTimeout(demoTapTimeout.current);
      }

      setDemoLoading(true);
      haptics.medium();

      const success = await demoLogin();

      if (success) {
        haptics.success();
        router.replace('/(tabs)/dashboard');
      } else {
        haptics.error();
        Alert.alert('Demo Login Failed', 'Could not authenticate demo account.');
      }

      setDemoLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // WELCOME — mocks 01a / 01b
  // ─────────────────────────────────────────────────────────────────────────────
  if (view === 'welcome') {
    return (
      <View
        style={[
          styles.container,
          styles.welcomeScreen,
          { backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 24) + 16 },
        ]}
      >
        {welcomePage === 0 ? (
          <View key="w0" style={styles.welcomeBody}>
            <View style={styles.welcomeHero}>
              {/* Logo — 5 taps triggers the hidden demo account entry */}
              <Animated.View entering={FadeInDown.duration(500)}>
                <TouchableOpacity onPress={handleLogoTap} activeOpacity={1} disabled={demoLoading}>
                  <View style={[styles.welcomeLogo, { backgroundColor: colors.surface }]}>
                    {demoLoading ? (
                      <ActivityIndicator size="large" color={colors.gold} />
                    ) : (
                      <Image
                        source={require('../assets/logo.png')}
                        style={styles.welcomeLogoImage}
                        resizeMode="cover"
                      />
                    )}
                  </View>
                </TouchableOpacity>
              </Animated.View>

              <Animated.Text
                entering={FadeInDown.delay(80).duration(500)}
                style={[styles.eyebrow, { color: colors.gold }]}
              >
                REPRESENT
              </Animated.Text>

              <Animated.Text
                entering={FadeInDown.delay(160).duration(500)}
                style={[styles.welcomeDisplay, { color: colors.text }]}
              >
                Your verified voice, on the record.
              </Animated.Text>

              <Animated.Text
                entering={FadeInDown.delay(240).duration(500)}
                style={[styles.welcomeBodyText, { color: colors.textSecondary }]}
              >
                Verify once with your government ID. Vote on the issues that govern your street,
                your city, your province — and watch the real count.
              </Animated.Text>

              {/* Biometric quick sign-in (only when a stored session exists) */}
              {biometricAvailable && (
                <Animated.View entering={FadeInDown.delay(320).duration(500)}>
                  <TouchableOpacity
                    onPress={handleBiometricLogin}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={`Sign in with ${biometricType}`}
                    style={[styles.biometricRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  >
                    <Ionicons
                      name={biometricType === 'Face ID' ? 'scan-outline' : 'finger-print-outline'}
                      size={18}
                      color={colors.gold}
                    />
                    <Text style={[styles.biometricRowText, { color: colors.text }]}>
                      Sign in with {biometricType}
                    </Text>
                  </TouchableOpacity>
                </Animated.View>
              )}
            </View>

            <PageDots count={2} index={0} />

            <Animated.View entering={FadeInUp.delay(300).duration(500)} style={styles.welcomeActions}>
              <Button
                title="Get Started"
                onPress={() => {
                  haptics.light();
                  setWelcomePage(1);
                }}
                variant="primary"
                size="lg"
                fullWidth
              />
              <TouchableOpacity
                onPress={() => {
                  haptics.light();
                  setView('login');
                }}
                activeOpacity={0.7}
                style={styles.ghostAction}
                accessibilityRole="button"
              >
                <Text style={[styles.ghostActionText, { color: colors.textSecondary }]}>
                  I already have an account
                </Text>
              </TouchableOpacity>
            </Animated.View>

            <Text style={[styles.ledgerFootnote, { color: colors.textTertiary }]}>
              ONE PERSON · ONE BALLOT
            </Text>
          </View>
        ) : (
          <View key="w1" style={styles.welcomeBody}>
            <View style={styles.welcomeHero}>
              <Animated.Text
                entering={FadeInDown.duration(400)}
                style={[styles.eyebrow, { color: colors.gold }]}
              >
                THE PUBLIC RECORD
              </Animated.Text>

              <Animated.Text
                entering={FadeInDown.delay(80).duration(400)}
                style={[styles.welcomeDisplaySmall, { color: colors.text }]}
              >
                Every ballot counted. Every count checkable.
              </Animated.Text>

              <View style={styles.featureList}>
                <FeatureRow
                  icon="shield-checkmark-outline"
                  title="Verified identity"
                  body="Government ID, verified once. No bots, no duplicates, no guessing."
                  delay={160}
                />
                <FeatureRow
                  icon="checkmark-circle-outline"
                  title="One person, one ballot"
                  body="Every number you see is one verified citizen. Counted, not estimated."
                  delay={240}
                />
                <FeatureRow
                  icon="library-outline"
                  title="A public ledger"
                  body="Ballots are recorded on a tamper-evident public record anyone can audit."
                  delay={320}
                />
              </View>
            </View>

            <PageDots count={2} index={1} />

            <Animated.View entering={FadeInUp.delay(240).duration(500)} style={styles.welcomeActions}>
              <Button
                title="Continue"
                onPress={() => {
                  haptics.light();
                  setView('signup');
                }}
                variant="primary"
                size="lg"
                fullWidth
              />
              <TouchableOpacity
                onPress={() => {
                  haptics.light();
                  setView('signup');
                }}
                activeOpacity={0.7}
                style={styles.ghostAction}
                accessibilityRole="button"
              >
                <Text style={[styles.ghostActionText, { color: colors.textSecondary }]}>Skip</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        )}
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SIGN IN / SIGN UP — mock 02
  // ─────────────────────────────────────────────────────────────────────────────
  const isLogin = view === 'login';

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[styles.authContent, { paddingTop: insets.top + 8 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Back button */}
        <Animated.View entering={FadeIn.duration(300)}>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: colors.surface, borderColor: colors.borderSubtle }]}
            onPress={() => {
              haptics.light();
              setView('welcome');
              setError('');
            }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </Animated.View>

        {/* Header */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.authHeader}>
          <Text style={[styles.authTitle, { color: colors.text }]}>Welcome</Text>
          <Text style={[styles.authSubtitle, { color: colors.textSecondary }]}>
            Sign in or create your verified account.
          </Text>
        </Animated.View>

        {/* Sign Up / Log In segmented control */}
        <Animated.View
          entering={FadeInDown.delay(150).duration(400)}
          style={[styles.segmented, { backgroundColor: colors.backgroundSecondary, borderColor: colors.borderSubtle }]}
        >
          {(['signup', 'login'] as const).map((tab) => {
            const selected = view === tab;
            return (
              <TouchableOpacity
                key={tab}
                onPress={() => {
                  if (!selected) {
                    haptics.light();
                    setView(tab);
                    setError('');
                  }
                }}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[
                  styles.segmentedTab,
                  selected && { backgroundColor: colors.surfaceHighlight },
                ]}
              >
                <Text
                  style={[
                    selected ? styles.segmentedTabTextActive : styles.segmentedTabText,
                    { color: selected ? colors.text : colors.textTertiary },
                  ]}
                >
                  {tab === 'signup' ? 'Sign Up' : 'Log In'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </Animated.View>

        {/* Social sign-in */}
        <Animated.View entering={FadeInUp.delay(200).duration(400)} style={styles.socialButtons}>
          {Platform.OS === 'ios' && appleAvailable && (
            <SocialButton
              provider="apple"
              onPress={handleAppleLogin}
              disabled={googleLoading || appleLoading}
              loading={appleLoading}
            />
          )}
          <SocialButton
            provider="google"
            onPress={handleGoogleLogin}
            disabled={googleLoading || appleLoading}
            loading={googleLoading}
          />
        </Animated.View>

        {/* Divider */}
        <Animated.View entering={FadeIn.delay(250).duration(400)} style={styles.divider}>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          <Text style={[styles.dividerText, { color: colors.textTertiary }]}>or</Text>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        </Animated.View>

        {/* Form */}
        <Animated.View entering={FadeInUp.delay(300).duration(400)}>
          {error ? (
            <View style={[styles.errorBox, { backgroundColor: colors.errorSurface, borderColor: colors.error }]}>
              <Ionicons name="alert-circle" size={18} color={colors.error} />
              <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
            </View>
          ) : null}

          {!isLogin && (
            <Input
              placeholder="Full name"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              leftIcon="person-outline"
            />
          )}

          <Input
            placeholder="Email address"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            leftIcon="mail-outline"
          />

          <Input
            placeholder={isLogin ? 'Password' : 'Create a password'}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            leftIcon="lock-closed-outline"
          />

          {!isLogin && (
            <Input
              placeholder="Referral code (optional)"
              value={referralCode}
              onChangeText={(t) => setReferralCode(t.toUpperCase())}
              autoCapitalize="characters"
              autoCorrect={false}
              leftIcon="gift-outline"
            />
          )}

          {isLogin && (
            <TouchableOpacity
              onPress={handleForgotPassword}
              style={styles.forgotPassword}
              accessibilityRole="button"
              accessibilityLabel="Forgot password"
            >
              <Text style={[styles.forgotPasswordText, { color: colors.textSecondary }]}>
                Forgot password?
              </Text>
            </TouchableOpacity>
          )}

          {!isLogin && (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                haptics.selection();
                setAcceptedTerms((v) => !v);
              }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: acceptedTerms }}
              style={[styles.termsCard, { backgroundColor: colors.backgroundSecondary, borderColor: colors.borderSubtle }]}
            >
              <View
                style={[
                  styles.termsCheckbox,
                  {
                    borderColor: acceptedTerms ? colors.gold : colors.borderStrong,
                    backgroundColor: acceptedTerms ? colors.goldSurface : 'transparent',
                  },
                ]}
              >
                {acceptedTerms && <Ionicons name="checkmark" size={12} color={colors.gold} />}
              </View>
              <Text style={[styles.termsText, { color: colors.textSecondary }]}>
                I agree to the{' '}
                <Text
                  style={[styles.termsLink, { color: colors.gold }]}
                  onPress={() => Linking.openURL('https://representportal.com/terms')}
                >
                  Terms of Service
                </Text>
                {' '}and acknowledge the{' '}
                <Text
                  style={[styles.termsLink, { color: colors.gold }]}
                  onPress={() => Linking.openURL('https://representportal.com/privacy')}
                >
                  Privacy Policy
                </Text>
                .
              </Text>
            </TouchableOpacity>
          )}

          <Button
            title="Continue"
            onPress={handleEmailAuth}
            variant="primary"
            size="lg"
            fullWidth
            loading={isLoading}
            disabled={!isLogin && !acceptedTerms}
            style={{ marginTop: SPACING.sm }}
          />
        </Animated.View>

        {/* Legal footnote + trust line */}
        <Animated.View entering={FadeIn.delay(400).duration(400)} style={styles.authFooter}>
          <Text style={[styles.legalFootnote, { color: colors.textTertiary }]}>
            By continuing, you agree to our{' '}
            <Text
              style={[styles.termsLink, { color: colors.gold }]}
              onPress={() => {
                haptics.light();
                Linking.openURL('https://representportal.com/terms');
              }}
            >
              Terms of Service
            </Text>
            {' '}and{' '}
            <Text
              style={[styles.termsLink, { color: colors.gold }]}
              onPress={() => {
                haptics.light();
                Linking.openURL('https://representportal.com/privacy');
              }}
            >
              Privacy Policy
            </Text>
            .
          </Text>
          <Text style={[styles.ledgerFootnote, { color: colors.textTertiary }]}>
            VERIFIED CITIZENS · PUBLIC COUNT
          </Text>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // ── Welcome (01a / 01b) ──────────────────────────────────────────────────────
  welcomeScreen: {
    paddingHorizontal: SPACING.screenPadding + 6, // mock: 30px gutters
  },
  welcomeBody: {
    flex: 1,
  },
  welcomeHero: {
    flex: 1,
    justifyContent: 'center',
    gap: 22,
  },
  welcomeLogo: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  welcomeLogoImage: {
    width: 76,
    height: 76,
    borderRadius: 38,
  },
  eyebrow: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 11,
    letterSpacing: 1.98, // .18em
  },
  welcomeDisplay: {
    fontFamily: FONTS.serif,
    fontSize: 45,
    lineHeight: 49,
    letterSpacing: -0.54,
  },
  welcomeDisplaySmall: {
    fontFamily: FONTS.serif,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -0.48,
  },
  welcomeBodyText: {
    fontFamily: FONTS.sans,
    fontSize: 16,
    lineHeight: 25,
    maxWidth: 320,
  },
  biometricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 9,
    paddingHorizontal: 16,
    height: 44,
    borderRadius: RADIUS.chip,
    borderWidth: 1,
  },
  biometricRowText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 14,
  },
  featureList: {
    gap: 18,
    marginTop: 6,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  featureIconTile: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureRowText: {
    flex: 1,
    gap: 3,
  },
  featureRowTitle: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 15,
  },
  featureRowBody: {
    fontFamily: FONTS.sans,
    fontSize: 13.5,
    lineHeight: 20,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 7,
    marginBottom: 26,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  welcomeActions: {
    gap: 10,
  },
  ghostAction: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostActionText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 15,
  },
  ledgerFootnote: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 2.2, // .22em
    textAlign: 'center',
    marginTop: 14,
    fontVariant: ['tabular-nums'],
  },

  // ── Sign in / sign up (02) ───────────────────────────────────────────────────
  authContent: {
    flexGrow: 1,
    paddingHorizontal: SPACING.screenPadding + 6, // mock: 30px gutters
    paddingBottom: SPACING['3xl'],
    gap: 22,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  authHeader: {
    gap: 8,
  },
  authTitle: {
    fontFamily: FONTS.serif,
    fontSize: 38,
    lineHeight: 42,
    letterSpacing: -0.46,
  },
  authSubtitle: {
    fontFamily: FONTS.sans,
    fontSize: 15,
    lineHeight: 22,
  },
  segmented: {
    flexDirection: 'row',
    borderRadius: 13,
    borderWidth: 1,
    padding: 3,
  },
  segmentedTab: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentedTabText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 14,
  },
  segmentedTabTextActive: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 14,
  },
  socialButtons: {
    gap: 10,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    height: 54,
    borderRadius: 15,
  },
  socialButtonText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 16,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 12,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.input,
    borderWidth: 1,
    marginBottom: SPACING.lg,
  },
  errorText: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    lineHeight: 19,
    flex: 1,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginTop: -6,
    marginBottom: 10,
    paddingVertical: 4,
  },
  forgotPasswordText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 13.5,
  },
  termsCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 13,
    paddingHorizontal: 15,
    marginBottom: SPACING.sm,
  },
  termsCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  termsText: {
    fontFamily: FONTS.sans,
    fontSize: 12.5,
    lineHeight: 19,
    flex: 1,
  },
  termsLink: {
    textDecorationLine: 'underline',
  },
  authFooter: {
    marginTop: 'auto',
    gap: 14,
    paddingTop: SPACING.lg,
  },
  legalFootnote: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
  },
});
