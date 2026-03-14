import type { Cleaner, CleanerTier } from "@/lib/types";

// ─── Types ──────────────────────────────────────────────────

export interface UpdateCleanerProfileData {
  name?: string;
  photo?: string;
  bio?: string;
  hourlyRate?: number;
  specialties?: string[];
  languages?: string[];
  location?: string;
  bringsProducts?: boolean;
}

export interface AvailabilitySlot {
  day: string; // "Monday" | "Tuesday" | ... | "Sunday"
  start: string; // "HH:mm"
  end: string; // "HH:mm"
}

export interface EarningsSummary {
  totalEarnings: number;
  platformFees: number;
  netEarnings: number;
  payouts: PayoutRecord[];
  breakdown: ServiceBreakdown[];
}

export interface PayoutRecord {
  id: string;
  date: string;
  amount: number;
  status: "completed" | "pending" | "processing";
  reference: string;
}

export interface ServiceBreakdown {
  serviceType: string;
  count: number;
  amount: number;
}

export interface CleanerJob {
  id: string;
  clientName: string;
  address: string;
  date: string;
  time: string;
  serviceType: string;
  price: number;
  status: "pending" | "upcoming" | "in-progress" | "completed";
  duration: number;
}

// ─── Mock Data ──────────────────────────────────────────────

const mockCleanerProfile: Cleaner = {
  id: "CL-001",
  name: "Sarah Chen",
  photo: "/images/cleaners/sarah.jpg",
  rating: 4.9,
  reviewCount: 127,
  hourlyRate: 25,
  sameDayRate: 37.5,
  bio: "Professional cleaner with 5+ years experience. I take pride in delivering spotless results.",
  specialties: ["Regular Cleaning", "Deep Cleaning", "End of Tenancy"],
  languages: ["English", "Portuguese"],
  tier: "premium" as CleanerTier,
  location: "SW1, SW3, SW7, W1, W8",
  verified: true,
  identityVerified: true,
  backgroundChecked: true,
  yearsExperience: 5,
  completedJobs: 127,
  availability: ["Monday", "Tuesday", "Thursday", "Friday", "Saturday"],
  availableNow: false,
  responseTime: "< 15 min",
  categoryRatings: {
    thoroughness: 4.9,
    punctuality: 4.8,
    communication: 4.9,
    value: 4.7,
  },
  bringsProducts: true,
  productFee: 5,
};

const mockAvailability: AvailabilitySlot[] = [
  { day: "Monday", start: "08:00", end: "17:00" },
  { day: "Tuesday", start: "08:00", end: "17:00" },
  { day: "Wednesday", start: "08:00", end: "13:00" },
  { day: "Thursday", start: "08:00", end: "17:00" },
  { day: "Friday", start: "08:00", end: "17:00" },
  { day: "Saturday", start: "09:00", end: "14:00" },
];

const mockJobs: CleanerJob[] = [
  { id: "B-1001", clientName: "Emma Wilson", address: "14 Baker St, W1U ***", date: "2026-03-14", time: "09:00", serviceType: "Regular Clean", price: 65, status: "upcoming", duration: 2 },
  { id: "B-1002", clientName: "James Taylor", address: "8 Canary Wharf, E14 ***", date: "2026-03-14", time: "14:00", serviceType: "Deep Clean", price: 120, status: "pending", duration: 4 },
  { id: "B-1003", clientName: "Olivia Brown", address: "22 Richmond Rd, TW9 ***", date: "2026-03-15", time: "10:00", serviceType: "End of Tenancy", price: 180, status: "pending", duration: 5 },
  { id: "B-1004", clientName: "Daniel Lee", address: "17 Brixton Hill, SW2 ***", date: "2026-03-12", time: "09:00", serviceType: "Deep Clean", price: 140, status: "completed", duration: 4 },
];

// ─── Service Functions ──────────────────────────────────────

/**
 * Get a cleaner's full profile.
 * TODO: Replace with actual API call to GET /api/cleaners/:userId/profile
 */
export async function getCleanerProfile(userId: string): Promise<Cleaner | null> {
  // TODO: Fetch from database by user ID
  if (userId === "CL-001") return mockCleanerProfile;
  return null;
}

/**
 * Update a cleaner's profile information.
 * TODO: Replace with actual API call to PATCH /api/cleaners/:userId/profile
 */
export async function updateCleanerProfile(
  userId: string,
  data: UpdateCleanerProfileData
): Promise<Cleaner | null> {
  // TODO: Validate data, update in database, handle photo upload
  return { ...mockCleanerProfile, ...data };
}

/**
 * Get a cleaner's availability slots.
 * TODO: Replace with actual API call to GET /api/cleaners/:cleanerId/availability
 */
export async function getAvailability(cleanerId: string): Promise<AvailabilitySlot[]> {
  // TODO: Fetch from database
  return mockAvailability;
}

/**
 * Update a cleaner's availability slots.
 * TODO: Replace with actual API call to PUT /api/cleaners/:cleanerId/availability
 */
export async function updateAvailability(
  cleanerId: string,
  slots: AvailabilitySlot[]
): Promise<{ success: boolean }> {
  // TODO: Validate slots (no overlaps, valid times), save to database
  return { success: true };
}

/**
 * Get earnings summary for a cleaner over a given period.
 * TODO: Replace with actual API call to GET /api/cleaners/:cleanerId/earnings?period=...
 */
export async function getEarnings(
  cleanerId: string,
  period: "week" | "month" | "year" | "custom"
): Promise<EarningsSummary> {
  // TODO: Aggregate earnings from completed bookings within the period
  return {
    totalEarnings: 1830,
    platformFees: 183,
    netEarnings: 1647,
    payouts: [
      { id: "P-001", date: "2026-03-13", amount: 245.00, status: "completed", reference: "PAY-2026031301" },
      { id: "P-002", date: "2026-03-10", amount: 180.50, status: "completed", reference: "PAY-2026031001" },
      { id: "P-003", date: "2026-03-07", amount: 320.00, status: "completed", reference: "PAY-2026030701" },
      { id: "P-004", date: "2026-03-14", amount: 165.00, status: "processing", reference: "PAY-2026031401" },
    ],
    breakdown: [
      { serviceType: "Regular Clean", count: 12, amount: 720 },
      { serviceType: "Deep Clean", count: 4, amount: 480 },
      { serviceType: "End of Tenancy", count: 2, amount: 360 },
      { serviceType: "AirBnB Turnover", count: 3, amount: 270 },
    ],
  };
}

/**
 * Get jobs for a cleaner filtered by status.
 * TODO: Replace with actual API call to GET /api/cleaners/:cleanerId/jobs?status=...
 */
export async function getCleanerJobs(
  cleanerId: string,
  status?: CleanerJob["status"]
): Promise<CleanerJob[]> {
  // TODO: Fetch from database with optional status filter
  if (status) {
    return mockJobs.filter((j) => j.status === status);
  }
  return mockJobs;
}
