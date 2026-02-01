import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export default function IdentityScreen() {
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.iconButton}>
            <MaterialIcons name="arrow-back" size={22} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Verification Status</Text>
          <View style={styles.iconSpacer} />
        </View>

        <View style={styles.heroGlow} />
        <View style={styles.badgeWrap}>
          <View style={styles.outerRing} />
          <View style={styles.innerRing} />
          <View style={styles.badge}>
            <View style={styles.badgeInner}>
              <MaterialIcons name="verified-user" size={54} color="#eab957" />
            </View>
          </View>
        </View>

        <View style={styles.headlineWrap}>
          <Text style={styles.headline}>
            You are <Text style={styles.headlineAccent}>Verified</Text>
          </Text>
          <Text style={styles.subheading}>Your digital identity is secured and ready for voting.</Text>
        </View>

        <View style={styles.checklist}>
          <ChecklistItem
            icon="badge"
            title="Government ID Match"
            subtitle="Driver's License Verified"
          />
          <ChecklistItem
            icon="face"
            title="Biometric Check"
            subtitle="Face Liveness Confirmed"
          />
          <ChecklistItem
            icon="storage"
            title="Blockchain Hash Generated"
            subtitle="Ledger #8x92...A41"
          />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.primaryButton}>
          <Text style={styles.primaryText}>Continue to Voting</Text>
          <MaterialIcons name="arrow-forward" size={18} color="#211c11" />
        </TouchableOpacity>
        <View style={styles.footerRow}>
          <MaterialIcons name="lock" size={14} color="rgba(255,255,255,0.5)" />
          <Text style={styles.footerText}>Secured by Blockchain</Text>
        </View>
      </View>
    </View>
  );
}

function ChecklistItem({
  icon,
  title,
  subtitle,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.checkItem}>
      <View style={styles.checkIconWrap}>
        <MaterialIcons name={icon} size={20} color="#eab957" />
      </View>
      <View style={styles.checkTextWrap}>
        <Text style={styles.checkTitle}>{title}</Text>
        <Text style={styles.checkSubtitle}>{subtitle}</Text>
      </View>
      <MaterialIcons name="check-circle" size={20} color="#eab957" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#211c11',
  },
  content: {
    paddingBottom: 160,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSpacer: {
    width: 44,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  heroGlow: {
    position: 'absolute',
    top: 160,
    alignSelf: 'center',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(234,185,87,0.12)',
    shadowColor: 'rgba(234,185,87,0.4)',
    shadowOpacity: 0.5,
    shadowRadius: 80,
    shadowOffset: { width: 0, height: 0 },
  },
  badgeWrap: {
    marginTop: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerRing: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 1,
    borderColor: 'rgba(234,185,87,0.2)',
  },
  innerRing: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 1,
    borderColor: 'rgba(234,185,87,0.1)',
  },
  badge: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#2b2417',
    borderWidth: 1,
    borderColor: 'rgba(234,185,87,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(234,185,87,0.4)',
    shadowOpacity: 0.5,
    shadowRadius: 24,
  },
  badgeInner: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 1,
    borderColor: 'rgba(234,185,87,0.3)',
    backgroundColor: '#211c11',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headlineWrap: {
    marginTop: 20,
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 8,
  },
  headline: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '700',
    textAlign: 'center',
  },
  headlineAccent: {
    color: '#eab957',
  },
  subheading: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  checklist: {
    marginTop: 28,
    paddingHorizontal: 20,
    gap: 12,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  checkIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(234,185,87,0.15)',
  },
  checkTextWrap: {
    flex: 1,
  },
  checkTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  checkSubtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    marginTop: 4,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 28,
    paddingTop: 12,
    backgroundColor: '#211c11',
  },
  primaryButton: {
    height: 56,
    backgroundColor: '#eab957',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    shadowColor: 'rgba(234,185,87,0.5)',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  primaryText: {
    color: '#211c11',
    fontSize: 16,
    fontWeight: '700',
  },
  footerRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    opacity: 0.7,
  },
  footerText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
