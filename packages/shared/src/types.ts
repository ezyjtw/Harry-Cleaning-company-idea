/**
 * Shared TypeScript interfaces used by web, customer-app, and cleaner-app.
 * Mirrors the web app's src/lib/types.ts for mobile consumption.
 */

import type {
  BookingStatus,
  CleanerTier,
  ComplaintCategory,
  ComplaintSeverity,
  DisputeStatus,
  EvidenceType,
  NotificationType,
  PaymentStatus,
  PropertySize,
  VerificationStatus,
} from './enums';

// ─── Cleaner ────────────────────────────────────────────────────

export interface Cleaner {
  id: string;
  name: string;
  photo: string;
  rating: number;
  reviewCount: number;
  hourlyRate: number;
  sameDayRate: number;
  bio: string;
  specialties: string[];
  languages: string[];
  tier: CleanerTier | string;
  location: string;
  postcodeAreas: string[];
  verified: boolean;
  identityVerified: boolean;
  backgroundChecked: boolean;
  yearsExperience: number;
  completedJobs: number;
  availability: string[];
  timeSlots: Record<string, string[]>;
  availableNow: boolean;
  responseTime: string;
  categoryRatings: CategoryRatings;
  bringsProducts: boolean;
  productFee: number;
  eotPrices?: Record<number, number>;
  airbnbPrices?: Record<number, number>;
}

export interface CategoryRatings {
  thoroughness: number;
  punctuality: number;
  communication: number;
  value: number;
}

// ─── Booking ────────────────────────────────────────────────────

export interface Booking {
  id: string;
  cleanerId: string;
  cleanerName?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  address: string;
  date: string;
  time: string;
  duration: number;
  serviceType: string;
  notes: string;
  status: BookingStatus | string;
  totalPrice: number;
  isLastMinute: boolean;
  escrowStatus: EscrowStatus;
  isFirstBookingWithCleaner: boolean;
  platformFee?: number;
  cleanerEarnings?: number;
  propertySize?: PropertySize;
  frequency?: string;
}

export type EscrowStatus = 'held' | 'released' | 'refunded' | 'disputed' | 'none';

// ─── Review ─────────────────────────────────────────────────────

export interface Review {
  id: string;
  cleanerId: string;
  customerName: string;
  rating: number;
  categoryRatings: CategoryRatings;
  comment: string;
  cleanerReply?: string;
  date: string;
  verified: boolean;
}

// ─── Message / Conversation ─────────────────────────────────────

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  bookingId?: string;
  content: string;
  read: boolean;
  createdAt: string;
}

export interface Conversation {
  id: string;
  participantId: string;
  participantName: string;
  participantPhoto?: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

// ─── Notification ───────────────────────────────────────────────

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType | string;
  title: string;
  body: string;
  read: boolean;
  data?: Record<string, string>;
  createdAt: string;
}

// ─── Payment ────────────────────────────────────────────────────

export interface Payment {
  id: string;
  bookingId: string;
  amount: number;
  currency: string;
  status: PaymentStatus | string;
  ryftPaymentId?: string;
  refundAmount?: number;
  createdAt: string;
}

// ─── Dispute ────────────────────────────────────────────────────

export type DisputeReason =
  | 'no-show-cleaner'
  | 'no-show-customer'
  | 'poor-quality'
  | 'property-damage'
  | 'incorrect-duration'
  | 'safety-concern'
  | 'payment-issue'
  | 'other';

export interface Dispute {
  id: string;
  bookingId: string;
  filedBy: 'customer' | 'cleaner';
  filedByName: string;
  reason: DisputeReason;
  description: string;
  evidence: DisputeEvidence[];
  status: DisputeStatus | string;
  resolution?: string;
  createdAt: string;
  resolvedAt?: string;
  escrowAction?: 'release' | 'refund' | 'split';
}

export interface DisputeEvidence {
  id: string;
  type: EvidenceType | string;
  description: string;
  uploadedAt: string;
  uploadedBy: 'customer' | 'cleaner';
}

// ─── Complaint ──────────────────────────────────────────────────

export interface ComplaintInput {
  bookingId: string;
  category: ComplaintCategory;
  severity?: ComplaintSeverity;
  subject: string;
  description: string;
}

