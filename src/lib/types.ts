export type CleanerTier = 'standard' | 'premium' | 'elite';

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
  tier: CleanerTier;
  location: string;
  verified: boolean;
  identityVerified: boolean;
  backgroundChecked: boolean;
  yearsExperience: number;
  completedJobs: number;
  availability: string[];
  /** Specific time slots the cleaner is available per day. Key is day abbreviation (e.g. 'Mon'). */
  timeSlots: Record<string, string[]>;
  availableNow: boolean;
  responseTime: string;
  categoryRatings: CategoryRatings;
  bringsProducts: boolean;
  productFee: number; // additional cost if cleaner brings products
}

export interface CategoryRatings {
  thoroughness: number;
  punctuality: number;
  communication: number;
  value: number;
}

export interface Booking {
  id: string;
  cleanerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  address: string;
  date: string;
  time: string;
  duration: number;
  serviceType: 'standard' | 'deep' | 'move-in-out' | 'office' | 'last-minute';
  notes: string;
  status: 'pending' | 'confirmed' | 'in-progress' | 'completed' | 'cancelled' | 'disputed';
  totalPrice: number;
  isLastMinute: boolean;
  escrowStatus: EscrowStatus;
  isFirstBookingWithCleaner: boolean;
}

export type EscrowStatus = 'held' | 'released' | 'refunded' | 'disputed' | 'none';

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

export interface CustomerReview {
  id: string;
  customerId: string;
  cleanerId: string;
  cleanerName: string;
  rating: number;
  comment: string;
  date: string;
}

export interface SavedAddress {
  id: string;
  label: string;
  address: string;
  isDefault: boolean;
}

export interface PastBooking {
  id: string;
  cleanerId: string;
  cleanerName: string;
  serviceType: string;
  date: string;
  address: string;
  duration: number;
  totalPrice: number;
}

// ─── Identity Verification ───────────────────────────────────

export interface IdentityVerification {
  id: string;
  userId: string;
  userType: 'cleaner' | 'customer';
  status: 'pending' | 'verified' | 'rejected' | 'expired';
  submittedAt: string;
  verifiedAt?: string;
  documentType: 'passport' | 'drivers-license' | 'national-id';
  selfieMatch: boolean;
  livePhotoRequired: boolean; // for arrival verification
}

export type VerificationLevel = 'unverified' | 'basic' | 'full';

// ─── Escrow ──────────────────────────────────────────────────

export interface EscrowTransaction {
  id: string;
  bookingId: string;
  amount: number;
  cleanerAmount: number;
  platformFee: number;
  status: EscrowStatus;
  heldAt: string;
  releasedAt?: string;
  releaseCondition: 'auto-24h' | 'customer-confirmed' | 'dispute-resolved';
  isFirstBooking: boolean;
}

// ─── Disputes ────────────────────────────────────────────────

export type DisputeReason =
  | 'no-show-cleaner'
  | 'no-show-customer'
  | 'poor-quality'
  | 'property-damage'
  | 'incorrect-duration'
  | 'safety-concern'
  | 'payment-issue'
  | 'other';

export type DisputeStatus =
  | 'open'
  | 'under-review'
  | 'resolved-customer'
  | 'resolved-cleaner'
  | 'resolved-split'
  | 'escalated';

export interface Dispute {
  id: string;
  bookingId: string;
  filedBy: 'customer' | 'cleaner';
  filedByName: string;
  reason: DisputeReason;
  description: string;
  evidence: DisputeEvidence[];
  status: DisputeStatus;
  resolution?: string;
  createdAt: string;
  resolvedAt?: string;
  escrowAction?: 'release' | 'refund' | 'split';
}

export interface DisputeEvidence {
  id: string;
  type: 'photo' | 'video' | 'text' | 'timestamp';
  description: string;
  uploadedAt: string;
  uploadedBy: 'customer' | 'cleaner';
}

// ─── Booking Flow ───────────────────────────────────────────

export type ServiceCategory = 'regular' | 'same-day' | 'deep' | 'airbnb' | 'end-of-tenancy';

export type BookingFrequency = 'one-off' | 'weekly' | 'biweekly';

export type KeyAccess = 'i-will-be-home' | 'key-under-mat' | 'lockbox' | 'with-concierge' | 'other';

export interface RoomConfig {
  bedrooms: number;
  bathrooms: number;
  livingAreas: number;
  kitchen: boolean;
  additionals: string[]; // e.g. "Conservatory", "Garage", "Utility Room"
}

// ─── Notifications ──────────────────────────────────────────

export type NotificationType =
  | 'booking_confirmed'
  | 'booking_cancelled'
  | 'booking_reminder'
  | 'cleaner_assigned'
  | 'payment_received'
  | 'review_received'
  | 'message_received'
  | 'dispute_update';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  data?: Record<string, string>;
  createdAt: string;
}

// ─── Messages ────────────────────────────────────────────────

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

// ─── Payments ────────────────────────────────────────────────

export interface Payment {
  id: string;
  bookingId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  stripePaymentId?: string;
  refundAmount?: number;
  createdAt: string;
}

// ─── Admin ───────────────────────────────────────────────────

export interface DashboardStats {
  totalBookings: number;
  activeCleaners: number;
  totalRevenue: number;
  pendingDisputes: number;
  bookingsThisWeek: number;
  newSignups: number;
}

export type UserRole = 'CLIENT' | 'CLEANER' | 'ADMIN';

