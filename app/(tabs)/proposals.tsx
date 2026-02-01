import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';

export default function ProposalsScreen() {
  return (
    <View style={styles.container}>
      <LinearGradient colors={['rgba(234,185,87,0.12)', 'transparent']} style={styles.topGlow} />
      <View style={styles.bottomGlow} />
      <View style={styles.noiseLayer} />

      <View style={styles.shell}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconButton}>
            <MaterialIcons name="arrow-back-ios-new" size={20} color="#d6d3d1" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Active Vote</Text>
          <TouchableOpacity style={styles.iconButton}>
            <MaterialIcons name="more-horiz" size={22} color="#d6d3d1" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.statusRow}>
            <View style={styles.statusLeft}>
              <View style={styles.livePill}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
              <View style={styles.timerPill}>
                <MaterialIcons name="timer" size={14} color="rgba(255,255,255,0.6)" />
                <Text style={styles.timerText}>Ends in 4h 32m</Text>
              </View>
            </View>
            <Text style={styles.voteId}>#4021-B</Text>
          </View>

          <View style={styles.progressTrack}>
            <View style={styles.progressFill} />
          </View>

          <View style={styles.titleBlock}>
            <Text style={styles.title}>Proposition 42:</Text>
            <Text style={styles.titleAccent}>Green Energy Initiative</Text>
            <Text style={styles.subtitle}>Proposed by City Council • Environment Committee</Text>
          </View>

          <View style={styles.glassCard}>
            <MaterialIcons name="eco" size={72} color="rgba(255,255,255,0.08)" style={styles.cardIcon} />
            <Text style={styles.cardEyebrow}>Executive Summary</Text>
            <Text style={styles.cardBody}>
              Should the city allocate 15% of the annual budget surplus to renewable energy infrastructure
              projects over the next five years?
            </Text>

            <View style={styles.pointRow}>
              <MaterialIcons name="check-circle" size={20} color="#4ade80" />
              <View style={styles.pointContent}>
                <Text style={styles.pointTitle}>Pro</Text>
                <Text style={styles.pointDesc}>Reduces carbon footprint by estimated 12% annually.</Text>
              </View>
            </View>
            <View style={styles.pointRow}>
              <MaterialIcons name="cancel" size={20} color="#f87171" />
              <View style={styles.pointContent}>
                <Text style={styles.pointTitle}>Con</Text>
                <Text style={styles.pointDesc}>Temporarily reduces road maintenance budget.</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.linkButton}>
              <Text style={styles.linkText}>Read full proposal text</Text>
              <MaterialIcons name="arrow-forward" size={16} color="#eab957" />
            </TouchableOpacity>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.buttonGrid}>
            <TouchableOpacity style={styles.rejectButton}>
              <Text style={styles.rejectText}>NO</Text>
              <Text style={styles.rejectSub}>Reject</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.approveButton}>
              <Text style={styles.approveText}>YES</Text>
              <Text style={styles.approveSub}>Approve</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.securityRow}>
            <MaterialIcons name="lock" size={16} color="#eab957" />
            <Text style={styles.securityText}>Verified Secure Vote via Ethereum</Text>
          </View>
          <View style={styles.homeIndicator} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#211c11',
  },
  topGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 240,
  },
  bottomGlow: {
    position: 'absolute',
    bottom: -80,
    right: -60,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(234,185,87,0.06)',
    shadowColor: 'rgba(234,185,87,0.3)',
    shadowOpacity: 0.4,
    shadowRadius: 80,
    shadowOffset: { width: 0, height: 0 },
  },
  noiseLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  shell: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  headerTitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 20,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(239,68,68,0.2)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ef4444',
  },
  liveText: {
    color: '#fecaca',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  timerText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '600',
  },
  voteId: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontWeight: '600',
  },
  progressTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    width: '85%',
    backgroundColor: '#eab957',
    borderRadius: 999,
  },
  titleBlock: {
    gap: 6,
  },
  title: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '700',
  },
  titleAccent: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 30,
    fontWeight: '700',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
  },
  glassCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  cardIcon: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  cardEyebrow: {
    color: '#eab957',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  cardBody: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 17,
    lineHeight: 26,
    marginBottom: 20,
  },
  pointRow: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 12,
  },
  pointContent: {
    flex: 1,
    gap: 4,
  },
  pointTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  pointDesc: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    lineHeight: 18,
  },
  linkButton: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
  },
  linkText: {
    color: '#eab957',
    fontSize: 13,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 28,
    paddingTop: 12,
    backgroundColor: 'rgba(33,28,17,0.95)',
  },
  buttonGrid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 18,
  },
  rejectButton: {
    flex: 1,
    height: 64,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 18,
    fontWeight: '700',
  },
  rejectSub: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  approveButton: {
    flex: 1,
    height: 64,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(234,185,87,0.5)',
    backgroundColor: 'rgba(234,185,87,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  approveText: {
    color: '#eab957',
    fontSize: 18,
    fontWeight: '700',
  },
  approveSub: {
    color: 'rgba(234,185,87,0.7)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    opacity: 0.7,
  },
  securityText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '600',
  },
  homeIndicator: {
    marginTop: 18,
    alignSelf: 'center',
    width: 120,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
});
