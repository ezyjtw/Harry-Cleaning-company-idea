import type { CleanerTier, DisputeStatus } from "@/lib/types";

// ─── Types ──────────────────────────────────────────────────

export interface DashboardStats {
  totalBookings: number;
  activeCleaners: number;
  revenue: number;
  pendingDisputes: number;
  bookingsChange: string;
  cleanersChange: string;
  revenueChange: string;
}

export interface AdminCustomer {
  id: string;
  name: string;
  email: string;
  joinDate: string;
  bookingsCount: number;
  totalSpent: number;
  status: "active" | "suspended" | "inactive";
}

export interface AdminCleaner {
  id: string;
  name: string;
  email: string;
  tier: CleanerTier;
  rating: number;
  verified: boolean;
  activeBookings: number;
  completedJobs: number;
  commission: number;
  status: "active" | "suspended" | "pending-approval";
}

export interface AdminBooking {
  id: string;
  customer: string;
  cleaner: string;
  serviceType: string;
  date: string;
  time: string;
  amount: number;
  status: "pending" | "confirmed" | "in-progress" | "completed" | "cancelled" | "disputed";
}

export interface AdminDispute {
  id: string;
  bookingRef: string;
  customerName: string;
  cleanerName: string;
  reason: string;
  description: string;
  dateRaised: string;
  status: DisputeStatus;
  amount: number;
  filedBy: "customer" | "cleaner";
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CleanerFilters {
  tier?: CleanerTier;
  verified?: boolean;
  status?: string;
}

export interface BookingFilters {
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  serviceType?: string;
}

export interface PlatformSettings {
  commissionRate: number;
  sameDayMultiplier: number;
  serviceTypes: Array<{ id: string; name: string; basePrice: number; active: boolean }>;
  pricingRules: Array<{ id: string; name: string; multiplier: number; active: boolean }>;
  serviceAreas: Array<{ id: string; name: string; postcodes: string; active: boolean }>;
}

// ─── Mock Data ──────────────────────────────────────────────

const mockCustomers: AdminCustomer[] = [
  { id: "C-001", name: "Emma Wilson", email: "emma@email.com", joinDate: "2025-06-15", bookingsCount: 24, totalSpent: 1560, status: "active" },
  { id: "C-002", name: "James Taylor", email: "james@email.com", joinDate: "2025-08-22", bookingsCount: 12, totalSpent: 840, status: "active" },
  { id: "C-003", name: "Olivia Brown", email: "olivia@email.com", joinDate: "2025-09-10", bookingsCount: 8, totalSpent: 620, status: "active" },
  { id: "C-004", name: "Liam Johnson", email: "liam@email.com", joinDate: "2025-11-01", bookingsCount: 3, totalSpent: 180, status: "active" },
  { id: "C-005", name: "Sophie Davis", email: "sophie@email.com", joinDate: "2025-07-18", bookingsCount: 18, totalSpent: 1240, status: "active" },
  { id: "C-006", name: "Daniel Lee", email: "daniel@email.com", joinDate: "2025-10-05", bookingsCount: 6, totalSpent: 480, status: "suspended" },
];

const mockCleaners: AdminCleaner[] = [
  { id: "CL-001", name: "Sarah Chen", email: "sarah@email.com", tier: "premium", rating: 4.9, verified: true, activeBookings: 3, completedJobs: 127, commission: 10, status: "active" },
  { id: "CL-002", name: "Maria Santos", email: "maria@email.com", tier: "elite", rating: 4.95, verified: true, activeBookings: 5, completedJobs: 245, commission: 8, status: "active" },
  { id: "CL-003", name: "Ewa Kowalski", email: "ewa@email.com", tier: "standard", rating: 4.5, verified: true, activeBookings: 2, completedJobs: 45, commission: 15, status: "active" },
  { id: "CL-004", name: "Fatima Al-Rashid", email: "fatima@email.com", tier: "premium", rating: 4.8, verified: true, activeBookings: 4, completedJobs: 98, commission: 10, status: "active" },
  { id: "CL-005", name: "Priya Sharma", email: "priya@email.com", tier: "standard", rating: 0, verified: false, activeBookings: 0, completedJobs: 0, commission: 15, status: "pending-approval" },
];

const mockBookings: AdminBooking[] = [
  { id: "B-2001", customer: "Emma Wilson", cleaner: "Sarah Chen", serviceType: "Regular Clean", date: "2026-03-14", time: "09:00", amount: 65, status: "confirmed" },
  { id: "B-2002", customer: "James Taylor", cleaner: "Maria Santos", serviceType: "Deep Clean", date: "2026-03-14", time: "14:00", amount: 120, status: "in-progress" },
  { id: "B-2003", customer: "Olivia Brown", cleaner: "Sarah Chen", serviceType: "End of Tenancy", date: "2026-03-13", time: "10:00", amount: 180, status: "completed" },
  { id: "B-2004", customer: "Liam Johnson", cleaner: "Ewa Kowalski", serviceType: "Regular Clean", date: "2026-03-13", time: "08:30", amount: 55, status: "confirmed" },
  { id: "B-2005", customer: "Sophie Davis", cleaner: "Fatima Al-Rashid", serviceType: "AirBnB Turnover", date: "2026-03-13", time: "11:00", amount: 90, status: "completed" },
];

const mockDisputes: AdminDispute[] = [
  { id: "D-001", bookingRef: "B-2006", customerName: "Daniel Lee", cleanerName: "Sarah Chen", reason: "poor-quality", description: "Kitchen was not cleaned properly.", dateRaised: "2026-03-12", status: "open", amount: 140, filedBy: "customer" },
  { id: "D-002", bookingRef: "B-1998", customerName: "Rachel Green", cleanerName: "Li Wei", reason: "no-show-cleaner", description: "Cleaner did not arrive.", dateRaised: "2026-03-10", status: "under-review", amount: 65, filedBy: "customer" },
  { id: "D-003", bookingRef: "B-1985", customerName: "Tom Mitchell", cleanerName: "Maria Santos", reason: "property-damage", description: "Cleaning solution caused discolouration.", dateRaised: "2026-03-08", status: "escalated", amount: 120, filedBy: "customer" },
];

// ─── Service Functions ──────────────────────────────────────

/**
 * Get dashboard statistics overview.
 * TODO: Replace with actual aggregation queries against the database
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  // TODO: Aggregate from bookings, cleaners, payments, and disputes tables
  return {
    totalBookings: 1247,
    activeCleaners: 89,
    revenue: 24680,
    pendingDisputes: 3,
    bookingsChange: "+8.2% from last month",
    cleanersChange: "+5 this week",
    revenueChange: "+12.5% from last month",
  };
}

/**
 * Get paginated list of customers with optional search.
 * TODO: Replace with actual API call to GET /api/admin/customers?page=&search=
 */
export async function getCustomers(
  page: number = 1,
  search: string = "",
  pageSize: number = 10
): Promise<PaginatedResult<AdminCustomer>> {
  // TODO: Query database with pagination and search
  let filtered = mockCustomers;
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
    );
  }
  const total = filtered.length;
  const data = filtered.slice((page - 1) * pageSize, page * pageSize);
  return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

