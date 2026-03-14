import type { Booking } from "@/lib/types";

// ─── Types ──────────────────────────────────────────────────

export interface CreateBookingData {
  cleanerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  address: string;
  date: string;
  time: string;
  duration: number;
  serviceType: Booking["serviceType"];
  notes: string;
  totalPrice: number;
  isLastMinute: boolean;
}

export interface RescheduleData {
  newDate: string;
  newTime: string;
}

// ─── Mock Data ──────────────────────────────────────────────

const mockBookings: Booking[] = [
  {
    id: "B-2001",
    cleanerId: "CL-001",
    customerName: "Emma Wilson",
    customerEmail: "emma@email.com",
    customerPhone: "07700900001",
    address: "14 Baker St, London, W1U 3BW",
    date: "2026-03-14",
    time: "09:00",
    duration: 2,
    serviceType: "standard",
    notes: "Please focus on kitchen and bathrooms",
    status: "confirmed",
    totalPrice: 65,
    isLastMinute: false,
    escrowStatus: "held",
    isFirstBookingWithCleaner: false,
  },
  {
    id: "B-2002",
    cleanerId: "CL-002",
    customerName: "James Taylor",
    customerEmail: "james@email.com",
    customerPhone: "07700900002",
    address: "8 Canary Wharf, London, E14 5AB",
    date: "2026-03-14",
    time: "14:00",
    duration: 4,
    serviceType: "deep",
    notes: "",
    status: "in-progress",
    totalPrice: 120,
    isLastMinute: false,
    escrowStatus: "held",
    isFirstBookingWithCleaner: true,
  },
  {
    id: "B-2003",
    cleanerId: "CL-001",
    customerName: "Olivia Brown",
    customerEmail: "olivia@email.com",
    customerPhone: "07700900003",
    address: "22 Richmond Rd, London, TW9 2NA",
    date: "2026-03-15",
    time: "10:00",
    duration: 5,
    serviceType: "move-in-out",
    notes: "End of tenancy clean. Landlord inspection on the 17th.",
    status: "pending",
    totalPrice: 180,
    isLastMinute: false,
    escrowStatus: "held",
    isFirstBookingWithCleaner: false,
  },
];

// ─── Service Functions ──────────────────────────────────────

/**
 * Create a new booking.
 * TODO: Replace with actual API call to POST /api/bookings
 */
export async function createBooking(data: CreateBookingData): Promise<Booking> {
  // TODO: Validate data, check cleaner availability, create escrow hold
  const newBooking: Booking = {
    id: `B-${Date.now()}`,
    ...data,
    status: "pending",
    escrowStatus: "held",
    isFirstBookingWithCleaner: true, // TODO: Check actual history
  };
  return newBooking;
}

/**
 * Get a single booking by ID.
 * TODO: Replace with actual API call to GET /api/bookings/:id
 */
export async function getBookingById(id: string): Promise<Booking | null> {
  // TODO: Fetch from database
  return mockBookings.find((b) => b.id === id) || null;
}

/**
 * Get all bookings for a specific client (customer).
 * TODO: Replace with actual API call to GET /api/bookings?clientEmail=...
 */
export async function getBookingsByClient(clientEmail: string): Promise<Booking[]> {
  // TODO: Fetch from database with client filter
  return mockBookings.filter((b) => b.customerEmail === clientEmail);
}

/**
 * Get all bookings for a specific cleaner.
 * TODO: Replace with actual API call to GET /api/bookings?cleanerId=...
 */
export async function getBookingsByCleaner(cleanerId: string): Promise<Booking[]> {
  // TODO: Fetch from database with cleaner filter
  return mockBookings.filter((b) => b.cleanerId === cleanerId);
}

/**
 * Update the status of a booking.
 * TODO: Replace with actual API call to PATCH /api/bookings/:id/status
 */
export async function updateBookingStatus(
  id: string,
  status: Booking["status"]
): Promise<Booking | null> {
  // TODO: Update in database, handle escrow status changes, send notifications
  const booking = mockBookings.find((b) => b.id === id);
  if (!booking) return null;
  return { ...booking, status };
}

/**
 * Cancel a booking with a reason.
 * TODO: Replace with actual API call to POST /api/bookings/:id/cancel
 */
export async function cancelBooking(
  id: string,
  reason: string
): Promise<{ success: boolean; refundAmount?: number }> {
  // TODO: Check cancellation policy, process refund if applicable, update escrow
  const booking = mockBookings.find((b) => b.id === id);
  if (!booking) return { success: false };

  // TODO: Calculate refund based on cancellation timing
  const refundAmount = booking.totalPrice;
  return { success: true, refundAmount };
}

/**
 * Reschedule a booking to a new date and time.
 * TODO: Replace with actual API call to POST /api/bookings/:id/reschedule
 */
export async function rescheduleBooking(
  id: string,
  newDate: string,
  newTime: string
): Promise<Booking | null> {
  // TODO: Check cleaner availability for new slot, update booking, notify parties
  const booking = mockBookings.find((b) => b.id === id);
  if (!booking) return null;
  return { ...booking, date: newDate, time: newTime };
}
