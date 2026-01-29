import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, KeyboardAvoidingView, Platform, Image, Alert } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme, SPACING, FONT_SIZES, BORDER_RADIUS } from '../lib/theme';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useAuthStore } from '../lib/auth';
import { router } from 'expo-router';
import { isBiometricAvailable, getBiometricType, authenticateWithBiometrics, isBiometricEnabled } from '../lib/biometrics';

GoogleSignin.configure({
  iosClientId: '945878560232-blus90hj4nqh6h32msts24971t72f8g7.apps.googleusercontent.com',
  webClientId: '945878560232-8ot8f3lr62436nlrm9qas82aras59koi.apps.googleusercontent.com',
  offlineAccess: true,
});

export default function HomeScreen() {
  const { colors, isDark } = useTheme();
  const [view, setView] = useState<'welcome' | 'login' | 'signup'>('welcome');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState('Biometric');
  const { login, isAuthenticated, checkAuth } = useAuthStore();

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

  const handleBiometricLogin = async () => {
    const result = await authenticateWithBiometrics(`Use ${biometricType} to sign in`);
    if (result.success) {
      await checkAuth();
      if (useAuthStore.getState().isAuthenticated) {
        router.replace('/(tabs)/dashboard');
      } else {
        Alert.alert('Session Expired', 'Please sign in again with Google or Apple.');
      }
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/(tabs)/dashboard');
    }
  }, [isAuthenticated]);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      
      console.log('Google sign in success:', userInfo);
      
      const tokens = await GoogleSignin.getTokens();
      
      const success = await login('google', tokens.accessToken, {
        email: userInfo.data?.user?.email || '',
        name: userInfo.data?.user?.name || '',
        profileImageUrl: userInfo.data?.user?.photo || '',
      });

      if (success) {
        router.replace('/(tabs)/dashboard');
      } else {
        Alert.alert('Login Failed', 'Could not authenticate with the server. Please try again.');
      }
    } catch (err: any) {
      console.error('Google sign in error:', err);
      if (err.code === statusCodes.SIGN_IN_CANCELLED) {
        console.log('User cancelled');
      } else if (err.code === statusCodes.IN_PROGRESS) {
        Alert.alert('Please wait', 'Sign in is already in progress');
      } else if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert('Error', 'Play services not available');
      } else {
        Alert.alert('Error', err.message || 'Failed to sign in with Google');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleAppleLogin = async () => {
    setIsLoading(true);
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
        router.replace('/(tabs)/dashboard');
      } else {
        Alert.alert('Login Failed', 'Could not authenticate with the server. Please try again.');
      }
    } catch (err: any) {
      if (err.code === 'ERR_REQUEST_CANCELED') {
        console.log('User canceled Apple sign in');
      } else {
        console.error('Apple login error:', err);
        Alert.alert('Error', 'An error occurred during Apple sign in');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (view === 'welcome') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.welcomeContent}>
          <View style={[styles.logoContainer, { backgroundColor: isDark ? '#1a1a1a' : '#f0f0f0' }]}>
            <Image 
              source={require('../assets/logo.png')} 
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>

          <Text style={[styles.brandTitle, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>Represent</Text>
          <Text style={[styles.tagline, { color: colors.textSecondary }]}>Your civic platform for identity, voting, and community.</Text>

          <View style={styles.featuresRow}>
            <View style={styles.featureItem}>
              <View style={[styles.featureIconContainer, { borderColor: colors.border }]}>
                <Ionicons name="shield-outline" size={28} color={colors.gold} />
              </View>
              <Text style={[styles.featureLabel, { color: colors.textSecondary }]}>Identity</Text>
            </View>
            <View style={styles.featureItem}>
              <View style={[styles.featureIconContainer, { borderColor: colors.border }]}>
                <MaterialCommunityIcons name="vote-outline" size={28} color={colors.gold} />
              </View>
              <Text style={[styles.featureLabel, { color: colors.textSecondary }]}>Voice</Text>
            </View>
            <View style={styles.featureItem}>
              <View style={[styles.featureIconContainer, { borderColor: colors.border }]}>
                <Ionicons name="people-outline" size={28} color={colors.gold} />
              </View>
              <Text style={[styles.featureLabel, { color: colors.textSecondary }]}>Community</Text>
            </View>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.gold }]} onPress={() => setView('signup')}>
              <Text style={[styles.primaryButtonText, { color: colors.background }]}>Create Account</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.secondaryButton, { backgroundColor: colors.cardBg, borderColor: colors.border }]} onPress={() => setView('login')}>
              <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Log In</Text>
            </TouchableOpacity>
            {biometricAvailable && (
              <TouchableOpacity style={[styles.biometricButton, { borderColor: colors.gold }]} onPress={handleBiometricLogin}>
                <Ionicons 
                  name={biometricType === 'Face ID' ? 'scan-outline' : 'finger-print-outline'} 
                  size={24} 
                  color={colors.gold} 
                />
                <Text style={[styles.biometricButtonText, { color: colors.gold }]}>Quick Sign In with {biometricType}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  }

  const isLogin = view === 'login';

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.authContent} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backNav} onPress={() => setView('welcome')}>
          <Text style={[styles.backNavText, { color: colors.gold }]}>← Back</Text>
        </TouchableOpacity>

        <View style={[styles.authCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <View style={styles.authHeader}>
            <Image 
              source={require('../assets/logo.png')} 
              style={styles.authLogoImage}
              resizeMode="contain"
            />
            <Text style={[styles.authTitle, { color: colors.gold }]}>{isLogin ? 'Welcome Back' : 'Join Represent'}</Text>
            <Text style={[styles.authSubtitle, { color: colors.textSecondary }]}>
              {isLogin ? 'Sign in to access your wallet and civic platform' : 'Create your account to start participating in governance'}
            </Text>
          </View>

          {error ? (
            <View style={[styles.errorContainer, { backgroundColor: colors.errorLight, borderLeftColor: colors.error }]}>
              <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
            </View>
          ) : null}

          {!isLogin && (
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.gold }]}>Full Name</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.goldLight, borderColor: colors.border, color: colors.text }]}
                placeholder="Jane Doe"
                placeholderTextColor={colors.textMuted}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
              />
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.gold }]}>Email Address</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.goldLight, borderColor: colors.border, color: colors.text }]}
              placeholder="citizen@example.com"
              placeholderTextColor={colors.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.gold }]}>Password</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.goldLight, borderColor: colors.border, color: colors.text }]}
              placeholder={isLogin ? 'Enter password' : 'Create a strong password'}
              placeholderTextColor={colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, styles.fullWidth, { backgroundColor: colors.gold }]}
            onPress={() => {
              if (!email || !password || (!isLogin && !name)) {
                setError('Please fill in all fields');
                return;
              }
              setError('');
              setIsLoading(true);
              setTimeout(() => setIsLoading(false), 1500);
            }}
          >
            <Text style={[styles.primaryButtonText, { color: colors.background }]}>
              {isLoading ? (isLogin ? 'Signing in...' : 'Creating account...') : (isLogin ? 'Sign In' : 'Create Account')}
            </Text>
          </TouchableOpacity>

          <View style={styles.orDivider}>
            <View style={[styles.orLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.orText, { color: colors.textSecondary }]}>OR</Text>
            <View style={[styles.orLine, { backgroundColor: colors.border }]} />
          </View>

          <TouchableOpacity 
            style={[styles.googleSignInButton, isLoading && styles.socialButtonDisabled]} 
            onPress={handleGoogleLogin}
            disabled={isLoading}
          >
            <Ionicons name="logo-google" size={22} color="#fff" />
            <Text style={styles.googleSignInText}>
              {isLoading ? 'Signing in...' : 'Sign in with Google'}
            </Text>
          </TouchableOpacity>

          {Platform.OS === 'ios' && appleAvailable && (
            <TouchableOpacity 
              style={[styles.appleSignInButton, isLoading && styles.socialButtonDisabled]} 
              onPress={handleAppleLogin}
              disabled={isLoading}
            >
              <Ionicons name="logo-apple" size={22} color="#000" />
              <Text style={styles.appleSignInText}>Sign in with Apple</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.switchAuth} onPress={() => setView(isLogin ? 'signup' : 'login')}>
            <Text style={[styles.switchAuthText, { color: colors.textSecondary }]}>
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
              <Text style={[styles.switchAuthLink, { color: colors.gold }]}>{isLogin ? 'Sign up' : 'Sign in'}</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  welcomeContent: { flex: 1, paddingHorizontal: SPACING.xxl, paddingTop: 100, alignItems: 'center' },
  logoContainer: { width: 100, height: 100, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.xxxl, overflow: 'hidden' },
  logoImage: { width: 90, height: 90 },
  brandTitle: { fontSize: 42, fontWeight: 'bold', letterSpacing: 1, marginBottom: SPACING.lg },
  tagline: { fontSize: FONT_SIZES.lg, textAlign: 'center', lineHeight: 24, maxWidth: 320, marginBottom: 60 },
  featuresRow: { flexDirection: 'row', justifyContent: 'center', gap: 50, marginBottom: 60 },
  featureItem: { alignItems: 'center' },
  featureIconContainer: { width: 64, height: 64, borderRadius: 32, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.sm, backgroundColor: 'transparent' },
  featureLabel: { fontSize: FONT_SIZES.md },
  buttonContainer: { width: '100%', gap: SPACING.md, paddingHorizontal: SPACING.lg },
  primaryButton: { paddingVertical: 18, borderRadius: 30, alignItems: 'center' },
  primaryButtonText: { fontSize: FONT_SIZES.lg, fontWeight: '600' },
  secondaryButton: { borderWidth: 1, paddingVertical: 18, borderRadius: 30, alignItems: 'center' },
  secondaryButtonText: { fontSize: FONT_SIZES.lg, fontWeight: '600' },
  biometricButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', borderWidth: 1, paddingVertical: 16, borderRadius: 30, gap: 10, marginTop: 8 },
  biometricButtonText: { fontSize: FONT_SIZES.md, fontWeight: '600' },
  authContent: { flexGrow: 1, padding: SPACING.xxl },
  backNav: { marginBottom: SPACING.xl, marginTop: 40 },
  backNavText: { fontSize: FONT_SIZES.lg, fontWeight: '500' },
  authCard: { borderRadius: BORDER_RADIUS.xl, padding: SPACING.xxl, borderWidth: 1 },
  authHeader: { alignItems: 'center', marginBottom: SPACING.xxl },
  authLogoImage: { width: 80, height: 80, borderRadius: 12, marginBottom: SPACING.lg },
  authTitle: { fontSize: FONT_SIZES.xxl, fontWeight: 'bold', marginBottom: SPACING.sm },
  authSubtitle: { fontSize: FONT_SIZES.md, textAlign: 'center', lineHeight: 22 },
  errorContainer: { padding: SPACING.md, borderRadius: BORDER_RADIUS.md, marginBottom: SPACING.lg, borderLeftWidth: 3 },
  errorText: { fontSize: FONT_SIZES.md },
  inputGroup: { marginBottom: SPACING.lg },
  inputLabel: { fontSize: FONT_SIZES.md, fontWeight: '600', marginBottom: SPACING.sm },
  input: { borderWidth: 1, borderRadius: BORDER_RADIUS.md, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, fontSize: FONT_SIZES.lg },
  fullWidth: { width: '100%', marginTop: SPACING.sm },
  orDivider: { flexDirection: 'row', alignItems: 'center', marginVertical: SPACING.xl },
  orLine: { flex: 1, height: 1 },
  orText: { fontSize: FONT_SIZES.sm, marginHorizontal: SPACING.lg },
  socialButtonDisabled: { opacity: 0.5 },
  googleSignInButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#4285F4', paddingVertical: 16, borderRadius: 30, gap: 10, marginBottom: 12 },
  googleSignInText: { fontSize: FONT_SIZES.lg, fontWeight: '600', color: '#fff' },
  appleSignInButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', paddingVertical: 16, borderRadius: 30, gap: 10, marginBottom: 12 },
  appleSignInText: { fontSize: FONT_SIZES.lg, fontWeight: '600', color: '#000' },
  switchAuth: { alignItems: 'center' },
  switchAuthText: { fontSize: FONT_SIZES.md },
  switchAuthLink: { fontWeight: '600' },
});
