// Frontend API client for communicating with NestJS backend

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

export interface User {
  id: string;
  name: string;
  email: string;
  role: "CUSTOMER" | "AGENT" | "ADMIN";
  createdAt: string;
}

export interface AuthResponse {
  message: string;
  accessToken: string;
  user: User;
}

export interface Message {
  id: string;
  conversationId: string;
  sender: "CUSTOMER" | "AI" | "AGENT" | "SYSTEM";
  content: string;
  metadata?: any;
  createdAt: string;
  sources?: MessageSource[];
  feedback?: any;
}

export interface Conversation {
  id: string;
  customerId: string;
  status: "ACTIVE" | "WAITING_AGENT" | "RESOLVED";
  createdAt: string;
  updatedAt: string;
  customer?: { id: string; name: string; email: string };
  messages?: Message[];
  tickets?: Ticket[];
  _count?: { messages: number; tickets: number };
}

export interface Ticket {
  id: string;
  conversationId?: string;
  customerId: string;
  assignedAgentId?: string;
  subject: string;
  description: string;
  category: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  status: "OPEN" | "IN_PROGRESS" | "WAITING_FOR_CUSTOMER" | "RESOLVED";
  conversationSummary?: string;
  resolutionNotes?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  customer?: { id: string; name: string; email: string };
  assignedAgent?: { id: string; name: string; email: string };
  conversation?: { id: string; status: string; messages?: Message[] };
}

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: "include", // Include HTTP-only cookie
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMessage =
      (data && data.error) ||
      (data && data.message) ||
      `Request failed with status ${response.status}`;
    throw new Error(typeof errorMessage === "string" ? errorMessage : JSON.stringify(errorMessage));
  }

  return data as T;
}

export const authApi = {
  register: (payload: { name: string; email: string; password: string; role?: string }) =>
    apiFetch<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  login: (payload: { email: string; password: string }) =>
    apiFetch<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  logout: () =>
    apiFetch<{ message: string }>("/auth/logout", {
      method: "POST",
    }),

  getProfile: () => apiFetch<User>("/auth/me"),

  testAdminOnly: () => apiFetch<{ message: string; user: User }>("/auth/admin-only-test"),

  testAgentOnly: () => apiFetch<{ message: string; user: User }>("/auth/agent-only-test"),
};

export const conversationsApi = {
  create: (initialMessage?: string) =>
    apiFetch<Conversation>("/conversations", {
      method: "POST",
      body: JSON.stringify({ initialMessage }),
    }),

  getAll: () => apiFetch<Conversation[]>("/conversations"),

  getById: (id: string) => apiFetch<Conversation>(`/conversations/${id}`),

  getMessages: (id: string) => apiFetch<Message[]>(`/conversations/${id}/messages`),

  sendMessage: (id: string, content: string) =>
    apiFetch<Message[]>(`/conversations/${id}/messages`, {
      method: "POST",
      body: JSON.stringify({ content }),
    }),
};

