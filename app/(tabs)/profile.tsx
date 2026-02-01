import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const PROFILE_IMAGE =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAirtV6tzIzhyRtWblqxZNLok2kXFG1UjJxtUYEO_Y1iRZ08RDFYJXm-GpEAHEus8bi8tKGkLZuQVg4uj6vggxHtSZ_0ajAZdnAi9uzlQGUOu5d_d2fJIBRffqAIxvnEV--i63PGvk7flX8FJHV6Q94ds-lKywSpRDvJ4Kmxpdm6gWn5W_PlfQfSGOrj2mJx7ryDCEA8GXSPGgMdJegSGgq9dO5fxzXdMSaRq05rw0TVkyFZVVQGMxfnTFk-78cwwi5J5Wuno4jXS-5';

export default function ProfileScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton}>
          <MaterialIcons name="arrow-back-ios-new" size={20} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Profile</Text>
        <TouchableOpacity style={styles.headerButton}>
          <MaterialIcons name="more-horiz" size={22} color="#ffffff" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.profileHeader}>
          <View style={styles.avatarGlow} />
          <View style={styles.avatarRing}>
            <Image source={{ uri: PROFILE_IMAGE }} style={styles.avatar} />
          </View>
          <View style={styles.verifiedMark}>
            <MaterialIcons name="verified" size={18} color="#eab957" />
          </View>
          <Text style={styles.profileName}>Jane Doe</Text>
          <View style={styles.roleBadge}>
            <MaterialIcons name="shield" size={14} color="#eab957" />
            <Text style={styles.roleText}>Verified Representative</Text>
          </View>
          <Text style={styles.handle}>@citizen_jane</Text>
        </View>

        <View style={styles.statsGrid}>
          <StatCard value="42" label="Votes" icon="how-to-vote" />
          <StatCard value="8" label="Proposals" icon="edit" />
          <StatCard value="98.5" label="Impact" icon="moving" highlight />
        </View>

        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.listGroup}>
          <ListItem icon="settings" label="Account Settings" />
          <ListItem icon="history-edu" label="Voting History" />
          <ListItem icon="verified-user" label="Verification Status" status="Active" />
        </View>

        <Text style={styles.sectionTitle}>Support</Text>
        <View style={styles.listGroup}>
          <ListItem icon="logout" label="Log Out" danger />
        </View>
      </ScrollView>
    </View>
  );
}

function StatCard({
  value,
  label,
  icon,
  highlight,
}: {
  value: string;
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  highlight?: boolean;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, highlight && styles.statValueHighlight]}>{value}</Text>
      <View style={styles.statRow}>
        <MaterialIcons name={icon} size={14} color="#eab957" />
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    </View>
  );
}

function ListItem({
  icon,
  label,
  status,
  danger,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  status?: string;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.listItem, danger && styles.listItemDanger]}
      activeOpacity={0.8}
    >
      <View style={[styles.listIconWrap, danger && styles.listIconDanger]}>
        <MaterialIcons name={icon} size={20} color={danger ? '#f87171' : '#eab957'} />
      </View>
      <Text style={[styles.listLabel, danger && styles.listLabelDanger]}>{label}</Text>
      {status ? (
        <View style={styles.statusPill}>
          <Text style={styles.statusText}>{status}</Text>
        </View>
      ) : null}
      <MaterialIcons name="chevron-right" size={20} color={danger ? '#f87171' : 'rgba(255,255,255,0.35)'} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#211c11',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 18,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(33,28,17,0.9)',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    padding: 18,
    paddingBottom: 120,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 26,
  },
  avatarGlow: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(234,185,87,0.3)',
    top: 12,
  },
  avatarRing: {
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 2,
    borderColor: '#eab957',
    padding: 4,
    backgroundColor: '#211c11',
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
  },
  verifiedMark: {
    position: 'absolute',
    bottom: 50,
    right: 120,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#211c11',
    borderWidth: 1,
    borderColor: 'rgba(234,185,87,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileName: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 16,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(234,185,87,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(234,185,87,0.2)',
    marginTop: 8,
  },
  roleText: {
    color: '#eab957',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  handle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    marginTop: 6,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 14,
    alignItems: 'center',
    gap: 8,
  },
  statValue: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  statValueHighlight: {
    color: '#eab957',
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '600',
  },
  sectionTitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  listGroup: {
    gap: 10,
    marginBottom: 18,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  listItemDanger: {
    borderColor: 'rgba(248,113,113,0.3)',
    backgroundColor: 'rgba(248,113,113,0.08)',
  },
  listIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(234,185,87,0.1)',
  },
  listIconDanger: {
    backgroundColor: 'rgba(248,113,113,0.15)',
  },
  listLabel: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  listLabelDanger: {
    color: '#f87171',
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(234,185,87,0.2)',
    backgroundColor: 'rgba(234,185,87,0.1)',
  },
  statusText: {
    color: '#eab957',
    fontSize: 10,
    fontWeight: '700',
  },
});
