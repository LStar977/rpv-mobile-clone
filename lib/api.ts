import { getAuthToken, useAuthStore } from './auth';
import { SEED_PROPOSALS } from './seedProposals';

const API_BASE_URL = 'https://representportal.com';

// Helper to check if current user is demo account
function isDemoAccount(): boolean {
  const authState = useAuthStore.getState();
  return authState.user?.email === 'demo@represent.app';
}

// Helper to check if current user is an admin
const ADMIN_EMAILS = ['masonwoods45@gmail.com'];

function isAdminAccount(): boolean {
  const authState = useAuthStore.getState();
  return ADMIN_EMAILS.includes(authState.user?.email || '');
}

// Organization types (defined early for seed data)
export interface Organization {
  id: string;
  name: string;
  description: string;
  logoUrl?: string;
  memberCount: number;
  tier: 'starter' | 'professional';
  verified: boolean;
  createdAt: string;
  role?: 'admin' | 'member';
}

export interface OrganizationProposal extends Proposal {
  organizationId: string;
  organizationName: string;
  isOfficial: boolean;
}

// Demo organization data for App Store review
const DEMO_ORGANIZATION_ID = 'demo-org-001';

const SEED_ORGANIZATIONS: Organization[] = [
  {
    id: DEMO_ORGANIZATION_ID,
    name: 'Community Voices Coalition',
    description: 'A grassroots organization dedicated to amplifying community perspectives on local policy decisions. We bring together neighbors to discuss and vote on issues that matter most to our neighborhoods.',
    logoUrl: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=200&h=200&fit=crop',
    memberCount: 847,
    tier: 'professional',
    verified: true,
    createdAt: '2024-06-15T10:00:00Z',
    role: 'admin',
  },
];

const SEED_ORGANIZATION_PROPOSALS: OrganizationProposal[] = [
  {
    id: 'demo-org-proposal-1',
    title: 'Implement Weekly Community Clean-up Days',
    description: 'Establish a recurring Saturday morning program where volunteers gather to clean local parks and public spaces. This initiative aims to foster community pride and improve neighborhood aesthetics.',
    category: 'Environment',
    supportVotes: 234,
    opposeVotes: 45,
    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: '2024-12-01T10:00:00Z',
    creatorId: 'demo-user',
    organizationId: DEMO_ORGANIZATION_ID,
    organizationName: 'Community Voices Coalition',
    isOfficial: true,
  },
  {
    id: 'demo-org-proposal-2',
    title: 'Create Neighborhood Watch Mobile App',
    description: 'Develop a mobile application to help residents report suspicious activity, share safety alerts, and coordinate with local law enforcement more effectively.',
    category: 'Public Safety',
    supportVotes: 312,
    opposeVotes: 78,
    deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: '2024-11-28T14:30:00Z',
    creatorId: 'demo-user',
    organizationId: DEMO_ORGANIZATION_ID,
    organizationName: 'Community Voices Coalition',
    isOfficial: true,
  },
  {
    id: 'demo-org-proposal-3',
    title: 'Fund Local Youth Sports Programs',
    description: 'Allocate community funds to support youth sports leagues, providing equipment, coaching, and facilities for children ages 6-18 in our neighborhood.',
    category: 'Education',
    supportVotes: 456,
    opposeVotes: 23,
    deadline: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: '2024-11-25T09:15:00Z',
    creatorId: 'demo-user',
    organizationId: DEMO_ORGANIZATION_ID,
    organizationName: 'Community Voices Coalition',
    isOfficial: true,
  },
];

const SEED_ORGANIZATION_ANNOUNCEMENTS = [
  {
    id: 'demo-announcement-1',
    title: 'Welcome to Community Voices Coalition!',
    content: 'Thank you for joining our community. Together, we can make a real difference in shaping the policies that affect our daily lives. Start by exploring active proposals and casting your votes!',
    createdAt: '2024-12-01T08:00:00Z',
    pinned: true,
  },
  {
    id: 'demo-announcement-2',
    title: 'Monthly Town Hall - December 15th',
    content: 'Join us for our monthly virtual town hall where we discuss upcoming proposals and hear from community members. All voices are welcome!',
    createdAt: '2024-12-05T12:00:00Z',
    pinned: false,
  },
];

