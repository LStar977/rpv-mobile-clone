import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { isBiometricAvailable, isBiometricEnabled, setBiometricEnabled as saveBiometricEnabled, getBiometricType } from '../../lib/biometrics';

export default function PrivacyScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricTypeState] = useState('Biometric');
  const [biometricEnabled, setBiometricEnabled] = useState(false);

  const colors = {
    background: isDark ? '#0a0a0a' : '#ffffff',
    cardBg: isDark ? '#1a1a1a' : '#f8f9fa',
    text: isDark ? '#ffffff' : '#1a1a1a',
    textSecondary: isDark ? '#888888' : '#666666',
    gold: '#D4AF37',
    goldLight: 'rgba(212, 175, 55, 0.15)',
    border: isDark ? '#2a2a2a' : '#e0e0e0',
    success: '#27ae60',
    white: '#ffffff',
  };

  useEffect(() => {
    checkBiometrics();
  }, []);

  const checkBiometrics = async () => {
    const available = await isBiometricAvailable();
    setBiometricAvailable(available);
    if (available) {
      const type = await getBiometricType();
      setBiometricTypeState(type);
      const enabled = await isBiometricEnabled();
      setBiometricEnabled(enabled);
    }
  };

  const handleBiometricToggle = async (value: boolean) => {
    setBiometricEnabled(value);
    await saveBiometricEnabled(value);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.content}>
        <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <View style={styles.row}>
            <Ionicons name="shield-checkmark" size={24} color={colors.success} />
            <View style={styles.info}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Two-Factor Authentication</Text>
              <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>OAuth login via Google/Apple</Text>
            </View>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
          </View>
        </View>

        {biometricAvailable && (
          <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <View style={styles.row}>
              <Ionicons name={biometricType === 'Face ID' ? 'scan-outline' : 'finger-print'} size={24} color={colors.gold} />
              <View style={styles.info}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>{biometricType} Login</Text>
                <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>Quick sign in with {biometricType}</Text>
              </View>
              <Switch
                value={biometricEnabled}
                onValueChange={handleBiometricToggle}
                trackColor={{ false: colors.border, true: colors.gold }}
                thumbColor={colors.white}
              />
            </View>
          </View>
        )}

        <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <View style={styles.row}>
            <Ionicons name="lock-closed" size={24} color={colors.gold} />
            <View style={styles.info}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Encrypted Wallet</Text>
              <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>Your keys are securely stored</Text>
            </View>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
          </View>
        </View>

        <View style={[styles.infoBox, { backgroundColor: colors.goldLight }]}>
          <Ionicons name="information-circle-outline" size={18} color={colors.gold} />
          <Text style={[styles.infoBoxText, { color: colors.gold }]}>
            Your identity verification data is processed by Veriff and not stored on our servers.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  card: { borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  info: { flex: 1, marginLeft: 12 },
  cardTitle: { fontSize: 15, fontWeight: '600' },
  cardSubtitle: { fontSize: 13, marginTop: 2 },
  infoBox: { flexDirection: 'row', alignItems: 'flex-start', borderRadius: 10, padding: 14, marginTop: 8, gap: 10 },
  infoBoxText: { fontSize: 13, flex: 1, lineHeight: 18 },
});
