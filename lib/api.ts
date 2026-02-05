import { getAuthToken, useAuthStore } from './auth';

const API_BASE_URL = 'https://representportal.com';

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
    if (Array.isArray(result.data)) return { data: result.data, error: null };
    if (result.data?.proposals && Array.isArray(result.data.proposals)) return { data: result.data.proposals, error: null };
    return { data: [], error: result.error };
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
};

export const veriffApi = {
  async createSession(): Promise<ApiResponse<{ sessionUrl: string; sessionId: string; verificationId?: string }>> {
    return apiRequest('/api/veriff/create-session', { method: 'POST' });
  },
  async checkDecision(verificationId: string): Promise<ApiResponse<{ status: string; decision?: string }>> {
    return apiRequest(`/api/veriff/check-decision?verificationId=${verificationId}`);
  },
};

// Organization types
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

export const organizationsApi = {
  async getMyOrganizations(): Promise<ApiResponse<Organization[]>> {
    const result = await apiRequest<any>('/api/organizations');
    if (Array.isArray(result.data)) return { data: result.data, error: null };
    if (result.data?.organizations) return { data: result.data.organizations, error: null };
    return { data: [], error: result.error };
  },

  async getOrganization(orgId: string): Promise<ApiResponse<Organization>> {
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
    const result = await apiRequest<any>(`/api/organizations/${orgId}/proposals`);
    if (Array.isArray(result.data)) return { data: result.data, error: null };
    if (result.data?.proposals) return { data: result.data.proposals, error: null };
    return { data: [], error: result.error };
  },

  async getOrganizationAnnouncements(orgId: string): Promise<ApiResponse<any[]>> {
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
};

export default api;