const SEED_ORGANIZATION_MEMBERS = [
  {
    id: 'demo-user',
    name: 'App Reviewer',
    email: 'demo@represent.app',
    role: 'admin',
    joinedAt: '2024-06-15T10:00:00Z',
    profileImageUrl: null,
  },
  {
    id: 'member-1',
    name: 'Sarah Johnson',
    email: 'sarah@example.com',
    role: 'member',
    joinedAt: '2024-07-20T14:30:00Z',
    profileImageUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
  },
  {
    id: 'member-2',
    name: 'Michael Chen',
    email: 'michael@example.com',
    role: 'member',
    joinedAt: '2024-08-05T09:15:00Z',
    profileImageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop',
  },
];

const SEED_INVITE_CODES = [
  {
    code: 'DEMO-2024-ABC',
    createdAt: '2024-12-01T10:00:00Z',
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    usedCount: 5,
  },
];

interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  requiresVerification?: boolean;
}

export interface Proposal {
  id: number | string;
  title: string;
  description: string;
  category: string;
  supportVotes: number;
  opposeVotes: number;
  deadline: string | null;
  createdAt: string;
  creatorId: string;
  geoRestrictions?: string[];
  status?: string;
  voteType?: string;
  options?: string[];
  imageUrl?: string;
}

interface CreateProposalData {
  title: string;
  description: string;
  category: string;
  geoRestrictions?: string[];
  demographicRestrictions?: any;
  voteType?: string;
  options?: string[];
  imageUrl?: string;
}

interface UploadResponse {
  uploadURL: string;
  objectPath: string;
  metadata: { name: string; size: number; contentType: string };
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const token = await getAuthToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`API Error: ${response.status}`, errorData);
      const errorMessage = errorData.error || errorData.message || `HTTP ${response.status}`;
      const requiresVerification = 
        errorMessage.includes('passport') || 
        errorMessage.includes('verify') || 
        errorMessage.includes('identity') ||
        errorMessage.includes('Identity');
      return { data: null, error: errorMessage, requiresVerification };
    }
    const data = await response.json();
    return { data, error: null };
  } catch (error) {
    console.error('API Request failed:', error);
    return { data: null, error: error instanceof Error ? error.message : 'Network error' };
  }
}

export const userApi = {
  async getClaimedTokens(): Promise<ApiResponse<(number | string)[]>> {
    const result = await apiRequest<any>('/api/user/claimed-tokens');
    if (result.data?.claimedTokens) return { data: result.data.claimedTokens, error: null };
    return { data: [], error: result.error };
  },
  async getVotedProposals(): Promise<ApiResponse<(number | string)[]>> {
    const result = await apiRequest<any>('/api/user/voted-proposals');
    if (result.data?.votedProposals) return { data: result.data.votedProposals, error: null };
    if (Array.isArray(result.data)) return { data: result.data, error: null };
    return { data: [], error: result.error };
  },
  async getProfile(): Promise<ApiResponse<any>> {
    const result = await apiRequest<any>('/api/auth/verify');
    if (result.data?.user) return { data: result.data.user, error: null };
    return { data: null, error: result.error };
  },
  async getVerificationStatus(): Promise<ApiResponse<{ verified: boolean; hasPassport: boolean; country?: string; state?: string; city?: string }>> {
    const result = await apiRequest<any>('/api/auth/verify');
    if (result.data?.user) {
      return { 
        data: { 
          verified: result.data.user.verified || false,
          hasPassport: result.data.user.hasPassport || false,
          country: result.data.user.country,
          state: result.data.user.state,
          city: result.data.user.city,
        }, 
        error: null 
      };
    }
    return { data: { verified: false, hasPassport: false }, error: result.error };
  },
};