export interface ComplaintRecord {
  id: string;
  bookingId: string;
  filedById: string;
  category: ComplaintCategory | string;
  severity: ComplaintSeverity | string;
  subject: string;
  description: string;
  status: 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'DISMISSED';
  resolution?: string;
  refundAmount?: number;
  isRedoClean: boolean;
  evidence: EvidenceRecord[];
  createdAt: string;
  resolvedAt?: string;
}

export interface EvidenceRecord {
  id: string;
  type: EvidenceType | string;
  url: string;
  fileName?: string;
  description?: string;
  uploadedAt: string;
}

// ─── Pricing ────────────────────────────────────────────────────

export interface QuoteRequest {
  serviceSlug: 'regular' | 'one-off' | 'same-day' | 'deep' | 'eot' | 'airbnb';
  cleanerHourlyRate: number;
  hours?: number;
  propertySize?: PropertySize;
  frequency?: 'WEEKLY' | 'FORTNIGHTLY' | 'ONE_OFF';
  addons?: string[];
}

export interface QuoteResult {
  cleanerGross: number;
  cleanerFee: number;
  cleanerEarns: number;
  customerSubtotal: number;
  customerServiceFee: number;
  totalCharged: number;
  addonTotal: number;
  renaEarns: number;
  hours: number;
  serviceMultiplier: number;
}

export interface ServiceTypeInfo {
  id: string;
  slug: string;
  name: string;
  pricingModel: 'HOURLY' | 'FIXED';
  baseMultiplier: number;
  minimumHours?: number;
  minimumCharge?: number;
  isActive: boolean;
}

// ─── Availability ───────────────────────────────────────────────

export interface AvailabilitySlot {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface AvailabilityOverride {
  id: string;
  date: string;
  isBlocked: boolean;
  startTime?: string;
  endTime?: string;
  reason?: string;
}

// ─── Cleaner Dashboard ──────────────────────────────────────────

export interface CleanerDashboardStats {
  todayJobs: number;
  weekJobs: number;
  monthEarnings: number;
  totalEarnings: number;
  rating: number;
  completedJobs: number;
  pendingJobs: number;
  cancellationRate: number;
}

export interface CleanerEarnings {
  totalEarnings: number;
  thisWeek: number;
  thisMonth: number;
  pendingPayments: number;
  recentPayments: EarningsEntry[];
}

export interface EarningsEntry {
  id: string;
  bookingId: string;
  date: string;
  amount: number;
  platformFee: number;
  netEarnings: number;
  status: string;
  serviceType: string;
  customerName: string;
}

// ─── Company ────────────────────────────────────────────────────

export interface Company {
  id: string;
  ownerId: string;
  name: string;
  description?: string;
  logo?: string;
  website?: string;
  phone?: string;
  email?: string;
  registrationNumber?: string;
  verificationStatus: VerificationStatus | string;
  staffCount: number;
  operatingAreas: string[];
  specialties: string[];
  insuranceVerified: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface TeamMember {
  id: string;
  companyId: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  role: 'OWNER' | 'MANAGER' | 'CLEANER';
  isActive: boolean;
  canAcceptJobs: boolean;
  joinedAt: string;
}

// ─── Auth ───────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  role: 'CLIENT' | 'CLEANER' | 'ADMIN';
  image?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignUpRequest {
  email: string;
  password: string;
  name: string;
  phone?: string;
  role: 'CLIENT' | 'CLEANER';
}

export interface AuthResponse {
  user: AuthUser;
  token: string;
}

// ─── Address ────────────────────────────────────────────────────

export interface SavedAddress {
  id: string;
  label: string;
  line1: string;
  line2?: string;
  city: string;
  postcode: string;
  isDefault: boolean;
}

// ─── Booking Form ───────────────────────────────────────────────

export type ServiceCategory = 'regular' | 'same-day' | 'deep' | 'airbnb' | 'end-of-tenancy';

export type KeyAccess = 'i-will-be-home' | 'key-under-mat' | 'lockbox' | 'with-concierge' | 'other';

export interface BookingFormData {
  serviceCategory: ServiceCategory;
  propertySize?: PropertySize;
  hours?: number;
  frequency?: string;
  focusAreas: string[];
  cleanerBringsProducts: boolean;
  email: string;
  keyAccess: KeyAccess;
  keyAccessNote: string;
  preferredDates: string[];
  preferredTimeSlots: string[];
  selectedCleanerId: string;
  specialInstructions: string;
  addons: string[];
}

// ─── API Responses ──────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiError {
  error: string;
  details?: string;
  statusCode: number;
}
