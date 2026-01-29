import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '../../lib/auth';
import { veriffApi, passportApi, userApi } from '../../lib/api';
import { useTheme } from '../../lib/theme';

export default function IdentityScreen() {
  const { colors } = useTheme();
  const { user, isAuthenticated } = useAuthStore();
  const params = useLocalSearchParams<{ verified?: string; verificationId?: string }>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'none' | 'pending' | 'verified'>('none');
  const [hasPassport, setHasPassport] = useState(false);
  const [startingVerification, setStartingVerification] = useState(false);
  const [mintingPassport, setMintingPassport] = useState(false);
  const [pendingVerificationId, setPendingVerificationId] = useState<string | null>(null);
  const [geoScope, setGeoScope] = useState<{ country?: string; state?: string; city?: string }>({});

  const fetchStatus = useCallback(async () => {
    if (!isAuthenticated) { setLoading(false); return; }
    try {
      const [profileRes, passportRes] = await Promise.all([userApi.getVerificationStatus(), passportApi.getStatus()]);
      if (profileRes.data) {
        setVerificationStatus(profileRes.data.verified ? 'verified' : 'none');
        setGeoScope({ country: profileRes.data.country, state: profileRes.data.state, city: profileRes.data.city });
      }
      if (passportRes.data) setHasPassport(passportRes.data.hasMinted);
    } catch (error) { console.error('Error fetching status:', error); }
    finally { setLoading(false); setRefreshing(false); }
  }, [isAuthenticated]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  useEffect(() => {
    if (pendingVerificationId) {
      const interval = setInterval(async () => {
        const result = await veriffApi.checkDecision(pendingVerificationId);
        if (result.data?.status === 'approved' || result.data?.decision === 'approved') {
          setVerificationStatus('verified'); setPendingVerificationId(null);
          Alert.alert('Verification Complete', 'Your identity has been verified!');
        } else if (result.data?.status === 'declined' || result.data?.decision === 'declined') {
          setPendingVerificationId(null); setVerificationStatus('none');
          Alert.alert('Verification Failed', 'Please try again.');
        }
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [pendingVerificationId]);

  useEffect(() => {
    if ((params.verified === 'true' || params.verified === 'pending') && params.verificationId) {
      setPendingVerificationId(params.verificationId);
      setVerificationStatus('pending');
      veriffApi.checkDecision(params.verificationId).then((result) => {
        if (result.data?.status === 'approved' || result.data?.decision === 'approved') {
          setVerificationStatus('verified');
          setPendingVerificationId(null);
          Alert.alert('Verification Complete', 'Your identity has been verified! You can now mint your passport.');
        }
      });
    }
  }, [params.verified, params.verificationId]);

  const handleStartVerification = async () => {
    if (!isAuthenticated) { Alert.alert('Sign In Required', 'Please sign in to verify your identity.'); return; }
    setStartingVerification(true);
    try {
      const result = await veriffApi.createSession();
      console.log('Veriff createSession result:', JSON.stringify(result, null, 2));
      if (result.error) { Alert.alert('Error', result.error); return; }
      
      const sessionUrl = result.data?.sessionUrl;
      const verificationId = result.data?.sessionId || result.data?.verificationId;
      
      if (sessionUrl) {
        console.log('Navigating to Veriff WebView:', sessionUrl);
        setPendingVerificationId(verificationId);
        setVerificationStatus('pending');
        router.push({ 
          pathname: '/modals/veriff', 
          params: { sessionUrl, verificationId } 
        });
      } else { 
        console.log('No sessionUrl in response:', result.data);
        Alert.alert('Error', 'Could not start verification session.'); 
      }
    } catch (error) { 
      console.error('Verification error:', error);
      Alert.alert('Error', 'Failed to start verification.'); 
    }
    finally { setStartingVerification(false); }
  };

  const handleMintPassport = async () => {
    if (!isAuthenticated) { Alert.alert('Sign In Required', 'Please sign in.'); return; }
    if (verificationStatus !== 'verified') { Alert.alert('Verification Required', 'Please complete identity verification first.'); return; }
    setMintingPassport(true);
    try {
      const result = await passportApi.mint();
      if (result.error) { Alert.alert('Error', result.error); return; }
      setHasPassport(true); Alert.alert('Passport Minted', 'Your soulbound passport NFT has been minted!');
    } catch (error) { Alert.alert('Error', 'Failed to mint passport.'); }
    finally { setMintingPassport(false); }
  };

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}><Text style={[styles.headerTitle, { color: colors.text }]}>Identity</Text></View>
        <View style={styles.centerContent}><Ionicons name="person-outline" size={64} color={colors.textSecondary} /><Text style={[styles.emptyText, { color: colors.textSecondary }]}>Sign in to manage your identity</Text></View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}><Text style={[styles.headerTitle, { color: colors.text }]}>Identity</Text></View>
        <View style={styles.centerContent}><ActivityIndicator size="large" color={colors.gold} /><Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading...</Text></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}><Text style={[styles.headerTitle, { color: colors.text }]}>Identity</Text></View>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchStatus(); }} tintColor={colors.gold} />}>
        <View style={[styles.profileCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <View style={[styles.avatarContainer, { backgroundColor: colors.goldLight }]}><Ionicons name="person" size={40} color={colors.gold} /></View>
          <Text style={[styles.profileName, { color: colors.text }]}>{user?.name || 'Citizen'}</Text>
          <Text style={[styles.profileEmail, { color: colors.textSecondary }]}>{user?.email}</Text>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>VERIFICATION STATUS</Text>
        <View style={[styles.statusCard, { backgroundColor: colors.cardBg, borderColor: verificationStatus === 'verified' ? colors.success : verificationStatus === 'pending' ? colors.warning : colors.border }]}>
          <View style={styles.statusHeader}>
            <Ionicons name={verificationStatus === 'verified' ? 'shield-checkmark' : verificationStatus === 'pending' ? 'time' : 'shield-outline'} size={32} color={verificationStatus === 'verified' ? colors.success : verificationStatus === 'pending' ? colors.warning : colors.textSecondary} />
            <View style={styles.statusInfo}>
              <Text style={[styles.statusTitle, { color: colors.text }]}>{verificationStatus === 'verified' ? 'Identity Verified' : verificationStatus === 'pending' ? 'Verification Pending' : 'Not Verified'}</Text>
              <Text style={[styles.statusSubtitle, { color: colors.textSecondary }]}>{verificationStatus === 'verified' ? (geoScope.city || geoScope.state || geoScope.country ? `${[geoScope.city, geoScope.state, geoScope.country].filter(Boolean).join(', ')}` : 'Your identity has been confirmed') : verificationStatus === 'pending' ? 'Checking verification status...' : 'Complete identity verification to vote'}</Text>
            </View>
          </View>
          {verificationStatus === 'none' && (
            <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.gold }, startingVerification && styles.actionButtonDisabled]} onPress={handleStartVerification} disabled={startingVerification}>
              {startingVerification ? <ActivityIndicator size="small" color="#000" /> : <><Ionicons name="scan" size={20} color="#000" /><Text style={styles.actionButtonText}>Start Verification</Text></>}
            </TouchableOpacity>
          )}
          {verificationStatus === 'pending' && (
            <View style={[styles.pendingInfo, { backgroundColor: colors.warningLight }]}><ActivityIndicator size="small" color={colors.warning} /><Text style={[styles.pendingText, { color: colors.warning }]}>Checking verification status...</Text></View>
          )}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>REPRESENT PASSPORT</Text>
        <View style={[styles.statusCard, { backgroundColor: colors.cardBg, borderColor: hasPassport ? colors.success : colors.border }]}>
          <View style={styles.statusHeader}>
            <Ionicons name={hasPassport ? 'ribbon' : 'ribbon-outline'} size={32} color={hasPassport ? colors.success : colors.textSecondary} />
            <View style={styles.statusInfo}>
              <Text style={[styles.statusTitle, { color: colors.text }]}>{hasPassport ? 'Passport Minted' : 'No Passport'}</Text>
              <Text style={[styles.statusSubtitle, { color: colors.textSecondary }]}>{hasPassport ? 'Your soulbound passport is active' : 'Mint your passport NFT to vote'}</Text>
            </View>
          </View>
          {!hasPassport && (
            <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.gold }, (mintingPassport || verificationStatus !== 'verified') && styles.actionButtonDisabled]} onPress={handleMintPassport} disabled={mintingPassport || verificationStatus !== 'verified'}>
              {mintingPassport ? <ActivityIndicator size="small" color="#000" /> : <><Ionicons name="diamond" size={20} color="#000" /><Text style={styles.actionButtonText}>{verificationStatus !== 'verified' ? 'Verify Identity First' : 'Mint Passport'}</Text></>}
            </TouchableOpacity>
          )}
        </View>

        <View style={[styles.infoCard, { backgroundColor: colors.goldLight }]}>
          <Ionicons name="information-circle-outline" size={24} color={colors.gold} />
          <View style={styles.infoContent}>
            <Text style={[styles.infoTitle, { color: colors.gold }]}>Why verify?</Text>
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>Identity verification ensures one person, one vote. Your soulbound passport NFT is tied to your verified identity and cannot be transferred.</Text>
          </View>
        </View>
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  headerTitle: { fontSize: 28, fontWeight: 'bold' },
  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  emptyText: { fontSize: 16 },
  loadingText: { fontSize: 14 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20 },
  profileCard: { borderRadius: 16, padding: 24, alignItems: 'center', borderWidth: 1, marginBottom: 24 },
  avatarContainer: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  profileName: { fontSize: 20, fontWeight: '600', marginBottom: 4 },
  profileEmail: { fontSize: 14 },
  sectionTitle: { fontSize: 12, fontWeight: '600', letterSpacing: 1, marginBottom: 12 },
  statusCard: { borderRadius: 16, padding: 20, borderWidth: 1, marginBottom: 24 },
  statusHeader: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  statusInfo: { flex: 1 },
  statusTitle: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
  statusSubtitle: { fontSize: 14 },
  actionButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, gap: 8, marginTop: 16 },
  actionButtonDisabled: { opacity: 0.5 },
  actionButtonText: { fontSize: 16, fontWeight: '600', color: '#000' },
  pendingInfo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, paddingVertical: 12, borderRadius: 8 },
  pendingText: { fontSize: 14, fontWeight: '500' },
  infoCard: { flexDirection: 'row', borderRadius: 12, padding: 16, gap: 12 },
  infoContent: { flex: 1 },
  infoTitle: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  infoText: { fontSize: 13, lineHeight: 20 },
});
