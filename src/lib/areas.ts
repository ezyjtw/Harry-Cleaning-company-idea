// A2 (James-ruled): the location-page launch list. Hand-ruled areas only — no
// wildcard generation. Every page renders LIVE data through the shared
// area-search service; an area with zero in-area cleaners 404s (the ruled
// 0-cleaner prune) and drops out of the sitemap.

export interface ServiceArea {
  slug: string;
  name: string;
  /** outward code used to anchor the area centroid (postcodes.io /outcodes) */
  outcode: string;
  /** display label for the postcode reality of the area */
  outcodeLabel: string;
  /** unique intro — genuinely local copy in the signed coverage/C2 voice */
  intro: string;
  /** FAQ: "Do you cover all of X?" answer */
  coversAnswer: string;
  /** cross-link slugs (rendered at the foot of the page) */
  neighbors: string[];
}

export const SERVICE_AREAS: ServiceArea[] = [
  {
    slug: 'chingford',
    name: 'Chingford',
    outcode: 'E4',
    outcodeLabel: 'E4',
    intro:
      'Looking for a cleaner in Chingford? Rena is proudly local — we serve north-east London and the surrounding areas of Essex, and E4 is home turf. Browse real local cleaners, compare their reviews and rates, and choose who comes to your door. The price you see is the price you pay.',
    coversAnswer:
      'Yes: Chingford Mount, Chingford Green, the Highams Park borders and the rest of E4. Enter your postcode to see exactly who covers your street.',
    neighbors: ['walthamstow', 'woodford-green', 'buckhurst-hill', 'loughton'],
  },
  {
    slug: 'walthamstow',
    name: 'Walthamstow',
    outcode: 'E17',
    outcodeLabel: 'E17',
    intro:
      'Walthamstow keeps busy, and E17 homes deserve better than agency roulette. Browse the vetted local cleaners serving Walthamstow, from the Village to Higham Hill, compare their reviews and rates, and choose who comes to your door.',
    coversAnswer:
      'Yes: Walthamstow Village, Higham Hill, Wood Street and the rest of E17. Enter your postcode to see exactly who covers your street.',
    neighbors: ['chingford', 'leyton', 'leytonstone', 'south-woodford'],
  },
  {
    slug: 'leyton',
    name: 'Leyton',
    outcode: 'E10',
    outcodeLabel: 'E10',
    intro:
      'From the Francis Road end to the marshes, Leyton sits squarely inside our patch. See the vetted cleaners serving E10, compare real reviews and rates, and pick the one that fits your home and your routine.',
    coversAnswer:
      'Yes: all of E10, from Francis Road to Lea Bridge. Enter your postcode to see exactly who covers your street.',
    neighbors: ['walthamstow', 'leytonstone', 'wanstead'],
  },
  {
    slug: 'leytonstone',
    name: 'Leytonstone',
    outcode: 'E11',
    outcodeLabel: 'E11',
    intro:
      'Leytonstone sits right at the heart of our north-east London coverage. Browse vetted local cleaners serving E11, read genuine reviews, and choose exactly who you let through the door, with the full price shown before you book.',
    coversAnswer:
      'Yes: Leytonstone and the E11 streets around it (Wanstead has its own page). Enter your postcode to see exactly who covers your street.',
    neighbors: ['leyton', 'wanstead', 'walthamstow', 'south-woodford'],
  },
  {
    slug: 'wanstead',
    name: 'Wanstead',
    outcode: 'E11',
    outcodeLabel: 'E11',
    intro:
      "Wanstead's period homes and flats take proper care. Browse the vetted cleaners covering E11, compare their reviews and rates, and choose someone you trust. The price you see is the price you pay.",
    coversAnswer:
      'Yes: Wanstead from the High Street up to Snaresbrook. Enter your postcode to see exactly who covers your street.',
    neighbors: ['leytonstone', 'south-woodford', 'woodford-green'],
  },
  {
    slug: 'south-woodford',
    name: 'South Woodford',
    outcode: 'E18',
    outcodeLabel: 'E18',
    intro:
      'South Woodford is home ground for our cleaners. See who covers E18, compare genuine reviews and transparent rates, and book in minutes. The full price is always shown before you confirm.',
    coversAnswer:
      'Yes: all of E18, both sides of George Lane. Enter your postcode to see exactly who covers your street.',
    neighbors: ['wanstead', 'woodford-green', 'walthamstow'],
  },
  {
    slug: 'woodford-green',
    name: 'Woodford Green',
    outcode: 'IG8',
    outcodeLabel: 'IG8',
    intro:
      'On the edge of Epping Forest, Woodford Green sits comfortably inside our Essex-side coverage. Browse vetted cleaners serving IG8, compare reviews and rates, and choose who comes to your door.',
    coversAnswer:
      'Yes: Woodford Green and the wider IG8, including Woodford Bridge. Enter your postcode to see exactly who covers your street.',
    neighbors: ['south-woodford', 'chingford', 'buckhurst-hill'],
  },
  {
    slug: 'buckhurst-hill',
    name: 'Buckhurst Hill',
    outcode: 'IG9',
    outcodeLabel: 'IG9',
    intro:
      'Buckhurst Hill sits on the Essex side of our patch, minutes from our east-London heartland. See the vetted cleaners covering IG9: real profiles, genuine reviews, upfront rates.',
    coversAnswer:
      'Yes: all of IG9, from Queens Road to the Roding Valley end. Enter your postcode to see exactly who covers your street.',
    neighbors: ['woodford-green', 'loughton', 'chingford'],
  },
  {
    slug: 'loughton',
    name: 'Loughton',
    outcode: 'IG10',
    outcodeLabel: 'IG10',
    intro:
      'Loughton marks the Essex edge of our coverage, and our cleaners are happy to make the trip. Browse who serves IG10, compare genuine reviews and rates, and book with the full price shown upfront.',
    coversAnswer:
      'Yes: Loughton and IG10, up to the Debden end. Enter your postcode to see exactly who covers your street.',
    neighbors: ['buckhurst-hill', 'woodford-green', 'chingford'],
  },
];

export function getServiceArea(slug: string): ServiceArea | undefined {
  return SERVICE_AREAS.find((a) => a.slug === slug);
}
