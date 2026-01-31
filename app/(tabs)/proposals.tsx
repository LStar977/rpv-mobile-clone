import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { proposalsApi, userApi, uploadsApi, Proposal } from '../../lib/api';
import { useAuthStore } from '../../lib/auth';
import { shareProposal } from '../../lib/share';
import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../../lib/theme';
import { haptics } from '../../lib/haptics';
import * as ImagePicker from 'expo-image-picker';

const CATEGORIES = [
  'All',
  'Transportation',
  'Environment',
  'Housing',
  'Education',
  'Healthcare',
  'Economy',
  'Public Safety',
  'Infrastructure',
  'Other',
];
const STATUS_FILTERS = ['All', 'Active', 'Ended', 'My Proposals'];
const GEO_LEVELS = ['All', 'National', 'State/Province', 'City/Local'];
const COUNTRIES = ['Canada', 'United States', 'United Kingdom', 'Australia'];
const AGE_GROUPS = ['All Ages', '18-25', '26-35', '36-45', '46-55', '56-65', '65+'];
const GENDERS = ['All Genders', 'Male', 'Female'];

function getTimeRemaining(deadline: string | null): string {
  if (!deadline) return '';
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return 'Ended';
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  return days > 0 ? `${days}d ${hours}h left` : `${hours}h left`;
}

function isProposalEnded(p: Proposal) {
  return getTimeRemaining(p.deadline) === 'Ended';
}

function FilterChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={[
        styles.filterChip,
        {
          backgroundColor: selected ? colors.gold : colors.cardBg,
          borderColor: selected ? colors.gold : colors.border,
        },
      ]}
      onPress={onPress}
    >
      <Text style={[styles.filterChipText, { color: selected ? colors.background : colors.text }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ProposalCard({
  proposal,
  onPress,
}: {
  proposal: Proposal;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const timeRemaining = getTimeRemaining(proposal.deadline);
  return (
    <TouchableOpacity
      style={[styles.proposalCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
      onPress={onPress}
    >
      <View style={styles.proposalHeader}>
        <Text style={[styles.proposalCategory, { color: colors.textMuted }]}
        >{proposal.category || 'General'}</Text>
        <View style={[styles.statusBadge, { backgroundColor: timeRemaining === 'Ended' ? colors.border : colors.goldLight }]}
        >
          <Text style={[styles.statusText, { color: timeRemaining === 'Ended' ? colors.textMuted : colors.gold }]}>{timeRemaining || 'Open'}</Text>
        </View>
      </View>
      <Text style={[styles.proposalTitle, { color: colors.text }]} numberOfLines={2}
      >{proposal.title}</Text>
      <Text style={[styles.proposalBody, { color: colors.textSecondary }]} numberOfLines={3}
      >{proposal.description}</Text>
      <View style={styles.proposalFooter}>
        <View style={styles.proposalMeta}>
          <Ionicons name="people" size={14} color={colors.textMuted} />
          <Text style={[styles.proposalMetaText, { color: colors.textMuted }]}
          >{proposal.totalVotes || 0} votes</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.gold} />
      </View>
    </TouchableOpacity>
  );
}

export default function ProposalsScreen() {
  const { colors } = useTheme();
  const { user, isAuthenticated } = useAuthStore();

  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [claimedTokens, setClaimedTokens] = useState<Set<number>>(new Set());
  const [votedProposals, setVotedProposals] = useState<Set<number>>(new Set());
  const [votingProposalId, setVotingProposalId] = useState<number | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);

  const [userCountry, setUserCountry] = useState('');
  const [userState, setUserState] = useState('');
  const [userCity, setUserCity] = useState('');
  const [isVerified, setIsVerified] = useState(false);

  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const [newProposal, setNewProposal] = useState({
    title: '',
    description: '',
    category: 'Other',
    country: '',
    state: '',
    city: '',
    geoScope: 'national' as 'national' | 'state' | 'city',
    ageGroup: 'All Ages',
    gender: 'All Genders',
    imageUri: '' as string,
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedGeoLevel, setSelectedGeoLevel] = useState('All');
  const [selectedFilterAge, setSelectedFilterAge] = useState('All Ages');
  const [selectedFilterGender, setSelectedFilterGender] = useState('All Genders');
  const [showFilters, setShowFilters] = useState(false);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photo library to add images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setNewProposal((p) => ({ ...p, imageUri: result.assets[0].uri }));
    }
  };

  useEffect(() => {
    setNewProposal((p) => ({ ...p, country: userCountry, state: userState, city: userCity }));
  }, [userCountry, userState, userCity]);

  const filteredProposals = useMemo(() => {
    return proposals.filter((proposal) => {
      const matchesSearch =
        searchQuery === '' ||
        proposal.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        proposal.description.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory = selectedCategory === 'All' || (proposal.category || 'Other') === selectedCategory;

      const ended = isProposalEnded(proposal);
      let matchesStatus = selectedStatus === 'All';
      if (selectedStatus === 'Active') matchesStatus = !ended;
      if (selectedStatus === 'Ended') matchesStatus = ended;
      if (selectedStatus === 'My Proposals') {
        const creatorId = (proposal as any).creatorId || (proposal as any).userId;
        matchesStatus = creatorId === user?.id || creatorId === String(user?.id);
      }

      let matchesGeo = true;
      if (selectedGeoLevel !== 'All') {
        const geoTags = proposal.geoRestrictions || [];
        if (selectedGeoLevel === 'National') matchesGeo = geoTags.length === 0 || geoTags.some((t) => COUNTRIES.includes(t));
        else if (selectedGeoLevel === 'State/Province') matchesGeo = geoTags.length >= 2;
        else if (selectedGeoLevel === 'City/Local') matchesGeo = geoTags.length >= 3;
      }

      let matchesAge = true;
      let matchesGender = true;
      const demoRestrictions = (proposal as any).demographicRestrictions;
      if (selectedFilterAge !== 'All Ages') {
        matchesAge = !demoRestrictions?.ageGroup || demoRestrictions.ageGroup === selectedFilterAge;
      }
      if (selectedFilterGender !== 'All Genders') {
        matchesGender = !demoRestrictions?.gender || demoRestrictions.gender === selectedFilterGender;
      }

      return matchesSearch && matchesCategory && matchesStatus && matchesGeo && matchesAge && matchesGender;
    });
  }, [
    proposals,
    searchQuery,
    selectedCategory,
    selectedStatus,
    selectedGeoLevel,
    selectedFilterAge,
    selectedFilterGender,
    user?.id,
  ]);

  const activeCount = useMemo(() => filteredProposals.filter((p) => !isProposalEnded(p)).length, [filteredProposals]);

  const fetchData = useCallback(
    async (isRefresh = false) => {
      isRefresh ? setRefreshing(true) : setLoading(true);
      try {
        const [proposalsRes, claimedRes, votedRes, profileRes, verificationRes] = await Promise.all([
          proposalsApi.getAll(),
          isAuthenticated ? userApi.getClaimedTokens() : Promise.resolve({ data: [], error: null }),
          isAuthenticated ? userApi.getVotedProposals() : Promise.resolve({ data: [], error: null }),
          isAuthenticated ? userApi.getProfile() : Promise.resolve({ data: null, error: null }),
          isAuthenticated ? userApi.getVerificationStatus() : Promise.resolve({ data: { verified: false }, error: null }),
        ]);

        if (proposalsRes.data) setProposals(proposalsRes.data);

        if (claimedRes.data) {
          setClaimedTokens(new Set(claimedRes.data.map((c: any) => (typeof c === 'object' ? c.proposalId : c))));
        }

        if (votedRes.data) {
          setVotedProposals(new Set(votedRes.data.map((v: any) => (typeof v === 'object' ? v.proposalId : v))));
        }

        if (profileRes.data) {
          setUserCountry(profileRes.data.country || user?.country || '');
          setUserState(profileRes.data.state || user?.state || '');
          setUserCity(profileRes.data.city || user?.city || '');
        }

        setIsVerified(!!verificationRes.data?.verified);
      } catch (error) {
        console.error('Error fetching proposals:', error);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [isAuthenticated, user?.city, user?.country, user?.state]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleClaimToken = async (proposalId: number) => {
    if (!isAuthenticated) {
      Alert.alert('Sign in required', 'Please sign in to claim voting tokens.');
      return;
    }
    setVotingProposalId(proposalId);
    try {
      const result = await proposalsApi.claimVoteToken(proposalId);
      if (result.error) {
        Alert.alert('Unable to claim', result.error);
      } else {
        setClaimedTokens((prev) => new Set(prev).add(proposalId));
        haptics.success();
      }
    } finally {
      setVotingProposalId(null);
    }
  };

  const handleVote = async (proposalId: number, position: 'support' | 'oppose') => {
    if (!isAuthenticated) {
      Alert.alert('Sign in required', 'Please sign in to vote.');
      return;
    }
    if (!isVerified) {
      Alert.alert('Verification required', 'Complete identity verification before voting.');
      return;
    }
    setVotingProposalId(proposalId);
    try {
      const result = await proposalsApi.submitVote(proposalId, position);
      if (result.error) {
        Alert.alert('Unable to vote', result.error);
      } else {
        setVotedProposals((prev) => new Set(prev).add(proposalId));
        haptics.success();
      }
    } finally {
      setVotingProposalId(null);
    }
  };

  const handleCreateProposal = async () => {
    if (!newProposal.title || !newProposal.description) {
      Alert.alert('Missing info', 'Add a title and description.');
      return;
    }
    setCreating(true);
    try {
      let imageUrl = '';
      if (newProposal.imageUri) {
        imageUrl = (await uploadsApi.uploadImage({
          uri: newProposal.imageUri,
          name: `proposal-${Date.now()}.jpg`,
          type: 'image/jpeg',
        })) as string;
      }

      const geoRestrictions: string[] = [];
      if (newProposal.geoScope === 'national' && newProposal.country) geoRestrictions.push(newProposal.country);
      if (newProposal.geoScope === 'state' && newProposal.country && newProposal.state) {
        geoRestrictions.push(newProposal.country, newProposal.state);
      }
      if (newProposal.geoScope === 'city' && newProposal.country && newProposal.state && newProposal.city) {
        geoRestrictions.push(newProposal.country, newProposal.state, newProposal.city);
      }

      const response = await proposalsApi.create({
        title: newProposal.title,
        description: newProposal.description,
        category: newProposal.category,
        geoRestrictions,
        demographicRestrictions: { ageGroup: newProposal.ageGroup, gender: newProposal.gender },
        imageUrl,
      });

      if (response.error) {
        Alert.alert('Unable to create', response.error);
      } else {
        setShowCreateModal(false);
        setNewProposal({
          title: '',
          description: '',
          category: 'Other',
          country: userCountry,
          state: userState,
          city: userCity,
          geoScope: 'national',
          ageGroup: 'All Ages',
          gender: 'All Genders',
          imageUri: '',
        });
        fetchData();
      }
    } finally {
      setCreating(false);
    }
  };

  const openProposal = (proposal: Proposal) => {
    setSelectedProposal(proposal);
    setShowDetailModal(true);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchData(true)} tintColor={colors.gold} />}
      >
        <LinearGradient colors={[colors.backgroundSecondary, colors.background]} style={styles.hero}>
          <Text style={[styles.heroTitle, { color: colors.text }]}>Proposals</Text>
          <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}
          >{activeCount} active votes · {filteredProposals.length} total</Text>
          <View style={styles.heroActions}>
            <TouchableOpacity
              style={[styles.heroButton, { backgroundColor: colors.gold }]}
              onPress={() => setShowCreateModal(true)}
            >
              <Ionicons name="add" size={16} color={colors.background} />
              <Text style={[styles.heroButtonText, { color: colors.background }]}>New proposal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.heroButtonOutline, { borderColor: colors.border }]}
              onPress={() => setShowFilters((prev) => !prev)}
            >
              <Ionicons name="options" size={16} color={colors.text} />
              <Text style={[styles.heroButtonText, { color: colors.text }]}
              >Filters</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <View style={[styles.searchRow, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
        >
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            placeholder="Search proposals"
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={[styles.searchInput, { color: colors.text }]}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}
        >
          {CATEGORIES.map((category) => (
            <FilterChip
              key={category}
              label={category}
              selected={selectedCategory === category}
              onPress={() => setSelectedCategory(category)}
            />
          ))}
        </ScrollView>

        {showFilters && (
          <View style={[styles.filtersPanel, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
          >
            <Text style={[styles.filterTitle, { color: colors.text }]}>Status</Text>
            <View style={styles.filterWrap}>
              {STATUS_FILTERS.map((filter) => (
                <FilterChip
                  key={filter}
                  label={filter}
                  selected={selectedStatus === filter}
                  onPress={() => setSelectedStatus(filter)}
                />
              ))}
            </View>

            <Text style={[styles.filterTitle, { color: colors.text }]}>Geo level</Text>
            <View style={styles.filterWrap}>
              {GEO_LEVELS.map((filter) => (
                <FilterChip
                  key={filter}
                  label={filter}
                  selected={selectedGeoLevel === filter}
                  onPress={() => setSelectedGeoLevel(filter)}
                />
              ))}
            </View>

            <Text style={[styles.filterTitle, { color: colors.text }]}>Age group</Text>
            <View style={styles.filterWrap}>
              {AGE_GROUPS.map((filter) => (
                <FilterChip
                  key={filter}
                  label={filter}
                  selected={selectedFilterAge === filter}
                  onPress={() => setSelectedFilterAge(filter)}
                />
              ))}
            </View>

            <Text style={[styles.filterTitle, { color: colors.text }]}>Gender</Text>
            <View style={styles.filterWrap}>
              {GENDERS.map((filter) => (
                <FilterChip
                  key={filter}
                  label={filter}
                  selected={selectedFilterGender === filter}
                  onPress={() => setSelectedFilterGender(filter)}
                />
              ))}
            </View>
          </View>
        )}

        <View style={styles.listSection}>
          {loading ? (
            <ActivityIndicator size="large" color={colors.gold} />
          ) : filteredProposals.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
            >
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}
              >No proposals match your filters.</Text>
            </View>
          ) : (
            filteredProposals.map((proposal) => (
              <ProposalCard
                key={proposal.id}
                proposal={proposal}
                onPress={() => openProposal(proposal)}
              />
            ))
          )}
        </View>
      </ScrollView>

      <Modal visible={showDetailModal} animationType="slide" transparent onRequestClose={() => setShowDetailModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
          >
            <ScrollView>
              <Text style={[styles.modalTitle, { color: colors.text }]}
              >{selectedProposal?.title}</Text>
              <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}
              >{selectedProposal?.category || 'General'} · {getTimeRemaining(selectedProposal?.deadline || null) || 'Open'}</Text>
              {selectedProposal?.imageUrl ? (
                <Image source={{ uri: selectedProposal.imageUrl }} style={styles.modalImage} />
              ) : null}
              <Text style={[styles.modalBody, { color: colors.textSecondary }]}
              >{selectedProposal?.description}</Text>

              <View style={styles.modalActionRow}>
                {!claimedTokens.has(selectedProposal?.id || 0) && (
                  <TouchableOpacity
                    style={[styles.modalAction, { borderColor: colors.border }]}
                    onPress={() => handleClaimToken(selectedProposal?.id || 0)}
                  >
                    <Text style={[styles.modalActionText, { color: colors.text }]}>Claim token</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.modalAction, { borderColor: colors.border }]}
                  onPress={() => selectedProposal && shareProposal(selectedProposal)}
                >
                  <Text style={[styles.modalActionText, { color: colors.text }]}>Share</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.voteRow}>
                <TouchableOpacity
                  style={[styles.voteButton, { backgroundColor: colors.success }]}
                  onPress={() => selectedProposal && handleVote(selectedProposal.id, 'support')}
                  disabled={votingProposalId === selectedProposal?.id}
                >
                  <Text style={[styles.voteText, { color: colors.background }]}>Support</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.voteButton, { backgroundColor: colors.error }]}
                  onPress={() => selectedProposal && handleVote(selectedProposal.id, 'oppose')}
                  disabled={votingProposalId === selectedProposal?.id}
                >
                  <Text style={[styles.voteText, { color: colors.background }]}>Oppose</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <TouchableOpacity onPress={() => setShowDetailModal(false)} style={styles.modalClose}
            >
              <Text style={[styles.modalCloseText, { color: colors.textSecondary }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showCreateModal} animationType="slide">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={[styles.modalContent, { backgroundColor: colors.background }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Create a proposal</Text>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Title</Text>
              <TextInput
                value={newProposal.title}
                onChangeText={(text) => setNewProposal((prev) => ({ ...prev, title: text }))}
                placeholder="Proposal title"
                placeholderTextColor={colors.textMuted}
                style={[styles.input, { backgroundColor: colors.cardBg, borderColor: colors.border, color: colors.text }]}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Description</Text>
              <TextInput
                value={newProposal.description}
                onChangeText={(text) => setNewProposal((prev) => ({ ...prev, description: text }))}
                placeholder="Describe the proposal"
                placeholderTextColor={colors.textMuted}
                style={[styles.input, styles.textArea, { backgroundColor: colors.cardBg, borderColor: colors.border, color: colors.text }]}
                multiline
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {CATEGORIES.filter((category) => category !== 'All').map((category) => (
                  <FilterChip
                    key={category}
                    label={category}
                    selected={newProposal.category === category}
                    onPress={() => setNewProposal((prev) => ({ ...prev, category }))}
                  />
                ))}
              </ScrollView>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Add a cover image</Text>
              <TouchableOpacity
                style={[styles.imagePicker, { borderColor: colors.border, backgroundColor: colors.cardBg }]}
                onPress={pickImage}
              >
                {newProposal.imageUri ? (
                  <Image source={{ uri: newProposal.imageUri }} style={styles.imagePreview} />
                ) : (
                  <Text style={[styles.imagePlaceholder, { color: colors.textMuted }]}>Upload image</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={[styles.modalAction, { borderColor: colors.border }]}
                onPress={() => setShowCreateModal(false)}
              >
                <Text style={[styles.modalActionText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalAction, { backgroundColor: colors.gold }]}
                onPress={handleCreateProposal}
                disabled={creating}
              >
                <Text style={[styles.modalActionText, { color: colors.background }]}
                >{creating ? 'Creating…' : 'Publish'}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: SPACING.xl,
    paddingBottom: SPACING.xxl,
  },
  hero: {
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    marginBottom: SPACING.lg,
    ...SHADOWS.soft,
  },
  heroTitle: {
    ...TYPOGRAPHY.displaySmall,
  },
  heroSubtitle: {
    ...TYPOGRAPHY.bodyMedium,
    marginTop: SPACING.xs,
  },
  heroActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  heroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
  },
  heroButtonOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  heroButtonText: {
    ...TYPOGRAPHY.labelMedium,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.md,
  },
  searchInput: {
    flex: 1,
    ...TYPOGRAPHY.bodyMedium,
  },
  filterRow: {
    marginBottom: SPACING.md,
  },
  filterChip: {
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    marginRight: SPACING.sm,
  },
  filterChipText: {
    ...TYPOGRAPHY.bodySmall,
  },
  filtersPanel: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
    ...SHADOWS.soft,
  },
  filterTitle: {
    ...TYPOGRAPHY.labelLarge,
  },
  filterWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  listSection: {
    gap: SPACING.md,
  },
  proposalCard: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    gap: SPACING.sm,
    ...SHADOWS.soft,
  },
  proposalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  proposalCategory: {
    ...TYPOGRAPHY.labelMedium,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  statusBadge: {
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  statusText: {
    ...TYPOGRAPHY.bodySmall,
  },
  proposalTitle: {
    ...TYPOGRAPHY.headlineSmall,
  },
  proposalBody: {
    ...TYPOGRAPHY.bodyMedium,
  },
  proposalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  proposalMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  proposalMetaText: {
    ...TYPOGRAPHY.bodySmall,
  },
  emptyCard: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    ...SHADOWS.soft,
  },
  emptyText: {
    ...TYPOGRAPHY.bodyMedium,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    maxHeight: '85%',
  },
  modalTitle: {
    ...TYPOGRAPHY.headlineMedium,
  },
  modalSubtitle: {
    ...TYPOGRAPHY.bodySmall,
    marginTop: SPACING.xs,
  },
  modalBody: {
    ...TYPOGRAPHY.bodyMedium,
    marginTop: SPACING.md,
  },
  modalImage: {
    width: '100%',
    height: 180,
    borderRadius: BORDER_RADIUS.lg,
    marginTop: SPACING.md,
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  modalAction: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  modalActionText: {
    ...TYPOGRAPHY.labelMedium,
  },
  voteRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  voteButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
  },
  voteText: {
    ...TYPOGRAPHY.labelMedium,
  },
  modalClose: {
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  modalCloseText: {
    ...TYPOGRAPHY.bodyMedium,
  },
  modalContent: {
    padding: SPACING.xl,
    paddingBottom: SPACING.xxl,
  },
  inputGroup: {
    marginTop: SPACING.md,
  },
  inputLabel: {
    ...TYPOGRAPHY.labelLarge,
    marginBottom: SPACING.xs,
  },
  input: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    ...TYPOGRAPHY.bodyMedium,
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  imagePicker: {
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePreview: {
    width: '100%',
    height: 160,
    borderRadius: BORDER_RADIUS.lg,
  },
  imagePlaceholder: {
    ...TYPOGRAPHY.bodyMedium,
  },
});
