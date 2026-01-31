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
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { proposalsApi, userApi, uploadsApi, Proposal } from '../../lib/api';
import { useAuthStore } from '../../lib/auth';
import { shareProposal } from '../../lib/share';
import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS } from '../../lib/theme';
import { haptics } from '../../lib/haptics';
import * as ImagePicker from 'expo-image-picker';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

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

// Filter Chip Component
function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    haptics.selection();
    scale.value = withSpring(0.95, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedTouchable
      style={[
        styles.filterChip,
        {
          backgroundColor: selected ? colors.gold : colors.cardBg,
          borderColor: selected ? colors.gold : colors.border,
        },
        animatedStyle,
      ]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
    >
      <Text style={[styles.filterChipText, { color: selected ? '#000' : colors.text }]}>
        {label}
      </Text>
    </AnimatedTouchable>
  );
}

// Premium Proposal Card Component
interface ProposalCardProps {
  proposal: Proposal;
  hasClaimed: boolean;
  hasVoted: boolean;
  onClaimToken: (id: number) => Promise<void>;
  onVote: (id: number, vote: 'support' | 'oppose') => Promise<void>;
  isVoting: boolean;
  onPress: () => void;
  index: number;
}

function ProposalCard({
  proposal,
  hasClaimed,
  hasVoted,
  onClaimToken,
  onVote,
  isVoting,
  onPress,
  index,
}: ProposalCardProps) {
  const { colors } = useTheme();
  const [claiming, setClaiming] = useState(false);
  const scale = useSharedValue(1);

  const totalVotes = (proposal.supportVotes || 0) + (proposal.opposeVotes || 0);
  const supportPercent =
    totalVotes > 0 ? Math.round(((proposal.supportVotes || 0) / totalVotes) * 100) : 50;

  const timeRemaining = getTimeRemaining(proposal.deadline);
  const isEnded = timeRemaining === 'Ended';
  const geoTags = proposal.geoRestrictions || [];

  const handlePressIn = () => {
    haptics.light();
    scale.value = withSpring(0.98, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handleClaimToken = async () => {
    haptics.medium();
    setClaiming(true);
    try {
      await onClaimToken(proposal.id as number);
      haptics.success();
    } catch {
      haptics.error();
    } finally {
      setClaiming(false);
    }
  };

  const handleShare = () => {
    haptics.light();
    shareProposal({
      id: proposal.id as number,
      title: proposal.title,
      description: proposal.description,
    });
  };

  return (
    <AnimatedTouchable
      entering={FadeInUp.delay(index * 80).duration(400).springify()}
      style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }, animatedStyle]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
    >
      <LinearGradient
        colors={[`${colors.gold}08`, 'transparent']}
        style={styles.cardGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <View style={styles.cardHeader}>
        <View style={[styles.categoryBadge, { backgroundColor: colors.goldLight }]}>
          <Text style={[styles.categoryText, { color: colors.gold }]}>{proposal.category || 'General'}</Text>
        </View>

        <View style={styles.headerRight}>
          {timeRemaining ? (
            <View
              style={[
                styles.deadlineBadge,
                { backgroundColor: isEnded ? colors.errorLight : colors.goldLight },
              ]}
            >
              <Ionicons name="time-outline" size={12} color={isEnded ? colors.error : colors.gold} />
              <Text style={[styles.deadlineText, { color: isEnded ? colors.error : colors.gold }]}>
                {timeRemaining}
              </Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.shareButton, { backgroundColor: colors.goldLight }]}
            onPress={(e) => {
              e.stopPropagation();
              handleShare();
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="share-outline" size={16} color={colors.gold} />
          </TouchableOpacity>
        </View>
      </View>

      {geoTags.length > 0 && (
        <View style={styles.geoTags}>
          {geoTags.slice(0, 3).map((tag, i) => (
            <View key={i} style={[styles.geoTag, { backgroundColor: colors.infoLight }]}>
              <Ionicons name="location-outline" size={10} color={colors.info} />
              <Text style={[styles.geoTagText, { color: colors.info }]}>{tag}</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
        {proposal.title}
      </Text>
      <Text style={[styles.cardDescription, { color: colors.textSecondary }]} numberOfLines={3}>
        {proposal.description}
      </Text>

      {proposal.imageUrl ? (
        <View style={styles.imageContainer}>
          <Image source={{ uri: proposal.imageUrl }} style={styles.proposalImage} resizeMode="cover" />
        </View>
      ) : null}

      <View style={styles.voteSection}>
        <View style={[styles.voteBar, { backgroundColor: colors.error }]}>
          <Animated.View style={[styles.supportBar, { width: `${supportPercent}%`, backgroundColor: colors.success }]} />
        </View>

        <View style={styles.voteStats}>
          <View style={styles.voteStat}>
            <View style={[styles.voteIconBg, { backgroundColor: `${colors.success}20` }]}>
              <Ionicons name="thumbs-up" size={12} color={colors.success} />
            </View>
            <Text style={[styles.voteCount, { color: colors.textSecondary }]}>
              {(proposal.supportVotes || 0).toLocaleString()}
            </Text>
          </View>

          <View style={styles.voteStat}>
            <View style={[styles.voteIconBg, { backgroundColor: `${colors.error}20` }]}>
              <Ionicons name="thumbs-down" size={12} color={colors.error} />
            </View>
            <Text style={[styles.voteCount, { color: colors.textSecondary }]}>
              {(proposal.opposeVotes || 0).toLocaleString()}
            </Text>
          </View>
        </View>
      </View>

      {isEnded ? (
        <View style={[styles.statusContainer, { backgroundColor: colors.errorLight }]}>
          <Ionicons name="flag-outline" size={18} color={colors.error} />
          <Text style={[styles.statusText, { color: colors.error }]}>Voting has ended</Text>
        </View>
      ) : hasVoted ? (
        <View style={[styles.statusContainer, { backgroundColor: colors.goldLight }]}>
          <Ionicons name="checkmark-circle" size={18} color={colors.gold} />
          <Text style={[styles.statusText, { color: colors.gold }]}>You have voted</Text>
        </View>
      ) : !hasClaimed ? (
        <TouchableOpacity
          style={[styles.claimButton, { backgroundColor: colors.gold }, claiming && styles.buttonDisabled]}
          onPress={(e) => {
            e.stopPropagation();
            handleClaimToken();
          }}
          disabled={claiming}
          activeOpacity={0.8}
        >
          {claiming ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <>
              <Ionicons name="wallet-outline" size={18} color="#000" />
              <Text style={styles.claimButtonText}>Claim Vote Token</Text>
            </>
          )}
        </TouchableOpacity>
      ) : (
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.voteButton, { backgroundColor: colors.success }, isVoting && styles.buttonDisabled]}
            onPress={(e) => {
              e.stopPropagation();
              haptics.medium();
              onVote(proposal.id as number, 'support');
            }}
            disabled={isVoting}
            activeOpacity={0.8}
          >
            {isVoting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={16} color="#fff" />
                <Text style={styles.voteButtonText}>Support</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.voteButton, { backgroundColor: colors.error }, isVoting && styles.buttonDisabled]}
            onPress={(e) => {
              e.stopPropagation();
              haptics.medium();
              onVote(proposal.id as number, 'oppose');
            }}
            disabled={isVoting}
            activeOpacity={0.8}
          >
            {isVoting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="close-circle" size={16} color="#fff" />
                <Text style={styles.voteButtonText}>Oppose</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </AnimatedTouchable>
  );
}

function ProposalSkeleton({ index }: { index: number }) {
  const { colors } = useTheme();

  return (
    <Animated.View
      entering={FadeIn.delay(index * 100).duration(300)}
      style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.skeletonBadge, { backgroundColor: colors.goldLight }]} />
        <View style={[styles.skeletonSmall, { backgroundColor: colors.goldLight }]} />
      </View>
      <View style={[styles.skeletonTitle, { backgroundColor: colors.goldLight }]} />
      <View style={[styles.skeletonLine, { backgroundColor: colors.goldLight }]} />
      <View style={[styles.skeletonLine, { backgroundColor: colors.goldLight, width: '60%' }]} />
      <View style={[styles.skeletonButton, { backgroundColor: colors.goldLight }]} />
    </Animated.View>
  );
}

export default function ProposalsScreen() {
  const { colors } = useTheme();
  const { isAuthenticated, user } = useAuthStore();

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

  // Details modal
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

      const matchesCategory =
        selectedCategory === 'All' || (proposal.category || 'Other') === selectedCategory;

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
        const [proposalsRes, claimedRes, votedRes, profileRes] = await Promise.all([
          proposalsApi.getAll(),
          isAuthenticated ? userApi.getClaimedTokens() : Promise.resolve({ data: [], error: null }),
          isAuthenticated ? userApi.getVotedProposals() : Promise.resolve({ data: [], error: null }),
          isAuthenticated ? userApi.getProfile() : Promise.resolve({ data: null, error: null }),
        ]);

        if (proposalsRes.data) setProposals(proposalsRes.data);

        if (claimedRes.data) {
          setClaimedTokens(new Set(claimedRes.data.map((c: any) => (typeof c === 'object' ? c.proposalId : c))));
        }

        if (votedRes.data) {
          setVotedProposals(new Set(votedRes.data.map((v: any) => (typeof v === 'object' ? v.proposalId : v))));
        }

        if (profileRes.data) {
          setUserCountry(profileRes.data.country || '');
          setUserState(profileRes.data.state || '');
          setUserCity(profileRes.data.city || '');
          setIsVerified(profileRes.data.verified || false);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [isAuthenticated]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleClaimToken = async (proposalId: number) => {
    if (!isAuthenticated) {
      Alert.alert('Sign In Required', 'Please sign in to claim vote tokens.');
      return;
    }
    try {
      const result = await proposalsApi.claimVoteToken(proposalId);
      if (result.error) {
        Alert.alert('Error', result.error);
        return;
      }
      setClaimedTokens((prev) => new Set([...prev, proposalId]));
      Alert.alert('Success', 'Vote token claimed! You can now vote on this proposal.');
    } catch {
      Alert.alert('Error', 'Failed to claim vote token. Please try again.');
    }
  };

  const handleVote = async (proposalId: number, vote: 'support' | 'oppose') => {
    if (!isAuthenticated) {
      Alert.alert('Sign In Required', 'Please sign in to vote.');
      return;
    }
    setVotingProposalId(proposalId);
    try {
      const result = await proposalsApi.submitVote(proposalId, vote);
      if (result.error) {
        Alert.alert('Error', result.error);
        return;
      }

      setVotedProposals((prev) => new Set([...prev, proposalId]));

      setProposals((prev) =>
        prev.map((p) =>
          (p.id as number) === proposalId
            ? {
                ...p,
                supportVotes: vote === 'support' ? (p.supportVotes || 0) + 1 : p.supportVotes,
                opposeVotes: vote === 'oppose' ? (p.opposeVotes || 0) + 1 : p.opposeVotes,
              }
            : p
        )
      );

      // Keep details modal in sync if open
      setSelectedProposal((sp) => {
        if (!sp) return sp;
        if ((sp.id as number) !== proposalId) return sp;
        return {
          ...sp,
          supportVotes: vote === 'support' ? (sp.supportVotes || 0) + 1 : sp.supportVotes,
          opposeVotes: vote === 'oppose' ? (sp.opposeVotes || 0) + 1 : sp.opposeVotes,
        };
      });

      Alert.alert('Vote Recorded', `Your ${vote} vote has been recorded on the blockchain.`);
    } catch {
      Alert.alert('Error', 'Failed to submit vote. Please try again.');
    } finally {
      setVotingProposalId(null);
    }
  };

  const handleCreateProposal = async () => {
    if (!newProposal.title.trim()) {
      Alert.alert('Error', 'Please enter a proposal title.');
      return;
    }
    if (!newProposal.description.trim()) {
      Alert.alert('Error', 'Please enter a proposal description.');
      return;
    }

    setCreating(true);
    try {
      const geoRestrictions: string[] = [];
      if (userCountry) {
        geoRestrictions.push(userCountry);
        if ((newProposal.geoScope === 'state' || newProposal.geoScope === 'city') && userState) {
          geoRestrictions.push(userState);
        }
        if (newProposal.geoScope === 'city' && userCity) {
          geoRestrictions.push(userCity);
        }
      }

      const demographicRestrictions: any = {};
      if (newProposal.ageGroup !== 'All Ages') demographicRestrictions.ageGroup = newProposal.ageGroup;
      if (newProposal.gender !== 'All Genders') demographicRestrictions.gender = newProposal.gender;

      let imageUrl: string | undefined;
      if (newProposal.imageUri) {
        const fileName = newProposal.imageUri.split('/').pop() || 'proposal-image.jpg';
        const uploadedUrl = await uploadsApi.uploadImage({
          uri: newProposal.imageUri,
          name: fileName,
          type: 'image/jpeg',
        });
        if (uploadedUrl) imageUrl = uploadedUrl;
      }

      const result = await proposalsApi.create({
        title: newProposal.title.trim(),
        description: newProposal.description.trim(),
        category: newProposal.category,
        geoRestrictions: geoRestrictions.length > 0 ? geoRestrictions : undefined,
        demographicRestrictions: Object.keys(demographicRestrictions).length > 0 ? demographicRestrictions : undefined,
        imageUrl,
      });

      if (result.error) {
        Alert.alert('Error', result.error);
        return;
      }

      Alert.alert('Success', 'Your proposal has been created!');
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
      fetchData(true);
    } catch {
      Alert.alert('Error', 'Failed to create proposal. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('All');
    setSelectedStatus('All');
    setSelectedGeoLevel('All');
    setSelectedFilterAge('All Ages');
    setSelectedFilterGender('All Genders');
  };

  const hasActiveFilters =
    searchQuery !== '' ||
    selectedCategory !== 'All' ||
    selectedStatus !== 'All' ||
    selectedGeoLevel !== 'All' ||
    selectedFilterAge !== 'All Ages' ||
    selectedFilterGender !== 'All Genders';

  const openProposal = (p: Proposal) => {
    haptics.light();
    setSelectedProposal(p);
    setShowDetailModal(true);
  };

  const closeProposal = () => {
    setShowDetailModal(false);
    setTimeout(() => setSelectedProposal(null), 150);
  };

  const detail = selectedProposal;
  const detailHasClaimed = detail ? claimedTokens.has(detail.id as number) : false;
  const detailHasVoted = detail ? votedProposals.has(detail.id as number) : false;
  const detailIsVoting = detail ? votingProposalId === (detail.id as number) : false;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <Animated.View entering={FadeInDown.duration(400)} style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.headerContent}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Proposals</Text>
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
              {activeCount} active
            </Text>
          </View>

          <View style={styles.headerButtons}>
            <TouchableOpacity
              style={[
                styles.iconButton,
                {
                  backgroundColor: hasActiveFilters ? colors.gold : colors.cardBg,
                  borderColor: hasActiveFilters ? colors.gold : colors.border,
                },
              ]}
              onPress={() => setShowFilters(!showFilters)}
            >
              <Ionicons name="filter" size={18} color={hasActiveFilters ? '#000' : colors.text} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.createButton, { backgroundColor: colors.gold, ...SHADOWS.glow }]}
              onPress={() => {
                haptics.light();
                setShowCreateModal(true);
              }}
            >
              <Ionicons name="add" size={22} color="#000" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchWrapper}>
          <View style={[styles.searchContainer, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <Ionicons name="search-outline" size={18} color={colors.textMuted} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search proposals..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </Animated.View>

      {/* Filter Panel */}
      {showFilters && (
        <Animated.View
          entering={FadeInDown.duration(300)}
          style={[styles.filterPanel, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
        >
          <View style={styles.filterSection}>
            <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.filterOptions}>
                {CATEGORIES.map((cat) => (
                  <FilterChip
                    key={cat}
                    label={cat}
                    selected={selectedCategory === cat}
                    onPress={() => setSelectedCategory(cat)}
                  />
                ))}
              </View>
            </ScrollView>
          </View>

          <View style={styles.filterSection}>
            <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>Status</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.filterOptions}>
                {STATUS_FILTERS.map((s) => (
                  <FilterChip key={s} label={s} selected={selectedStatus === s} onPress={() => setSelectedStatus(s)} />
                ))}
              </View>
            </ScrollView>
          </View>

          <View style={styles.filterSection}>
            <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>Geographic Level</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.filterOptions}>
                {GEO_LEVELS.map((g) => (
                  <FilterChip key={g} label={g} selected={selectedGeoLevel === g} onPress={() => setSelectedGeoLevel(g)} />
                ))}
              </View>
            </ScrollView>
          </View>

          {hasActiveFilters && (
            <TouchableOpacity style={styles.clearFiltersButton} onPress={clearFilters}>
              <Ionicons name="close-circle" size={16} color={colors.error} />
              <Text style={[styles.clearFiltersText, { color: colors.error }]}>Clear all filters</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      )}

      {/* Content */}
      {loading ? (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {[0, 1, 2].map((i) => (
            <ProposalSkeleton key={i} index={i} />
          ))}
        </ScrollView>
      ) : filteredProposals.length === 0 ? (
        <Animated.View entering={FadeIn.duration(400)} style={styles.emptyContainer}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.goldLight }]}>
            <Ionicons name="document-text-outline" size={48} color={colors.gold} />
          </View>
          <Text style={[styles.emptyText, { color: colors.text }]}>No proposals found</Text>
          <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
            {hasActiveFilters ? 'Try adjusting your filters' : 'Be the first to create one!'}
          </Text>
          {!hasActiveFilters && (
            <TouchableOpacity
              style={[styles.emptyCreateButton, { backgroundColor: colors.gold }]}
              onPress={() => setShowCreateModal(true)}
            >
              <Ionicons name="add-circle-outline" size={20} color="#000" />
              <Text style={styles.emptyCreateButtonText}>Create Proposal</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchData(true)}
              tintColor={colors.gold}
              colors={[colors.gold]}
            />
          }
        >
          {filteredProposals.map((proposal, index) => (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              hasClaimed={claimedTokens.has(proposal.id as number)}
              hasVoted={votedProposals.has(proposal.id as number)}
              onClaimToken={handleClaimToken}
              onVote={handleVote}
              isVoting={votingProposalId === proposal.id}
              onPress={() => openProposal(proposal)}
              index={index}
            />
          ))}
          <View style={styles.bottomPadding} />
        </ScrollView>
      )}

      {/* Proposal Details Modal */}
      <Modal visible={showDetailModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeProposal}>
        <View style={[styles.detailContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.detailHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={closeProposal} style={styles.modalHeaderButton} activeOpacity={0.7}>
              <Ionicons name="chevron-down" size={24} color={colors.textSecondary} />
            </TouchableOpacity>

            <Text style={[styles.detailHeaderTitle, { color: colors.text }]} numberOfLines={1}>
              Proposal
            </Text>

            <TouchableOpacity
              onPress={() => {
                if (!detail) return;
                haptics.light();
                shareProposal({ id: detail.id as number, title: detail.title, description: detail.description });
              }}
              style={[styles.detailShareBtn, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
              activeOpacity={0.8}
            >
              <Ionicons name="share-outline" size={18} color={colors.text} />
            </TouchableOpacity>
          </View>

          {!detail ? null : (
            <ScrollView contentContainerStyle={styles.detailContent} showsVerticalScrollIndicator={false}>
              <View style={[styles.detailCard, { backgroundColor: colors.cardBg, borderColor: colors.border }, SHADOWS.md]}>
                <LinearGradient
                  colors={[`${colors.gold}10`, 'transparent']}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />

                <View style={styles.detailTopRow}>
                  <View style={[styles.categoryBadge, { backgroundColor: colors.goldLight }]}>
                    <Text style={[styles.categoryText, { color: colors.gold }]}>{detail.category || 'General'}</Text>
                  </View>

                  {detail.deadline ? (
                    <View
                      style={[
                        styles.deadlineBadge,
                        { backgroundColor: isProposalEnded(detail) ? colors.errorLight : colors.goldLight },
                      ]}
                    >
                      <Ionicons
                        name="time-outline"
                        size={12}
                        color={isProposalEnded(detail) ? colors.error : colors.gold}
                      />
                      <Text
                        style={[
                          styles.deadlineText,
                          { color: isProposalEnded(detail) ? colors.error : colors.gold },
                        ]}
                      >
                        {getTimeRemaining(detail.deadline)}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {(detail.geoRestrictions || []).length > 0 && (
                  <View style={[styles.geoTags, { marginTop: SPACING.sm }]}>
                    {(detail.geoRestrictions || []).slice(0, 6).map((tag, i) => (
                      <View key={i} style={[styles.geoTag, { backgroundColor: colors.infoLight }]}>
                        <Ionicons name="location-outline" size={10} color={colors.info} />
                        <Text style={[styles.geoTagText, { color: colors.info }]}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}

                <Text style={[styles.detailTitle, { color: colors.text }]}>{detail.title}</Text>
                <Text style={[styles.detailDesc, { color: colors.textSecondary }]}>{detail.description}</Text>

                {detail.imageUrl ? (
                  <View style={[styles.imageContainer, { marginTop: SPACING.md }]}>
                    <Image source={{ uri: detail.imageUrl }} style={styles.proposalImage} resizeMode="cover" />
                  </View>
                ) : null}

                {/* Progress */}
                <View style={[styles.voteSection, { marginTop: SPACING.lg, marginBottom: 0 }]}>
                  {(() => {
                    const total = (detail.supportVotes || 0) + (detail.opposeVotes || 0);
                    const supportPct = total > 0 ? Math.round(((detail.supportVotes || 0) / total) * 100) : 50;
                    return (
                      <>
                        <View style={[styles.voteBar, { backgroundColor: colors.error }]}>
                          <Animated.View
                            style={[styles.supportBar, { width: `${supportPct}%`, backgroundColor: colors.success }]}
                          />
                        </View>
                        <View style={styles.voteStats}>
                          <View style={styles.voteStat}>
                            <View style={[styles.voteIconBg, { backgroundColor: `${colors.success}20` }]}>
                              <Ionicons name="thumbs-up" size={12} color={colors.success} />
                            </View>
                            <Text style={[styles.voteCount, { color: colors.textSecondary }]}>
                              {(detail.supportVotes || 0).toLocaleString()}
                            </Text>
                          </View>
                          <View style={styles.voteStat}>
                            <View style={[styles.voteIconBg, { backgroundColor: `${colors.error}20` }]}>
                              <Ionicons name="thumbs-down" size={12} color={colors.error} />
                            </View>
                            <Text style={[styles.voteCount, { color: colors.textSecondary }]}>
                              {(detail.opposeVotes || 0).toLocaleString()}
                            </Text>
                          </View>
                        </View>
                      </>
                    );
                  })()}
                </View>

                {/* Actions */}
                <View style={{ marginTop: SPACING.lg }}>
                  {isProposalEnded(detail) ? (
                    <View style={[styles.statusContainer, { backgroundColor: colors.errorLight }]}>
                      <Ionicons name="flag-outline" size={18} color={colors.error} />
                      <Text style={[styles.statusText, { color: colors.error }]}>Voting has ended</Text>
                    </View>
                  ) : detailHasVoted ? (
                    <View style={[styles.statusContainer, { backgroundColor: colors.goldLight }]}>
                      <Ionicons name="checkmark-circle" size={18} color={colors.gold} />
                      <Text style={[styles.statusText, { color: colors.gold }]}>You have voted</Text>
                    </View>
                  ) : !detailHasClaimed ? (
                    <TouchableOpacity
                      style={[styles.claimButton, { backgroundColor: colors.gold }, detailIsVoting && styles.buttonDisabled]}
                      onPress={async () => {
                        if (!detail) return;
                        haptics.medium();
                        await handleClaimToken(detail.id as number);
                      }}
                      activeOpacity={0.85}
                      disabled={detailIsVoting}
                    >
                      {detailIsVoting ? (
                        <ActivityIndicator size="small" color="#000" />
                      ) : (
                        <>
                          <Ionicons name="wallet-outline" size={18} color="#000" />
                          <Text style={styles.claimButtonText}>Claim Vote Token</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.actionButtons}>
                      <TouchableOpacity
                        style={[styles.voteButton, { backgroundColor: colors.success }, detailIsVoting && styles.buttonDisabled]}
                        onPress={() => detail && handleVote(detail.id as number, 'support')}
                        disabled={detailIsVoting}
                        activeOpacity={0.85}
                      >
                        {detailIsVoting ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <Ionicons name="checkmark-circle" size={16} color="#fff" />
                            <Text style={styles.voteButtonText}>Support</Text>
                          </>
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.voteButton, { backgroundColor: colors.error }, detailIsVoting && styles.buttonDisabled]}
                        onPress={() => detail && handleVote(detail.id as number, 'oppose')}
                        disabled={detailIsVoting}
                        activeOpacity={0.85}
                      >
                        {detailIsVoting ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <Ionicons name="close-circle" size={16} color="#fff" />
                            <Text style={styles.voteButtonText}>Oppose</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>

              <View style={{ height: 120 }} />
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* Create Proposal Modal */}
      <Modal visible={showCreateModal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          style={[styles.modalContainer, { backgroundColor: colors.background }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setShowCreateModal(false)} style={styles.modalHeaderButton}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>New Proposal</Text>
            <TouchableOpacity
              onPress={handleCreateProposal}
              disabled={creating}
              style={[styles.modalSubmitButton, { backgroundColor: colors.gold }, creating && styles.buttonDisabled]}
            >
              {creating ? <ActivityIndicator size="small" color="#000" /> : <Text style={styles.modalSubmitText}>Create</Text>}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.gold }]}>Title</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.cardBg, color: colors.text, borderColor: colors.border }]}
                placeholder="Enter proposal title..."
                placeholderTextColor={colors.textMuted}
                value={newProposal.title}
                onChangeText={(t) => setNewProposal((p) => ({ ...p, title: t }))}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.gold }]}>Description</Text>
              <TextInput
                style={[
                  styles.input,
                  styles.textArea,
                  { backgroundColor: colors.cardBg, color: colors.text, borderColor: colors.border },
                ]}
                placeholder="Describe your proposal..."
                placeholderTextColor={colors.textMuted}
                value={newProposal.description}
                onChangeText={(t) => setNewProposal((p) => ({ ...p, description: t }))}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.gold }]}>Image (Optional)</Text>
              <TouchableOpacity
                style={[styles.imagePickerButton, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
                onPress={pickImage}
              >
                {newProposal.imageUri ? (
                  <Image source={{ uri: newProposal.imageUri }} style={styles.imagePreview} />
                ) : (
                  <View style={styles.imagePickerPlaceholder}>
                    <Ionicons name="image-outline" size={32} color={colors.textMuted} />
                    <Text style={[styles.imagePickerText, { color: colors.textMuted }]}>Tap to add image</Text>
                  </View>
                )}
              </TouchableOpacity>

              {newProposal.imageUri ? (
                <TouchableOpacity style={styles.removeImageButton} onPress={() => setNewProposal((p) => ({ ...p, imageUri: '' }))}>
                  <Ionicons name="trash-outline" size={16} color={colors.error} />
                  <Text style={[styles.removeImageText, { color: colors.error }]}>Remove</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.gold }]}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.categoryPicker}>
                  {CATEGORIES.filter((c) => c !== 'All').map((cat) => (
                    <FilterChip key={cat} label={cat} selected={newProposal.category === cat} onPress={() => setNewProposal((p) => ({ ...p, category: cat }))} />
                  ))}
                </View>
              </ScrollView>
            </View>

            <View style={[styles.sectionDivider, { borderTopColor: colors.border }]}>
              <View style={[styles.sectionIcon, { backgroundColor: colors.goldLight }]}>
                <Ionicons name="location-outline" size={16} color={colors.gold} />
              </View>
              <Text style={[styles.sectionLabel, { color: colors.gold }]}>Geographic Scope</Text>
            </View>

            {userCountry ? (
              <>
                <Text style={[styles.helperText, { color: colors.textSecondary }]}>
                  Based on your verified location, you can create proposals for:
                </Text>

                <View style={[styles.locationCard, { backgroundColor: colors.cardBg, borderColor: colors.gold }]}>
                  <Ionicons name="location" size={16} color={colors.gold} />
                  <Text style={[styles.locationText, { color: colors.text }]}>
                    {[userCity, userState, userCountry].filter(Boolean).join(', ')}
                  </Text>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                    Who can vote on this proposal?
                  </Text>

                  <View style={styles.scopeOptions}>
                    <TouchableOpacity
                      style={[
                        styles.scopeOption,
                        {
                          backgroundColor: newProposal.geoScope === 'national' ? colors.goldLight : colors.cardBg,
                          borderColor: newProposal.geoScope === 'national' ? colors.gold : colors.border,
                        },
                      ]}
                      onPress={() => setNewProposal((p) => ({ ...p, geoScope: 'national' }))}
                    >
                      <Ionicons name="globe-outline" size={24} color={newProposal.geoScope === 'national' ? colors.gold : colors.textSecondary} />
                      <Text style={[styles.scopeTitle, { color: newProposal.geoScope === 'national' ? colors.gold : colors.text }]}>National</Text>
                      <Text style={[styles.scopeDesc, { color: colors.textSecondary }]}>All of {userCountry}</Text>
                    </TouchableOpacity>

                    {userState ? (
                      <TouchableOpacity
                        style={[
                          styles.scopeOption,
                          {
                            backgroundColor: newProposal.geoScope === 'state' ? colors.goldLight : colors.cardBg,
                            borderColor: newProposal.geoScope === 'state' ? colors.gold : colors.border,
                          },
                        ]}
                        onPress={() => setNewProposal((p) => ({ ...p, geoScope: 'state' }))}
                      >
                        <Ionicons name="map-outline" size={24} color={newProposal.geoScope === 'state' ? colors.gold : colors.textSecondary} />
                        <Text style={[styles.scopeTitle, { color: newProposal.geoScope === 'state' ? colors.gold : colors.text }]}>State/Province</Text>
                        <Text style={[styles.scopeDesc, { color: colors.textSecondary }]}>{userState} only</Text>
                      </TouchableOpacity>
                    ) : null}

                    {userCity ? (
                      <TouchableOpacity
                        style={[
                          styles.scopeOption,
                          {
                            backgroundColor: newProposal.geoScope === 'city' ? colors.goldLight : colors.cardBg,
                            borderColor: newProposal.geoScope === 'city' ? colors.gold : colors.border,
                          },
                        ]}
                        onPress={() => setNewProposal((p) => ({ ...p, geoScope: 'city' }))}
                      >
                        <Ionicons name="business-outline" size={24} color={newProposal.geoScope === 'city' ? colors.gold : colors.textSecondary} />
                        <Text style={[styles.scopeTitle, { color: newProposal.geoScope === 'city' ? colors.gold : colors.text }]}>City/Local</Text>
                        <Text style={[styles.scopeDesc, { color: colors.textSecondary }]}>{userCity} only</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              </>
            ) : (
              <View style={[styles.warningCard, { backgroundColor: colors.warningLight, borderColor: colors.warning }]}>
                <Ionicons name="warning-outline" size={20} color={colors.warning} />
                <View style={styles.warningContent}>
                  <Text style={[styles.warningTitle, { color: colors.warning }]}>Location Not Verified</Text>
                  <Text style={[styles.warningText, { color: colors.textSecondary }]}>
                    Complete identity verification to create geo-restricted proposals. Your proposal will be visible to all users.
                  </Text>
                </View>
              </View>
            )}

            <View style={[styles.sectionDivider, { borderTopColor: colors.border }]}>
              <View style={[styles.sectionIcon, { backgroundColor: colors.goldLight }]}>
                <Ionicons name="people-outline" size={16} color={colors.gold} />
              </View>
              <Text style={[styles.sectionLabel, { color: colors.gold }]}>Demographic Restrictions</Text>
            </View>

            <Text style={[styles.helperText, { color: colors.textSecondary }]}>
              Limit who can vote based on demographics (optional)
            </Text>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Age Group</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.filterOptions}>
                  {AGE_GROUPS.map((age) => (
                    <FilterChip key={age} label={age} selected={newProposal.ageGroup === age} onPress={() => setNewProposal((p) => ({ ...p, ageGroup: age }))} />
                  ))}
                </View>
              </ScrollView>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Gender</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.filterOptions}>
                  {GENDERS.map((g) => (
                    <FilterChip key={g} label={g} selected={newProposal.gender === g} onPress={() => setNewProposal((p) => ({ ...p, gender: g }))} />
                  ))}
                </View>
              </ScrollView>
            </View>

            <View style={{ height: 50 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: 60,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  headerTitle: { ...TYPOGRAPHY.headlineLarge },
  headerSubtitle: { ...TYPOGRAPHY.bodySmall, marginTop: SPACING.xxs },
  headerButtons: { flexDirection: 'row', gap: SPACING.sm },

  iconButton: {
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  createButton: {
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Search
  searchWrapper: { marginTop: SPACING.xs },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    gap: SPACING.sm,
  },
  searchInput: { flex: 1, ...TYPOGRAPHY.bodyMedium, paddingVertical: SPACING.xs },

  // Filter Panel
  filterPanel: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
  },
  filterSection: { marginBottom: SPACING.md },
  filterLabel: { ...TYPOGRAPHY.overline, marginBottom: SPACING.sm },
  filterOptions: { flexDirection: 'row', gap: SPACING.sm },
  filterChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
  },
  filterChipText: { ...TYPOGRAPHY.labelSmall },
  clearFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingTop: SPACING.sm,
  },
  clearFiltersText: { ...TYPOGRAPHY.labelMedium },

  // Content
  scrollView: { flex: 1 },
  scrollContent: { padding: SPACING.lg, gap: SPACING.md },

  // Card
  card: {
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    overflow: 'hidden',
    ...SHADOWS.md,
  },
  cardGradient: { ...StyleSheet.absoluteFillObject, borderRadius: BORDER_RADIUS.xl },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  categoryBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  categoryText: { ...TYPOGRAPHY.labelSmall, fontWeight: '600', textTransform: 'uppercase' },
  deadlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  deadlineText: { ...TYPOGRAPHY.labelSmall },
  shareButton: {
    width: 32,
    height: 32,
    borderRadius: BORDER_RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  geoTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  geoTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xxs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xxs,
    borderRadius: BORDER_RADIUS.full,
  },
  geoTagText: { ...TYPOGRAPHY.labelSmall, fontSize: 10 },
  cardTitle: { ...TYPOGRAPHY.headlineSmall, marginBottom: SPACING.sm },
  cardDescription: { ...TYPOGRAPHY.bodyMedium, lineHeight: 22, marginBottom: SPACING.lg },

  imageContainer: {
    marginBottom: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  proposalImage: { width: '100%', height: 180 },

  // Vote Section
  voteSection: { marginBottom: SPACING.lg },
  voteBar: {
    height: 8,
    borderRadius: BORDER_RADIUS.full,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
  },
  supportBar: { height: '100%', borderRadius: BORDER_RADIUS.full },
  voteStats: { flexDirection: 'row', justifyContent: 'space-between' },
  voteStat: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  voteIconBg: {
    width: 24,
    height: 24,
    borderRadius: BORDER_RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voteCount: { ...TYPOGRAPHY.labelMedium },

  // Actions
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    gap: SPACING.sm,
  },
  statusText: { ...TYPOGRAPHY.labelMedium },
  claimButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    gap: SPACING.sm,
  },
  claimButtonText: { color: '#000', ...TYPOGRAPHY.labelLarge, fontWeight: '600' },
  actionButtons: { flexDirection: 'row', gap: SPACING.md },
  voteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    gap: SPACING.xs,
  },
  voteButtonText: { color: '#fff', ...TYPOGRAPHY.labelMedium, fontWeight: '600' },
  buttonDisabled: { opacity: 0.6 },

  // Skeleton
  skeletonBadge: { width: 80, height: 24, borderRadius: BORDER_RADIUS.full },
  skeletonSmall: { width: 60, height: 24, borderRadius: BORDER_RADIUS.full },
  skeletonTitle: { height: 24, borderRadius: BORDER_RADIUS.sm, marginBottom: SPACING.sm },
  skeletonLine: { height: 16, borderRadius: BORDER_RADIUS.sm, marginBottom: SPACING.xs },
  skeletonButton: { height: 48, borderRadius: BORDER_RADIUS.lg, marginTop: SPACING.md },

  // Empty State
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xxxl },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: BORDER_RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xl,
  },
  emptyText: { ...TYPOGRAPHY.headlineSmall, marginBottom: SPACING.xs },
  emptySubtext: { ...TYPOGRAPHY.bodyMedium, textAlign: 'center', marginBottom: SPACING.xl },
  emptyCreateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.full,
    gap: SPACING.sm,
  },
  emptyCreateButtonText: { color: '#000', ...TYPOGRAPHY.labelLarge, fontWeight: '600' },
  bottomPadding: { height: 100 },

  // Detail modal
  detailContainer: { flex: 1 },
  detailHeader: {
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailHeaderTitle: { ...TYPOGRAPHY.headlineSmall },
  detailShareBtn: {
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  detailContent: { padding: SPACING.lg },
  detailCard: {
    borderRadius: BORDER_RADIUS.xxl,
    borderWidth: 1,
    padding: SPACING.xl,
    overflow: 'hidden',
  },
  detailTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  detailTitle: { ...TYPOGRAPHY.headlineLarge, marginTop: SPACING.lg },
  detailDesc: { ...TYPOGRAPHY.bodyLarge, marginTop: SPACING.md, lineHeight: 26 },

  // Create modal
  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
  },
  modalHeaderButton: { padding: SPACING.xs },
  modalTitle: { ...TYPOGRAPHY.headlineSmall },
  modalSubmitButton: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    minWidth: 80,
    alignItems: 'center',
  },
  modalSubmitText: { color: '#000', ...TYPOGRAPHY.labelMedium, fontWeight: '600' },
  modalContent: { flex: 1, padding: SPACING.lg },

  // Form
  inputGroup: { marginBottom: SPACING.lg },
  inputLabel: { ...TYPOGRAPHY.labelMedium, marginBottom: SPACING.sm },
  input: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    ...TYPOGRAPHY.bodyMedium,
  },
  textArea: { minHeight: 140, paddingTop: SPACING.md },
  imagePickerButton: { borderWidth: 1, borderRadius: BORDER_RADIUS.lg, overflow: 'hidden', borderStyle: 'dashed' },
  imagePreview: { width: '100%', height: 180 },
  imagePickerPlaceholder: { alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.xxxl },
  imagePickerText: { ...TYPOGRAPHY.bodySmall, marginTop: SPACING.sm },
  removeImageButton: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginTop: SPACING.sm },
  removeImageText: { ...TYPOGRAPHY.labelMedium },
  categoryPicker: { flexDirection: 'row', gap: SPACING.sm },

  // Section
  sectionDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.xl,
    marginBottom: SPACING.md,
    paddingTop: SPACING.xl,
    borderTopWidth: 1,
  },
  sectionIcon: { width: 32, height: 32, borderRadius: BORDER_RADIUS.full, alignItems: 'center', justifyContent: 'center' },
  sectionLabel: { ...TYPOGRAPHY.headlineSmall, fontSize: 16 },
  helperText: { ...TYPOGRAPHY.bodySmall, marginBottom: SPACING.md },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.lg,
  },
  locationText: { ...TYPOGRAPHY.bodyMedium, fontWeight: '500' },
  scopeOptions: { gap: SPACING.md },
  scopeOption: {
    alignItems: 'center',
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 2,
  },
  scopeTitle: { ...TYPOGRAPHY.labelLarge, marginTop: SPACING.sm },
  scopeDesc: { ...TYPOGRAPHY.bodySmall, marginTop: SPACING.xxs },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    marginBottom: SPACING.lg,
  },
  warningContent: { flex: 1 },
  warningTitle: { ...TYPOGRAPHY.labelMedium, marginBottom: SPACING.xs },
  warningText: { ...TYPOGRAPHY.bodySmall, lineHeight: 20 },
});
