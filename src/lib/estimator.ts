// AI-powered cleaning estimate engine.
// Takes room details from the customer and produces a recommended duration,
// service type, and price range. This runs locally (no external API needed)
// using a rule-based model that can later be swapped for a real ML model.

export interface RoomDetail {
  type: string;
  size: "small" | "medium" | "large";
  condition: "light" | "moderate" | "heavy";
}

export interface HomeDetails {
  rooms: RoomDetail[];
  hasPets: boolean;
  extras: string[]; // e.g. "inside-oven", "inside-fridge", "windows", "laundry"
}

export interface CleaningEstimate {
  recommendedDuration: number; // hours
  recommendedServiceType: string;
  durationRange: { min: number; max: number };
  breakdown: RoomEstimate[];
  extrasTime: number;
  tips: string[];
}

interface RoomEstimate {
  room: string;
  estimatedMinutes: number;
  note: string;
}

// Base minutes per room type
const ROOM_BASE_MINUTES: Record<string, number> = {
  bedroom: 20,
  bathroom: 25,
  kitchen: 30,
  "living-room": 20,
  "dining-room": 15,
  office: 15,
  hallway: 10,
  laundry: 10,
  garage: 20,
  other: 15,
};

// Multipliers
const SIZE_MULTIPLIER: Record<string, number> = {
  small: 0.75,
  medium: 1.0,
  large: 1.5,
};

const CONDITION_MULTIPLIER: Record<string, number> = {
  light: 0.7,
  moderate: 1.0,
  heavy: 1.5,
};

const EXTRA_MINUTES: Record<string, number> = {
  "inside-oven": 20,
  "inside-fridge": 15,
  windows: 25,
  laundry: 20,
  "organize-closets": 30,
  "wall-marks": 15,
  balcony: 15,
};

export function generateEstimate(details: HomeDetails): CleaningEstimate {
  const breakdown: RoomEstimate[] = [];
  let totalMinutes = 0;

  for (const room of details.rooms) {
    const base = ROOM_BASE_MINUTES[room.type] ?? 15;
    const sizeMultiplier = SIZE_MULTIPLIER[room.size] ?? 1;
    const condMultiplier = CONDITION_MULTIPLIER[room.condition] ?? 1;

    let minutes = Math.round(base * sizeMultiplier * condMultiplier);

    let note = "";
    if (room.condition === "heavy") {
      note = "Deep scrub needed";
    } else if (room.size === "large") {
      note = "Large space — extra time allocated";
    }

    breakdown.push({
      room: formatRoomName(room.type),
      estimatedMinutes: minutes,
      note,
    });

    totalMinutes += minutes;
  }

  // Pets add 15% time
  if (details.hasPets) {
    totalMinutes = Math.round(totalMinutes * 1.15);
  }

  // Extras
  let extrasTime = 0;
  for (const extra of details.extras) {
    extrasTime += EXTRA_MINUTES[extra] ?? 10;
  }
  totalMinutes += extrasTime;

  // Convert to hours (round up to nearest 0.5)
  const hours = Math.ceil((totalMinutes / 60) * 2) / 2;
  const minHours = Math.max(1, hours - 0.5);
  const maxHours = hours + 0.5;

  // Determine service type
  const hasHeavyRooms = details.rooms.some((r) => r.condition === "heavy");
  const roomCount = details.rooms.length;
  let recommendedServiceType = "standard";
  if (hasHeavyRooms || details.extras.length >= 3) {
    recommendedServiceType = "deep";
  } else if (roomCount <= 2 && !hasHeavyRooms) {
    recommendedServiceType = "standard";
  }

  // Generate helpful tips
  const tips: string[] = [];
  if (details.hasPets) {
    tips.push("Pet-friendly products will be used. Consider booking a cleaner with the Pet-Friendly specialty.");
  }
  if (hasHeavyRooms) {
    tips.push("Some rooms need heavy cleaning — a deep clean service is recommended for the best results.");
  }
  if (roomCount >= 6) {
    tips.push("For larger homes, you may want to consider splitting the job across two sessions for the best quality.");
  }
  if (details.extras.includes("inside-oven")) {
    tips.push("Oven cleaning works best when the oven is cool. Please turn it off at least 2 hours before your booking.");
  }

  return {
    recommendedDuration: hours,
    recommendedServiceType,
    durationRange: { min: minHours, max: maxHours },
    breakdown,
    extrasTime,
    tips,
  };
}

function formatRoomName(type: string): string {
  return type
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export const ROOM_TYPES = [
  { value: "bedroom", label: "Bedroom" },
  { value: "bathroom", label: "Bathroom" },
  { value: "kitchen", label: "Kitchen" },
  { value: "living-room", label: "Living Room" },
  { value: "dining-room", label: "Dining Room" },
  { value: "office", label: "Home Office" },
  { value: "hallway", label: "Hallway / Entrance" },
  { value: "laundry", label: "Laundry Room" },
  { value: "garage", label: "Garage" },
  { value: "other", label: "Other" },
];

export const EXTRA_SERVICES = [
  { value: "inside-oven", label: "Inside Oven" },
  { value: "inside-fridge", label: "Inside Fridge" },
  { value: "windows", label: "Interior Windows" },
  { value: "laundry", label: "Laundry (wash & fold)" },
  { value: "organize-closets", label: "Organize Closets" },
  { value: "wall-marks", label: "Wall Mark Removal" },
  { value: "balcony", label: "Balcony / Patio" },
];
