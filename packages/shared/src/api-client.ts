/**
 * Shared API client for React Native apps to hit the Next.js backend.
 * Handles auth tokens, error formatting, and base URL configuration.
 */

import type {
  AuthResponse,
  AuthUser,
  Booking,
  Cleaner,
  CleanerDashboardStats,
  CleanerEarnings,
  Conversation,
  LoginRequest,
  Message,
  Notification,
  PaginatedResponse,
  QuoteRequest,
  QuoteResult,
  Review,
  SavedAddress,
  ServiceTypeInfo,
  SignUpRequest,
  AvailabilitySlot,
  AvailabilityOverride,
} from './types';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

interface RequestOptions {
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  setToken(token: string | null) {
    this.token = token;
  }

  getToken(): string | null {
    return this.token;
  }

  private async request<T>(
    method: HttpMethod,
    path: string,
    body?: unknown,
    options?: RequestOptions
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options?.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: options?.signal,
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new ApiError(
        errorBody.error || `Request failed with status ${response.status}`,
        response.status,
        errorBody.details
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  // ─── Auth ───────────────────────────────────────────────────

  async login(data: LoginRequest): Promise<AuthResponse> {
    return this.request('POST', '/api/auth/login', data);
  }

  async signUp(data: SignUpRequest): Promise<AuthResponse> {
    return this.request('POST', '/api/auth/signup', data);
  }

  async getProfile(): Promise<AuthUser> {
    return this.request('GET', '/api/auth/profile');
  }

  // ─── Cleaners ─────────────────────────────────────────────────

  async getCleaners(params?: {
    postcode?: string;
    specialty?: string;
    available_now?: boolean;
    page?: number;
    pageSize?: number;
  }): Promise<PaginatedResponse<Cleaner>> {
    const searchParams = new URLSearchParams();
    if (params?.postcode) searchParams.set('postcode', params.postcode);
    if (params?.specialty) searchParams.set('specialty', params.specialty);
    if (params?.available_now) searchParams.set('available_now', 'true');
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));
    const query = searchParams.toString();
    return this.request('GET', `/api/cleaners${query ? `?${query}` : ''}`);
  }

  async getCleaner(id: string): Promise<Cleaner> {
    return this.request('GET', `/api/cleaners/${id}`);
  }

  // ─── Bookings ─────────────────────────────────────────────────

  async createBooking(data: Partial<Booking>): Promise<Booking> {
    return this.request('POST', '/api/bookings', data);
  }