export const ticketsApi = {
  create: (payload: {
    conversationId?: string;
    subject: string;
    description: string;
    category?: string;
    priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  }) =>
    apiFetch<Ticket>("/tickets", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getAll: (status?: string, priority?: string) => {
    const params = new URLSearchParams();
    if (status) params.append("status", status);
    if (priority) params.append("priority", priority);
    const query = params.toString() ? `?${params.toString()}` : "";
    return apiFetch<Ticket[]>(`/tickets${query}`);
  },

  getById: (id: string) => apiFetch<Ticket>(`/tickets/${id}`),

  update: (
    id: string,
    payload: {
      status?: "OPEN" | "IN_PROGRESS" | "WAITING_FOR_CUSTOMER" | "RESOLVED";
      priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
      assignedAgentId?: string;
      resolutionNotes?: string;
      conversationSummary?: string;
    },
  ) =>
    apiFetch<Ticket>(`/tickets/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  claim: (id: string) =>
    apiFetch<Ticket>(`/tickets/${id}/claim`, {
      method: "PATCH",
    }),

  reply: (id: string, content: string) =>
    apiFetch<Ticket>(`/tickets/${id}/reply`, {
      method: "POST",
      body: JSON.stringify({ content }),
    }),

  resolve: (id: string, resolutionNotes: string) =>
    apiFetch<Ticket>(`/tickets/${id}/resolve`, {
      method: "POST",
      body: JSON.stringify({ resolutionNotes }),
    }),

  submitFeedback: (id: string, rating: number, comment?: string) =>
    apiFetch<any>(`/tickets/${id}/feedback`, {
      method: "POST",
      body: JSON.stringify({ rating, comment }),
    }),
};

export const aiApi = {
  getProviderInfo: () =>
    apiFetch<{
      activeProvider: string;
      supportedIntents: string[];
      timestamp: string;
    }>("/ai/provider-info"),

  classify: (message: string, conversationId?: string) =>
    apiFetch<{
      query: string;
      classification: {
        intent: string;
        urgency: string;
        requiresEscalation: boolean;
        confidenceScore: number;
        reasoning: string;
        suggestedAction?: string;
      };
      provider: string;
      evaluatedAt: string;
    }>("/ai/classify", {
      method: "POST",
      body: JSON.stringify({ message, conversationId }),
    }),
};

export interface MessageSource {
  id: string;
  messageId: string;
  documentChunkId: string;
  relevanceScore?: number;
  documentChunk?: {
    content: string;
    pageNumber?: number;
    document?: {
      title: string;
      originalFilename: string;
    };
  };
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  pageNumber?: number;
  tokenCount?: number;
  createdAt: string;
}

export interface KnowledgeDocument {
  id: string;
  title: string;
  originalFilename: string;
  filePath: string; // Bug #6 fix: backend returns filePath, not fileType/fileSizeBytes
  processingStatus: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED"; // Bug #6 fix: correct field name & enum values
  processingError?: string;
  createdBy: string; // Bug #6 fix: backend uses createdBy, not uploadedById
  createdAt: string;
  updatedAt: string;
  creator?: { id: string; name: string; email: string };
  chunks?: DocumentChunk[];
  _count?: { chunks: number };
}

export interface SearchResultChunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  pageNumber?: number;
  content: string;
  similarityScore: number; // Bug #7 fix: backend returns similarityScore, not similarity
  documentTitle: string;
  originalFilename: string; // Bug #7 fix: backend also returns this field
}

export const knowledgeApi = {
  upload: async (file: File, title: string): Promise<KnowledgeDocument> => {
    const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", title);

    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}/knowledge/documents`, {
      method: "POST",
      headers,
      body: formData,
      credentials: "include",
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const errorMessage =
        (data && data.error) ||
        (data && data.message) ||
        `Upload failed with status ${response.status}`;
      throw new Error(typeof errorMessage === "string" ? errorMessage : JSON.stringify(errorMessage));
    }
    return data as KnowledgeDocument;
  },

  getAll: () => apiFetch<KnowledgeDocument[]>("/knowledge/documents"),

  getById: (id: string) => apiFetch<KnowledgeDocument>(`/knowledge/documents/${id}`),

  delete: (id: string) =>
    apiFetch<{ message: string }>(`/knowledge/documents/${id}`, { // Bug #8 fix: backend returns { message } only, no deletedId
      method: "DELETE",
    }),

  search: (query: string, limit: number = 3, threshold: number = 0.5) =>
    apiFetch<SearchResultChunk[]>("/knowledge/search", {
      method: "POST",
      body: JSON.stringify({ query, limit, threshold }),
    }),
};

export interface AnalyticsOverview {
  summary: {
    totalConversations: number;
    totalMessages: number;
    totalTickets: number;
    openTickets: number;
    inProgressTickets: number;
    resolvedTickets: number;
    containmentRatePercentage: number;
    escalationRatePercentage: number;
    avgResolutionTimeMinutes: number;
  };
  csat: {
    averageRating: number;
    totalRatings: number;
    distribution: {
      star1: number;
      star2: number;
      star3: number;
      star4: number;
      star5: number;
    };
  };
  intentBreakdown: {
    intent: string;
    label: string;
    count: number;
    percentage: number;
  }[];
  recentEscalations: {
    id: string;
    subject: string;
    priority: string;
    status: string;
    customerName: string;
    customerEmail: string;
    createdAt: string;
    resolvedAt: string | null;
    durationMinutes: number | null;
    conversationSummary: string | null;
  }[];
}

export const analyticsApi = {
  getOverview: () => apiFetch<AnalyticsOverview>("/analytics/overview"),
};

export interface EvaluationTestCase {
  id: string;
  query: string;
  expectedIntent: string;
  expectedUrgency: string;
  expectedRequiresEscalation: boolean;
  category: string;
  notes: string;
}

export interface TestCaseResult {
  id: string;
  query: string;
  category: string;
  expectedIntent: string;
  predictedIntent: string;
  expectedRequiresEscalation: boolean;
  predictedRequiresEscalation: boolean;
  confidenceScore: number;
  latencyMs: number;
  passed: boolean;
  failureReason?: string;
}

export interface EvaluationReport {
  summary: {
    totalTestCases: number;
    passedCases: number;
    failedCases: number;
    overallAccuracyPercentage: number;
    escalationRecallPercentage: number;
    averageLatencyMs: number;
    evaluatedProvider: string;
    evaluatedAt: string;
  };
  categoryBreakdown: {
    category: string;
    total: number;
    passed: number;
    accuracyPercentage: number;
  }[];
  detailedResults: TestCaseResult[];
}

export const evalApi = {
  getDataset: () => apiFetch<EvaluationTestCase[]>("/ai/eval/dataset"),
  runEvaluation: () =>
    apiFetch<EvaluationReport>("/ai/eval/run", {
      method: "POST",
    }),
};



