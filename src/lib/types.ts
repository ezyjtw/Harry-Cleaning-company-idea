export interface Cleaner {
  id: string;
  name: string;
  photo: string;
  rating: number;
  reviewCount: number;
  hourlyRate: number;
  bio: string;
  specialties: string[];
  location: string;
  verified: boolean;
  yearsExperience: number;
  completedJobs: number;
  availability: string[];
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
  serviceType: "standard" | "deep" | "move-in-out" | "office";
  notes: string;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  totalPrice: number;
}

export interface Review {
  id: string;
  cleanerId: string;
  customerName: string;
  rating: number;
  comment: string;
  date: string;
}