/**
 * Get paginated list of cleaners with optional search and filters.
 * TODO: Replace with actual API call to GET /api/admin/cleaners?page=&search=&tier=&verified=
 */
export async function getCleaners(
  page: number = 1,
  search: string = "",
  filters: CleanerFilters = {},
  pageSize: number = 10
): Promise<PaginatedResult<AdminCleaner>> {
  // TODO: Query database with pagination, search, and filters
  let filtered = mockCleaners;
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
    );
  }
  if (filters.tier) filtered = filtered.filter((c) => c.tier === filters.tier);
  if (filters.verified !== undefined) filtered = filtered.filter((c) => c.verified === filters.verified);
  if (filters.status) filtered = filtered.filter((c) => c.status === filters.status);

  const total = filtered.length;
  const data = filtered.slice((page - 1) * pageSize, page * pageSize);
  return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

/**
 * Get paginated list of all bookings with optional filters.
 * TODO: Replace with actual API call to GET /api/admin/bookings?page=&status=&dateFrom=&dateTo=&serviceType=
 */
export async function getAllBookings(
  page: number = 1,
  filters: BookingFilters = {},
  pageSize: number = 10
): Promise<PaginatedResult<AdminBooking>> {
  // TODO: Query database with pagination and filters
  let filtered = mockBookings;
  if (filters.status) filtered = filtered.filter((b) => b.status === filters.status);
  if (filters.serviceType) filtered = filtered.filter((b) => b.serviceType === filters.serviceType);
  // TODO: Implement date range filtering

  const total = filtered.length;
  const data = filtered.slice((page - 1) * pageSize, page * pageSize);
  return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

/**
 * Get paginated list of disputes with optional status filter.
 * TODO: Replace with actual API call to GET /api/admin/disputes?page=&status=
 */
export async function getDisputes(
  page: number = 1,
  status?: DisputeStatus,
  pageSize: number = 10
): Promise<PaginatedResult<AdminDispute>> {
  // TODO: Query database with pagination and status filter
  let filtered = mockDisputes;
  if (status) filtered = filtered.filter((d) => d.status === status);

  const total = filtered.length;
  const data = filtered.slice((page - 1) * pageSize, page * pageSize);
  return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

/**
 * Update platform-wide settings.
 * TODO: Replace with actual API call to PUT /api/admin/settings
 */
export async function updatePlatformSettings(
  settings: Partial<PlatformSettings>
): Promise<{ success: boolean }> {
  // TODO: Validate settings, save to database/config
  // TODO: Consider caching and invalidation strategy
  return { success: true };
}
