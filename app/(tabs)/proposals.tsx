import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Modal, TextInput, Alert, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { proposalsApi, userApi, uploadsApi, Proposal } from '../../lib/api';
import { useAuthStore } from '../../lib/auth';
import { shareProposal } from '../../lib/share';
import { useTheme } from '../../lib/theme';
import * as ImagePicker from 'expo-image-picker';

const CATEGORIES = ['All', 'Transportation', 'Environment', 'Housing', 'Education', 'Healthcare', 'Economy', 'Public Safety', 'Infrastructure', 'Other'];
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

interface ProposalCardProps {
  proposal: Proposal; hasClaimed: boolean; hasVoted: boolean;
  onClaimToken: (id: number) => Promise<void>; onVote: (id: number, vote: 'support' | 'oppose') => Promise<void>;
  isVoting: boolean; colors: any; onPress: () => void;
}

function ProposalCard({ proposal, hasClaimed, hasVoted, onClaimToken, onVote, isVoting, colors, onPress }: ProposalCardProps) {
  const [claiming, setClaiming] = useState(false);
  const totalVotes = (proposal.supportVotes || 0) + (proposal.opposeVotes || 0);
  const supportPercent = totalVotes > 0 ? Math.round(((proposal.supportVotes || 0) / totalVotes) * 100) : 50;
  const timeRemaining = getTimeRemaining(proposal.deadline);
  const isEnded = timeRemaining === 'Ended';
  const geoTags = proposal.geoRestrictions || [];
  const handleClaimToken = async () => { setClaiming(true); try { await onClaimToken(proposal.id as number); } finally { setClaiming(false); } };
  const handleShare = () => shareProposal({ id: proposal.id as number, title: proposal.title, description: proposal.description });

  return (
    <TouchableOpacity style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardHeader}>
        <View style={[styles.categoryBadge, { backgroundColor: colors.goldLight }]}><Text style={[styles.categoryText, { color: colors.gold }]}>{proposal.category || 'General'}</Text></View>
        <View style={styles.headerRight}>
          {timeRemaining && <View style={styles.deadlineBadge}><Ionicons name="time-outline" size={12} color={isEnded ? colors.error : colors.gold} /><Text style={[styles.deadlineText, { color: isEnded ? colors.error : colors.gold }]}>{timeRemaining}</Text></View>}
          <TouchableOpacity style={styles.shareButton} onPress={(e) => { e.stopPropagation(); handleShare(); }}><Ionicons name="share-outline" size={18} color={colors.gold} /></TouchableOpacity>
        </View>
      </View>
      {geoTags.length > 0 && <View style={styles.geoTags}>{geoTags.slice(0, 3).map((tag, i) => <View key={i} style={[styles.geoTag, { backgroundColor: colors.infoLight }]}><Ionicons name="location-outline" size={10} color={colors.info} /><Text style={[styles.geoTagText, { color: colors.info }]}>{tag}</Text></View>)}</View>}
      <Text style={[styles.cardTitle, { color: colors.text }]}>{proposal.title}</Text>
      <Text style={[styles.cardDescription, { color: colors.textSecondary }]} numberOfLines={3}>{proposal.description}</Text>
      {proposal.imageUrl && <Image source={{ uri: proposal.imageUrl }} style={styles.proposalImage} resizeMode="cover" />}
      <View style={[styles.voteBar, { backgroundColor: colors.error }]}><View style={[styles.supportBar, { width: `${supportPercent}%`, backgroundColor: colors.success }]} /></View>
      <View style={styles.voteStats}>
        <View style={styles.voteStat}><Ionicons name="thumbs-up" size={14} color={colors.success} /><Text style={[styles.voteCount, { color: colors.textSecondary }]}>{(proposal.supportVotes || 0).toLocaleString()}</Text></View>
        <View style={styles.voteStat}><Ionicons name="thumbs-down" size={14} color={colors.error} /><Text style={[styles.voteCount, { color: colors.textSecondary }]}>{(proposal.opposeVotes || 0).toLocaleString()}</Text></View>
      </View>
      {isEnded ? (
        <View style={[styles.endedContainer, { backgroundColor: colors.errorLight }]}><Text style={[styles.endedLabel, { color: colors.error }]}>Voting has ended</Text></View>
      ) : hasVoted ? (
        <View style={[styles.votedContainer, { backgroundColor: colors.goldLight }]}><Ionicons name="checkmark-circle" size={20} color={colors.gold} /><Text style={[styles.votedText, { color: colors.gold }]}>You have voted on this proposal</Text></View>
      ) : !hasClaimed ? (
        <TouchableOpacity style={[styles.claimButton, { backgroundColor: colors.gold }, claiming && styles.claimingButton]} onPress={(e) => { e.stopPropagation(); handleClaimToken(); }} disabled={claiming}>
          {claiming ? <ActivityIndicator size="small" color="#000" /> : <><Ionicons name="wallet-outline" size={18} color="#000" /><Text style={styles.claimButtonText}>Claim RPV Vote Token</Text></>}
        </TouchableOpacity>
      ) : (
        <View style={styles.actionButtons}>
          <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.success }, isVoting && styles.disabledButton]} onPress={(e) => { e.stopPropagation(); onVote(proposal.id as number, 'support'); }} disabled={isVoting}>
            {isVoting ? <ActivityIndicator size="small" color="#fff" /> : <><Ionicons name="checkmark-circle" size={16} color="#fff" /><Text style={styles.actionButtonText}>Support</Text></>}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.error }, isVoting && styles.disabledButton]} onPress={(e) => { e.stopPropagation(); onVote(proposal.id as number, 'oppose'); }} disabled={isVoting}>
            {isVoting ? <ActivityIndicator size="small" color="#fff" /> : <><Ionicons name="close-circle" size={16} color="#fff" /><Text style={styles.actionButtonText}>Oppose</Text></>}
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
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
  const [newProposal, setNewProposal] = useState({ title: '', description: '', category: 'Other', country: '', state: '', city: '', geoScope: 'national' as 'national' | 'state' | 'city', ageGroup: 'All Ages', gender: 'All Genders', imageUri: '' as string });

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission Required', 'Please allow access to your photo library to add images.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [16, 9], quality: 0.8 });
    if (!result.canceled && result.assets[0]) { setNewProposal(p => ({ ...p, imageUri: result.assets[0].uri })); }
  };

  useEffect(() => { setNewProposal(p => ({ ...p, country: userCountry, state: userState, city: userCity })); }, [userCountry, userState, userCity]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedGeoLevel, setSelectedGeoLevel] = useState('All');
  const [selectedFilterAge, setSelectedFilterAge] = useState('All Ages');
  const [selectedFilterGender, setSelectedFilterGender] = useState('All Genders');
  const [showFilters, setShowFilters] = useState(false);

  const filteredProposals = useMemo(() => {
    return proposals.filter(proposal => {
      const matchesSearch = searchQuery === '' || proposal.title.toLowerCase().includes(searchQuery.toLowerCase()) || proposal.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || (proposal.category || 'Other') === selectedCategory;
      const timeRemaining = getTimeRemaining(proposal.deadline);
      const isEnded = timeRemaining === 'Ended';
      let matchesStatus = selectedStatus === 'All';
      if (selectedStatus === 'Active') matchesStatus = !isEnded;
      if (selectedStatus === 'Ended') matchesStatus = isEnded;
      if (selectedStatus === 'My Proposals') { const creatorId = (proposal as any).creatorId || (proposal as any).userId; matchesStatus = creatorId === user?.id || creatorId === String(user?.id); }
      let matchesGeo = true;
      if (selectedGeoLevel !== 'All') { const geoTags = proposal.geoRestrictions || []; if (selectedGeoLevel === 'National') matchesGeo = geoTags.length === 0 || geoTags.some(t => COUNTRIES.includes(t)); else if (selectedGeoLevel === 'State/Province') matchesGeo = geoTags.length >= 2; else if (selectedGeoLevel === 'City/Local') matchesGeo = geoTags.length >= 3; }
      let matchesAge = true, matchesGender = true;
      const demoRestrictions = (proposal as any).demographicRestrictions;
      if (selectedFilterAge !== 'All Ages') matchesAge = !demoRestrictions?.ageGroup || demoRestrictions.ageGroup === selectedFilterAge;
      if (selectedFilterGender !== 'All Genders') matchesGender = !demoRestrictions?.gender || demoRestrictions.gender === selectedFilterGender;
      return matchesSearch && matchesCategory && matchesStatus && matchesGeo && matchesAge && matchesGender;
    });
  }, [proposals, searchQuery, selectedCategory, selectedStatus, selectedGeoLevel, selectedFilterAge, selectedFilterGender, user?.id]);

  const fetchData = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const [proposalsRes, claimedRes, votedRes, profileRes] = await Promise.all([proposalsApi.getAll(), isAuthenticated ? userApi.getClaimedTokens() : Promise.resolve({ data: [], error: null }), isAuthenticated ? userApi.getVotedProposals() : Promise.resolve({ data: [], error: null }), isAuthenticated ? userApi.getProfile() : Promise.resolve({ data: null, error: null })]);
      if (proposalsRes.data) setProposals(proposalsRes.data);
      if (claimedRes.data) setClaimedTokens(new Set(claimedRes.data.map((c: any) => typeof c === 'object' ? c.proposalId : c)));
      if (votedRes.data) setVotedProposals(new Set(votedRes.data.map((v: any) => typeof v === 'object' ? v.proposalId : v)));
      if (profileRes.data) { setUserCountry(profileRes.data.country || ''); setUserState(profileRes.data.state || ''); setUserCity(profileRes.data.city || ''); setIsVerified(profileRes.data.verified || false); }
    } catch (error) { console.error('Error fetching data:', error); } finally { setLoading(false); setRefreshing(false); }
  }, [isAuthenticated]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleClaimToken = async (proposalId: number) => {
    if (!isAuthenticated) { Alert.alert('Sign In Required', 'Please sign in to claim vote tokens.'); return; }
    try { const result = await proposalsApi.claimVoteToken(proposalId); if (result.error) { Alert.alert('Error', result.error); return; } setClaimedTokens(prev => new Set([...prev, proposalId])); Alert.alert('Success', 'Vote token claimed! You can now vote on this proposal.'); } catch (error) { Alert.alert('Error', 'Failed to claim vote token. Please try again.'); }
  };

  const handleVote = async (proposalId: number, vote: 'support' | 'oppose') => {
    if (!isAuthenticated) { Alert.alert('Sign In Required', 'Please sign in to vote.'); return; }
    setVotingProposalId(proposalId);
    try { const result = await proposalsApi.submitVote(proposalId, vote); if (result.error) { Alert.alert('Error', result.error); return; } setVotedProposals(prev => new Set([...prev, proposalId])); setProposals(prev => prev.map(p => (p.id as number) === proposalId ? { ...p, supportVotes: vote === 'support' ? (p.supportVotes || 0) + 1 : p.supportVotes, opposeVotes: vote === 'oppose' ? (p.opposeVotes || 0) + 1 : p.opposeVotes } : p)); Alert.alert('Vote Recorded', `Your ${vote} vote has been recorded on the blockchain.`); } catch (error) { Alert.alert('Error', 'Failed to submit vote. Please try again.'); } finally { setVotingProposalId(null); }
  };

  const handleCreateProposal = async () => {
    if (!newProposal.title.trim()) { Alert.alert('Error', 'Please enter a proposal title.'); return; }
    if (!newProposal.description.trim()) { Alert.alert('Error', 'Please enter a proposal description.'); return; }
    setCreating(true);
    try {
      const geoRestrictions: string[] = [];
      if (userCountry) { geoRestrictions.push(userCountry); if ((newProposal.geoScope === 'state' || newProposal.geoScope === 'city') && userState) { geoRestrictions.push(userState); } if (newProposal.geoScope === 'city' && userCity) { geoRestrictions.push(userCity); } }
      const demographicRestrictions: any = {};
      if (newProposal.ageGroup !== 'All Ages') demographicRestrictions.ageGroup = newProposal.ageGroup;
      if (newProposal.gender !== 'All Genders') demographicRestrictions.gender = newProposal.gender;
      let imageUrl: string | undefined;
      if (newProposal.imageUri) { const fileName = newProposal.imageUri.split('/').pop() || 'proposal-image.jpg'; const uploadedUrl = await uploadsApi.uploadImage({ uri: newProposal.imageUri, name: fileName, type: 'image/jpeg' }); if (uploadedUrl) imageUrl = uploadedUrl; }
      const result = await proposalsApi.create({ title: newProposal.title.trim(), description: newProposal.description.trim(), category: newProposal.category, geoRestrictions: geoRestrictions.length > 0 ? geoRestrictions : undefined, demographicRestrictions: Object.keys(demographicRestrictions).length > 0 ? demographicRestrictions : undefined, imageUrl });
      if (result.error) { Alert.alert('Error', result.error); return; }
      Alert.alert('Success', 'Your proposal has been created!');
      setShowCreateModal(false); setNewProposal({ title: '', description: '', category: 'Other', country: userCountry, state: userState, city: userCity, geoScope: 'national', ageGroup: 'All Ages', gender: 'All Genders', imageUri: '' }); fetchData(true);
    } catch (error) { Alert.alert('Error', 'Failed to create proposal. Please try again.'); } finally { setCreating(false); }
  };

  const clearFilters = () => { setSearchQuery(''); setSelectedCategory('All'); setSelectedStatus('All'); setSelectedGeoLevel('All'); setSelectedFilterAge('All Ages'); setSelectedFilterGender('All Genders'); };
  const hasActiveFilters = searchQuery !== '' || selectedCategory !== 'All' || selectedStatus !== 'All' || selectedGeoLevel !== 'All' || selectedFilterAge !== 'All Ages' || selectedFilterGender !== 'All Genders';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Proposals</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity style={[styles.filterButton, { backgroundColor: hasActiveFilters ? colors.gold : colors.cardBg, borderColor: colors.border }]} onPress={() => setShowFilters(!showFilters)}><Ionicons name="filter" size={18} color={hasActiveFilters ? '#000' : colors.text} /></TouchableOpacity>
          <TouchableOpacity style={[styles.createButton, { backgroundColor: colors.gold }]} onPress={() => setShowCreateModal(true)}><Ionicons name="add" size={22} color="#000" /></TouchableOpacity>
        </View>
      </View>
      <View style={[styles.searchContainer, { backgroundColor: colors.cardBg, borderColor: colors.border }]}><Ionicons name="search" size={18} color={colors.textSecondary} /><TextInput style={[styles.searchInput, { color: colors.text }]} placeholder="Search proposals..." placeholderTextColor={colors.textSecondary} value={searchQuery} onChangeText={setSearchQuery} /></View>
      {showFilters && (
        <View style={[styles.filterPanel, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <View style={styles.filterSection}><Text style={[styles.filterLabel, { color: colors.textSecondary }]}>Category</Text><ScrollView horizontal showsHorizontalScrollIndicator={false}><View style={styles.filterOptions}>{CATEGORIES.map(cat => <TouchableOpacity key={cat} style={[styles.filterChip, { backgroundColor: selectedCategory === cat ? colors.gold : colors.background, borderColor: colors.border }]} onPress={() => setSelectedCategory(cat)}><Text style={[styles.filterChipText, { color: selectedCategory === cat ? '#000' : colors.text }]}>{cat}</Text></TouchableOpacity>)}</View></ScrollView></View>
          <View style={styles.filterSection}><Text style={[styles.filterLabel, { color: colors.textSecondary }]}>Status</Text><ScrollView horizontal showsHorizontalScrollIndicator={false}><View style={styles.filterOptions}>{STATUS_FILTERS.map(s => <TouchableOpacity key={s} style={[styles.filterChip, { backgroundColor: selectedStatus === s ? colors.gold : colors.background, borderColor: colors.border }]} onPress={() => setSelectedStatus(s)}><Text style={[styles.filterChipText, { color: selectedStatus === s ? '#000' : colors.text }]}>{s}</Text></TouchableOpacity>)}</View></ScrollView></View>
          <View style={styles.filterSection}><Text style={[styles.filterLabel, { color: colors.textSecondary }]}>Geographic Level</Text><ScrollView horizontal showsHorizontalScrollIndicator={false}><View style={styles.filterOptions}>{GEO_LEVELS.map(g => <TouchableOpacity key={g} style={[styles.filterChip, { backgroundColor: selectedGeoLevel === g ? colors.gold : colors.background, borderColor: colors.border }]} onPress={() => setSelectedGeoLevel(g)}><Text style={[styles.filterChipText, { color: selectedGeoLevel === g ? '#000' : colors.text }]}>{g}</Text></TouchableOpacity>)}</View></ScrollView></View>
          {hasActiveFilters && <TouchableOpacity style={styles.clearFiltersButton} onPress={clearFilters}><Ionicons name="close-circle" size={16} color={colors.error} /><Text style={[styles.clearFiltersText, { color: colors.error }]}>Clear filters</Text></TouchableOpacity>}
        </View>
      )}
      <View style={styles.resultsCount}><Text style={[styles.resultsText, { color: colors.textSecondary }]}>{filteredProposals.length} proposal{filteredProposals.length !== 1 ? 's' : ''}</Text></View>
      {loading ? (
        <View style={styles.loadingContainer}><ActivityIndicator size="large" color={colors.gold} /><Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading proposals...</Text></View>
      ) : filteredProposals.length === 0 ? (
        <View style={styles.emptyContainer}><Ionicons name="document-text-outline" size={48} color={colors.textSecondary} /><Text style={[styles.emptyText, { color: colors.text }]}>No proposals found</Text><Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>{hasActiveFilters ? 'Try adjusting your filters' : 'Be the first to create one!'}</Text>{!hasActiveFilters && <TouchableOpacity style={[styles.emptyCreateButton, { backgroundColor: colors.gold }]} onPress={() => setShowCreateModal(true)}><Text style={styles.emptyCreateButtonText}>Create Proposal</Text></TouchableOpacity>}</View>
      ) : (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchData(true)} tintColor={colors.gold} />}>
          {filteredProposals.map(proposal => <ProposalCard key={proposal.id} proposal={proposal} hasClaimed={claimedTokens.has(proposal.id as number)} hasVoted={votedProposals.has(proposal.id as number)} onClaimToken={handleClaimToken} onVote={handleVote} isVoting={votingProposalId === proposal.id} colors={colors} onPress={() => {}} />)}
        </ScrollView>
      )}
      <Modal visible={showCreateModal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={[styles.modalContainer, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setShowCreateModal(false)}><Text style={[styles.modalCancel, { color: colors.textSecondary }]}>Cancel</Text></TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>New Proposal</Text>
            <TouchableOpacity onPress={handleCreateProposal} disabled={creating}><Text style={[styles.modalSubmit, { color: colors.gold }, creating && styles.modalSubmitDisabled]}>{creating ? 'Creating...' : 'Create'}</Text></TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            <View style={styles.inputGroup}><Text style={[styles.inputLabel, { color: colors.gold }]}>Title</Text><TextInput style={[styles.input, { backgroundColor: colors.cardBg, color: colors.text, borderColor: colors.border }]} placeholder="Enter proposal title..." placeholderTextColor={colors.textSecondary} value={newProposal.title} onChangeText={t => setNewProposal(p => ({ ...p, title: t }))} /></View>
            <View style={styles.inputGroup}><Text style={[styles.inputLabel, { color: colors.gold }]}>Description</Text><TextInput style={[styles.input, styles.textArea, { backgroundColor: colors.cardBg, color: colors.text, borderColor: colors.border }]} placeholder="Describe your proposal..." placeholderTextColor={colors.textSecondary} value={newProposal.description} onChangeText={t => setNewProposal(p => ({ ...p, description: t }))} multiline numberOfLines={6} textAlignVertical="top" /></View>
            <View style={styles.inputGroup}><Text style={[styles.inputLabel, { color: colors.gold }]}>Image (Optional)</Text><TouchableOpacity style={[styles.imagePickerButton, { backgroundColor: colors.cardBg, borderColor: colors.border }]} onPress={pickImage}>{newProposal.imageUri ? <Image source={{ uri: newProposal.imageUri }} style={styles.imagePreview} /> : <View style={styles.imagePickerPlaceholder}><Ionicons name="image-outline" size={32} color={colors.textSecondary} /><Text style={[styles.imagePickerText, { color: colors.textSecondary }]}>Tap to add image</Text></View>}</TouchableOpacity>{newProposal.imageUri && <TouchableOpacity style={styles.removeImageButton} onPress={() => setNewProposal(p => ({ ...p, imageUri: '' }))}><Ionicons name="trash-outline" size={16} color={colors.error} /><Text style={[styles.removeImageText, { color: colors.error }]}>Remove</Text></TouchableOpacity>}</View>
            <View style={styles.inputGroup}><Text style={[styles.inputLabel, { color: colors.gold }]}>Category</Text><ScrollView horizontal showsHorizontalScrollIndicator={false}><View style={styles.categoryPicker}>{CATEGORIES.filter(c => c !== 'All').map(cat => <TouchableOpacity key={cat} style={[styles.categoryOption, { backgroundColor: colors.cardBg, borderColor: colors.border }, newProposal.category === cat && { backgroundColor: colors.gold, borderColor: colors.gold }]} onPress={() => setNewProposal(p => ({ ...p, category: cat }))}><Text style={[styles.categoryOptionText, { color: colors.textSecondary }, newProposal.category === cat && { color: '#000' }]}>{cat}</Text></TouchableOpacity>)}</View></ScrollView></View>
            <View style={[styles.sectionDivider, { borderTopColor: colors.border }]}><Ionicons name="location-outline" size={18} color={colors.gold} /><Text style={[styles.sectionLabel, { color: colors.gold }]}>Geographic Scope</Text></View>
            {userCountry ? (
              <>
                <Text style={[styles.helperText, { color: colors.textSecondary }]}>Based on your verified location, you can create proposals for:</Text>
                <View style={[styles.locationCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}><Ionicons name="location" size={16} color={colors.gold} /><Text style={[styles.locationText, { color: colors.text }]}>{[userCity, userState, userCountry].filter(Boolean).join(', ')}</Text></View>
                <View style={styles.inputGroup}><Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Who can vote on this proposal?</Text><View style={styles.scopeOptions}>
                  <TouchableOpacity style={[styles.scopeOption, { backgroundColor: colors.cardBg, borderColor: newProposal.geoScope === 'national' ? colors.gold : colors.border }, newProposal.geoScope === 'national' && { backgroundColor: colors.goldLight }]} onPress={() => setNewProposal(p => ({ ...p, geoScope: 'national' }))}><Ionicons name="globe-outline" size={24} color={newProposal.geoScope === 'national' ? colors.gold : colors.textSecondary} /><Text style={[styles.scopeTitle, { color: newProposal.geoScope === 'national' ? colors.gold : colors.text }]}>National</Text><Text style={[styles.scopeDesc, { color: colors.textSecondary }]}>All of {userCountry}</Text></TouchableOpacity>
                  {userState && <TouchableOpacity style={[styles.scopeOption, { backgroundColor: colors.cardBg, borderColor: newProposal.geoScope === 'state' ? colors.gold : colors.border }, newProposal.geoScope === 'state' && { backgroundColor: colors.goldLight }]} onPress={() => setNewProposal(p => ({ ...p, geoScope: 'state' }))}><Ionicons name="map-outline" size={24} color={newProposal.geoScope === 'state' ? colors.gold : colors.textSecondary} /><Text style={[styles.scopeTitle, { color: newProposal.geoScope === 'state' ? colors.gold : colors.text }]}>State/Province</Text><Text style={[styles.scopeDesc, { color: colors.textSecondary }]}>{userState} only</Text></TouchableOpacity>}
                  {userCity && <TouchableOpacity style={[styles.scopeOption, { backgroundColor: colors.cardBg, borderColor: newProposal.geoScope === 'city' ? colors.gold : colors.border }, newProposal.geoScope === 'city' && { backgroundColor: colors.goldLight }]} onPress={() => setNewProposal(p => ({ ...p, geoScope: 'city' }))}><Ionicons name="business-outline" size={24} color={newProposal.geoScope === 'city' ? colors.gold : colors.textSecondary} /><Text style={[styles.scopeTitle, { color: newProposal.geoScope === 'city' ? colors.gold : colors.text }]}>City/Local</Text><Text style={[styles.scopeDesc, { color: colors.textSecondary }]}>{userCity} only</Text></TouchableOpacity>}
                </View></View>
              </>
            ) : (
              <View style={[styles.warningCard, { backgroundColor: colors.warningLight, borderColor: colors.warning }]}><Ionicons name="warning-outline" size={20} color={colors.warning} /><View style={styles.warningContent}><Text style={[styles.warningTitle, { color: colors.warning }]}>Location Not Verified</Text><Text style={[styles.warningText, { color: colors.textSecondary }]}>Complete identity verification to create geo-restricted proposals. Your proposal will be visible to all users.</Text></View></View>
            )}
            <View style={[styles.sectionDivider, { borderTopColor: colors.border }]}><Ionicons name="people-outline" size={18} color={colors.gold} /><Text style={[styles.sectionLabel, { color: colors.gold }]}>Demographic Restrictions</Text></View>
            <Text style={[styles.helperText, { color: colors.textSecondary }]}>Limit who can vote based on demographics (optional)</Text>
            <View style={styles.inputGroup}><Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Age Group</Text><ScrollView horizontal showsHorizontalScrollIndicator={false}><View style={styles.filterOptions}>{AGE_GROUPS.map(age => <TouchableOpacity key={age} style={[styles.filterChip, { backgroundColor: newProposal.ageGroup === age ? colors.gold : colors.cardBg, borderColor: colors.border }]} onPress={() => setNewProposal(p => ({ ...p, ageGroup: age }))}><Text style={[styles.filterChipText, { color: newProposal.ageGroup === age ? '#000' : colors.text }]}>{age}</Text></TouchableOpacity>)}</View></ScrollView></View>
            <View style={styles.inputGroup}><Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Gender</Text><ScrollView horizontal showsHorizontalScrollIndicator={false}><View style={styles.filterOptions}>{GENDERS.map(g => <TouchableOpacity key={g} style={[styles.filterChip, { backgroundColor: newProposal.gender === g ? colors.gold : colors.cardBg, borderColor: colors.border }]} onPress={() => setNewProposal(p => ({ ...p, gender: g }))}><Text style={[styles.filterChipText, { color: newProposal.gender === g ? '#000' : colors.text }]}>{g}</Text></TouchableOpacity>)}</View></ScrollView></View>
            <View style={{ height: 50 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  headerTitle: { fontSize: 28, fontWeight: 'bold' },
  headerButtons: { flexDirection: 'row', gap: 10 },
  filterButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  createButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 12, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, gap: 10 },
  searchInput: { flex: 1, fontSize: 16 },
  filterPanel: { marginHorizontal: 16, marginTop: 12, padding: 16, borderRadius: 12, borderWidth: 1 },
  filterSection: { marginBottom: 12 },
  filterLabel: { fontSize: 12, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase' },
  filterOptions: { flexDirection: 'row', gap: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  filterChipText: { fontSize: 13, fontWeight: '500' },
  clearFiltersButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingTop: 8 },
  clearFiltersText: { fontSize: 14, fontWeight: '500' },
  resultsCount: { paddingHorizontal: 20, paddingTop: 12 },
  resultsText: { fontSize: 13 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyText: { fontSize: 20, fontWeight: '600', marginTop: 16 },
  emptySubtext: { fontSize: 14, marginTop: 8, textAlign: 'center' },
  emptyCreateButton: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24, marginTop: 24 },
  emptyCreateButtonText: { color: '#000', fontSize: 16, fontWeight: '600' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, gap: 16 },
  card: { borderRadius: 16, padding: 16, borderWidth: 1, marginBottom: 16 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  shareButton: { padding: 4 },
  categoryBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  categoryText: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  geoTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  geoTag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  geoTagText: { fontSize: 10, fontWeight: '500' },
  deadlineBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  deadlineText: { fontSize: 11, fontWeight: '500' },
  cardTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  cardDescription: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
  proposalImage: { width: '100%', height: 180, borderRadius: 8, marginBottom: 12 },
  voteBar: { height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 8 },
  supportBar: { height: '100%', borderRadius: 3 },
  voteStats: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  voteStat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  voteCount: { fontSize: 13, fontWeight: '500' },
  claimButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, gap: 8 },
  claimingButton: { opacity: 0.7 },
  claimButtonText: { color: '#000', fontSize: 15, fontWeight: '600' },
  actionButtons: { flexDirection: 'row', gap: 12 },
  actionButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, gap: 6 },
  disabledButton: { opacity: 0.6 },
  actionButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  votedContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, gap: 8 },
  votedText: { fontSize: 14, fontWeight: '500' },
  endedContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12 },
  endedLabel: { fontSize: 14, fontWeight: '500' },
  modalContainer: { flex: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
  modalCancel: { fontSize: 16 },
  modalTitle: { fontSize: 18, fontWeight: '600' },
  modalSubmit: { fontSize: 16, fontWeight: '600' },
  modalSubmitDisabled: { opacity: 0.5 },
  modalContent: { flex: 1, padding: 20 },
  inputGroup: { marginBottom: 20 },
  inputLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16 },
  textArea: { minHeight: 120, paddingTop: 14 },
  imagePickerButton: { borderWidth: 1, borderRadius: 12, overflow: 'hidden', borderStyle: 'dashed' },
  imagePreview: { width: '100%', height: 180, borderRadius: 12 },
  imagePickerPlaceholder: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  imagePickerText: { fontSize: 14, marginTop: 8 },
  removeImageButton: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  removeImageText: { fontSize: 14 },
  categoryPicker: { flexDirection: 'row', gap: 8 },
  categoryOption: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1 },
  categoryOptionText: { fontSize: 14, fontWeight: '500' },
  sectionDivider: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, marginBottom: 8, paddingTop: 16, borderTopWidth: 1 },
  sectionLabel: { fontSize: 16, fontWeight: '600' },
  helperText: { fontSize: 13, marginBottom: 12 },
  locationCard: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 16 },
  locationText: { fontSize: 14, fontWeight: '500' },
  scopeOptions: { gap: 12 },
  scopeOption: { flexDirection: 'column', alignItems: 'center', padding: 16, borderRadius: 12, borderWidth: 2, marginBottom: 12 },
  scopeTitle: { fontSize: 16, fontWeight: '600', marginTop: 8 },
  scopeDesc: { fontSize: 12, marginTop: 4 },
  warningCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 16 },
  warningContent: { flex: 1 },
  warningTitle: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  warningText: { fontSize: 13, lineHeight: 18 },
});
