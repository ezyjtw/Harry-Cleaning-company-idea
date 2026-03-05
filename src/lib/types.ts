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
  location: string;
  verified: boolean;
  yearsExperience: number;
  completedJobs: number;
  availability: string[];
  availableNow: boolean;
  responseTime: string;
  categoryRatings: CategoryRatings;
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
  status: "pending" | "confirmed" | "completed" | "cancelled";
  totalPrice: number;
  isLastMinute: boolean;
}

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