// ─── Booking Flow ───────────────────────────────────────────

export interface BookingFormData {
  serviceCategory: ServiceCategory;
  rooms: RoomConfig;
  suggestedHours: number;
  selectedHours: number;
  focusAreas: string[];
  cleanerBringsProducts: boolean;
  frequency: BookingFrequency;
  email: string;
  joinMailingList: boolean;
  keyAccess: KeyAccess;
  keyAccessNote: string;
  scheduling: 'specific' | 'flexible';
  preferredDates: string[];
  preferredTimeSlots: string[];
  selectedCleanerId: string;
  acceptSubstitute: boolean;
  specialInstructions: string;
}

// ─── Account & Verification ────────────────────────────────
export type AccountStatus = 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
export type VerificationStatus = 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
export type ReviewVisibility = 'VISIBLE' | 'HIDDEN' | 'FLAGGED';

// ─── Extended Booking Status ───────────────────────────────
export type BookingStatusExtended =
  | 'PENDING'
  | 'CONFIRMED'
  | 'ACCEPTED'
  | 'EN_ROUTE'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'REVIEWED'
  | 'CANCELLED';

// ─── Availability Override ─────────────────────────────────
export interface AvailabilityOverride {
  id: string;
  cleanerProfileId: string;
  date: string;
  isBlocked: boolean;
  startTime?: string;
  endTime?: string;
  reason?: string;
}

// ─── Audit Log ─────────────────────────────────────────────
export interface AuditLogEntry {
  id: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

// ─── Pricing Zone ──────────────────────────────────────────
export interface PricingZone {
  id: string;
  name: string;
  postcodePrefix: string;
  multiplier: number;
  travelFee: number;
  isActive: boolean;
}

// ─── Background Job ────────────────────────────────────────
export type JobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
export type JobType =
  | 'SEND_EMAIL'
  | 'SEND_SMS'
  | 'PROCESS_PAYMENT'
  | 'SEND_REMINDER'
  | 'REQUEST_REVIEW';

export interface BackgroundJobRecord {
  id: string;
  type: JobType;
  payload: Record<string, unknown>;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  lastError?: string;
  scheduledAt: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

// ─── Cleaner Matching ──────────────────────────────────────
export interface CleanerMatchScore {
  cleanerId: string;
  totalScore: number;
  ratingScore: number;
  distanceScore: number;
  reliabilityScore: number;
  completionRateScore: number;
  responseSpeedScore: number;
  isRepeatCleaner: boolean;
}

// ─── Surge Pricing ─────────────────────────────────────────
export interface SurgePricingInfo {
  isActive: boolean;
  multiplier: number;
  reason: 'peak_demand' | 'low_supply' | 'holiday' | 'none';
  expiresAt?: string;
}

// ─── Provider System ─────────────────────────────────────────

export type ProviderType = 'INDIVIDUAL' | 'COMPANY';

export interface Provider {
  id: string;
  type: ProviderType;
  companyId?: string;
  createdAt: string;
}

// ─── Company ─────────────────────────────────────────────────

export type CompanyVerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED';

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
  verificationStatus: CompanyVerificationStatus;
  staffCount: number;
  operatingAreas: string[];
  specialties: string[];
  insuranceVerified: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface CompanyDashboardStats {
  totalBookings: number;
  completedBookings: number;
  activeCleaners: number;
  totalRevenue: number;
  averageRating: number;
  cancellationRate: number;
  bookingsThisWeek: number;
  revenueThisMonth: number;
}

// ─── Team Management ─────────────────────────────────────────

export type TeamMemberRole = 'OWNER' | 'MANAGER' | 'CLEANER';

export interface TeamMember {
  id: string;
  companyId: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  role: TeamMemberRole;
  isActive: boolean;
  canAcceptJobs: boolean;
  joinedAt: string;
}

// ─── Complaint System ────────────────────────────────────────

export type ComplaintCategory =
  | 'NO_SHOW'
  | 'POOR_QUALITY'
  | 'PROPERTY_DAMAGE'
  | 'INCORRECT_DURATION'
  | 'SAFETY_CONCERN'
  | 'PAYMENT_ISSUE'
  | 'UNPROFESSIONAL'
  | 'OTHER';

export type ComplaintSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

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
  category: ComplaintCategory;
  severity: ComplaintSeverity;
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

// ─── Evidence System ─────────────────────────────────────────

export type EvidenceType = 'PHOTO' | 'VIDEO' | 'TEXT' | 'DOCUMENT';

export interface EvidenceRecord {
  id: string;
  type: EvidenceType;
  url: string;
  fileName?: string;
  description?: string;
  uploadedAt: string;
}

export interface EvidenceUploadInput {
  type: EvidenceType;
  url: string;
  fileName?: string;
  description?: string;
}

// ─── Cleaner Job Actions ─────────────────────────────────────

export type CleanerJobAction = 'ACCEPT' | 'REJECT' | 'CHECK_IN' | 'COMPLETE' | 'ADD_NOTES';

export interface CleanerJobUpdate {
  action: CleanerJobAction;
  bookingId: string;
  notes?: string;
}

// ─── Notification Channels ──────────────────────────────────

export type NotificationChannel = 'EMAIL' | 'SMS' | 'PUSH';

export interface NotificationPreferences {
  userId: string;
  email: boolean;
  sms: boolean;
  push: boolean;
  pushSubscription?: PushSubscriptionData;
}

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}
