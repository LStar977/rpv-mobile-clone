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
// W3 ambient glow — the mock's radial-gradient behind the mark, approximated
// with concentric circles (RN has no radial gradients). Sits behind content.
// ═══════════════════════════════════════════════════════════════════════════════
function GoldGlow() {
  const { isDark } = useTheme();
  // Light theme uses the deeper #C99A38 at slightly higher alpha per the mock.
  const rgb = isDark ? '234, 186, 88' : '201, 154, 56';
  const rings: Array<[number, number]> = isDark
    ? [[480, 0.03], [340, 0.035], [220, 0.04], [140, 0.05]]
    : [[480, 0.035], [340, 0.04], [220, 0.05], [140, 0.06]];
  return (
    <View pointerEvents="none" style={styles.glowWrap}>
      {rings.map(([size, alpha]) => (
        <View
          key={size}
          style={{
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: `rgba(${rgb}, ${alpha})`,
          }}
        />
      ))}
    </View>
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
      router.replace('/(tabs)/proposals');
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
        router.replace('/(tabs)/proposals');
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
        router.replace('/(tabs)/proposals');
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
        router.replace('/(tabs)/proposals');
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
      router.replace('/(tabs)/proposals');
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
        router.replace('/(tabs)/proposals');
      } else {
        haptics.error();
        Alert.alert('Demo Login Failed', 'Could not authenticate demo account.');
      }

      setDemoLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // WELCOME — W3 "simple cut": wordmark, big mark in a gold glow, one serif
  // line, Create Account (the gold moment) / Sign In. Single screen — no
  // carousel, no Skip. Static composition, so reduced motion needs nothing.
  // ─────────────────────────────────────────────────────────────────────────────
  if (view === 'welcome') {
    return (
      <View
        style={[
          styles.container,
          styles.welcomeScreen,
          { backgroundColor: colors.background, paddingTop: insets.top + 24, paddingBottom: Math.max(insets.bottom, 24) + 16 },
        ]}
      >
        <GoldGlow />

        <Text style={[styles.wordmark, { color: colors.gold }]}>REPRESENT</Text>

        <View style={styles.welcomeCenter}>
          {/* Mark — 5 taps triggers the hidden demo account entry */}
          <Animated.View entering={FadeIn.duration(500)}>
            <TouchableOpacity
              onPress={handleLogoTap}
              activeOpacity={1}
              disabled={demoLoading}
              accessibilityLabel="Represent"
            >
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
            entering={FadeInDown.delay(120).duration(500)}
            style={[styles.welcomeDisplay, { color: colors.text }]}
          >
            Your voice beyond the ballot box.
          </Animated.Text>

          {/* Biometric quick sign-in (only when a stored session exists) */}
          {biometricAvailable && (
            <Animated.View entering={FadeInDown.delay(240).duration(500)}>
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

        <Animated.View entering={FadeInUp.delay(200).duration(500)} style={styles.welcomeActions}>
          <TouchableOpacity
            onPress={() => {
              haptics.light();
              setView('signup');
            }}
            activeOpacity={0.85}
            accessibilityRole="button"
            style={[styles.welcomeCta, { backgroundColor: colors.goldFill }]}
          >
            <Text style={styles.welcomeCtaText}>Create Account</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              haptics.light();
              setView('login');
            }}
            activeOpacity={0.85}
            accessibilityRole="button"
            style={[styles.welcomeCta, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}
          >
            <Text style={[styles.welcomeCtaText, { color: colors.text }]}>Sign In</Text>
          </TouchableOpacity>
          <Text style={[styles.welcomeFooter, { color: colors.textTertiary }]}>
            <Text
              style={[styles.welcomeFooterLink, { color: colors.textSecondary }]}
              onPress={() => Linking.openURL('https://representportal.com/terms')}
            >
              Terms
            </Text>
            {'  ·  '}
            <Text
              style={[styles.welcomeFooterLink, { color: colors.textSecondary }]}
              onPress={() => Linking.openURL('https://representportal.com/privacy')}
            >
              Privacy
            </Text>
          </Text>
        </Animated.View>
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

  // ── Welcome (W3 · simple cut) ────────────────────────────────────────────────
  welcomeScreen: {
    paddingHorizontal: 32, // mock: 32px gutters
  },
  glowWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    // Mock centers the glow slightly above true center (translate -58%).
    paddingBottom: 120,
  },
  wordmark: {
    textAlign: 'center',
    fontFamily: FONTS.sansSemiBold,
    fontSize: 13,
    letterSpacing: 3.9, // .3em
  },
  welcomeCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 36,
  },
  welcomeLogo: {
    width: 170,
    height: 170,
    borderRadius: 85,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    // Mock: 0 24px 70px black + a gold bloom (the bloom comes from GoldGlow).
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.6,
    shadowRadius: 35,
    elevation: 16,
  },
  welcomeLogoImage: {
    width: 170,
    height: 170,
    borderRadius: 85,
  },
  welcomeDisplay: {
    fontFamily: FONTS.serif,
    fontSize: 34,
    lineHeight: 41, // 1.2
    letterSpacing: -0.41, // -.012em
    textAlign: 'center',
    maxWidth: 280,
  },
  biometricRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  welcomeActions: {
    gap: 10,
  },
  welcomeCta: {
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeCtaText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 16.5,
    color: '#040707',
  },
  welcomeFooter: {
    marginTop: 6,
    textAlign: 'center',
    fontFamily: FONTS.sans,
    fontSize: 11.5,
    lineHeight: 18,
  },
  welcomeFooterLink: {
    textDecorationLine: 'underline',
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
