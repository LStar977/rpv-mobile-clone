import { getAuthToken, useAuthStore } from './auth';
import { SEED_PROPOSALS } from './seedProposals';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://representportal.com';
const DEMO_ORGS_STORAGE_KEY = '@represent_demo_organizations';
const DEMO_PROPOSALS_STORAGE_KEY = '@represent_demo_proposals';
const DELETED_PROPOSALS_STORAGE_KEY = '@represent_deleted_proposals';
const ORG_VOTES_STORAGE_KEY = '@represent_org_votes';

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
  tier: 'starter' | 'professional' | 'premium' | 'enterprise';
  verified: boolean;
  createdAt: string;
  role?: 'admin' | 'member';
}

export interface OrganizationProposal extends Proposal {
  organizationId: string;
  organizationName: string;
  isOfficial: boolean;
  userVote?: 'support' | 'oppose' | null;
}

// Demo organization data for App Store review
const DEMO_ORGANIZATION_ID = 'demo-org-001';
const DEMO_WESTBROOK_ID = 'demo-org-westbrook';

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
  {
    id: DEMO_WESTBROOK_ID,
    name: 'Westbrook University',
    description: 'Westbrook University uses Represent to give every student and faculty member a direct voice in campus decisions. Sub-organizations let each department run its own polls while leadership sees the full picture.',
    logoUrl: 'https://images.unsplash.com/photo-1562774053-701939374585?w=200&h=200&fit=crop',
    memberCount: 3209,
    tier: 'enterprise',
    verified: true,
    createdAt: '2024-08-22T10:00:00Z',
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
  {
    id: 'westbrook-proposal-1',
    title: 'Extend library hours to 24/7 during finals week',
    description: 'Expand operating hours at Carrigan Library and the engineering branch to round-the-clock access during the two weeks before finals each semester. Funded by reallocating existing weekend custodial budget.',
    category: 'Campus Operations',
    supportVotes: 1247,
    opposeVotes: 89,
    deadline: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    creatorId: 'demo-user',
    organizationId: DEMO_WESTBROOK_ID,
    organizationName: 'Westbrook University',
    isOfficial: true,
  },
  {
    id: 'westbrook-proposal-2',
    title: 'Mandate AI ethics course in CS curriculum',
    description: 'Add a required 3-credit AI ethics course (CS 287) for all CS majors starting Fall 2026. Course would be co-taught with the Philosophy department and cover topics like bias, transparency, and accountability in AI systems.',
    category: 'Curriculum',
    supportVotes: 312,
    opposeVotes: 167,
    deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    creatorId: 'demo-user',
    organizationId: DEMO_WESTBROOK_ID,
    organizationName: 'Westbrook University',
    isOfficial: true,
  },
  {
    id: 'westbrook-proposal-3',
    title: 'Replace dining hall vendor with local sustainable provider',
    description: 'Switch from Sodexo to Hudson Valley Foodworks beginning the next contract cycle (July 2026). Estimated 12% cost increase offset by reduced food waste and stronger ties to regional farms.',
    category: 'Campus Operations',
    supportVotes: 891,
    opposeVotes: 234,
    deadline: new Date(Date.now() + 18 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    creatorId: 'demo-user',
    organizationId: DEMO_WESTBROOK_ID,
    organizationName: 'Westbrook University',
    isOfficial: true,
  },
  {
    id: 'westbrook-proposal-4',
    title: 'Build new engineering lab in Bessemer Hall',
    description: 'Approve $4.2M renovation of Bessemer Hall basement to add a maker-space lab with 3D printers, CNC machines, and electronics benches. Funded jointly by the engineering school and a matching alumni gift.',
    category: 'Facilities',
    supportVotes: 489,
    opposeVotes: 78,
    deadline: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
    creatorId: 'demo-user',
    organizationId: DEMO_WESTBROOK_ID,
    organizationName: 'Westbrook University',
    isOfficial: true,
  },
  {
    id: 'westbrook-proposal-5',
    title: 'Move CS 101 to online-first format',
    description: 'Convert the introductory CS course from in-person lectures to a flipped/online-first model with optional weekly recitation sections. Same total credit hours; aimed at letting students re-watch lectures during problem sets.',
    category: 'Curriculum',
    supportVotes: 198,
    opposeVotes: 184,
    deadline: new Date(Date.now() + 11 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    creatorId: 'demo-user',
    organizationId: DEMO_WESTBROOK_ID,
    organizationName: 'Westbrook University',
    isOfficial: true,
  },
  {
    id: 'westbrook-proposal-6',
    title: 'Add startup incubator funding for student entrepreneurs',
    description: 'Allocate $250K/year from the Business School endowment to fund a student-run startup incubator providing mentorship, working space, and seed grants of up to $10K per team.',
    category: 'Programs',
    supportVotes: 423,
    opposeVotes: 91,
    deadline: new Date(Date.now() + 16 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    creatorId: 'demo-user',
    organizationId: DEMO_WESTBROOK_ID,
    organizationName: 'Westbrook University',
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

// ─── Westbrook University demo data ──────────────────────────────────────
// Used by the demo account to showcase sub-organizations + insights.
// Numbers are tuned to make the spread visible: small high-engagement
// departments (Athletics, CS) contrast with larger lower-engagement ones
// (Business, Liberal Arts), so the Insights page tells a clear story.

const SEED_WESTBROOK_SUB_ORGS = [
  {
    id: 'westbrook-cs',
    parentOrgId: DEMO_WESTBROOK_ID,
    name: 'Computer Science',
    type: 'department',
    membershipType: 'invite',
    description: 'CS undergrads, grads, and faculty.',
    memberCount: 487,
    proposalCount: 8,
    voteCount: 412,
    participationRate: 0.78,
    createdAt: '2024-08-22T10:30:00Z',
  },
  {
    id: 'westbrook-engineering',
    parentOrgId: DEMO_WESTBROOK_ID,
    name: 'School of Engineering',
    type: 'department',
    membershipType: 'invite',
    description: 'Mechanical, Electrical, Civil, and Bioengineering.',
    memberCount: 612,
    proposalCount: 6,
    voteCount: 489,
    participationRate: 0.65,
    createdAt: '2024-08-22T10:35:00Z',
  },
  {
    id: 'westbrook-business',
    parentOrgId: DEMO_WESTBROOK_ID,
    name: 'Business School',
    type: 'department',
    membershipType: 'invite',
    description: 'Undergraduate and MBA students, plus business faculty.',
    memberCount: 745,
    proposalCount: 4,
    voteCount: 398,
    participationRate: 0.54,
    createdAt: '2024-08-22T10:40:00Z',
  },
  {
    id: 'westbrook-liberal-arts',
    parentOrgId: DEMO_WESTBROOK_ID,
    name: 'Liberal Arts',
    type: 'department',
    membershipType: 'invite',
    description: 'Humanities, social sciences, and the arts.',
    memberCount: 891,
    proposalCount: 3,
    voteCount: 287,
    participationRate: 0.42,
    createdAt: '2024-08-22T10:45:00Z',
  },
  {
    id: 'westbrook-athletics',
    parentOrgId: DEMO_WESTBROOK_ID,
    name: 'Athletics',
    type: 'department',
    membershipType: 'invite',
    description: 'Varsity athletes, coaches, and athletic department staff.',
    memberCount: 234,
    proposalCount: 1,
    voteCount: 156,
    participationRate: 0.89,
    createdAt: '2024-08-22T10:50:00Z',
  },
];

// 30-day time series with weekday peaks (Mon-Fri ~70/day, Sat-Sun ~25/day).
// Generated relative to today so the chart always shows recent activity.
function buildWestbrookVoteTimeSeries(): Array<{ date: string; count: number }> {
  const series: Array<{ date: string; count: number }> = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dow = d.getDay(); // 0 = Sun, 6 = Sat
    const isWeekend = dow === 0 || dow === 6;
    // Slightly varied per-day so the chart isn't a flat line.
    const variance = ((i * 7919) % 17) - 8; // deterministic -8..+8
    const base = isWeekend ? 25 : 70;
    series.push({
      date: d.toISOString().slice(0, 10),
      count: Math.max(0, base + variance),
    });
  }
  return series;
}

const SEED_WESTBROOK_INSIGHTS = {
  totalMembers: 3209,
  subOrgCount: 5,
  totalProposals: 24,
  totalVotes: 1742,
  participationRate: 0.58,
  subOrgs: SEED_WESTBROOK_SUB_ORGS.map(s => ({
    id: s.id,
    name: s.name,
    memberCount: s.memberCount,
    proposalCount: s.proposalCount,
    voteCount: s.voteCount,
    participationRate: s.participationRate,
  })),
  voteTimeSeries: buildWestbrookVoteTimeSeries(),
  periodDays: 30,
};

const SEED_WESTBROOK_ANNOUNCEMENTS = [
  {
    id: 'westbrook-ann-1',
    title: 'Welcome to the Fall 2025 Voting Season',
    content: 'Six new proposals are open across departments. Check the Insights tab to see participation rates and how your department compares to the rest of campus.',
    createdAt: '2025-09-08T08:00:00Z',
    pinned: true,
  },
  {
    id: 'westbrook-ann-2',
    title: 'New: Sub-Organizations',
    content: 'Department admins can now create sub-organizations to run polls scoped to their own students and faculty. Talk to your department chair to get set up.',
    createdAt: '2025-09-15T12:00:00Z',
    pinned: false,
  },
];

const SEED_WESTBROOK_MEMBERS = [
  {
    id: 'demo-user',
    name: 'App Reviewer',
    email: 'demo@represent.app',
    role: 'admin',
    joinedAt: '2024-08-22T10:00:00Z',
    profileImageUrl: null,
  },
  {
    id: 'westbrook-faculty-1',
    name: 'Dr. Elena Rodriguez',
    email: 'elena.rodriguez@westbrook.edu',
    role: 'admin',
    joinedAt: '2024-08-25T09:00:00Z',
    profileImageUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&h=100&fit=crop',
  },
  {
    id: 'westbrook-student-1',
    name: 'Jamal Patterson',
    email: 'jpatterson@westbrook.edu',
    role: 'member',
    joinedAt: '2024-09-05T14:20:00Z',
    profileImageUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&h=100&fit=crop',
  },
  {
    id: 'westbrook-student-2',
    name: 'Priya Anand',
    email: 'panand@westbrook.edu',
    role: 'member',
    joinedAt: '2024-09-12T11:45:00Z',
    profileImageUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop',
  },
  {
    id: 'westbrook-student-3',
    name: 'Kevin Walsh',
    email: 'kwalsh@westbrook.edu',
    role: 'member',
    joinedAt: '2024-09-18T16:30:00Z',
    profileImageUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop',
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
  creatorName?: string;
  source?: 'civic-desk' | 'user' | 'legislative';
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
  isOfficial?: boolean;
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

      // Handle auth expiration - trigger re-auth flow.
      // TODO: implement transparent refresh+retry. Requires backend changes:
      // (1) issue a refreshToken alongside the JWT at /api/auth/{google,apple}/mobile,
      // (2) add POST /api/auth/refresh that consumes a refresh token and returns
      //     a new short-lived JWT, (3) mobile SecureStore-persist the refresh token,
      // (4) on 401 here, call /api/auth/refresh, update auth store, retry once.
      // Currently the user is bounced to sign-in on token expiry — acceptable
      // for now since JWT_EXPIRES_IN is long enough for typical sessions.
      if (response.status === 401) {
        console.log('[API] Token expired or invalid, triggering re-auth');
        useAuthStore.getState().checkAuth();
        return { data: null, error: 'Session expired. Please sign in again.' };
      }

      const errorMessage = errorData.error || errorData.message || `HTTP ${response.status}`;
      const requiresVerification =
        errorMessage.includes('passport') ||
        errorMessage.includes('verify') ||
        errorMessage.includes('identity') ||
        errorMessage.includes('Identity');
      return { data: null, error: errorMessage, requiresVerification };
    }

    // For DELETE requests, treat any successful response as success
    // Many servers return empty, "OK", "Deleted", or other non-JSON for DELETE
    const method = options.method?.toUpperCase();
    if (method === 'DELETE') {
      return { data: { success: true } as T, error: null };
    }

    // Handle potential non-JSON responses (e.g., HTML error pages with 200 status)
    const text = await response.text();
    if (!text) {
      // Empty response is valid for some operations
      return { data: { success: true } as T, error: null };
    }
    try {
      const data = JSON.parse(text);
      return { data, error: null };
    } catch (parseError) {
      console.error('Failed to parse response as JSON:', text.substring(0, 200));
      return { data: null, error: 'Server returned invalid response' };
    }
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
    let backendIds: (number | string)[] = [];
    if (result.data?.votedProposals) backendIds = result.data.votedProposals;
    else if (Array.isArray(result.data)) backendIds = result.data;

    // Also include locally-recorded org-proposal votes so the dashboard
    // pending counter decrements after voting on an org proposal. The
    // deployed backend's /api/user/voted-proposals only tracks global
    // proposal votes (via /api/voting/submit), not org-proposal votes
    // (cast through /api/organizations/.../proposals/.../vote).
    try {
      const stored = await AsyncStorage.getItem(ORG_VOTES_STORAGE_KEY);
      if (stored) {
        const votes: Record<string, 'support' | 'oppose'> = JSON.parse(stored);
        const orgProposalIds = Object.keys(votes)
          .map((k) => k.split(':')[1])
          .filter(Boolean);
        backendIds = Array.from(new Set([...backendIds.map(String), ...orgProposalIds]));
      }
    } catch {}

    return { data: backendIds, error: result.error };
  },
  async getProfile(): Promise<ApiResponse<any>> {
    const result = await apiRequest<any>('/api/auth/verify');
    if (result.data?.user) return { data: result.data.user, error: null };
    return { data: null, error: result.error };
  },
  async getVerificationStatus(): Promise<ApiResponse<{ verified: boolean; hasPassport: boolean; country?: string; state?: string; city?: string }>> {
    const result = await apiRequest<any>('/api/auth/verify');
    if (result.data?.user) {
      const u = result.data.user;
      const verified = !!(u.verified || u.isVerified || u.is_verified || u.kycVerified || u.kyc_verified || u.passport_verified);
      console.log('[verify] backend user keys:', Object.keys(u).join(','), '| derived verified:', verified);
      return {
        data: {
          verified,
          hasPassport: !!(u.hasPassport || u.has_passport),
          country: u.country,
          state: u.state,
          city: u.city,
        },
        error: null
      };
    }
    return { data: { verified: false, hasPassport: false }, error: result.error };
  },
};

export const proposalsApi = {
  async getAll(): Promise<ApiResponse<Proposal[]>> {
    console.log('[Proposals] getAll() called - fetching from backend...');
    const result = await apiRequest<any>('/api/proposals');
    console.log('[Proposals] API result - error:', result.error, '| data type:', typeof result.data, '| isArray:', Array.isArray(result.data));

    // Extract backend proposals if available
    let backendProposals: Proposal[] = [];
    if (Array.isArray(result.data) && result.data.length > 0) {
      backendProposals = result.data;
    } else if (result.data?.proposals && Array.isArray(result.data.proposals)) {
      backendProposals = result.data.proposals;
    }

    // Backend uses "userId" but client expects "creatorId" - map the field
    backendProposals = backendProposals.map((p: any) => ({
      ...p,
      creatorId: p.creatorId || p.userId,
    }));

    console.log('[Proposals] Backend count:', backendProposals.length, '| Seed count:', SEED_PROPOSALS.length);

    const merged = [...SEED_PROPOSALS, ...backendProposals];
    return { data: merged, error: null };
  },
  async create(data: CreateProposalData): Promise<ApiResponse<Proposal>> {
    const result = await apiRequest<Proposal>('/api/proposals', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    console.log('[Proposals] Create response - error:', result.error, '| creatorId:', (result.data as any)?.creatorId || (result.data as any)?.proposal?.creatorId);
    return result;
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
    // Only admins can delete proposals from backend
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

// Provider-neutral KYC client. Backend routes were renamed from /api/veriff/*
// to /api/didit/* during the Veriff → Didit migration. The veriffApi alias is
// kept so any stale imports still compile.
export const kycApi = {
  async createSession(): Promise<ApiResponse<{ sessionUrl: string; sessionId: string; verificationId?: string }>> {
    return apiRequest('/api/didit/create-session', { method: 'POST' });
  },
  async checkDecision(verificationId: string): Promise<ApiResponse<{ status: string; decision?: string }>> {
    return apiRequest(`/api/didit/check-decision?verificationId=${verificationId}`);
  },
};
export const veriffApi = kycApi;

export const organizationsApi = {
  async getMyOrganizations(): Promise<ApiResponse<Organization[]>> {
    const result = await apiRequest<any>('/api/organizations');
    let backendOrgs: Organization[] = [];
    if (Array.isArray(result.data)) {
      backendOrgs = result.data;
    } else if (result.data?.organizations) {
      backendOrgs = result.data.organizations;
    }

    // For demo account, always include seed organizations AND locally stored orgs
    if (isDemoAccount()) {
      // Load locally stored demo organizations
      let localOrgs: Organization[] = [];
      try {
        const stored = await AsyncStorage.getItem(DEMO_ORGS_STORAGE_KEY);
        if (stored) {
          localOrgs = JSON.parse(stored);
        }
      } catch (e) {
        console.error('Failed to load local demo organizations:', e);
      }

      // Combine all sources, avoiding duplicates
      const seedIds = SEED_ORGANIZATIONS.map(o => o.id);
      const localIds = localOrgs.map(o => o.id);
      const allKnownIds = [...seedIds, ...localIds];
      const filteredBackend = backendOrgs.filter(o => !allKnownIds.includes(o.id));

      // Ensure all backend orgs have admin role for demo account
      const backendWithRole = filteredBackend.map(o => ({ ...o, role: 'admin' as const }));

      // Filter out organizations with missing/empty names
      const allOrgs = [...SEED_ORGANIZATIONS, ...localOrgs, ...backendWithRole];
      const validOrgs = allOrgs.filter(o => o.name && o.name.trim() !== '');
      return { data: validOrgs, error: null };
    }

    // Filter out organizations with missing/empty names
    const validOrgs = backendOrgs.filter(o => o.name && o.name.trim() !== '');
    return { data: validOrgs, error: result.error };
  },

  async getOrganization(orgId: string): Promise<ApiResponse<Organization>> {
    // For demo account, check seed organizations and local storage first
    // Always ensure admin role for demo accounts
    if (isDemoAccount()) {
      const seedOrg = SEED_ORGANIZATIONS.find(o => o.id === orgId);
      if (seedOrg) {
        return { data: { ...seedOrg, role: 'admin' }, error: null };
      }

      // Check locally stored demo organizations
      try {
        const stored = await AsyncStorage.getItem(DEMO_ORGS_STORAGE_KEY);
        if (stored) {
          const localOrgs: Organization[] = JSON.parse(stored);
          const localOrg = localOrgs.find(o => o.id === orgId);
          if (localOrg) {
            return { data: { ...localOrg, role: 'admin' }, error: null };
          }
        }
      } catch (e) {
        console.error('Failed to load local demo organization:', e);
      }

      // Fall through to backend, but ensure admin role for demo account
      const result = await apiRequest<Organization>(`/api/organizations/${orgId}`);
      if (result.data) {
        return { data: { ...result.data, role: 'admin' }, error: null };
      }
      return result;
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
    const authState = useAuthStore.getState();
    const userId = authState.user?.id;
    if (!userId) return { data: null, error: 'Not authenticated' };
    return apiRequest(`/api/organizations/${orgId}/members/${userId}/remove`, { method: 'POST' });
  },

  async deleteOrganization(orgId: string): Promise<ApiResponse<{ success: boolean }>> {
    // Block deletion of protected seed organization
    if (orgId === DEMO_ORGANIZATION_ID) {
      return { data: null, error: 'This demonstration organization cannot be deleted.' };
    }

    // Handle demo account local organizations
    if (isDemoAccount()) {
      try {
        const stored = await AsyncStorage.getItem(DEMO_ORGS_STORAGE_KEY);
        if (stored) {
          const localOrgs: Organization[] = JSON.parse(stored);
          const filtered = localOrgs.filter(o => o.id !== orgId);
          if (filtered.length < localOrgs.length) {
            await AsyncStorage.setItem(DEMO_ORGS_STORAGE_KEY, JSON.stringify(filtered));
            // Also clean up proposals for this org
            const proposalsStored = await AsyncStorage.getItem(DEMO_PROPOSALS_STORAGE_KEY);
            if (proposalsStored) {
              const proposals = JSON.parse(proposalsStored);
              const filteredProposals = proposals.filter((p: any) => p.organizationId !== orgId);
              await AsyncStorage.setItem(DEMO_PROPOSALS_STORAGE_KEY, JSON.stringify(filteredProposals));
            }
            return { data: { success: true }, error: null };
          }
        }
      } catch (e) {
        console.error('Failed to delete local demo organization:', e);
      }
    }

    // Call backend API for regular accounts or demo backend orgs
    return apiRequest(`/api/organizations/${orgId}`, { method: 'DELETE' });
  },

  // ─── Sub-organizations ───────────────────────────────────────────────────
  // Hierarchical orgs: a school is a parent org; classrooms are sub-orgs.
  // Sub-orgs are just organizations with parent_org_id set, so all the existing
  // org endpoints (members, invite codes, proposals, announcements, voting)
  // work on them unchanged.

  async getSubOrganizations(orgId: string): Promise<ApiResponse<any[]>> {
    if (isDemoAccount() && orgId === DEMO_WESTBROOK_ID) {
      return { data: SEED_WESTBROOK_SUB_ORGS, error: null };
    }
    const result = await apiRequest<any>(`/api/organizations/${orgId}/sub-orgs`);
    if (Array.isArray(result.data)) return { data: result.data, error: null };
    if (result.data?.subOrgs) return { data: result.data.subOrgs, error: null };
    return { data: [], error: result.error };
  },

  async createSubOrganization(parentOrgId: string, name: string, type: string, options?: { membershipType?: string; description?: string }): Promise<ApiResponse<any>> {
    return apiRequest(`/api/organizations/${parentOrgId}/sub-orgs`, {
      method: 'POST',
      body: JSON.stringify({ name, type, ...options }),
    });
  },

  async deleteSubOrganization(parentOrgId: string, subOrgId: string): Promise<ApiResponse<{ success: boolean }>> {
    return apiRequest(`/api/organizations/${parentOrgId}/sub-orgs/${subOrgId}`, { method: 'DELETE' });
  },

  // ─── Insights ────────────────────────────────────────────────────────────

  async getOrganizationInsights(orgId: string, periodDays: number = 30): Promise<ApiResponse<{
    totalMembers: number;
    subOrgCount: number;
    totalProposals: number;
    totalVotes: number;
    participationRate: number;
    subOrgs?: Array<{ id: string; name: string; memberCount: number; proposalCount: number; voteCount: number; participationRate: number }>;
    voteTimeSeries?: Array<{ date: string; count: number }>;
    periodDays: number;
  }>> {
    if (isDemoAccount() && orgId === DEMO_WESTBROOK_ID) {
      return { data: SEED_WESTBROOK_INSIGHTS, error: null };
    }
    return apiRequest(`/api/organizations/${orgId}/insights?period=${periodDays}`);
  },

  async getOrganizationProposals(orgId: string): Promise<ApiResponse<OrganizationProposal[]>> {
    // Helper to merge user votes into proposals
    const mergeUserVotes = async (proposals: OrganizationProposal[]): Promise<OrganizationProposal[]> => {
      try {
        const votesStored = await AsyncStorage.getItem(ORG_VOTES_STORAGE_KEY);
        const votes: Record<string, 'support' | 'oppose'> = votesStored ? JSON.parse(votesStored) : {};
        return proposals.map(p => ({
          ...p,
          userVote: votes[`${orgId}:${p.id}`] || null,
        }));
      } catch (e) {
        return proposals;
      }
    };

    // For demo accounts, also check local storage for proposals
    if (isDemoAccount()) {
      let localProposals: OrganizationProposal[] = [];
      let deletedIds: string[] = [];

      // Load deleted proposal IDs
      try {
        const deletedStored = await AsyncStorage.getItem(DELETED_PROPOSALS_STORAGE_KEY);
        if (deletedStored) {
          deletedIds = JSON.parse(deletedStored);
        }
      } catch (e) {
        console.error('Failed to load deleted proposal IDs:', e);
      }

      // Load locally stored demo proposals for this org
      try {
        const stored = await AsyncStorage.getItem(DEMO_PROPOSALS_STORAGE_KEY);
        if (stored) {
          const allProposals: OrganizationProposal[] = JSON.parse(stored);
          localProposals = allProposals.filter(p => p.organizationId === orgId && !deletedIds.includes(String(p.id)));
        }
      } catch (e) {
        console.error('Failed to load local demo proposals:', e);
      }

      // For seed organizations, return their seed proposals (filtered by deleted IDs)
      if (orgId === DEMO_ORGANIZATION_ID || orgId === DEMO_WESTBROOK_ID) {
        const filteredSeedProposals = SEED_ORGANIZATION_PROPOSALS
          .filter(p => p.organizationId === orgId)
          .filter(p => !deletedIds.includes(String(p.id)));
        const allProposals = [...filteredSeedProposals, ...localProposals];
        return { data: await mergeUserVotes(allProposals), error: null };
      }

      // For other demo orgs, return local proposals + backend
      const result = await apiRequest<any>(`/api/organizations/${orgId}/proposals`);
      let backendProposals: OrganizationProposal[] = [];
      if (Array.isArray(result.data)) backendProposals = result.data;
      else if (result.data?.proposals) backendProposals = result.data.proposals;

      const allProposals = [...localProposals, ...backendProposals];
      return { data: await mergeUserVotes(allProposals), error: null };
    }

    const result = await apiRequest<any>(`/api/organizations/${orgId}/proposals`);
    let proposals: OrganizationProposal[] = [];
    if (Array.isArray(result.data)) proposals = result.data;
    else if (result.data?.proposals) proposals = result.data.proposals;
    return { data: await mergeUserVotes(proposals), error: result.error };
  },

  async getOrganizationAnnouncements(orgId: string): Promise<ApiResponse<any[]>> {
    // For demo organizations, return seed announcements
    if (isDemoAccount() && orgId === DEMO_ORGANIZATION_ID) {
      return { data: SEED_ORGANIZATION_ANNOUNCEMENTS, error: null };
    }
    if (isDemoAccount() && orgId === DEMO_WESTBROOK_ID) {
      return { data: SEED_WESTBROOK_ANNOUNCEMENTS, error: null };
    }
    const result = await apiRequest<any>(`/api/organizations/${orgId}/announcements`);
    if (Array.isArray(result.data)) return { data: result.data, error: null };
    if (result.data?.announcements) return { data: result.data.announcements, error: null };
    return { data: [], error: result.error };
  },

  async createProposal(orgId: string, data: CreateProposalData): Promise<ApiResponse<OrganizationProposal>> {
    // For demo accounts, store proposals locally
    if (isDemoAccount()) {
      // Get organization name for the proposal
      let orgName = '';
      try {
        const orgResult = await this.getOrganization(orgId);
        if (orgResult.data) {
          orgName = orgResult.data.name;
        }
      } catch (e) {
        console.error('Failed to get organization name:', e);
      }

      const newProposal: OrganizationProposal = {
        id: `demo-proposal-${Date.now()}`,
        title: data.title,
        description: data.description,
        category: data.category,
        supportVotes: 0,
        opposeVotes: 0,
        deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
        creatorId: 'demo-user',
        organizationId: orgId,
        organizationName: orgName,
        isOfficial: data.isOfficial ?? false,
      };

      try {
        const stored = await AsyncStorage.getItem(DEMO_PROPOSALS_STORAGE_KEY);
        const existingProposals: OrganizationProposal[] = stored ? JSON.parse(stored) : [];
        existingProposals.push(newProposal);
        await AsyncStorage.setItem(DEMO_PROPOSALS_STORAGE_KEY, JSON.stringify(existingProposals));
        return { data: newProposal, error: null };
      } catch (e) {
        console.error('Failed to save demo proposal:', e);
        return { data: newProposal, error: null }; // Return success anyway since we created it
      }
    }

    return apiRequest<OrganizationProposal>(`/api/organizations/${orgId}/proposals`, {
      method: 'POST',
      body: JSON.stringify({ ...data, isOfficial: data.isOfficial ?? false }),
    });
  },

  async deleteProposal(orgId: string, proposalId: string): Promise<ApiResponse<{ success: boolean }>> {
    // For demo accounts, handle deletion locally
    if (isDemoAccount()) {
      try {
        // Check if it's a seed proposal or user-created proposal
        const isSeedProposal = proposalId.startsWith('demo-org-proposal-');
        const isLocalProposal = proposalId.startsWith('demo-proposal-');

        if (isSeedProposal) {
          // For seed proposals, add to deleted list (they'll be filtered out on fetch)
          const deletedStored = await AsyncStorage.getItem(DELETED_PROPOSALS_STORAGE_KEY);
          const deletedIds: string[] = deletedStored ? JSON.parse(deletedStored) : [];
          if (!deletedIds.includes(proposalId)) {
            deletedIds.push(proposalId);
            await AsyncStorage.setItem(DELETED_PROPOSALS_STORAGE_KEY, JSON.stringify(deletedIds));
          }
          return { data: { success: true }, error: null };
        }

        if (isLocalProposal) {
          // For locally created proposals, remove from storage AND add to deleted list
          const stored = await AsyncStorage.getItem(DEMO_PROPOSALS_STORAGE_KEY);
          if (stored) {
            const proposals: OrganizationProposal[] = JSON.parse(stored);
            const filtered = proposals.filter(p => String(p.id) !== proposalId);
            await AsyncStorage.setItem(DEMO_PROPOSALS_STORAGE_KEY, JSON.stringify(filtered));
          }
          // Also add to deleted list to prevent any caching issues
          const deletedStored = await AsyncStorage.getItem(DELETED_PROPOSALS_STORAGE_KEY);
          const deletedIds: string[] = deletedStored ? JSON.parse(deletedStored) : [];
          if (!deletedIds.includes(proposalId)) {
            deletedIds.push(proposalId);
            await AsyncStorage.setItem(DELETED_PROPOSALS_STORAGE_KEY, JSON.stringify(deletedIds));
          }
          return { data: { success: true }, error: null };
        }

        // For any other proposal, add to deleted list
        const deletedStored = await AsyncStorage.getItem(DELETED_PROPOSALS_STORAGE_KEY);
        const deletedIds: string[] = deletedStored ? JSON.parse(deletedStored) : [];
        if (!deletedIds.includes(proposalId)) {
          deletedIds.push(proposalId);
          await AsyncStorage.setItem(DELETED_PROPOSALS_STORAGE_KEY, JSON.stringify(deletedIds));
        }
        return { data: { success: true }, error: null };
      } catch (e) {
        console.error('Failed to delete demo proposal:', e);
        return { data: null, error: 'Failed to delete proposal' };
      }
    }

    // For regular accounts, call the backend API
    return apiRequest(`/api/organizations/${orgId}/proposals/${proposalId}`, { method: 'DELETE' });
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

  async voteOnProposal(
    orgId: string,
    proposalId: string,
    vote: 'support' | 'oppose'
  ): Promise<ApiResponse<{ success: boolean; supportVotes: number; opposeVotes: number }>> {
    // For demo accounts, handle voting locally
    if (isDemoAccount()) {
      try {
        // Load existing votes
        const votesStored = await AsyncStorage.getItem(ORG_VOTES_STORAGE_KEY);
        const votes: Record<string, 'support' | 'oppose'> = votesStored ? JSON.parse(votesStored) : {};

        // Check if already voted
        const voteKey = `${orgId}:${proposalId}`;
        if (votes[voteKey]) {
          return { data: null, error: 'You have already voted on this proposal' };
        }

        // Record the vote
        votes[voteKey] = vote;
        await AsyncStorage.setItem(ORG_VOTES_STORAGE_KEY, JSON.stringify(votes));

        // Update vote counts in the proposal
        // First check seed proposals
        const seedProposal = SEED_ORGANIZATION_PROPOSALS.find(p => String(p.id) === proposalId);
        if (seedProposal) {
          const newSupport = seedProposal.supportVotes + (vote === 'support' ? 1 : 0);
          const newOppose = seedProposal.opposeVotes + (vote === 'oppose' ? 1 : 0);
          return { data: { success: true, supportVotes: newSupport, opposeVotes: newOppose }, error: null };
        }

        // Check locally stored proposals
        const stored = await AsyncStorage.getItem(DEMO_PROPOSALS_STORAGE_KEY);
        if (stored) {
          const proposals: OrganizationProposal[] = JSON.parse(stored);
          const proposalIndex = proposals.findIndex(p => String(p.id) === proposalId);
          if (proposalIndex >= 0) {
            if (vote === 'support') {
              proposals[proposalIndex].supportVotes += 1;
            } else {
              proposals[proposalIndex].opposeVotes += 1;
            }
            await AsyncStorage.setItem(DEMO_PROPOSALS_STORAGE_KEY, JSON.stringify(proposals));
            return {
              data: {
                success: true,
                supportVotes: proposals[proposalIndex].supportVotes,
                opposeVotes: proposals[proposalIndex].opposeVotes,
              },
              error: null,
            };
          }
        }

        // Fallback - just return success with incremented counts
        return { data: { success: true, supportVotes: 1, opposeVotes: 0 }, error: null };
      } catch (e) {
        console.error('Failed to vote on demo proposal:', e);
        return { data: null, error: 'Failed to record vote' };
      }
    }

    // For regular accounts, call the backend API
    const result = await apiRequest<{ success: boolean; supportVotes: number; opposeVotes: number }>(
      `/api/organizations/${orgId}/proposals/${proposalId}/vote`,
      {
        method: 'POST',
        body: JSON.stringify({ vote }),
      }
    );

    // On success, persist the vote locally so userVote is restored when the
    // modal is reopened or the proposal list is refetched. The proposal-list
    // merge step (mergeUserVotes above) reads from this same key.
    if (!result.error) {
      try {
        const stored = await AsyncStorage.getItem(ORG_VOTES_STORAGE_KEY);
        const votes: Record<string, 'support' | 'oppose'> = stored ? JSON.parse(stored) : {};
        votes[`${orgId}:${proposalId}`] = vote;
        await AsyncStorage.setItem(ORG_VOTES_STORAGE_KEY, JSON.stringify(votes));
      } catch {}
    }

    return result;
  },

  async getUserOrgVotes(): Promise<Record<string, 'support' | 'oppose'>> {
    if (isDemoAccount()) {
      try {
        const stored = await AsyncStorage.getItem(ORG_VOTES_STORAGE_KEY);
        return stored ? JSON.parse(stored) : {};
      } catch (e) {
        return {};
      }
    }
    // For real accounts, votes would come from the backend with proposals
    return {};
  },

  // Member management
  async getMembers(orgId: string): Promise<ApiResponse<any[]>> {
    // For demo organizations, return seed members
    if (isDemoAccount() && orgId === DEMO_ORGANIZATION_ID) {
      return { data: SEED_ORGANIZATION_MEMBERS, error: null };
    }
    if (isDemoAccount() && orgId === DEMO_WESTBROOK_ID) {
      return { data: SEED_WESTBROOK_MEMBERS, error: null };
    }
    const result = await apiRequest<any>(`/api/organizations/${orgId}/members`);
    if (Array.isArray(result.data)) return { data: result.data, error: null };
    if (result.data?.members) return { data: result.data.members, error: null };
    return { data: [], error: result.error };
  },

  async removeMember(orgId: string, userId: string): Promise<ApiResponse<{ success: boolean }>> {
    return apiRequest(`/api/organizations/${orgId}/members/${userId}/remove`, { method: 'POST' });
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

  // Per-email roster invites (CSV import)
  async importRoster(
    orgId: string,
    rows: Array<{ email: string; firstName?: string; lastName?: string; role?: 'admin' | 'member'; metadata?: any }>
  ): Promise<ApiResponse<{
    created: number;
    skippedExistingMembers: string[];
    skippedAlreadyInvited: string[];
    invalid: Array<{ email: string; reason: string }>;
    sentEmails: number;
  }>> {
    return apiRequest(`/api/organizations/${orgId}/invites/import`, {
      method: 'POST',
      body: JSON.stringify({ invites: rows }),
    });
  },

  async getPendingInvites(orgId: string): Promise<ApiResponse<any[]>> {
    const result = await apiRequest<any>(`/api/organizations/${orgId}/invites?status=pending`);
    if (result.data?.invites) return { data: result.data.invites, error: null };
    return { data: [], error: result.error };
  },

  async revokeInvite(orgId: string, inviteId: string): Promise<ApiResponse<{ success: boolean }>> {
    return apiRequest(`/api/organizations/${orgId}/invites/${inviteId}`, { method: 'DELETE' });
  },

  // Create organization
  async createOrganization(data: {
    name: string;
    description: string;
    logoUrl?: string;
    type: 'starter' | 'professional' | 'premium' | 'enterprise';
  }): Promise<ApiResponse<Organization>> {
    const rawResult = await apiRequest<any>('/api/organizations', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    // Backend returns { organization: {...} }; unwrap to a flat Organization
    // so callers can read .id directly. Matches getMembers/getInviteCodes pattern.
    const result: ApiResponse<Organization> = rawResult.data?.organization
      ? { data: rawResult.data.organization, error: null }
      : { data: rawResult.data, error: rawResult.error };

    // For demo account, save with enhanced data to ensure input fields and admin role
    if (isDemoAccount() && result.data) {
      const enhancedOrg: Organization = {
        ...result.data,
        // Ensure input data is preserved (backend might return different/missing values)
        name: data.name,
        description: data.description,
        logoUrl: data.logoUrl,
        // Always set demo creator as admin
        role: 'admin',
      };

      try {
        const stored = await AsyncStorage.getItem(DEMO_ORGS_STORAGE_KEY);
        const existingOrgs: Organization[] = stored ? JSON.parse(stored) : [];

        // Prevent duplicates - if org with same name exists, return it
        const duplicate = existingOrgs.find(o => o.name.toLowerCase() === data.name.toLowerCase());
        if (duplicate) {
          return { data: { ...duplicate, role: 'admin' }, error: null };
        }

        existingOrgs.push(enhancedOrg);
        await AsyncStorage.setItem(DEMO_ORGS_STORAGE_KEY, JSON.stringify(existingOrgs));
        return { data: enhancedOrg, error: null };
      } catch (e) {
        console.error('Failed to save demo organization locally:', e);
        return { data: enhancedOrg, error: null };
      }
    }

    // If backend failed but this is demo account, create a local org
    if (isDemoAccount() && result.error) {
      const localOrg: Organization = {
        id: `local-${Date.now()}`,
        name: data.name,
        description: data.description,
        logoUrl: data.logoUrl,
        memberCount: 1,
        tier: data.type,
        verified: false,
        createdAt: new Date().toISOString(),
        role: 'admin',
      };

      try {
        const stored = await AsyncStorage.getItem(DEMO_ORGS_STORAGE_KEY);
        const existingOrgs: Organization[] = stored ? JSON.parse(stored) : [];

        // Prevent duplicates - if org with same name exists, return it
        const duplicate = existingOrgs.find(o => o.name.toLowerCase() === data.name.toLowerCase());
        if (duplicate) {
          return { data: { ...duplicate, role: 'admin' }, error: null };
        }

        existingOrgs.push(localOrg);
        await AsyncStorage.setItem(DEMO_ORGS_STORAGE_KEY, JSON.stringify(existingOrgs));
        return { data: localOrg, error: null };
      } catch (e) {
        console.error('Failed to save demo organization locally:', e);
        return { data: localOrg, error: null };
      }
    }

    // For regular accounts, ensure creator is always set as admin
    if (result.data && !result.data.role) {
      result.data.role = 'admin';
    }

    return result;
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
