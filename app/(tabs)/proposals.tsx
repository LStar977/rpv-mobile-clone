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
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeInRight,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  interpolate,
} from 'react-native-reanimated';
import { proposalsApi, userApi, uploadsApi, Proposal } from '../../lib/api';
import { useAuthStore } from '../../lib/auth';
import { shareProposal } from '../../lib/share';
import { useTheme, SPACING, BORDER_RADIUS, TYPOGRAPHY, SHADOWS, ANIMATION } from '../../lib/theme';
import * as ImagePicker from 'expo-image-picker';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
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

// Premium Filter Chip
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

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scale.value = withSequence(
      withTiming(0.92, { duration: 80 }),
      withSpring(1, ANIMATION.spring.snappy)
    );
    onPress();
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedTouchable
      style={[
        styles.filterChip,
        {
          backgroundColor: selected ? colors.gold : colors.surface,
          borderColor: selected ? colors.gold : colors.border,
        },
        animatedStyle,
      ]}
      onPress={handlePress}
      activeOpacity={1}
    >
      {selected && (
        <LinearGradient
          colors={[colors.gold, colors.goldDark || '#A68523']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      )}
      <Text style={[styles.filterChipText, { color: selected ? '#000' : colors.text }]}>
        {label}
      </Text>
    </AnimatedTouchable>
  );
}

// Premium Proposal Card
interface ProposalCardProps {
  proposal: Proposal;
  hasVoted: boolean;
  onVote: (id: number, vote: 'support' | 'oppose') => Promise<void>;
  isVoting: boolean;
  onPress: () => void;
  index: number;
}

