import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ImageBackground,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';

const AVATAR_URI =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAdLEsSFbN59fs-E-_5BGVDogRU-vQeexIkRI8eiLZkm9wLdVQShwfuMnAZGFUWr8LaeH-lAEtynwkAS8_jsntvzz19eNEBQyuY4xdrRDYzvtlGk-tAYYNHruDs63Xz6pZvxbC3KYC8LMS8ueSppf4XXxVnPeFQw3odDcBJJCK2T-4zjeK6zusXGF7Qv-BTqaGlU2CLMtg5Pcil3aHFJErPI2jvbuDK49OKUlSHj3ovKt24FOVyHduYJvBW0jHyRd11S18P91Sns4DY';
const POLL_IMAGE_1 =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuBVA_2371yWOU0X_lwMiAXMsY4lv9LsGSzn2w_dKxomLm1EEJvDUhCTCrnzzX94QJ-zokgwtssKNEp0rdNjghPl8cwvvU8Saclq_4cgE0hiMHf8W5CEB13YcMtwkXfEHG4N79vtonY95zJ67GNNzGSxS62CYdn-ty1l19SJx9YHBanatZgS7udwES-KE2ogb2fAo5OCTdksMPHku19SrJKLgZvOKflTBHIwnY2iU2SFyNJnacsjT5i71r-wgimF3-QPpbnOSoYMI4fB';
const POLL_IMAGE_2 =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDs6ZxBHUCAGwkx7MuZBLDW0snp5ulV3Ga99_dVd4Xv74XwDUTwWmSs06yqRpvoVvFxMNHgZ-5d8layNINiaJ-nxV1T1KlHoj7-daNvKpEbZ7BXHypl9s_pgkgTp7CGplMBETe1_YjKiF38wly7SiRqfM0VkIw5XboXZT2yHvYXJngz29U9AOfZJUyT6uX12iJbtacwM3vxo3LKE42BASJqOqY8lLG6Mj8V_6vmjuHMkZ6P3DfZzOlAfQ49W1WRqKowdfz7CUMheAuE';

export default function DashboardScreen() {
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={['#0a0e0e', 'transparent']} style={styles.headerGradient} />
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.avatarWrap}>
              <Image source={{ uri: AVATAR_URI }} style={styles.avatar} />
              <View style={styles.verifiedBadge}>
                <MaterialIcons name="verified-user" size={12} color="#0a0e0e" />
              </View>
            </View>
            <View>
              <Text style={styles.kicker}>Verified Citizen</Text>
              <Text style={styles.title}>Welcome back, Alex</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.notificationBtn}>
            <MaterialIcons name="notifications" size={22} color="#f2efe9" />
            <View style={styles.notificationDot} />
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleWrap}>
            <MaterialIcons name="how-to-vote" size={18} color="#eab957" />
            <Text style={styles.sectionTitle}>Live Polls</Text>
          </View>
          <TouchableOpacity>
            <Text style={styles.sectionLink}>See all</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pollsRow}
        >
          <PollCard
            tag="Proposition 45"
            title="Infrastructure Bond"
            description="Funding for bridge repairs and new highway lanes in District 9."
            image={POLL_IMAGE_1}
            timeLeft="4h left"
            primary
          />
          <PollCard
            tag="City Council"
            title="Zoning Laws Update"
            description="Proposal to change mixed-use zoning restrictions in downtown area."
            image={POLL_IMAGE_2}
            timeLeft="12h left"
          />
        </ScrollView>

        <View style={styles.sectionHeaderAlt}>
          <MaterialIcons name="analytics" size={18} color="#eab957" />
          <Text style={styles.sectionTitle}>Community Sentiment</Text>
        </View>

        <View style={styles.sentimentCard}>
          <MaterialIcons name="park" size={64} color="rgba(255,255,255,0.07)" style={styles.sentimentIcon} />
          <View style={styles.sentimentContent}>
            <View style={styles.sentimentHeader}>
              <View>
                <Text style={styles.sentimentTitle}>Local Park Renovation</Text>
                <Text style={styles.sentimentMeta}>Based on 1,240 verified votes</Text>
              </View>
              <View style={styles.sentimentPillSuccess}>
                <Text style={styles.sentimentPillText}>+12%</Text>
              </View>
            </View>
            <View style={styles.sentimentRow}>
              <Text style={styles.sentimentValue}>78%</Text>
              <Text style={styles.sentimentLabel}>Approval Rating</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: '78%' }]} />
              <View style={[styles.progressRest, { width: '22%' }]} />
            </View>
            <View style={styles.progressLabels}>
              <Text style={styles.progressLabel}>Approve</Text>
              <Text style={styles.progressLabel}>Disapprove</Text>
            </View>
          </View>
        </View>

        <View style={styles.sentimentCard}>
          <MaterialIcons
            name="directions-bus"
            size={64}
            color="rgba(255,255,255,0.07)"
            style={styles.sentimentIcon}
          />
          <View style={styles.sentimentContent}>
            <View style={styles.sentimentHeader}>
              <View>
                <Text style={styles.sentimentTitle}>Public Transport Satisfaction</Text>
                <Text style={styles.sentimentMeta}>Based on 3,400 verified votes</Text>
              </View>
              <View style={styles.sentimentPillNeutral}>
                <Text style={styles.sentimentPillText}>+2%</Text>
              </View>
            </View>
            <View style={styles.sentimentRow}>
              <Text style={styles.sentimentValue}>45%</Text>
              <Text style={styles.sentimentLabelMuted}>Approval Rating</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFillMuted, { width: '45%' }]} />
              <View style={[styles.progressRest, { width: '55%' }]} />
            </View>
            <View style={styles.progressLabels}>
              <Text style={styles.progressLabel}>Satisfied</Text>
              <Text style={styles.progressLabel}>Unsatisfied</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <TouchableOpacity style={styles.fab} activeOpacity={0.9}>
        <MaterialIcons name="add" size={28} color="#040707" />
      </TouchableOpacity>
    </View>
  );
}