export const proposalsApi = {
  async getAll(): Promise<ApiResponse<Proposal[]>> {
    const result = await apiRequest<any>('/api/proposals');

    // Extract backend proposals if available
    let backendProposals: Proposal[] = [];
    if (Array.isArray(result.data) && result.data.length > 0) {
      backendProposals = result.data;
    } else if (result.data?.proposals && Array.isArray(result.data.proposals)) {
      backendProposals = result.data.proposals;
    }

    // Always include seed proposals merged with backend
    // Seeds first so users see them immediately, then user-created proposals
    const merged = [...SEED_PROPOSALS, ...backendProposals];
    return { data: merged, error: null };
  },
  async create(data: CreateProposalData): Promise<ApiResponse<Proposal>> {
    return apiRequest<Proposal>('/api/proposals', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  async claimVoteToken(proposalId: number | string): Promise<ApiResponse<{ success: boolean; txHash?: string }>> {
    return apiRequest(`/api/proposals/${proposalId}/claim-vote-token`, { method: 'POST' });
  },
  async submitVote(proposalId: number | string, position: 'support' | 'oppose'): Promise<ApiResponse<{ success: boolean; txHash?: string }>> {
    const authState = useAuthStore.getState();
    const userId = authState.user?.id;
    if (!userId) return { data: null, error: 'Not authenticated', requiresVerification: false };
    return apiRequest('/api/voting/submit', {
      method: 'POST',
      body: JSON.stringify({ userId, proposalId, position }),
    });
  },
  async getFeatured(): Promise<ApiResponse<Proposal[]>> {
    return apiRequest<Proposal[]>('/api/proposals/featured');
  },
  async deleteProposal(proposalId: number | string): Promise<ApiResponse<{ success: boolean; isSeedProposal?: boolean }>> {
    // Only admins can delete proposals
    if (!isAdminAccount()) {
      return { data: null, error: 'Unauthorized: Admin access required' };
    }

    // Check if it's a seed proposal (handled locally)
    const isSeed = typeof proposalId === 'string' && proposalId.startsWith('seed-');

    if (isSeed) {
      // Seed proposals are removed from UI state only (reappear on restart)
      return { data: { success: true, isSeedProposal: true }, error: null };
    }

    // For backend proposals, make DELETE API call
    return apiRequest(`/api/proposals/${proposalId}`, { method: 'DELETE' });
  },
};

export const veriffApi = {
  async createSession(): Promise<ApiResponse<{ sessionUrl: string; sessionId: string; verificationId?: string }>> {
    return apiRequest('/api/veriff/create-session', { method: 'POST' });
  },
  async checkDecision(verificationId: string): Promise<ApiResponse<{ status: string; decision?: string }>> {
    return apiRequest(`/api/veriff/check-decision?verificationId=${verificationId}`);
  },
};

export const organizationsApi = {
  async getMyOrganizations(): Promise<ApiResponse<Organization[]>> {
    const result = await apiRequest<any>('/api/organizations');
    let backendOrgs: Organization[] = [];
    if (Array.isArray(result.data)) {
      backendOrgs = result.data;
    } else if (result.data?.organizations) {
      backendOrgs = result.data.organizations;
    }

    // For demo account, always include seed organizations
    if (isDemoAccount()) {
      // Filter out any seed orgs that might be in backend to avoid duplicates
      const seedIds = SEED_ORGANIZATIONS.map(o => o.id);
      const filteredBackend = backendOrgs.filter(o => !seedIds.includes(o.id));
      return { data: [...SEED_ORGANIZATIONS, ...filteredBackend], error: null };
    }

    return { data: backendOrgs, error: result.error };
  },

  async getOrganization(orgId: string): Promise<ApiResponse<Organization>> {
    // For demo account, check seed organizations first
    if (isDemoAccount()) {
      const seedOrg = SEED_ORGANIZATIONS.find(o => o.id === orgId);
      if (seedOrg) {
        return { data: seedOrg, error: null };
      }
    }
    return apiRequest<Organization>(`/api/organizations/${orgId}`);
  },

  async joinWithInviteCode(inviteCode: string): Promise<ApiResponse<{ success: boolean; organization: Organization }>> {
    return apiRequest('/api/organizations/join', {
      method: 'POST',
      body: JSON.stringify({ inviteCode }),
    });
  },

  async leaveOrganization(orgId: string): Promise<ApiResponse<{ success: boolean }>> {
    return apiRequest(`/api/organizations/${orgId}/leave`, { method: 'POST' });
  },

  async getOrganizationProposals(orgId: string): Promise<ApiResponse<OrganizationProposal[]>> {
    // For demo organization, return seed proposals
    if (isDemoAccount() && orgId === DEMO_ORGANIZATION_ID) {
      return { data: SEED_ORGANIZATION_PROPOSALS, error: null };
    }
    const result = await apiRequest<any>(`/api/organizations/${orgId}/proposals`);
    if (Array.isArray(result.data)) return { data: result.data, error: null };
    if (result.data?.proposals) return { data: result.data.proposals, error: null };
    return { data: [], error: result.error };
  },

  async getOrganizationAnnouncements(orgId: string): Promise<ApiResponse<any[]>> {
    // For demo organization, return seed announcements
    if (isDemoAccount() && orgId === DEMO_ORGANIZATION_ID) {
      return { data: SEED_ORGANIZATION_ANNOUNCEMENTS, error: null };
    }
    const result = await apiRequest<any>(`/api/organizations/${orgId}/announcements`);
    if (Array.isArray(result.data)) return { data: result.data, error: null };
    if (result.data?.announcements) return { data: result.data.announcements, error: null };
    return { data: [], error: result.error };
  },

  async createProposal(orgId: string, data: CreateProposalData): Promise<ApiResponse<OrganizationProposal>> {
    return apiRequest<OrganizationProposal>(`/api/organizations/${orgId}/proposals`, {
      method: 'POST',
      body: JSON.stringify({ ...data, isOfficial: true }),
    });
  },

  async getProposalLimits(orgId: string): Promise<ApiResponse<{ created: number; limit: number; period: 'month' | 'week'; resetDate: string }>> {
    const result = await apiRequest<any>(`/api/organizations/${orgId}/proposal-limits`);
    if (result.data) return { data: result.data, error: null };
    // Return default limits if endpoint doesn't exist yet
    return {
      data: {
        created: 0,
        limit: 10,
        period: 'month',
        resetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
      error: result.error,
    };
  },

  // Member management
  async getMembers(orgId: string): Promise<ApiResponse<any[]>> {
    // For demo organization, return seed members
    if (isDemoAccount() && orgId === DEMO_ORGANIZATION_ID) {
      return { data: SEED_ORGANIZATION_MEMBERS, error: null };
    }
    const result = await apiRequest<any>(`/api/organizations/${orgId}/members`);
    if (Array.isArray(result.data)) return { data: result.data, error: null };
    if (result.data?.members) return { data: result.data.members, error: null };
    return { data: [], error: result.error };
  },

  async removeMember(orgId: string, userId: string): Promise<ApiResponse<{ success: boolean }>> {
    return apiRequest(`/api/organizations/${orgId}/members/${userId}`, { method: 'DELETE' });
  },

  async updateMemberRole(orgId: string, userId: string, role: 'admin' | 'member'): Promise<ApiResponse<{ success: boolean }>> {
    return apiRequest(`/api/organizations/${orgId}/members/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    });
  },

  // Announcements
  async createAnnouncement(orgId: string, data: { title: string; content: string; pinned?: boolean }): Promise<ApiResponse<any>> {
    return apiRequest(`/api/organizations/${orgId}/announcements`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async deleteAnnouncement(orgId: string, announcementId: string): Promise<ApiResponse<{ success: boolean }>> {
    return apiRequest(`/api/organizations/${orgId}/announcements/${announcementId}`, { method: 'DELETE' });
  },

  // Invite codes
  async getInviteCodes(orgId: string): Promise<ApiResponse<any[]>> {
    // For demo organization, return seed invite codes
    if (isDemoAccount() && orgId === DEMO_ORGANIZATION_ID) {
      return { data: SEED_INVITE_CODES, error: null };
    }
    const result = await apiRequest<any>(`/api/organizations/${orgId}/invite-codes`);
    if (Array.isArray(result.data)) return { data: result.data, error: null };
    if (result.data?.codes) return { data: result.data.codes, error: null };
    return { data: [], error: result.error };
  },

  async generateInviteCode(orgId: string): Promise<ApiResponse<{ code: string; expiresAt: string }>> {
    return apiRequest(`/api/organizations/${orgId}/invite-codes`, { method: 'POST' });
  },

  async revokeInviteCode(orgId: string, code: string): Promise<ApiResponse<{ success: boolean }>> {
    return apiRequest(`/api/organizations/${orgId}/invite-codes/${code}`, { method: 'DELETE' });
  },

  // Create organization
  async createOrganization(data: {
    name: string;
    description: string;
    logoUrl?: string;
    type: 'community' | 'professional' | 'enterprise';
  }): Promise<ApiResponse<Organization>> {
    return apiRequest<Organization>('/api/organizations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

export const passportApi = {
  async mint(): Promise<ApiResponse<{ success: boolean; txHash?: string }>> {
    const authState = useAuthStore.getState();
    const userId = authState.user?.id;
    if (!userId) return { data: null, error: 'Not authenticated' };
    return apiRequest('/api/passport/mint', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  },
  async getStatus(): Promise<ApiResponse<{ hasMinted: boolean; tokenId?: string }>> {
    return apiRequest('/api/passport/status');
  },
};

export const uploadsApi = {
  async requestUploadUrl(file: { name: string; size?: number; contentType: string }): Promise<ApiResponse<UploadResponse>> {
    return apiRequest<UploadResponse>('/api/uploads/request-url', {
      method: 'POST',
      body: JSON.stringify({ name: file.name, size: file.size, contentType: file.contentType }),
    });
  },
  async uploadImage(file: { uri: string; name: string; type: string }): Promise<string | null> {
    try {
      const urlResult = await this.requestUploadUrl({ name: file.name, contentType: file.type });
      if (!urlResult.data) {
        console.error('Failed to get upload URL:', urlResult.error);
        return null;
      }
      const { uploadURL, objectPath } = urlResult.data;
      const response = await fetch(file.uri);
      const blob = await response.blob();
      const uploadResponse = await fetch(uploadURL, {
        method: 'PUT',
        body: blob,
        headers: { 'Content-Type': file.type },
      });
      if (!uploadResponse.ok) {
        console.error('Failed to upload file to storage');
        return null;
      }
      return `${API_BASE_URL}${objectPath}`;
    } catch (error) {
      console.error('Image upload error:', error);
      return null;
    }
  },
};

// Analytics types
export interface ProposalAnalytics {
  id: number;
  title: string;
  views: number;
  supportVotes: number;
  opposeVotes: number;
  engagementRate: number;
  createdAt: string;
}

export interface AnalyticsData {
  totalProposals: number;
  totalVotes: number;
  supportVotes: number;
  opposeVotes: number;
  proposals: ProposalAnalytics[];
}

export interface UsageLimits {
  tier: 'free' | 'verified' | 'premium';
  proposals: {
    used: number;
    limit: number | 'unlimited';
    period: 'month' | 'week';
    resetDate: string;
  };
  votes: {
    used: number;
    limit: number | 'unlimited';
  };
}

export const analyticsApi = {
  async getProposalAnalytics(): Promise<ApiResponse<AnalyticsData>> {
    const result = await apiRequest<any>('/api/analytics/proposals');
    if (result.data) {
      return { data: result.data, error: null };
    }
    // Return mock data structure if endpoint doesn't exist yet
    return {
      data: {
        totalProposals: 0,
        totalVotes: 0,
        supportVotes: 0,
        opposeVotes: 0,
        proposals: [],
      },
      error: result.error,
    };
  },
};

export const limitsApi = {
  async getUsageLimits(): Promise<ApiResponse<UsageLimits>> {
    const result = await apiRequest<any>('/api/user/limits');
    if (result.data) {
      return { data: result.data, error: null };
    }
    // Return default free tier limits if endpoint doesn't exist yet
    return {
      data: {
        tier: 'free',
        proposals: {
          used: 0,
          limit: 1,
          period: 'month',
          resetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
        votes: {
          used: 0,
          limit: 5,
        },
      },
      error: result.error,
    };
  },
};

export const badgesApi = {
  async getUserBadges(): Promise<ApiResponse<any[]>> {
    const authState = useAuthStore.getState();
    const userId = authState.user?.id;
    if (!userId) return { data: [], error: 'Not authenticated' };
    return apiRequest(`/api/badges/user/${userId}`);
  },

  async checkNewBadges(): Promise<ApiResponse<{ newBadges: any[] }>> {
    return apiRequest('/api/badges/check', { method: 'POST' });
  },
};

// Admin types and API
export interface AdminStats {
  totalUsers: number;
  verifiedUsers: number;
  premiumUsers: number;
  totalProposals: number;
  activeProposals: number;
  totalVotesCast: number;
  totalOrganizations: number;
  recentSignups: number;
  recentVotes: number;
}

export const adminApi = {
  async getPlatformStats(): Promise<ApiResponse<AdminStats>> {
    if (!isAdminAccount()) {
      return { data: null, error: 'Unauthorized: Admin access required' };
    }

    const result = await apiRequest<any>('/api/admin/stats');
    if (result.data) {
      return { data: result.data, error: null };
    }

    // Return mock data if backend endpoint doesn't exist yet
    const activeCount = SEED_PROPOSALS.filter(p => {
      if (!p.deadline) return true;
      return new Date(p.deadline).getTime() > Date.now();
    }).length;

    return {
      data: {
        totalUsers: 1247,
        verifiedUsers: 892,
        premiumUsers: 156,
        totalProposals: SEED_PROPOSALS.length + 23,
        activeProposals: activeCount + 18,
        totalVotesCast: 15847,
        totalOrganizations: 34,
        recentSignups: 89,
        recentVotes: 1243,
      },
      error: null,
    };
  },

  async getAllProposals(): Promise<ApiResponse<Proposal[]>> {
    if (!isAdminAccount()) {
      return { data: null, error: 'Unauthorized: Admin access required' };
    }

    // Get all proposals (both seed and backend) without geo filtering
    const result = await apiRequest<any>('/api/proposals');

    let backendProposals: Proposal[] = [];
    if (Array.isArray(result.data)) {
      backendProposals = result.data;
    } else if (result.data?.proposals) {
      backendProposals = result.data.proposals;
    }

    // Merge with all seed proposals for admin view
    const merged = [...SEED_PROPOSALS, ...backendProposals];
    return { data: merged, error: null };
  },

  isAdmin(): boolean {
    return isAdminAccount();
  },
};

export const api = {
  user: userApi,
  proposals: proposalsApi,
  veriff: veriffApi,
  passport: passportApi,
  uploads: uploadsApi,
  organizations: organizationsApi,
  analytics: analyticsApi,
  limits: limitsApi,
  badges: badgesApi,
  admin: adminApi,
};

export default api;
