export type TravelMode = 'car' | 'public_transport' | 'bicycle' | 'walking';

export interface TravelEstimate {
  distanceKm: number;
  durationMinutes: number;
  travelFee: number;
}

export interface LocationCoords {
  latitude: number;
  longitude: number;
}

const SPEED_BY_MODE: Record<TravelMode, number> = {
  car: 30,
  public_transport: 20,
  bicycle: 15,
  walking: 5,
};

const MINIMUM_GAP_MINUTES = 30;
const TRAVEL_FEE_PER_KM = 0.5; // £0.50 per km
const FREE_TRAVEL_RADIUS_KM = 5;

export class TravelTimeService {
  /**
   * Calculate travel distance between two points using Haversine formula
   */
  static calculateDistance(from: LocationCoords, to: LocationCoords): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRadians(to.latitude - from.latitude);
    const dLon = this.toRadians(to.longitude - from.longitude);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(from.latitude)) *
        Math.cos(this.toRadians(to.latitude)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 100) / 100;
  }

  /**
   * Estimate travel time between two locations
   */
  static estimateTravelTime(
    from: LocationCoords,
    to: LocationCoords,
    travelMode: TravelMode = 'public_transport'
  ): TravelEstimate {
    const distanceKm = this.calculateDistance(from, to);
    const speedKmh = SPEED_BY_MODE[travelMode] || 20;
    const durationMinutes = Math.ceil((distanceKm / speedKmh) * 60);
    const travelFee =
      distanceKm > FREE_TRAVEL_RADIUS_KM
        ? Math.round((distanceKm - FREE_TRAVEL_RADIUS_KM) * TRAVEL_FEE_PER_KM * 100) / 100
        : 0;

    return { distanceKm, durationMinutes, travelFee };
  }

  /**
   * Calculate the minimum gap required between two bookings
   */
  static getMinimumGap(from: LocationCoords, to: LocationCoords): number {
    const travel = this.estimateTravelTime(from, to);
    return Math.max(MINIMUM_GAP_MINUTES, travel.durationMinutes + 15); // +15 min buffer
  }

  /**
   * Check if there's enough travel time between consecutive bookings
   */
  static hasAdequateTravelTime(
    previousEndTime: string,
    nextStartTime: string,
    from: LocationCoords,
    to: LocationCoords
  ): { adequate: boolean; gap: number; required: number } {
    const [prevH, prevM] = previousEndTime.split(':').map(Number);
    const [nextH, nextM] = nextStartTime.split(':').map(Number);
    const gap = nextH * 60 + nextM - (prevH * 60 + prevM);
    const required = this.getMinimumGap(from, to);

    return { adequate: gap >= required, gap, required };
  }

  /**
   * Calculate travel fee based on distance
   */
  static calculateTravelFee(distanceKm: number): number {
    if (distanceKm <= FREE_TRAVEL_RADIUS_KM) return 0;
    return Math.round((distanceKm - FREE_TRAVEL_RADIUS_KM) * TRAVEL_FEE_PER_KM * 100) / 100;
  }

  /**
   * Check if a location is within a cleaner's service radius
   */
  static isWithinServiceRadius(
    cleanerLocation: LocationCoords,
    bookingLocation: LocationCoords,
    serviceRadiusKm: number
  ): boolean {
    const distance = this.calculateDistance(cleanerLocation, bookingLocation);
    return distance <= serviceRadiusKm;
  }

  private static toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}
