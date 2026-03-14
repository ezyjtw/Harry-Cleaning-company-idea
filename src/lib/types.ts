export type CleanerTier = "standard" | "premium" | "elite";

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
  serviceType: "standard" | "deep" | "move-in-out" | "office" | "last-minute";
  notes: string;
  status: "pending" | "confirmed" | "in-progress" | "completed" | "cancelled" | "disputed";
  totalPrice: number;
  isLastMinute: boolean;
  escrowStatus: EscrowStatus;
  isFirstBookingWithCleaner: boolean;
}

export type EscrowStatus = "held" | "released" | "refunded" | "disputed" | "none";

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
  userType: "cleaner" | "customer";
  status: "pending" | "verified" | "rejected" | "expired";
  submittedAt: string;
  verifiedAt?: string;
  documentType: "passport" | "drivers-license" | "national-id";
  selfieMatch: boolean;
  livePhotoRequired: boolean; // for arrival verification
}

export type VerificationLevel = "unverified" | "basic" | "full";

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
  releaseCondition: "auto-24h" | "customer-confirmed" | "dispute-resolved";
  isFirstBooking: boolean;
}

// ─── Disputes ────────────────────────────────────────────────

export type DisputeReason =
  | "no-show-cleaner"
  | "no-show-customer"
  | "poor-quality"
  | "property-damage"
  | "incorrect-duration"
  | "safety-concern"
  | "payment-issue"
  | "other";

export type DisputeStatus = "open" | "under-review" | "resolved-customer" | "resolved-cleaner" | "resolved-split" | "escalated";

export interface Dispute {
  id: string;
  bookingId: string;
  filedBy: "customer" | "cleaner";
  filedByName: string;
  reason: DisputeReason;
  description: string;
  evidence: DisputeEvidence[];
  status: DisputeStatus;
  resolution?: string;
  createdAt: string;
  resolvedAt?: string;
  escrowAction?: "release" | "refund" | "split";
}

export interface DisputeEvidence {
  id: string;
  type: "photo" | "video" | "text" | "timestamp";
  description: string;
  uploadedAt: string;
  uploadedBy: "customer" | "cleaner";
}

// ─── Booking Flow ───────────────────────────────────────────

export type ServiceCategory =
  | "regular"
  | "one-off"
  | "same-day"
  | "deep"
  | "airbnb"
  | "end-of-tenancy";

export type BookingFrequency = "weekly" | "biweekly" | "one-time";

export type KeyAccess = "i-will-be-home" | "key-under-mat" | "lockbox" | "with-concierge" | "other";

export interface RoomConfig {
  bedrooms: number;
  bathrooms: number;
  livingAreas: number;
  kitchen: boolean;
  additionals: string[]; // e.g. "Conservatory", "Garage", "Utility Room"
}

// ─── Notifications ──────────────────────────────────────────

export type NotificationType =
  | "booking_confirmed"
  | "booking_cancelled"
  | "booking_reminder"
  | "cleaner_assigned"
  | "payment_received"
  | "review_received"
  | "message_received"
  | "dispute_update";

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
  status: "pending" | "completed" | "failed" | "refunded";
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

export type UserRole = "CLIENT" | "CLEANER" | "ADMIN";

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
  scheduling: "specific" | "flexible";
  preferredDates: string[];
  preferredTimeSlots: string[];
  selectedCleanerId: string;
  acceptSubstitute: boolean;
  specialInstructions: string;
}