function ProposalCard({
  proposal,
  hasVoted,
  onVote,
  isVoting,
  onPress,
  index,
}: ProposalCardProps) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const shimmer = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: 3000 }),
      -1,
      false
    );
  }, []);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(shimmer.value, [0, 1], [-SCREEN_WIDTH, SCREEN_WIDTH]) }],
  }));

  const totalVotes = (proposal.supportVotes || 0) + (proposal.opposeVotes || 0);
  const supportPercent =
    totalVotes > 0 ? Math.round(((proposal.supportVotes || 0) / totalVotes) * 100) : 50;

  const timeRemaining = getTimeRemaining(proposal.deadline);
  const isEnded = timeRemaining === 'Ended';
  const geoTags = proposal.geoRestrictions || [];

  const handlePressIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scale.value = withSpring(0.98, ANIMATION.spring.snappy);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, ANIMATION.spring.snappy);
  };

  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handleShare = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    shareProposal({
      id: proposal.id as number,
      title: proposal.title,
      description: proposal.description,
    });
  };

  return (
    <AnimatedTouchable
      entering={FadeInUp.delay(index * 60).duration(400).springify()}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, animatedCardStyle]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
    >
      {/* Subtle shimmer */}
      <View style={styles.shimmerContainer}>
        <Animated.View style={[styles.shimmerBar, shimmerStyle]}>
          <LinearGradient
            colors={['transparent', `${colors.gold}06`, 'transparent']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
          />
        </Animated.View>
      </View>

      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={[styles.categoryBadge, { backgroundColor: `${colors.gold}15` }]}>
          <Text style={[styles.categoryText, { color: colors.gold }]}>
            {proposal.category || 'General'}
          </Text>
        </View>

        <View style={styles.headerRight}>
          {timeRemaining ? (
            <View
              style={[
                styles.timeBadge,
                { backgroundColor: isEnded ? `${colors.error}15` : `${colors.gold}15` },
              ]}
            >
              <Ionicons
                name="time-outline"
                size={12}
                color={isEnded ? colors.error : colors.gold}
              />
              <Text style={[styles.timeText, { color: isEnded ? colors.error : colors.gold }]}>
                {timeRemaining}
              </Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.shareBtn, { backgroundColor: colors.surfaceHover || `${colors.gold}08` }]}
            onPress={(e) => {
              e.stopPropagation();
              handleShare();
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="share-outline" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Geo tags */}
      {geoTags.length > 0 && (
        <View style={styles.geoTags}>
          {geoTags.slice(0, 3).map((tag, i) => (
            <View key={i} style={[styles.geoTag, { backgroundColor: `${colors.info}12` }]}>
              <Ionicons name="location-outline" size={10} color={colors.info} />
              <Text style={[styles.geoTagText, { color: colors.info }]}>{tag}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Content */}
      <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
        {proposal.title}
      </Text>
      <Text style={[styles.cardDesc, { color: colors.textSecondary }]} numberOfLines={3}>
        {proposal.description}
      </Text>

      {/* Image */}
      {proposal.imageUrl && (
        <View style={styles.imageWrapper}>
          <Image source={{ uri: proposal.imageUrl }} style={styles.proposalImage} resizeMode="cover" />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.3)']}
            style={styles.imageOverlay}
          />
        </View>
      )}

      {/* Vote Bar */}
      <View style={styles.voteSection}>
        <View style={[styles.voteBarBg, { backgroundColor: colors.error }]}>
          <Animated.View
            style={[
              styles.voteBarFill,
              { width: `${supportPercent}%`, backgroundColor: colors.success },
            ]}
          />
        </View>

        <View style={styles.voteStats}>
          <View style={styles.voteStat}>
            <View style={[styles.voteIconBg, { backgroundColor: `${colors.success}15` }]}>
              <Ionicons name="thumbs-up" size={12} color={colors.success} />
            </View>
            <Text style={[styles.voteCount, { color: colors.textSecondary }]}>
              {(proposal.supportVotes || 0).toLocaleString()}
            </Text>
          </View>

          <View style={styles.voteStat}>
            <View style={[styles.voteIconBg, { backgroundColor: `${colors.error}15` }]}>
              <Ionicons name="thumbs-down" size={12} color={colors.error} />
            </View>
            <Text style={[styles.voteCount, { color: colors.textSecondary }]}>
              {(proposal.opposeVotes || 0).toLocaleString()}
            </Text>
          </View>
        </View>
      </View>

      {/* Actions */}
      {isEnded ? (
        <View style={[styles.statusBanner, { backgroundColor: `${colors.error}10` }]}>
          <Ionicons name="flag-outline" size={16} color={colors.error} />
          <Text style={[styles.statusText, { color: colors.error }]}>Voting has ended</Text>
        </View>
      ) : hasVoted ? (
        <View style={[styles.statusBanner, { backgroundColor: `${colors.success}10` }]}>
          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
          <Text style={[styles.statusText, { color: colors.success }]}>You have voted</Text>
        </View>
      ) : (
        <View style={styles.voteActions}>
          <TouchableOpacity
            style={[styles.voteBtn, { backgroundColor: colors.success }, isVoting && styles.btnDisabled]}
            onPress={(e) => {
              e.stopPropagation();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onVote(proposal.id as number, 'support');
            }}
            disabled={isVoting}
            activeOpacity={0.85}
          >
            {isVoting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={16} color="#fff" />
                <Text style={styles.voteBtnText}>Support</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.voteBtn, { backgroundColor: colors.error }, isVoting && styles.btnDisabled]}
            onPress={(e) => {
              e.stopPropagation();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onVote(proposal.id as number, 'oppose');
            }}
            disabled={isVoting}
            activeOpacity={0.85}
          >
            {isVoting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="close-circle" size={16} color="#fff" />
                <Text style={styles.voteBtnText}>Oppose</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </AnimatedTouchable>
  );
}

// Skeleton Card
function ProposalSkeleton({ index }: { index: number }) {
  const { colors } = useTheme();
  const shimmer = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: 1500 }),
      -1,
      false
    );
  }, []);

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 0.5, 1], [0.3, 0.7, 0.3]),
  }));

  return (
    <Animated.View
      entering={FadeIn.delay(index * 80).duration(300)}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={styles.cardHeader}>
        <Animated.View style={[styles.skeletonBadge, { backgroundColor: `${colors.gold}15` }, shimmerStyle]} />
        <Animated.View style={[styles.skeletonSmall, { backgroundColor: `${colors.gold}15` }, shimmerStyle]} />
      </View>
      <Animated.View style={[styles.skeletonTitle, { backgroundColor: `${colors.gold}10` }, shimmerStyle]} />
      <Animated.View style={[styles.skeletonLine, { backgroundColor: `${colors.gold}10` }, shimmerStyle]} />
      <Animated.View style={[styles.skeletonLine, { backgroundColor: `${colors.gold}10`, width: '70%' }, shimmerStyle]} />
      <Animated.View style={[styles.skeletonBtn, { backgroundColor: `${colors.gold}10` }, shimmerStyle]} />
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
    // Reverse to show most recent proposals first
    return [...proposals].reverse().filter((proposal) => {
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

  const handleVote = async (proposalId: number, vote: 'support' | 'oppose') => {
    if (!isAuthenticated) {
      Alert.alert('Sign In Required', 'Please sign in to vote.');
      return;
    }
    setVotingProposalId(proposalId);
    try {
      // First claim the token if not already claimed
      if (!claimedTokens.has(proposalId)) {
        const claimResult = await proposalsApi.claimVoteToken(proposalId);
        if (claimResult.error) {
          Alert.alert('Error', claimResult.error);
          setVotingProposalId(null);
          return;
        }
        setClaimedTokens((prev) => new Set([...prev, proposalId]));
      }

      // Then submit the vote
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

      setSelectedProposal((sp) => {
        if (!sp) return sp;
        if ((sp.id as number) !== proposalId) return sp;
        return {
          ...sp,
          supportVotes: vote === 'support' ? (sp.supportVotes || 0) + 1 : sp.supportVotes,
          opposeVotes: vote === 'oppose' ? (sp.opposeVotes || 0) + 1 : sp.opposeVotes,
        };
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Vote Recorded', `Your ${vote} vote has been recorded.`);
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

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const hasActiveFilters =
    searchQuery !== '' ||
    selectedCategory !== 'All' ||
    selectedStatus !== 'All' ||
    selectedGeoLevel !== 'All' ||
    selectedFilterAge !== 'All Ages' ||
    selectedFilterGender !== 'All Genders';

  const openProposal = (p: Proposal) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedProposal(p);
    setShowDetailModal(true);
  };

  const closeProposal = () => {
    setShowDetailModal(false);
    setTimeout(() => setSelectedProposal(null), 150);
  };

  const detail = selectedProposal;
  const detailHasVoted = detail ? votedProposals.has(detail.id as number) : false;
  const detailIsVoting = detail ? votingProposalId === (detail.id as number) : false;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <Animated.View entering={FadeInDown.duration(400)} style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Proposals</Text>
            <Text style={[styles.headerSubtitle, { color: colors.textTertiary }]}>
              {activeCount} active proposal{activeCount !== 1 ? 's' : ''}
            </Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[
                styles.filterBtn,
                {
                  backgroundColor: hasActiveFilters ? colors.gold : colors.surface,
                  borderColor: hasActiveFilters ? colors.gold : colors.border,
                },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowFilters(!showFilters);
              }}
            >
              <Ionicons name="options-outline" size={18} color={hasActiveFilters ? '#000' : colors.text} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setShowCreateModal(true);
              }}
            >
              <LinearGradient
                colors={[colors.gold, colors.goldDark || '#A68523']}
                style={styles.createBtn}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="add" size={22} color="#000" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search */}
        <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={18} color={colors.textTertiary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search proposals..."
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </Animated.View>

      {/* Filter Panel */}
      {showFilters && (
        <Animated.View
          entering={FadeInDown.duration(250)}
          style={[styles.filterPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <View style={styles.filterSection}>
            <Text style={[styles.filterLabel, { color: colors.textTertiary }]}>CATEGORY</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.filterRow}>
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
            <Text style={[styles.filterLabel, { color: colors.textTertiary }]}>STATUS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.filterRow}>
                {STATUS_FILTERS.map((s) => (
                  <FilterChip key={s} label={s} selected={selectedStatus === s} onPress={() => setSelectedStatus(s)} />
                ))}
              </View>
            </ScrollView>
          </View>

          <View style={styles.filterSection}>
            <Text style={[styles.filterLabel, { color: colors.textTertiary }]}>GEOGRAPHIC LEVEL</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.filterRow}>
                {GEO_LEVELS.map((g) => (
                  <FilterChip key={g} label={g} selected={selectedGeoLevel === g} onPress={() => setSelectedGeoLevel(g)} />
                ))}
              </View>
            </ScrollView>
          </View>

          {hasActiveFilters && (
            <TouchableOpacity style={styles.clearBtn} onPress={clearFilters}>
              <Ionicons name="close-circle" size={16} color={colors.error} />
              <Text style={[styles.clearBtnText, { color: colors.error }]}>Clear all filters</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      )}

      {/* Content */}
      {loading ? (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {[0, 1, 2].map((i) => (
            <ProposalSkeleton key={i} index={i} />
          ))}
        </ScrollView>
      ) : filteredProposals.length === 0 ? (
        <Animated.View entering={FadeIn.duration(400)} style={styles.emptyState}>
          <View style={[styles.emptyIcon, { backgroundColor: `${colors.gold}15` }]}>
            <Ionicons name="document-text-outline" size={48} color={colors.gold} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No proposals found</Text>
          <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
            {hasActiveFilters ? 'Try adjusting your filters' : 'Be the first to create one!'}
          </Text>
          {!hasActiveFilters && (
            <TouchableOpacity
              onPress={() => setShowCreateModal(true)}
              style={styles.emptyBtn}
            >
              <LinearGradient
                colors={[colors.gold, colors.goldDark || '#A68523']}
                style={styles.emptyBtnGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Ionicons name="add-circle-outline" size={20} color="#000" />
                <Text style={styles.emptyBtnText}>Create Proposal</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </Animated.View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchData(true)}
              tintColor={colors.gold}
              progressBackgroundColor={colors.surface}
            />
          }
        >
          {filteredProposals.map((proposal, index) => (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              hasVoted={votedProposals.has(proposal.id as number)}
              onVote={handleVote}
              isVoting={votingProposalId === proposal.id}
              onPress={() => openProposal(proposal)}
              index={index}
            />
          ))}
          <View style={styles.listSpacer} />
        </ScrollView>
      )}

      {/* Detail Modal */}
      <Modal visible={showDetailModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeProposal}>
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={closeProposal} style={styles.modalClose}>
              <Ionicons name="chevron-down" size={24} color={colors.textSecondary} />
            </TouchableOpacity>

            <Text style={[styles.modalTitle, { color: colors.text }]}>Proposal</Text>

            <TouchableOpacity
              onPress={() => {
                if (!detail) return;
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                shareProposal({ id: detail.id as number, title: detail.title, description: detail.description });
              }}
              style={[styles.modalShare, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Ionicons name="share-outline" size={18} color={colors.text} />
            </TouchableOpacity>
          </View>

          {detail && (
            <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
              <View style={[styles.detailCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <LinearGradient
                  colors={[`${colors.gold}08`, 'transparent']}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />

                <View style={styles.detailHeaderRow}>
                  <View style={[styles.categoryBadge, { backgroundColor: `${colors.gold}15` }]}>
                    <Text style={[styles.categoryText, { color: colors.gold }]}>{detail.category || 'General'}</Text>
                  </View>

                  {detail.deadline && (
                    <View
                      style={[
                        styles.timeBadge,
                        { backgroundColor: isProposalEnded(detail) ? `${colors.error}15` : `${colors.gold}15` },
                      ]}
                    >
                      <Ionicons
                        name="time-outline"
                        size={12}
                        color={isProposalEnded(detail) ? colors.error : colors.gold}
                      />
                      <Text
                        style={[styles.timeText, { color: isProposalEnded(detail) ? colors.error : colors.gold }]}
                      >
                        {getTimeRemaining(detail.deadline)}
                      </Text>
                    </View>
                  )}
                </View>

                {(detail.geoRestrictions || []).length > 0 && (
                  <View style={[styles.geoTags, { marginTop: SPACING.sm }]}>
                    {(detail.geoRestrictions || []).slice(0, 6).map((tag, i) => (
                      <View key={i} style={[styles.geoTag, { backgroundColor: `${colors.info}12` }]}>
                        <Ionicons name="location-outline" size={10} color={colors.info} />
                        <Text style={[styles.geoTagText, { color: colors.info }]}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}

                <Text style={[styles.detailTitle, { color: colors.text }]}>{detail.title}</Text>
                <Text style={[styles.detailDesc, { color: colors.textSecondary }]}>{detail.description}</Text>

                {detail.imageUrl && (
                  <View style={[styles.imageWrapper, { marginTop: SPACING.lg }]}>
                    <Image source={{ uri: detail.imageUrl }} style={styles.proposalImage} resizeMode="cover" />
                  </View>
                )}

                {/* Vote Progress */}
                <View style={[styles.voteSection, { marginTop: SPACING.xl }]}>
                  {(() => {
                    const total = (detail.supportVotes || 0) + (detail.opposeVotes || 0);
                    const pct = total > 0 ? Math.round(((detail.supportVotes || 0) / total) * 100) : 50;
                    return (
                      <>
                        <View style={[styles.voteBarBg, { backgroundColor: colors.error }]}>
                          <Animated.View style={[styles.voteBarFill, { width: `${pct}%`, backgroundColor: colors.success }]} />
                        </View>
                        <View style={styles.voteStats}>
                          <View style={styles.voteStat}>
                            <View style={[styles.voteIconBg, { backgroundColor: `${colors.success}15` }]}>
                              <Ionicons name="thumbs-up" size={12} color={colors.success} />
                            </View>
                            <Text style={[styles.voteCount, { color: colors.textSecondary }]}>
                              {(detail.supportVotes || 0).toLocaleString()}
                            </Text>
                          </View>
                          <View style={styles.voteStat}>
                            <View style={[styles.voteIconBg, { backgroundColor: `${colors.error}15` }]}>
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
                <View style={{ marginTop: SPACING.xl }}>
                  {isProposalEnded(detail) ? (
                    <View style={[styles.statusBanner, { backgroundColor: `${colors.error}10` }]}>
                      <Ionicons name="flag-outline" size={16} color={colors.error} />
                      <Text style={[styles.statusText, { color: colors.error }]}>Voting has ended</Text>
                    </View>
                  ) : detailHasVoted ? (
                    <View style={[styles.statusBanner, { backgroundColor: `${colors.success}10` }]}>
                      <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                      <Text style={[styles.statusText, { color: colors.success }]}>You have voted</Text>
                    </View>
                  ) : (
                    <View style={styles.voteActions}>
                      <TouchableOpacity
                        style={[styles.voteBtn, { backgroundColor: colors.success }, detailIsVoting && styles.btnDisabled]}
                        onPress={() => detail && handleVote(detail.id as number, 'support')}
                        disabled={detailIsVoting}
                        activeOpacity={0.85}
                      >
                        {detailIsVoting ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <Ionicons name="checkmark-circle" size={16} color="#fff" />
                            <Text style={styles.voteBtnText}>Support</Text>
                          </>
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.voteBtn, { backgroundColor: colors.error }, detailIsVoting && styles.btnDisabled]}
                        onPress={() => detail && handleVote(detail.id as number, 'oppose')}
                        disabled={detailIsVoting}
                        activeOpacity={0.85}
                      >
                        {detailIsVoting ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <Ionicons name="close-circle" size={16} color="#fff" />
                            <Text style={styles.voteBtnText}>Oppose</Text>
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

      {/* Create Modal */}
      <Modal visible={showCreateModal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          style={[styles.modalContainer, { backgroundColor: colors.background }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setShowCreateModal(false)} style={styles.modalClose}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>

            <Text style={[styles.modalTitle, { color: colors.text }]}>New Proposal</Text>

            <TouchableOpacity
              onPress={handleCreateProposal}
              disabled={creating}
              style={[creating && styles.btnDisabled]}
            >
              <LinearGradient
                colors={[colors.gold, colors.goldDark || '#A68523']}
                style={styles.submitBtn}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {creating ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Text style={styles.submitBtnText}>Create</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.formSection}>
              <Text style={[styles.formLabel, { color: colors.gold }]}>Title</Text>
              <TextInput
                style={[styles.formInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                placeholder="Enter proposal title..."
                placeholderTextColor={colors.textTertiary}
                value={newProposal.title}
                onChangeText={(t) => setNewProposal((p) => ({ ...p, title: t }))}
              />
            </View>

            <View style={styles.formSection}>
              <Text style={[styles.formLabel, { color: colors.gold }]}>Description</Text>
              <TextInput
                style={[
                  styles.formInput,
                  styles.formTextArea,
                  { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border },
                ]}
                placeholder="Describe your proposal..."
                placeholderTextColor={colors.textTertiary}
                value={newProposal.description}
                onChangeText={(t) => setNewProposal((p) => ({ ...p, description: t }))}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.formSection}>
              <Text style={[styles.formLabel, { color: colors.gold }]}>Image (Optional)</Text>
              <TouchableOpacity
                style={[styles.imagePicker, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={pickImage}
              >
                {newProposal.imageUri ? (
                  <Image source={{ uri: newProposal.imageUri }} style={styles.imagePreview} />
                ) : (
                  <View style={styles.imagePickerContent}>
                    <Ionicons name="image-outline" size={32} color={colors.textTertiary} />
                    <Text style={[styles.imagePickerText, { color: colors.textTertiary }]}>Tap to add image</Text>
                  </View>
                )}
              </TouchableOpacity>

              {newProposal.imageUri && (
                <TouchableOpacity
                  style={styles.removeImageBtn}
                  onPress={() => setNewProposal((p) => ({ ...p, imageUri: '' }))}
                >
                  <Ionicons name="trash-outline" size={16} color={colors.error} />
                  <Text style={[styles.removeImageText, { color: colors.error }]}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.formSection}>
              <Text style={[styles.formLabel, { color: colors.gold }]}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.filterRow}>
                  {CATEGORIES.filter((c) => c !== 'All').map((cat) => (
                    <FilterChip
                      key={cat}
                      label={cat}
                      selected={newProposal.category === cat}
                      onPress={() => setNewProposal((p) => ({ ...p, category: cat }))}
                    />
                  ))}
                </View>
              </ScrollView>
            </View>

            <View style={[styles.formDivider, { borderTopColor: colors.border }]}>
              <View style={[styles.formDividerIcon, { backgroundColor: `${colors.gold}15` }]}>
                <Ionicons name="location-outline" size={16} color={colors.gold} />
              </View>
              <Text style={[styles.formDividerLabel, { color: colors.gold }]}>Geographic Scope</Text>
            </View>

            {userCountry ? (
              <>
                <Text style={[styles.formHelper, { color: colors.textSecondary }]}>
                  Based on your verified location:
                </Text>

                <View style={[styles.locationBadge, { backgroundColor: colors.surface, borderColor: colors.gold }]}>
                  <Ionicons name="location" size={16} color={colors.gold} />
                  <Text style={[styles.locationText, { color: colors.text }]}>
                    {[userCity, userState, userCountry].filter(Boolean).join(', ')}
                  </Text>
                </View>

                <View style={styles.scopeGrid}>
                  <TouchableOpacity
                    style={[
                      styles.scopeCard,
                      {
                        backgroundColor: newProposal.geoScope === 'national' ? `${colors.gold}15` : colors.surface,
                        borderColor: newProposal.geoScope === 'national' ? colors.gold : colors.border,
                      },
                    ]}
                    onPress={() => setNewProposal((p) => ({ ...p, geoScope: 'national' }))}
                  >
                    <Ionicons
                      name="globe-outline"
                      size={24}
                      color={newProposal.geoScope === 'national' ? colors.gold : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.scopeTitle,
                        { color: newProposal.geoScope === 'national' ? colors.gold : colors.text },
                      ]}
                    >
                      National
                    </Text>
                    <Text style={[styles.scopeDesc, { color: colors.textTertiary }]}>All of {userCountry}</Text>
                  </TouchableOpacity>

                  {userState && (
                    <TouchableOpacity
                      style={[
                        styles.scopeCard,
                        {
                          backgroundColor: newProposal.geoScope === 'state' ? `${colors.gold}15` : colors.surface,
                          borderColor: newProposal.geoScope === 'state' ? colors.gold : colors.border,
                        },
                      ]}
                      onPress={() => setNewProposal((p) => ({ ...p, geoScope: 'state' }))}
                    >
                      <Ionicons
                        name="map-outline"
                        size={24}
                        color={newProposal.geoScope === 'state' ? colors.gold : colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.scopeTitle,
                          { color: newProposal.geoScope === 'state' ? colors.gold : colors.text },
                        ]}
                      >
                        State
                      </Text>
                      <Text style={[styles.scopeDesc, { color: colors.textTertiary }]}>{userState} only</Text>
                    </TouchableOpacity>
                  )}

                  {userCity && (
                    <TouchableOpacity
                      style={[
                        styles.scopeCard,
                        {
                          backgroundColor: newProposal.geoScope === 'city' ? `${colors.gold}15` : colors.surface,
                          borderColor: newProposal.geoScope === 'city' ? colors.gold : colors.border,
                        },
                      ]}
                      onPress={() => setNewProposal((p) => ({ ...p, geoScope: 'city' }))}
                    >
                      <Ionicons
                        name="business-outline"
                        size={24}
                        color={newProposal.geoScope === 'city' ? colors.gold : colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.scopeTitle,
                          { color: newProposal.geoScope === 'city' ? colors.gold : colors.text },
                        ]}
                      >
                        City
                      </Text>
                      <Text style={[styles.scopeDesc, { color: colors.textTertiary }]}>{userCity} only</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            ) : (
              <View style={[styles.warningBanner, { backgroundColor: `${colors.warning}12`, borderColor: `${colors.warning}30` }]}>
                <Ionicons name="warning-outline" size={20} color={colors.warning} />
                <View style={styles.warningContent}>
                  <Text style={[styles.warningTitle, { color: colors.warning }]}>Location Not Verified</Text>
                  <Text style={[styles.warningDesc, { color: colors.textSecondary }]}>
                    Complete identity verification to create geo-restricted proposals.
                  </Text>
                </View>
              </View>
            )}

            <View style={[styles.formDivider, { borderTopColor: colors.border }]}>
              <View style={[styles.formDividerIcon, { backgroundColor: `${colors.gold}15` }]}>
                <Ionicons name="people-outline" size={16} color={colors.gold} />
              </View>
              <Text style={[styles.formDividerLabel, { color: colors.gold }]}>Demographics (Optional)</Text>
            </View>

            <View style={styles.formSection}>
              <Text style={[styles.formSubLabel, { color: colors.textSecondary }]}>Age Group</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.filterRow}>
                  {AGE_GROUPS.map((age) => (
                    <FilterChip
                      key={age}
                      label={age}
                      selected={newProposal.ageGroup === age}
                      onPress={() => setNewProposal((p) => ({ ...p, ageGroup: age }))}
                    />
                  ))}
                </View>
              </ScrollView>
            </View>

            <View style={styles.formSection}>
              <Text style={[styles.formSubLabel, { color: colors.textSecondary }]}>Gender</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.filterRow}>
                  {GENDERS.map((g) => (
                    <FilterChip
                      key={g}
                      label={g}
                      selected={newProposal.gender === g}
                      onPress={() => setNewProposal((p) => ({ ...p, gender: g }))}
                    />
                  ))}
                </View>
              </ScrollView>
            </View>

            <View style={{ height: 100 }} />
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  headerTitle: { ...TYPOGRAPHY.displaySmall },
  headerSubtitle: { ...TYPOGRAPHY.labelMedium, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },

  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  createBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.md,
  },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    gap: SPACING.sm,
  },
  searchInput: { flex: 1, ...TYPOGRAPHY.bodyMedium, paddingVertical: SPACING.xs },

  // Filter Panel
  filterPanel: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xxl,
    borderWidth: 1,
  },
  filterSection: { marginBottom: SPACING.md },
  filterLabel: { ...TYPOGRAPHY.labelSmall, letterSpacing: 1, marginBottom: SPACING.sm },
  filterRow: { flexDirection: 'row', gap: SPACING.sm },
  filterChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    borderWidth: 1,
    overflow: 'hidden',
  },
  filterChipText: { ...TYPOGRAPHY.labelSmall, fontWeight: '500' },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingTop: SPACING.sm,
  },
  clearBtnText: { ...TYPOGRAPHY.labelMedium },

  // List
  list: { flex: 1 },
  listContent: { padding: SPACING.lg, gap: SPACING.md },
  listSpacer: { height: 100 },

  // Card
  card: {
    borderRadius: BORDER_RADIUS.xxl,
    padding: SPACING.lg,
    borderWidth: 1,
    overflow: 'hidden',
    ...SHADOWS.md,
  },
  shimmerContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  shimmerBar: {
    width: SCREEN_WIDTH,
    height: '100%',
  },
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
  categoryText: { ...TYPOGRAPHY.labelSmall, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  timeText: { ...TYPOGRAPHY.labelSmall, fontWeight: '500' },
  shareBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
    gap: 3,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
  },
  geoTagText: { ...TYPOGRAPHY.labelSmall, fontSize: 10 },
  cardTitle: { ...TYPOGRAPHY.headlineSmall, marginBottom: SPACING.sm },
  cardDesc: { ...TYPOGRAPHY.bodyMedium, lineHeight: 22, marginBottom: SPACING.lg },

  imageWrapper: {
    marginBottom: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
  },
  proposalImage: { width: '100%', height: 180 },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
  },

  // Vote Section
  voteSection: { marginBottom: SPACING.lg },
  voteBarBg: {
    height: 8,
    borderRadius: BORDER_RADIUS.full,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
  },
  voteBarFill: { height: '100%', borderRadius: BORDER_RADIUS.full },
  voteStats: { flexDirection: 'row', justifyContent: 'space-between' },
  voteStat: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  voteIconBg: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voteCount: { ...TYPOGRAPHY.labelMedium },

  // Actions
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.xl,
    gap: SPACING.sm,
  },
  statusText: { ...TYPOGRAPHY.labelMedium, fontWeight: '500' },
  voteActions: { flexDirection: 'row', gap: SPACING.md },
  voteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: BORDER_RADIUS.xl,
    gap: SPACING.xs,
  },
  voteBtnText: { color: '#fff', ...TYPOGRAPHY.labelMedium, fontWeight: '600' },
  btnDisabled: { opacity: 0.6 },

  // Skeleton
  skeletonBadge: { width: 80, height: 24, borderRadius: BORDER_RADIUS.full },
  skeletonSmall: { width: 60, height: 24, borderRadius: BORDER_RADIUS.full },
  skeletonTitle: { height: 24, borderRadius: BORDER_RADIUS.sm, marginBottom: SPACING.sm },
  skeletonLine: { height: 16, borderRadius: BORDER_RADIUS.sm, marginBottom: SPACING.xs },
  skeletonBtn: { height: 48, borderRadius: BORDER_RADIUS.xl, marginTop: SPACING.md },

  // Empty State
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xxxl },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xl,
  },
  emptyTitle: { ...TYPOGRAPHY.headlineSmall, marginBottom: SPACING.xs },
  emptyDesc: { ...TYPOGRAPHY.bodyMedium, textAlign: 'center', marginBottom: SPACING.xl },
  emptyBtn: { overflow: 'hidden', borderRadius: BORDER_RADIUS.full },
  emptyBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  emptyBtnText: { color: '#000', ...TYPOGRAPHY.labelLarge, fontWeight: '600' },

  // Modal
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
  modalClose: { padding: SPACING.xs },
  modalTitle: { ...TYPOGRAPHY.headlineSmall },
  modalShare: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  modalContent: { padding: SPACING.lg },

  // Detail Card
  detailCard: {
    borderRadius: BORDER_RADIUS.xxl,
    borderWidth: 1,
    padding: SPACING.xl,
    overflow: 'hidden',
    ...SHADOWS.lg,
  },
  detailHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  detailTitle: { ...TYPOGRAPHY.headlineLarge, marginTop: SPACING.lg },
  detailDesc: { ...TYPOGRAPHY.bodyLarge, marginTop: SPACING.md, lineHeight: 26 },

  // Create Form
  submitBtn: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    minWidth: 80,
    alignItems: 'center',
  },
  submitBtnText: { color: '#000', ...TYPOGRAPHY.labelMedium, fontWeight: '600' },
  formScroll: { flex: 1, padding: SPACING.lg },
  formSection: { marginBottom: SPACING.lg },
  formLabel: { ...TYPOGRAPHY.labelMedium, marginBottom: SPACING.sm },
  formSubLabel: { ...TYPOGRAPHY.labelSmall, marginBottom: SPACING.sm },
  formInput: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.xl,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    ...TYPOGRAPHY.bodyMedium,
  },
  formTextArea: { minHeight: 140, paddingTop: SPACING.md },
  imagePicker: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    borderStyle: 'dashed',
  },
  imagePreview: { width: '100%', height: 180 },
  imagePickerContent: { alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.xxxl },
  imagePickerText: { ...TYPOGRAPHY.bodySmall, marginTop: SPACING.sm },
  removeImageBtn: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginTop: SPACING.sm },
  removeImageText: { ...TYPOGRAPHY.labelMedium },

  formDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.xl,
    marginBottom: SPACING.lg,
    paddingTop: SPACING.xl,
    borderTopWidth: 1,
  },
  formDividerIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  formDividerLabel: { ...TYPOGRAPHY.headlineSmall, fontSize: 16 },
  formHelper: { ...TYPOGRAPHY.bodySmall, marginBottom: SPACING.md },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    marginBottom: SPACING.lg,
  },
  locationText: { ...TYPOGRAPHY.bodyMedium, fontWeight: '500' },
  scopeGrid: { gap: SPACING.md },
  scopeCard: {
    alignItems: 'center',
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 2,
  },
  scopeTitle: { ...TYPOGRAPHY.labelLarge, marginTop: SPACING.sm },
  scopeDesc: { ...TYPOGRAPHY.bodySmall, marginTop: 2 },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.xl,
    borderWidth: 1,
    marginBottom: SPACING.lg,
  },
  warningContent: { flex: 1 },
  warningTitle: { ...TYPOGRAPHY.labelMedium, marginBottom: SPACING.xxs },
  warningDesc: { ...TYPOGRAPHY.bodySmall, lineHeight: 20 },
});