  async getBookings(params?: {
    status?: string;
    page?: number;
  }): Promise<PaginatedResponse<Booking>> {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.page) searchParams.set('page', String(params.page));
    const query = searchParams.toString();
    return this.request('GET', `/api/bookings${query ? `?${query}` : ''}`);
  }

  async getBooking(id: string): Promise<Booking> {
    return this.request('GET', `/api/bookings/${id}`);
  }

  // ─── Pricing ──────────────────────────────────────────────────

  async getQuote(data: QuoteRequest): Promise<QuoteResult> {
    return this.request('POST', '/api/pricing/quote', data);
  }

  async getServices(): Promise<ServiceTypeInfo[]> {
    return this.request('GET', '/api/pricing/services');
  }

  // ─── Messages ─────────────────────────────────────────────────

  async getConversations(): Promise<Conversation[]> {
    return this.request('GET', '/api/messages');
  }

  async getMessages(conversationId: string): Promise<Message[]> {
    return this.request('GET', `/api/messages?conversationId=${conversationId}`);
  }

  async sendMessage(data: {
    receiverId: string;
    content: string;
    bookingId?: string;
  }): Promise<Message> {
    return this.request('POST', '/api/messages', data);
  }

  // ─── Notifications ────────────────────────────────────────────

  async getNotifications(): Promise<Notification[]> {
    return this.request('GET', '/api/notifications');
  }

  async markNotificationRead(id: string): Promise<void> {
    return this.request('PUT', `/api/notifications/${id}/read`);
  }

  // ─── Reviews ──────────────────────────────────────────────────

  async getCleanerReviews(cleanerId: string): Promise<Review[]> {
    return this.request('GET', `/api/cleaners/${cleanerId}/reviews`);
  }

  async createReview(data: {
    bookingId: string;
    rating: number;
    thoroughness?: number;
    punctuality?: number;
    communication?: number;
    text?: string;
  }): Promise<Review> {
    return this.request('POST', '/api/reviews', data);
  }

  // ─── Addresses ────────────────────────────────────────────────

  async getAddresses(): Promise<SavedAddress[]> {
    return this.request('GET', '/api/addresses');
  }

  async createAddress(data: Omit<SavedAddress, 'id'>): Promise<SavedAddress> {
    return this.request('POST', '/api/addresses', data);
  }

  // ─── Cleaner Portal ───────────────────────────────────────────

  async getCleanerDashboard(): Promise<CleanerDashboardStats> {
    return this.request('GET', '/api/cleaner/dashboard');
  }

  async getCleanerJobs(params?: {
    status?: string;
    page?: number;
  }): Promise<PaginatedResponse<Booking>> {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.page) searchParams.set('page', String(params.page));
    const query = searchParams.toString();
    return this.request('GET', `/api/cleaner/jobs${query ? `?${query}` : ''}`);
  }

  async getCleanerJob(id: string): Promise<Booking> {
    return this.request('GET', `/api/cleaner/jobs/${id}`);
  }

  async updateJobStatus(id: string, action: string, notes?: string): Promise<Booking> {
    return this.request('PUT', `/api/cleaner/jobs/${id}`, { action, notes });
  }

  async getCleanerEarnings(): Promise<CleanerEarnings> {
    return this.request('GET', '/api/cleaner/earnings');
  }

  async getCleanerReviewsOwn(): Promise<Review[]> {
    return this.request('GET', '/api/cleaner/reviews');
  }

  async getCleanerProfile(): Promise<Cleaner> {
    return this.request('GET', '/api/cleaner/profile');
  }

  async updateCleanerProfile(data: Partial<Cleaner>): Promise<Cleaner> {
    return this.request('PUT', '/api/cleaner/profile', data);
  }

  async getAvailability(): Promise<{
    slots: AvailabilitySlot[];
    overrides: AvailabilityOverride[];
  }> {
    return this.request('GET', '/api/cleaner/availability');
  }

  async updateAvailability(data: {
    slots: Omit<AvailabilitySlot, 'id'>[];
    overrides: Omit<AvailabilityOverride, 'id'>[];
  }): Promise<void> {
    return this.request('PUT', '/api/cleaner/availability', data);
  }

  // ─── Queue Bookings ───────────────────────────────────────────

  async acceptQueueBooking(bookingId: string, cleanerId: string): Promise<Booking> {
    return this.request('POST', `/api/bookings/queue/accept/${cleanerId}`, { bookingId });
  }

  async rejectQueueBooking(bookingId: string, cleanerId: string): Promise<void> {
    return this.request('POST', `/api/bookings/queue/reject/${cleanerId}`, { bookingId });
  }

  // ─── Complaints ───────────────────────────────────────────────

  async fileComplaint(data: {
    bookingId: string;
    category: string;
    severity?: string;
    subject: string;
    description: string;
  }): Promise<{ id: string }> {
    return this.request('POST', '/api/complaints', data);
  }

  async getComplaints(): Promise<PaginatedResponse<unknown>> {
    return this.request('GET', '/api/complaints');
  }

  // ─── GDPR ─────────────────────────────────────────────────────

  async requestDataExport(): Promise<{ downloadUrl: string }> {
    return this.request('GET', '/api/gdpr/export');
  }

  async requestDataDeletion(): Promise<{ id: string }> {
    return this.request('POST', '/api/gdpr/deletion');
  }

  // ─── Contact ──────────────────────────────────────────────────

  async submitContactForm(data: {
    name: string;
    email: string;
    subject: string;
    message: string;
  }): Promise<void> {
    return this.request('POST', '/api/contact', data);
  }

  // ─── DBS Verification ──────────────────────────────────────────

  async getDBSVerificationStatus(): Promise<{
    dbsCertVerified: boolean;
    dbsCertNumber: string | null;
    dbsOption: string | null;
    livenessComplete: boolean;
    backgroundCheckPassed: boolean;
    verificationStatus: string;
  }> {
    return this.request('GET', '/api/verification/dbs');
  }

  async submitDBSVerification(data: {
    action: 'verify_existing' | 'apply_new' | 'liveness_check';
    certNumber?: string;
    issueDate?: string;
    certFile?: string;
    selfieImage?: string;
    idImage?: string;
  }): Promise<{
    success: boolean;
    message: string;
    referenceNumber?: string;
    matchConfidence?: number;
  }> {
    return this.request('POST', '/api/verification/dbs', data);
  }

  // ─── Health ───────────────────────────────────────────────────

  async healthCheck(): Promise<{ status: string }> {
    return this.request('GET', '/api/health');
  }
}

// ─── Error Class ────────────────────────────────────────────────

export class ApiError extends Error {
  statusCode: number;
  details?: string;

  constructor(message: string, statusCode: number, details?: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
  }
}
