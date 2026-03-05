import { Cleaner, Review } from "./types";

export const cleaners: Cleaner[] = [
  {
    id: "1",
    name: "Maria Santos",
    photo: "/cleaners/maria.jpg",
    rating: 4.9,
    reviewCount: 127,
    hourlyRate: 35,
    bio: "Professional cleaner with 8 years of experience. I take pride in leaving every home spotless and fresh. Specializing in eco-friendly products that are safe for families and pets.",
    specialties: ["Deep Cleaning", "Eco-Friendly", "Pet-Friendly"],
    location: "Manhattan, NY",
    verified: true,
    yearsExperience: 8,
    completedJobs: 520,
    availability: ["Mon", "Tue", "Wed", "Thu", "Fri"],
  },
  {
    id: "2",
    name: "James Wilson",
    photo: "/cleaners/james.jpg",
    rating: 4.8,
    reviewCount: 89,
    hourlyRate: 30,
    bio: "Detail-oriented cleaner who treats every home like my own. Certified in commercial and residential cleaning with a focus on kitchens and bathrooms.",
    specialties: ["Standard Cleaning", "Kitchen Specialist", "Bathroom Specialist"],
    location: "Brooklyn, NY",
    verified: true,
    yearsExperience: 5,
    completedJobs: 340,
    availability: ["Mon", "Wed", "Fri", "Sat"],
  },
  {
    id: "3",
    name: "Aisha Johnson",
    photo: "/cleaners/aisha.jpg",
    rating: 5.0,
    reviewCount: 64,
    hourlyRate: 40,
    bio: "Premium cleaning services for those who expect the best. I use top-of-the-line equipment and products. Perfect for move-in/move-out deep cleans.",
    specialties: ["Move-In/Out", "Deep Cleaning", "Premium Service"],
    location: "Queens, NY",
    verified: true,
    yearsExperience: 10,
    completedJobs: 280,
    availability: ["Tue", "Thu", "Sat", "Sun"],
  },
  {
    id: "4",
    name: "Carlos Rivera",
    photo: "/cleaners/carlos.jpg",
    rating: 4.7,
    reviewCount: 156,
    hourlyRate: 28,
    bio: "Reliable and efficient cleaner specializing in office spaces and commercial properties. Available for regular weekly contracts or one-time cleans.",
    specialties: ["Office Cleaning", "Commercial", "Regular Contracts"],
    location: "Bronx, NY",
    verified: true,
    yearsExperience: 6,
    completedJobs: 610,
    availability: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  },
  {
    id: "5",
    name: "Elena Petrov",
    photo: "/cleaners/elena.jpg",
    rating: 4.9,
    reviewCount: 93,
    hourlyRate: 38,
    bio: "Meticulous cleaner with a background in hospitality. I bring hotel-level cleanliness to your home. Flexible scheduling and always on time.",
    specialties: ["Hospitality Standard", "Flexible Schedule", "Deep Cleaning"],
    location: "Manhattan, NY",
    verified: true,
    yearsExperience: 12,
    completedJobs: 450,
    availability: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  },
  {
    id: "6",
    name: "David Chen",
    photo: "/cleaners/david.jpg",
    rating: 4.6,
    reviewCount: 71,
    hourlyRate: 32,
    bio: "Organized, punctual, and thorough. I specialize in apartments and condos, with experience handling sensitive surfaces like marble and hardwood.",
    specialties: ["Apartments", "Sensitive Surfaces", "Organizing"],
    location: "Staten Island, NY",
    verified: true,
    yearsExperience: 4,
    completedJobs: 195,
    availability: ["Wed", "Thu", "Fri", "Sat", "Sun"],
  },
];

export const reviews: Review[] = [
  {
    id: "r1",
    cleanerId: "1",
    customerName: "Sarah M.",
    rating: 5,
    comment: "Maria is absolutely fantastic! My apartment has never looked this clean. She was thorough, professional, and even organized my pantry. Will definitely book again!",
    date: "2026-02-28",
  },
  {
    id: "r2",
    cleanerId: "1",
    customerName: "Tom K.",
    rating: 5,
    comment: "Incredible attention to detail. Maria used eco-friendly products which was important because we have a newborn. Highly recommended!",
    date: "2026-02-20",
  },
  {
    id: "r3",
    cleanerId: "1",
    customerName: "Linda R.",
    rating: 4,
    comment: "Great cleaning overall. Maria was on time and very professional. Only reason for 4 stars is I wish she had spent a bit more time on the windows.",
    date: "2026-02-10",
  },
  {
    id: "r4",
    cleanerId: "2",
    customerName: "Alex P.",
    rating: 5,
    comment: "James transformed my kitchen! It looks brand new. He really knows what he's doing.",
    date: "2026-02-25",
  },
  {
    id: "r5",
    cleanerId: "2",
    customerName: "Nina S.",
    rating: 5,
    comment: "Super professional and reliable. James has been cleaning my apartment weekly for 3 months now. Consistently excellent.",
    date: "2026-02-15",
  },
  {
    id: "r6",
    cleanerId: "3",
    customerName: "Robert D.",
    rating: 5,
    comment: "Aisha did an amazing move-out clean for us. Our landlord was impressed and we got our full deposit back. Worth every penny!",
    date: "2026-03-01",
  },
  {
    id: "r7",
    cleanerId: "3",
    customerName: "Michelle T.",
    rating: 5,
    comment: "Premium service is an understatement. Aisha uses professional-grade equipment and the results speak for themselves. My home has never been cleaner.",
    date: "2026-02-22",
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
