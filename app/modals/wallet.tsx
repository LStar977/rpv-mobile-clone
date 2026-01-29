import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../lib/auth';
import { useTheme } from '../../lib/theme';

const API_URL = 'https://representportal.com';

export default function WalletScreen() {
  const { colors } = useTheme();
  const { user, token } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [walletAddress, setWalletAddress] = useState('');
  const [rpvBalance, setRpvBalance] = useState(0);
  const [copiedAddress, setCopiedAddress] = useState(false);

  useEffect(() => { fetchWalletData(); }, []);

  const fetchWalletData = async () => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      
      const response = await fetch(`${API_URL}/api/auth/verify`, { headers });
      if (response.ok) {
        const data = await response.json();
        if (data.user?.walletAddress) {
          setWalletAddress(data.user.walletAddress);
        }
      }
      
      const claimedRes = await fetch(`${API_URL}/api/user/claimed-tokens`, { headers });
      if (claimedRes.ok) {
        const claimedData = await claimedRes.json();
        const tokens = claimedData.claimedTokens || claimedData || [];
        setRpvBalance(Array.isArray(tokens) ? tokens.length : 0);
      }
    } catch (error) { 
      console.error('Failed to fetch wallet data:', error); 
      if (user?.walletAddress) setWalletAddress(user.walletAddress);
    }
    finally { setLoading(false); }
  };

  const copyToClipboard = async (text: string) => {
    try {
      const Clipboard = require('expo-clipboard');
      await Clipboard.setStringAsync(text);
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    } catch (error) {
      Alert.alert('Wallet Address', text, [{ text: 'OK' }]);
    }
  };
  
  const formatAddress = (address: string) => address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '';

  if (loading) return <View style={[styles.container, { backgroundColor: colors.background }]}><ActivityIndicator size="large" color={colors.gold} style={{ marginTop: 40 }} /></View>;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.content}>
        {walletAddress ? (
          <>
            <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.gold }]}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Wallet Address</Text>
              <View style={styles.addressRow}>
                <Text style={[styles.addressText, { color: colors.text }]}>{formatAddress(walletAddress)}</Text>
                <TouchableOpacity onPress={() => copyToClipboard(walletAddress)}>
                  <Ionicons name={copiedAddress ? "checkmark" : "copy-outline"} size={20} color={colors.gold} />
                </TouchableOpacity>
              </View>
              <Text style={[styles.fullAddress, { color: colors.textSecondary }]} numberOfLines={1}>{walletAddress}</Text>
            </View>
            <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>RPV Balance</Text>
              <Text style={[styles.balanceText, { color: colors.gold }]}>{rpvBalance} RPV</Text>
              <Text style={[styles.balanceSubtext, { color: colors.textSecondary }]}>Represent Vote Tokens</Text>
            </View>
            <View style={[styles.infoCard, { backgroundColor: colors.goldLight }]}>
              <Ionicons name="globe-outline" size={18} color={colors.gold} />
              <Text style={[styles.infoText, { color: colors.gold }]}>Network: Base Sepolia (Testnet)</Text>
            </View>
          </>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="wallet-outline" size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No wallet connected</Text>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>Complete identity verification to get your wallet</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  card: { borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1 },
  label: { fontSize: 12, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  addressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  addressText: { fontSize: 18, fontWeight: '600' },
  fullAddress: { fontSize: 12, fontFamily: 'monospace' },
  balanceText: { fontSize: 32, fontWeight: 'bold' },
  balanceSubtext: { fontSize: 13, marginTop: 4 },
  infoCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, padding: 14, gap: 10 },
  infoText: { fontSize: 13 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptySubtext: { fontSize: 14, marginTop: 8, textAlign: 'center' },
});
