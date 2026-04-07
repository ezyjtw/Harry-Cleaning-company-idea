/**
 * Shared constants across mobile apps and web.
 */

// ─── Brand Colours ──────────────────────────────────────────────

export const Colors = {
  primary: '#0D9488', // Teal-600 — main brand
  primaryDark: '#0F766E', // Teal-700
  primaryLight: '#14B8A6', // Teal-500
  secondary: '#6366F1', // Indigo-500
  secondaryDark: '#4F46E5',

  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',

  white: '#FFFFFF',
  black: '#000000',
  background: '#F9FAFB', // Gray-50
  surface: '#FFFFFF',
  border: '#E5E7EB', // Gray-200
  textPrimary: '#111827', // Gray-900
  textSecondary: '#6B7280', // Gray-500
  textMuted: '#9CA3AF', // Gray-400
  placeholder: '#D1D5DB', // Gray-300

  // Status-specific
  statusPending: '#F59E0B',
  statusConfirmed: '#3B82F6',
  statusInProgress: '#8B5CF6',
  statusCompleted: '#22C55E',
  statusCancelled: '#EF4444',
} as const;

// ─── Cleaner Tier Colours ───────────────────────────────────────

export const TierColors: Record<string, string> = {
  STARTER: '#9CA3AF',
  BRONZE: '#CD7F32',
  SILVER: '#C0C0C0',
  GOLD: '#FFD700',
  ELITE: '#8B5CF6',
};

// ─── Service Types ──────────────────────────────────────────────

export const ServiceTypes = [
  { slug: 'regular', name: 'Regular Clean', icon: 'home-outline' },
  { slug: 'deep', name: 'Deep Clean', icon: 'sparkles' },
  { slug: 'eot', name: 'End of Tenancy', icon: 'key-outline' },
  { slug: 'airbnb', name: 'Airbnb Turnaround', icon: 'bed-outline' },
  { slug: 'same-day', name: 'Same-Day', icon: 'flash-outline' },
] as const;

// ─── Property Sizes ─────────────────────────────────────────────

export const PropertySizes = [
  { value: 'STUDIO', label: 'Studio' },
  { value: 'ONE_BED', label: '1 Bedroom' },
  { value: 'TWO_BED', label: '2 Bedrooms' },
  { value: 'THREE_BED', label: '3 Bedrooms' },
  { value: 'FOUR_BED', label: '4 Bedrooms' },
  { value: 'FIVE_PLUS', label: '5+ Bedrooms' },
] as const;

// ─── Booking Frequencies ────────────────────────────────────────

export const Frequencies = [
  { value: 'ONE_OFF', label: 'One-off' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'FORTNIGHTLY', label: 'Fortnightly' },
] as const;

// ─── Days of Week ───────────────────────────────────────────────

export const DaysOfWeek = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

// ─── Platform Config ────────────────────────────────────────────

export const PLATFORM_FEE_PERCENT = 10; // % charged to cleaners
export const CUSTOMER_SERVICE_FEE_PERCENT = 6; // % added for customers on hourly
export const MIN_HOURLY_RATE = 14;
export const MAX_HOURLY_RATE = 35;
export const MIN_BOOKING_HOURS = 2;
export const MAX_BOOKING_HOURS = 12;