function PollCard({
  tag,
  title,
  description,
  image,
  timeLeft,
  primary,
}: {
  tag: string;
  title: string;
  description: string;
  image: string;
  timeLeft: string;
  primary?: boolean;
}) {
  return (
    <View style={styles.pollCard}>
      <ImageBackground source={{ uri: image }} style={styles.pollImage} imageStyle={styles.pollImageStyle}>
        <LinearGradient colors={['rgba(0,0,0,0)', '#141616']} style={styles.pollOverlay} />
        <View style={styles.timeBadge}>
          <MaterialIcons name="timer" size={12} color="#eab957" />
          <Text style={styles.timeText}>{timeLeft}</Text>
        </View>
      </ImageBackground>
      <View style={styles.pollContent}>
        <Text style={styles.pollTag}>{tag}</Text>
        <Text style={styles.pollTitle}>{title}</Text>
        <Text style={styles.pollDescription}>{description}</Text>
        <TouchableOpacity style={[styles.pollButton, primary ? styles.pollButtonPrimary : styles.pollButtonSecondary]}>
          <Text style={[styles.pollButtonText, !primary && styles.pollButtonTextSecondary]}>
            {primary ? 'Vote Now' : 'Read & Vote'}
          </Text>
          {primary && <MaterialIcons name="arrow-forward" size={16} color="#040707" />}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#040707',
  },
  content: {
    paddingBottom: 120,
  },
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 200,
  },
  header: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: 'rgba(234,185,87,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#eab957',
    borderRadius: 10,
    padding: 4,
    borderWidth: 2,
    borderColor: '#040707',
  },
  kicker: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  notificationBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationDot: {
    position: 'absolute',
    top: 8,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 4,
    marginBottom: 12,
  },
  sectionHeaderAlt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 12,
  },
  sectionTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  sectionLink: {
    color: '#eab957',
    fontSize: 13,
    fontWeight: '600',
  },
  pollsRow: {
    paddingLeft: 20,
    paddingRight: 8,
    gap: 16,
  },
  pollCard: {
    width: 300,
    backgroundColor: '#141616',
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  pollImage: {
    height: 150,
    justifyContent: 'flex-start',
  },
  pollImageStyle: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  pollOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  timeBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  timeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  pollContent: {
    padding: 16,
    gap: 6,
  },
  pollTag: {
    color: '#eab957',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  pollTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  pollDescription: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    lineHeight: 18,
  },
  pollButton: {
    marginTop: 12,
    borderRadius: 12,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  pollButtonPrimary: {
    backgroundColor: '#eab957',
  },
  pollButtonSecondary: {
    backgroundColor: '#2a2f30',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  pollButtonText: {
    color: '#040707',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pollButtonTextSecondary: {
    color: '#fff',
  },
  sentimentCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: 'rgba(20,22,22,0.6)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    padding: 20,
    overflow: 'hidden',
  },
  sentimentIcon: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  sentimentContent: {
    gap: 12,
  },
  sentimentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  sentimentTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  sentimentMeta: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    marginTop: 4,
  },
  sentimentPillSuccess: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.2)',
  },
  sentimentPillNeutral: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  sentimentPillText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  sentimentRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  sentimentValue: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '700',
  },
  sentimentLabel: {
    color: '#eab957',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  sentimentLabelMuted: {
    color: 'rgba(234,185,87,0.7)',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  progressTrack: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  progressFill: {
    backgroundColor: '#eab957',
  },
  progressFillMuted: {
    backgroundColor: 'rgba(234,185,87,0.7)',
  },
  progressRest: {
    backgroundColor: '#2a2f30',
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    bottom: 26,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#eab957',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#eab957',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
});
