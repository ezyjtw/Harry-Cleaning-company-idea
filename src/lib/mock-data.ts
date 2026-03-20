import type { Cleaner, Review, SavedAddress, PastBooking, CustomerReview } from './types';

export const cleaners: Cleaner[] = [
  {
    id: '1',
    name: 'Maria Santos',
    photo: '/cleaners/maria.jpg',
    rating: 4.9,
    reviewCount: 127,
    hourlyRate: 35,
    sameDayRate: 50,
    bio: 'Professional cleaner with 8 years of experience. I take pride in leaving every home spotless and fresh. Specializing in eco-friendly products that are safe for families and pets.',
    specialties: ['Deep Cleaning', 'Regular Cleaning', 'One-Off Clean'],
    languages: ['English', 'Portuguese', 'Spanish'],
    tier: 'elite',
    location: 'Manhattan, NY',
    verified: true,
    identityVerified: true,
    backgroundChecked: true,
    yearsExperience: 8,
    completedJobs: 520,
    availability: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    availableNow: true,
    responseTime: '~5 min',
    categoryRatings: { thoroughness: 4.9, punctuality: 5.0, communication: 4.8, value: 4.9 },
    bringsProducts: true,
    productFee: 8,
  },
  {
    id: '2',
    name: 'James Wilson',
    photo: '/cleaners/james.jpg',
    rating: 4.8,
    reviewCount: 89,
    hourlyRate: 30,
    sameDayRate: 42,
    bio: 'Detail-oriented cleaner who treats every home like my own. Certified in commercial and residential cleaning with a focus on kitchens and bathrooms.',
    specialties: ['Regular Cleaning', 'One-Off Clean', 'Deep Cleaning'],
    languages: ['English'],
    tier: 'premium',
    location: 'Brooklyn, NY',
    verified: true,
    identityVerified: true,
    backgroundChecked: false,
    yearsExperience: 5,
    completedJobs: 340,
    availability: ['Mon', 'Wed', 'Fri', 'Sat'],
    availableNow: false,
    responseTime: '~15 min',
    categoryRatings: { thoroughness: 4.8, punctuality: 4.7, communication: 4.9, value: 4.8 },
    bringsProducts: true,
    productFee: 5,
  },
  {
    id: '3',
    name: 'Aisha Johnson',
    photo: '/cleaners/aisha.jpg',
    rating: 5.0,
    reviewCount: 64,
    hourlyRate: 40,
    sameDayRate: 58,
    bio: 'Premium cleaning services for those who expect the best. I use top-of-the-line equipment and products. Perfect for move-in/move-out deep cleans.',
    specialties: ['End of Tenancy', 'Deep Cleaning', 'One-Off Clean'],
    languages: ['English', 'French'],
    tier: 'elite',
    location: 'Queens, NY',
    verified: true,
    identityVerified: true,
    backgroundChecked: true,
    yearsExperience: 10,
    completedJobs: 280,
    availability: ['Tue', 'Thu', 'Sat', 'Sun'],
    availableNow: true,
    responseTime: '~3 min',
    categoryRatings: { thoroughness: 5.0, punctuality: 5.0, communication: 5.0, value: 4.8 },
    bringsProducts: true,
    productFee: 12,
  },
  {
    id: '4',
    name: 'Carlos Rivera',
    photo: '/cleaners/carlos.jpg',
    rating: 4.7,
    reviewCount: 156,
    hourlyRate: 28,
    sameDayRate: 40,
    bio: 'Reliable and efficient cleaner specializing in office spaces and commercial properties. Available for regular weekly contracts or one-time cleans.',
    specialties: ['Regular Cleaning', 'Airbnb Cleaning', 'One-Off Clean'],
    languages: ['English', 'Spanish'],
    tier: 'standard',
    location: 'Bronx, NY',
    verified: true,
    identityVerified: true,
    backgroundChecked: true,
    yearsExperience: 6,
    completedJobs: 610,
    availability: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    availableNow: false,
    responseTime: '~30 min',
    categoryRatings: { thoroughness: 4.7, punctuality: 4.6, communication: 4.8, value: 4.9 },
    bringsProducts: false,
    productFee: 0,
  },
  {
    id: '5',
    name: 'Elena Petrov',
    photo: '/cleaners/elena.jpg',
    rating: 4.9,
    reviewCount: 93,
    hourlyRate: 38,
    sameDayRate: 55,
    bio: 'Meticulous cleaner with a background in hospitality. I bring hotel-level cleanliness to your home. Flexible scheduling and always on time.',
    specialties: ['Airbnb Cleaning', 'Deep Cleaning', 'End of Tenancy'],
    languages: ['English', 'Russian', 'Ukrainian'],
    tier: 'elite',
    location: 'Manhattan, NY',
    verified: true,
    identityVerified: true,
    backgroundChecked: true,
    yearsExperience: 12,
    completedJobs: 450,
    availability: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    availableNow: true,
    responseTime: '~2 min',
    categoryRatings: { thoroughness: 4.9, punctuality: 5.0, communication: 4.9, value: 4.7 },
    bringsProducts: true,
    productFee: 10,
  },
  {
    id: '6',
    name: 'David Chen',
    photo: '/cleaners/david.jpg',
    rating: 4.6,
    reviewCount: 71,
    hourlyRate: 32,
    sameDayRate: 45,
    bio: 'Organized, punctual, and thorough. I specialize in apartments and condos, with experience handling sensitive surfaces like marble and hardwood.',
    specialties: ['Regular Cleaning', 'End of Tenancy', 'Airbnb Cleaning'],
    languages: ['English', 'Mandarin', 'Cantonese'],
    tier: 'premium',
    location: 'Staten Island, NY',
    verified: true,
    identityVerified: false,
    backgroundChecked: false,
    yearsExperience: 4,
    completedJobs: 195,
    availability: ['Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    availableNow: false,
    responseTime: '~20 min',
    categoryRatings: { thoroughness: 4.7, punctuality: 4.5, communication: 4.6, value: 4.8 },
    bringsProducts: true,
    productFee: 6,
  },
];

export const reviews: Review[] = [
  {
    id: 'r1',
    cleanerId: '1',
    customerName: 'Sarah M.',
    rating: 5,
    categoryRatings: { thoroughness: 5, punctuality: 5, communication: 5, value: 5 },
    comment:
      'Maria is absolutely fantastic! My apartment has never looked this clean. She was thorough, professional, and even organized my pantry. Will definitely book again!',
    cleanerReply:
      'Thank you so much, Sarah! It was a pleasure working in your home. Looking forward to next time!',
    date: '2026-02-28',
    verified: true,
  },
  {
    id: 'r2',
    cleanerId: '1',
    customerName: 'Tom K.',
    rating: 5,
    categoryRatings: { thoroughness: 5, punctuality: 5, communication: 4, value: 5 },
    comment:
      'Incredible attention to detail. Maria used eco-friendly products which was important because we have a newborn. Highly recommended!',
    date: '2026-02-20',
    verified: true,
  },
  {
    id: 'r3',
    cleanerId: '1',
    customerName: 'Linda R.',
    rating: 4,
    categoryRatings: { thoroughness: 4, punctuality: 5, communication: 4, value: 4 },
    comment:
      'Great cleaning overall. Maria was on time and very professional. Only reason for 4 stars is I wish she had spent a bit more time on the windows.',
    cleanerReply:
      "Thanks for the feedback, Linda! I'll make sure to spend extra time on the windows next visit.",
    date: '2026-02-10',
    verified: true,
  },
  {
    id: 'r4',
    cleanerId: '2',
    customerName: 'Alex P.',
    rating: 5,
    categoryRatings: { thoroughness: 5, punctuality: 5, communication: 5, value: 5 },
    comment: "James transformed my kitchen! It looks brand new. He really knows what he's doing.",
    date: '2026-02-25',
    verified: true,
  },
  {
    id: 'r5',
    cleanerId: '2',
    customerName: 'Nina S.',
    rating: 5,
    categoryRatings: { thoroughness: 5, punctuality: 4, communication: 5, value: 5 },
    comment:
      'Super professional and reliable. James has been cleaning my apartment weekly for 3 months now. Consistently excellent.',
    date: '2026-02-15',
    verified: true,
  },
  {
    id: 'r6',
    cleanerId: '3',
    customerName: 'Robert D.',
    rating: 5,
    categoryRatings: { thoroughness: 5, punctuality: 5, communication: 5, value: 4 },
    comment:
      'Aisha did an amazing move-out clean for us. Our landlord was impressed and we got our full deposit back. Worth every penny!',
    date: '2026-03-01',
    verified: true,
  },
  {
    id: 'r7',
    cleanerId: '3',
    customerName: 'Michelle T.',
    rating: 5,
    categoryRatings: { thoroughness: 5, punctuality: 5, communication: 5, value: 5 },
    comment:
      'Premium service is an understatement. Aisha uses professional-grade equipment and the results speak for themselves. My home has never been cleaner.',
    cleanerReply:
      'Thank you, Michelle! I always invest in the best equipment because my clients deserve the best results.',
    date: '2026-02-22',
    verified: true,
  },
];

export const customerReviews: CustomerReview[] = [
  {
    id: 'cr1',
    customerId: 'c1',
    cleanerId: '1',
    cleanerName: 'Maria Santos',
    rating: 5,
    comment:
      'Wonderful client! Clean home, clear instructions, and very respectful. Would love to work with them again.',
    date: '2026-02-28',
  },
  {
    id: 'cr2',
    customerId: 'c2',
    cleanerId: '2',
    cleanerName: 'James Wilson',
    rating: 4,
    comment:
      'Good client overall. Home was in reasonable condition. Would appreciate clearer parking instructions next time.',
    date: '2026-02-25',
  },
];

export const savedAddresses: SavedAddress[] = [
  { id: 'a1', label: 'Home', address: '123 Main St, Apt 4B, Manhattan, NY 10001', isDefault: true },
  {
    id: 'a2',
    label: 'Office',
    address: '456 Park Ave, Suite 200, Manhattan, NY 10022',
    isDefault: false,
  },
];

export const pastBookings: PastBooking[] = [
  {
    id: 'pb1',
    cleanerId: '1',
    cleanerName: 'Maria Santos',
    serviceType: 'Deep Cleaning',
    date: '2026-02-20',
    address: '123 Main St, Apt 4B, Manhattan, NY 10001',
    duration: 3,
    totalPrice: 157.5,
  },
  {
    id: 'pb2',
    cleanerId: '5',
    cleanerName: 'Elena Petrov',
    serviceType: 'Standard Cleaning',
    date: '2026-02-05',
    address: '123 Main St, Apt 4B, Manhattan, NY 10001',
    duration: 2,
    totalPrice: 76,
  },
];

export function getCleanerById(id: string): Cleaner | undefined {
  return cleaners.find((c) => c.id === id);
}

export function getReviewsForCleaner(cleanerId: string): Review[] {
  return reviews.filter((r) => r.cleanerId === cleanerId);
}

export function searchCleaners(query: string): Cleaner[] {
  const q = query.toLowerCase();
  return cleaners.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.location.toLowerCase().includes(q) ||
      c.specialties.some((s) => s.toLowerCase().includes(q))
  );
}

export function getAvailableNowCleaners(): Cleaner[] {
  return cleaners.filter((c) => c.availableNow);
}
