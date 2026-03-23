# RENA — Pricing System Build Spec
**Version:** 1.0  
**For:** Claude Code  
**Scope:** Full pricing engine, database schema, API routes, and UI components for all Rena cleaning services  
**Stack:** Next.js 14 / TypeScript / Prisma / PostgreSQL / Tailwind

---

## 1. CONTEXT & PHILOSOPHY

Rena is a marketplace where customers browse and choose their own cleaner. Cleaners set their own advertised hourly rate. Rena takes a **platform fee on top** of the cleaner's rate — the customer sees the all-in price, the cleaner sees their agreed rate.

This is the **TaskRabbit model**, not the Housekeep model:
- TaskRabbit: cleaner sets rate, platform adds fee on top, cleaner keeps 100% of their rate
- Housekeep: platform sets rate, pays cleaner a fixed split

Rena operates a **split-fee model**:
- **Cleaner pays 10%** of their earnings as a platform fee (deducted from their payout)
- **Customer pays 5%** service fee on top of the cleaner rate
- Rena's total take per booking is therefore ~15% of the cleaner rate, split across both sides

This is a deliberate positioning choice — cleaners see a lower visible fee (10%) than a single-sided 15% model, and customers see a smaller surcharge (5%). Both sides feel like Rena is taking less than a pure marketplace while Rena earns the same total.

### Competitive Benchmarks (London, 2026)
| Platform | Model | Customer rate | Cleaner keeps |
|---|---|---|---|
| Housekeep | Agency sets rate | From £18.50/hr | ~60–65% |
| TaskRabbit | Self-set + 15% fee (customer only) | Cleaner rate + 15% | 100% of set rate |
| WeCasa | Fixed packages | £20–28/hr | ~70% |
| Rena target | Split fee: 10% cleaner / 5% customer | Cleaner rate + 5% | 90% of set rate |

### Market Rate Ranges (London 2026)
- Standard home cleaning: £18–£25/hr (customer-facing)
- Deep cleaning: £25–£35/hr (customer-facing)
- End of tenancy: £175–£500 (fixed, by property size)
- Airbnb turnaround: £55–£165 (fixed, by bedrooms)
- Same-day premium: +25–30% on standard rate

---

## 2. PRICING RULES ENGINE

### 2.1 Core Formula

**Hourly services (regular, one-off, same-day, deep):**
```
cleaner_gross    = cleaner_rate * hours * service_multiplier * frequency_multiplier
cleaner_fee      = cleaner_gross * 0.10          ← Rena deducts 10% from cleaner payout
cleaner_earns    = cleaner_gross * 0.90          ← cleaner receives 90% of their gross
customer_subtotal = cleaner_gross
customer_fee     = cleaner_gross * 0.05          ← 5% service fee added on top for customer
total_charged    = cleaner_gross * 1.05          ← what customer pays
rena_total_take  = cleaner_fee + customer_fee    ← ~15% of cleaner_gross
```

**Airbnb fixed-price:**
```
deep_rate        = cleaner_standard_rate * deep_multiplier (1.45)
cleaner_base     = deep_rate * estimated_hours
                 ← cleaner always paid at deep rate for Airbnb, no deduction
cleaner_addon    = addon_price * 0.85
                 ← cleaner keeps 85% of each add-on charged to customer
rena_addon       = addon_price * 0.15
                 ← Rena keeps 15% of each add-on
customer_price   = fixed_table_price + addon_total
rena_earns       = customer_price - cleaner_base - cleaner_addon_total
```

**End of Tenancy fixed-price:**
```
deep_rate        = cleaner_standard_rate * deep_multiplier (1.45)
cleaner_base     = deep_rate * estimated_hours * 1.10
                 ← EOT cleaners receive an additional 10% on top of their deep rate
                 ← this reflects the extra thoroughness EOT requires vs a standard deep clean
cleaner_addon    = addon_price * 0.85
                 ← cleaner keeps 85% of each add-on charged to customer
rena_addon       = addon_price * 0.15
customer_price   = fixed_table_price + addon_total
rena_earns       = customer_price - cleaner_base - cleaner_addon_total
```

> **Why no platform fee deduction for EOT/Airbnb?** These are fixed-price jobs. The cleaner accepts the booking knowing the fixed fee — there is no hourly rate for Rena to take a percentage of. Rena's margin is already embedded in the spread between the fixed customer price and the cleaner payout. Showing a separate fee deduction here would be confusing and feel unfair to cleaners on intensive jobs.

> **Why deep rate + 10% bonus for EOT?** EOT is the most demanding service — every appliance, every cupboard, full inventory standard. The 10% uplift rewards cleaners appropriately and makes EOT the most attractive booking type on the platform, driving supply where you need it most.

> **Why 85% of add-ons to cleaner?** The cleaner does the additional work, so they should earn the majority of it. Rena keeps 15% to cover payment processing and support costs on the extra transaction value.

> **Important:** Never recalculate pricing from live config after a booking is confirmed. Snapshot all values at booking creation time.

### 2.2 Service Multipliers

| Service | Multiplier | Notes |
|---|---|---|
| Regular cleaning (weekly) | 1.00 | Base rate |
| Regular cleaning (fortnightly) | 1.05 | Slight premium for less frequent |
| One-off clean | 1.15 | Higher as no recurring relationship |
| Same-day clean | 1.30 | Urgency premium |
| Deep clean | 1.45 | Labour intensity premium |

### 2.3 Frequency Discounts (applied to regular bookings)

| Frequency | Customer discount | Purpose |
|---|---|---|
| Weekly | 0% (base) | Best value, drives LTV |
| Fortnightly | 0% (slight multiplier instead) | Still recurring |
| One-off | No discount, +15% | Compensates lack of retention |

### 2.4 Minimum Booking Rules

| Service | Minimum hours | Minimum charge |
|---|---|---|
| Regular (weekly/fortnightly) | 2 hrs | — |
| One-off | 2 hrs | — |
| Same-day | 2 hrs | — |
| Deep clean | 3 hrs | — |
| EOT | Fixed price | See EOT table |
| Airbnb | Fixed price | See Airbnb table |

### 2.5 End of Tenancy — Fixed Price Table

Customer prices are fixed. Cleaner is paid at their deep clean rate × estimated hours × 1.10 (EOT bonus). Rena earns the delta. No platform fee is shown or deducted from the cleaner's base pay.

| Property | Est. hours | Min. customer price | Notes |
|---|---|---|---|
| Studio | 4 hrs | £175 | 1 cleaner |
| 1 bed | 5 hrs | £220 | 1 cleaner |
| 2 bed | 6 hrs | £280 | 1–2 cleaners |
| 3 bed | 8 hrs | £350 | 2 cleaners |
| 4 bed | 10 hrs | £430 | 2–3 cleaners |
| 5 bed+ | 13 hrs | £550 | 3 cleaners |

**EOT Add-ons (optional, customer selects):**
Cleaner keeps 85% of each add-on price. Rena keeps 15%.

| Add-on | Customer price | Cleaner earns |
|---|---|---|
| Oven deep clean | +£40 | +£34 |
| Carpet deep clean (per room) | +£45 | +£38.25 |
| Interior window clean | +£25 | +£21.25 |
| Fridge clean | +£20 | +£17 |

### 2.6 Airbnb Turnaround — Fixed Price Table

Customer prices are fixed. Cleaner is paid at their deep clean rate × estimated hours. No platform fee is shown or deducted from the cleaner's base pay. Linen change included as standard.

| Property | Est. hours | Customer price | Market range |
|---|---|---|---|
| Studio | 1.5 hrs | £55 | £45–£65 |
| 1 bed | 2 hrs | £75 | £55–£85 |
| 2 bed | 2.5 hrs | £95 | £75–£110 |
| 3 bed | 3.5 hrs | £120 | £95–£140 |
| 4 bed+ | 4.5 hrs | £155 | £130–£165 |

**Airbnb Add-ons:**
Cleaner keeps 85% of each add-on price. Rena keeps 15%.

| Add-on | Customer price | Cleaner earns |
|---|---|---|
| Same-day turnaround (under 3hr notice) | +£25 | +£21.25 |
| Post-party deep clean | +£40 | +£34 |

---

## 3. DATABASE SCHEMA

Add the following to `schema.prisma`:

```prisma
// ─── Pricing Engine ───────────────────────────────────────────

model ServiceType {
  id                String   @id @default(cuid())
  slug              String   @unique  // "regular", "one-off", "same-day", "deep", "eot", "airbnb"
  name              String
  pricingModel      PricingModel     // HOURLY | FIXED
  baseMultiplier    Float            // 1.0 for regular, 1.15 for one-off, etc
  minimumHours      Float?           // null for fixed-price services
  minimumCharge     Float?
  isActive          Boolean  @default(true)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  bookings          Booking[]
  fixedPrices       FixedServicePrice[]
  addons            ServiceAddon[]
}

enum PricingModel {
  HOURLY
  FIXED
}

model FixedServicePrice {
  id              String   @id @default(cuid())
  serviceTypeId   String
  serviceType     ServiceType @relation(fields: [serviceTypeId], references: [id])
  propertySize    PropertySize  // STUDIO | ONE_BED | TWO_BED | THREE_BED | FOUR_BED | FIVE_PLUS
  estimatedHours  Float
  customerPrice   Float         // what customer pays (incl. platform fee)
  createdAt       DateTime @default(now())

  @@unique([serviceTypeId, propertySize])
}

enum PropertySize {
  STUDIO
  ONE_BED
  TWO_BED
  THREE_BED
  FOUR_BED
  FIVE_PLUS
}

model ServiceAddon {
  id            String   @id @default(cuid())
  serviceTypeId String
  serviceType   ServiceType @relation(fields: [serviceTypeId], references: [id])
  name          String
  price         Float
  isActive      Boolean  @default(true)

  bookingAddons BookingAddon[]
}

model PlatformConfig {
  id              String   @id @default(cuid())
  key             String   @unique
  value           String
  description     String?
  updatedAt       DateTime @updatedAt
  // key examples:
  // "cleaner_fee_pct"        → "0.10"   ← deducted from cleaner payout
  // "customer_fee_pct"       → "0.05"   ← added on top for customer
  // "same_day_multiplier"    → "1.30"
  // "one_off_multiplier"     → "1.15"
  // "fortnightly_multiplier" → "1.05"
  // "deep_multiplier"        → "1.45"   ← also used to derive deep rate for EOT/Airbnb
  // "min_cleaner_rate"       → "14.00"
  // "max_cleaner_rate"       → "35.00"
}

model Booking {
  id                String   @id @default(cuid())
  customerId        String
  cleanerId         String
  serviceTypeId     String
  serviceType       ServiceType @relation(fields: [serviceTypeId], references: [id])

  // Pricing snapshot at time of booking (never recalculate from live rates)
  cleanerHourlyRate     Float              // cleaner's standard rate at booking time
  cleanerDeepRate       Float?             // derived deep rate (standard * 1.45) — set for EOT/Airbnb
  hours                 Float?             // null for fixed-price
  propertySize          PropertySize?      // for EOT/Airbnb
  frequency             BookingFrequency?  // WEEKLY | FORTNIGHTLY | ONE_OFF
  serviceMultiplier     Float              // multiplier applied
  cleanerGross          Float              // rate * hours * multiplier (before cleaner fee deduction)
  cleanerFee            Float              // 10% deducted from cleaner (Rena's cut from cleaner side)
  cleanerEarns          Float              // cleanerGross * 0.90 — what cleaner actually receives
  customerSubtotal      Float              // = cleanerGross (or fixed price before customer fee)
  customerServiceFee    Float              // 5% added on top for customer (hourly) or embedded (fixed)
  addonTotal            Float              @default(0)
  totalCharged          Float              // what customer pays in full
  renaEarns             Float              // cleanerFee + customerServiceFee (or delta for fixed)

  status            BookingStatus @default(PENDING)
  scheduledAt       DateTime
  completedAt       DateTime?

  addons            BookingAddon[]
  customer          User     @relation("CustomerBookings", fields: [customerId], references: [id])
  cleaner           User     @relation("CleanerBookings", fields: [cleanerId], references: [id])

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}

model BookingAddon {
  id          String   @id @default(cuid())
  bookingId   String
  booking     Booking  @relation(fields: [bookingId], references: [id])
  addonId     String
  addon       ServiceAddon @relation(fields: [addonId], references: [id])
  price       Float    // snapshot price at time of booking

  @@unique([bookingId, addonId])
}

enum BookingFrequency {
  WEEKLY
  FORTNIGHTLY
  ONE_OFF
}

enum BookingStatus {
  PENDING
  CONFIRMED
  IN_PROGRESS
  COMPLETED
  CANCELLED
  DISPUTED
}
```

---

## 4. SEED DATA

Create `prisma/seeds/pricing.ts`:

```typescript
const serviceTypes = [
  {
    slug: 'regular',
    name: 'Regular Cleaning',
    pricingModel: 'HOURLY',
    baseMultiplier: 1.0,
    minimumHours: 2.0,
  },
  {
    slug: 'one-off',
    name: 'One-Off Cleaning',
    pricingModel: 'HOURLY',
    baseMultiplier: 1.15,
    minimumHours: 2.0,
  },
  {
    slug: 'same-day',
    name: 'Same-Day Cleaning',
    pricingModel: 'HOURLY',
    baseMultiplier: 1.30,
    minimumHours: 2.0,
  },
  {
    slug: 'deep',
    name: 'Deep Cleaning',
    pricingModel: 'HOURLY',
    baseMultiplier: 1.45,
    minimumHours: 3.0,
  },
  {
    slug: 'eot',
    name: 'End of Tenancy',
    pricingModel: 'FIXED',
    baseMultiplier: 1.0,
    minimumHours: null,
  },
  {
    slug: 'airbnb',
    name: 'Airbnb Cleaning',
    pricingModel: 'FIXED',
    baseMultiplier: 1.0,
    minimumHours: null,
  },
];

const fixedPrices = {
  eot: [
    { propertySize: 'STUDIO',    estimatedHours: 4,  customerPrice: 175 },
    { propertySize: 'ONE_BED',   estimatedHours: 5,  customerPrice: 220 },
    { propertySize: 'TWO_BED',   estimatedHours: 6,  customerPrice: 280 },
    { propertySize: 'THREE_BED', estimatedHours: 8,  customerPrice: 350 },
    { propertySize: 'FOUR_BED',  estimatedHours: 10, customerPrice: 430 },
    { propertySize: 'FIVE_PLUS', estimatedHours: 13, customerPrice: 550 },
  ],
  airbnb: [
    { propertySize: 'STUDIO',    estimatedHours: 1.5, customerPrice: 55  },
    { propertySize: 'ONE_BED',   estimatedHours: 2,   customerPrice: 75  },
    { propertySize: 'TWO_BED',   estimatedHours: 2.5, customerPrice: 95  },
    { propertySize: 'THREE_BED', estimatedHours: 3.5, customerPrice: 120 },
    { propertySize: 'FOUR_BED',  estimatedHours: 4.5, customerPrice: 155 },
  ],
};

const platformConfig = [
  { key: 'cleaner_fee_pct',        value: '0.10',  description: 'Platform fee deducted from cleaner payout (10%)' },
  { key: 'customer_fee_pct',       value: '0.05',  description: 'Service fee added on top for customer (5%)' },
  { key: 'same_day_multiplier',    value: '1.30',  description: 'Urgency multiplier for same-day bookings' },
  { key: 'one_off_multiplier',     value: '1.15',  description: 'One-off booking premium' },
  { key: 'fortnightly_multiplier', value: '1.05',  description: 'Fortnightly vs weekly premium' },
  { key: 'deep_multiplier',        value: '1.45',  description: 'Deep clean labour intensity premium — also applied to derive cleaner deep rate for EOT/Airbnb' },
  { key: 'min_cleaner_rate',       value: '14.00', description: 'Minimum advertised cleaner hourly rate' },
  { key: 'max_cleaner_rate',       value: '35.00', description: 'Maximum advertised cleaner hourly rate' },
];
```

---

## 5. PRICING SERVICE

Create `src/lib/services/pricing.service.ts`:

```typescript
import { prisma } from '@/lib/prisma';
import Decimal from 'decimal.js';

export interface QuoteInput {
  serviceSlug: 'regular' | 'one-off' | 'same-day' | 'deep' | 'eot' | 'airbnb';
  cleanerHourlyRate: number;        // cleaner's advertised standard rate
  hours?: number;                   // required for hourly services
  propertySize?: string;            // required for EOT and Airbnb
  frequency?: 'WEEKLY' | 'FORTNIGHTLY' | 'ONE_OFF';
  addons?: string[];                // addon IDs
}

export interface QuoteResult {
  serviceType: string;
  cleanerHourlyRate: number;
  cleanerDeepRate: number | null;   // derived for EOT/Airbnb
  hours: number | null;
  propertySize: string | null;
  isFixedPrice: boolean;

  // Cleaner side
  cleanerGross: number;             // what cleaner earns before Rena's 10% cut
  cleanerFee: number;               // 10% deducted — Rena's cut from cleaner
  cleanerEarns: number;             // net payout to cleaner

  // Customer side
  customerSubtotal: number;         // base price before 5% service fee
  customerServiceFee: number;       // 5% on top (hourly) or embedded (fixed)
  addonTotal: number;
  totalCharged: number;             // customer pays this

  // Rena
  renaEarns: number;                // total Rena revenue on this booking
  breakdown: string;
}

export class PricingService {

  private async getConfig(): Promise<Record<string, number>> {
    const configs = await prisma.platformConfig.findMany();
    return Object.fromEntries(
      configs.map(c => [c.key, parseFloat(c.value)])
    );
  }

  async calculateQuote(input: QuoteInput): Promise<QuoteResult> {
    const config = await this.getConfig();
    const cleanerFeePct   = config['cleaner_fee_pct'];    // 0.10
    const customerFeePct  = config['customer_fee_pct'];   // 0.05
    const deepMultiplier  = config['deep_multiplier'];    // 1.45

    const serviceType = await prisma.serviceType.findUnique({
      where: { slug: input.serviceSlug },
      include: { fixedPrices: true, addons: true },
    });

    if (!serviceType) throw new Error(`Unknown service: ${input.serviceSlug}`);

    // ── Fixed-price services (EOT, Airbnb) ───────────────────────
    if (serviceType.pricingModel === 'FIXED') {
      if (!input.propertySize) {
        throw new Error('propertySize required for fixed-price services');
      }

      const fixedPrice = serviceType.fixedPrices.find(
        fp => fp.propertySize === input.propertySize
      );
      if (!fixedPrice) throw new Error(`No price found for ${input.propertySize}`);

      // Use deep rate for cleaner payout on intensive fixed-price jobs
      const cleanerDeepRate = new Decimal(input.cleanerHourlyRate)
        .mul(deepMultiplier)
        .toDecimalPlaces(2)
        .toNumber();

      const cleanerGross = new Decimal(cleanerDeepRate)
        .mul(fixedPrice.estimatedHours)
        .toDecimalPlaces(2)
        .toNumber();

      const cleanerFee = new Decimal(cleanerGross)
        .mul(cleanerFeePct)
        .toDecimalPlaces(2)
        .toNumber();

      const cleanerEarns = new Decimal(cleanerGross)
        .minus(cleanerFee)
        .toDecimalPlaces(2)
        .toNumber();

      const addonTotal = await this.calcAddonTotal(input.addons ?? [], serviceType.addons);
      const totalCharged = fixedPrice.customerPrice + addonTotal;
      // Customer fee is embedded in fixed price — not added on top
      const customerServiceFee = 0;

      const renaEarns = new Decimal(totalCharged)
        .minus(cleanerEarns)
        .toDecimalPlaces(2)
        .toNumber();

      return {
        serviceType: serviceType.name,
        cleanerHourlyRate: input.cleanerHourlyRate,
        cleanerDeepRate,
        hours: fixedPrice.estimatedHours,
        propertySize: input.propertySize,
        isFixedPrice: true,
        cleanerGross,
        cleanerFee,
        cleanerEarns,
        customerSubtotal: fixedPrice.customerPrice,
        customerServiceFee,
        addonTotal,
        totalCharged,
        renaEarns,
        breakdown: `Fixed price £${fixedPrice.customerPrice}. Cleaner paid at deep rate £${cleanerDeepRate}/hr × ${fixedPrice.estimatedHours} hrs = £${cleanerGross} gross, earns £${cleanerEarns} after 10% Rena fee. Rena keeps £${renaEarns}.`,
      };
    }

    // ── Hourly services ───────────────────────────────────────────
    if (!input.hours) throw new Error('hours required for hourly services');

    const minHours = serviceType.minimumHours ?? 2;
    const hours = Math.max(input.hours, minHours);

    let multiplier = serviceType.baseMultiplier;
    if (input.serviceSlug === 'regular' && input.frequency === 'FORTNIGHTLY') {
      multiplier = new Decimal(multiplier).mul(config['fortnightly_multiplier']).toNumber();
    }

    const cleanerGross = new Decimal(input.cleanerHourlyRate)
      .mul(hours)
      .mul(multiplier)
      .toDecimalPlaces(2)
      .toNumber();

    const cleanerFee = new Decimal(cleanerGross)
      .mul(cleanerFeePct)
      .toDecimalPlaces(2)
      .toNumber();

    const cleanerEarns = new Decimal(cleanerGross)
      .minus(cleanerFee)
      .toDecimalPlaces(2)
      .toNumber();

    const customerServiceFee = new Decimal(cleanerGross)
      .mul(customerFeePct)
      .toDecimalPlaces(2)
      .toNumber();

    const addonTotal = await this.calcAddonTotal(input.addons ?? [], serviceType.addons);

    const totalCharged = new Decimal(cleanerGross)
      .plus(customerServiceFee)
      .plus(addonTotal)
      .toDecimalPlaces(2)
      .toNumber();

    const renaEarns = new Decimal(cleanerFee)
      .plus(customerServiceFee)
      .toDecimalPlaces(2)
      .toNumber();

    return {
      serviceType: serviceType.name,
      cleanerHourlyRate: input.cleanerHourlyRate,
      cleanerDeepRate: null,
      hours,
      propertySize: null,
      isFixedPrice: false,
      cleanerGross,
      cleanerFee,
      cleanerEarns,
      customerSubtotal: cleanerGross,
      customerServiceFee,
      addonTotal,
      totalCharged,
      renaEarns,
      breakdown: `${hours} hrs × £${input.cleanerHourlyRate}/hr × ${multiplier}x = £${cleanerGross}. Customer pays £${customerServiceFee} service fee (5%). Cleaner pays £${cleanerFee} platform fee (10%). Rena earns £${renaEarns}.`,
    };
  }

  private async calcAddonTotal(
    addonIds: string[],
    available: { id: string; price: number }[]
  ): Promise<number> {
    if (!addonIds.length) return 0;
    const matched = available.filter(a => addonIds.includes(a.id));
    return matched.reduce((sum, a) => sum + a.price, 0);
  }

  /**
   * Validate a cleaner's proposed hourly rate against platform min/max.
   */
  async validateCleanerRate(rate: number): Promise<{ valid: boolean; message?: string }> {
    const config = await this.getConfig();
    const min = config['min_cleaner_rate'];
    const max = config['max_cleaner_rate'];
    if (rate < min) return { valid: false, message: `Minimum rate is £${min}/hr` };
    if (rate > max) return { valid: false, message: `Maximum rate is £${max}/hr` };
    return { valid: true };
  }
}

export const pricingService = new PricingService();
```

---

## 6. API ROUTES

### 6.1 Quote Endpoint
**File:** `src/app/api/pricing/quote/route.ts`

```typescript
// POST /api/pricing/quote
// Body: QuoteInput
// Returns: QuoteResult
// Auth: None (public — used by quote widget before login)

import { NextRequest, NextResponse } from 'next/server';
import { pricingService } from '@/lib/services/pricing.service';
import { z } from 'zod';

const schema = z.object({
  serviceSlug: z.enum(['regular', 'one-off', 'same-day', 'deep', 'eot', 'airbnb']),
  cleanerHourlyRate: z.number().min(14).max(35),
  hours: z.number().min(2).max(12).optional(),
  propertySize: z.enum(['STUDIO','ONE_BED','TWO_BED','THREE_BED','FOUR_BED','FIVE_PLUS']).optional(),
  frequency: z.enum(['WEEKLY','FORTNIGHTLY','ONE_OFF']).optional(),
  addons: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = schema.parse(body);
    const quote = await pricingService.calculateQuote(input);
    return NextResponse.json(quote);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to calculate quote' }, { status: 500 });
  }
}
```

### 6.2 Services Endpoint
**File:** `src/app/api/pricing/services/route.ts`

```typescript
// GET /api/pricing/services
// Returns all active service types with their fixed prices and addons
// Auth: None (public)
```

### 6.3 Admin Config Endpoint
**File:** `src/app/api/admin/pricing/config/route.ts`

```typescript
// GET  /api/admin/pricing/config  — returns all PlatformConfig entries
// POST /api/admin/pricing/config  — updates a config value by key
// Auth: ADMIN role required
// This allows fee % and multipliers to be adjusted without a redeploy
```

---

## 7. QUOTE WIDGET — USE EXISTING COMPONENT

**Do NOT rebuild the quote widget.** The existing widget on the homepage is already designed and working. The only task here is to wire the existing widget up to the new `/api/pricing/quote` endpoint.

### What to change in the existing widget

**Stage 2 (property details) — add fixed price display for EOT and Airbnb:**
- When service is `eot` or `airbnb` and the user selects a bedroom count, immediately fetch and display the fixed price from the API — no hours input needed for these services
- For hourly services, the hours slider and existing logic remains unchanged

**Stage 3 (price reveal) — update the price calculation call:**
```typescript
// Replace any hardcoded pricing logic in the widget with a fetch to:
// POST /api/pricing/quote
// Body: { serviceSlug, cleanerHourlyRate: 14, hours, propertySize, frequency, addons }
// Use £14 as the floor rate for the initial quote (before cleaner is selected)
// Re-calculate server-side with actual cleaner rate at booking confirmation
```

**Price breakdown display — update labels to reflect split fee:**
```
// Show to customer:
Cleaner rate:     £X
Service fee (5%): £Y       ← rename from "platform fee" to "service fee"
─────────────────────
Total:            £Z

// Do NOT show the cleaner's 10% fee to the customer — that is internal
```

**Add-ons checkboxes (EOT and Airbnb only):**
- After price is revealed for EOT, show checkboxes for: Oven deep clean (+£40), Carpet deep clean per room (+£45), Interior window clean (+£25), Fridge clean (+£20)
- After price is revealed for Airbnb, show checkboxes for: Same-day turnaround (+£25), Post-party deep clean (+£40)
- Re-fetch quote total when add-ons are toggled (debounce 300ms)

**Store quote in sessionStorage** so it survives navigation to the cleaner browse page and back. Key: `rena_active_quote`.

**NEVER treat the widget quote as final.** Always recalculate server-side when the booking is confirmed with the actual selected cleaner's rate.

---

## 8. CLEANER RATE DISPLAY RULES

Cleaners advertise their own hourly rate. The customer sees a slightly higher rate (cleaner rate + 5% service fee). The cleaner sees their gross rate but is told Rena deducts 10% at payout.

```typescript
// What to display on cleaner card (customer view)
const cleanerRate   = cleaner.hourlyRate;                         // e.g. £16/hr
const customerRate  = new Decimal(cleanerRate).mul(1.05);         // + 5% service fee
const displayTotal  = customerRate.toDecimalPlaces(2).toNumber(); // e.g. £16.80/hr

// What to display on cleaner dashboard (cleaner view)
const grossEarnings = cleanerRate * hours;                        // e.g. £48 for 3hrs
const renaFee       = new Decimal(grossEarnings).mul(0.10);       // £4.80
const netEarnings   = new Decimal(grossEarnings).mul(0.90);       // £43.20

// Customer-facing card shows:
// "£16.80/hr" (their rate + 5% service fee)
// Do NOT show "inc. service fee" — just show the number

// Cleaner dashboard shows:
// "Your rate: £16/hr"
// "Rena platform fee: 10% (£X deducted from your payout)"
// "You receive: £Y per visit"
```

**Important:** Never display the raw cleaner rate to customers as the price — always show rate × 1.05. Never show the cleaner their net rate on their profile page — show gross, then explain the 10% deduction separately in their earnings view.

---

## 9. CLEANER RATE GUARDRAILS

When a cleaner sets their rate during onboarding:

```typescript
// Minimum: £14.00/hr (above £12.21 NMW, accounts for self-employment costs)
// Maximum: £35.00/hr (above this, enforce manual review)
// Suggested range shown to cleaner: £15–£22/hr
// If rate < £14: block with message "Minimum rate on Rena is £14/hr"
// If rate > £35: flag for admin review before publishing profile
```

Show cleaner what they'll earn per typical booking:
```
Your rate: £16/hr
Rena platform fee: 10% (deducted from your payout)

2hr visit: you earn £28.80  (gross £32, minus £3.20 fee)
3hr visit: you earn £43.20  (gross £48, minus £4.80 fee)
4hr visit: you earn £57.60  (gross £64, minus £6.40 fee)

The customer pays a separate 5% service fee — your advertised rate is what you charge.
```

---

## 10. ADMIN PRICING DASHBOARD

**File:** `src/app/admin/pricing/page.tsx`

A protected admin page (role: ADMIN) with:

1. **Platform Config Panel** — edit all `PlatformConfig` values with live save
   - Platform fee %
   - All service multipliers
   - Min/max cleaner rate

2. **Fixed Price Editor** — table of EOT and Airbnb prices editable per property size

3. **Margin Calculator** — given current config, show estimated margin at min, mid, and max cleaner rates

4. **Booking Revenue Summary** — last 30 days: total bookings, GMV, platform revenue, avg margin %

---

## 11. VALIDATION & ERROR CASES

Handle all of these gracefully in both API and UI:

| Error | User-facing message |
|---|---|
| Cleaner rate below minimum | "This cleaner's rate is below our minimum. Please contact support." |
| Hours below minimum | "Minimum booking is X hours for this service." |
| Invalid property size for EOT/Airbnb | "Please select a valid property size." |
| Postcode not in service area | "We don't currently cover this postcode — enter your email to be notified." |
| Price calculation mismatch | "We couldn't calculate a price. Please try again or contact us." |
| Addon not available for service | Silently filter out invalid addons server-side |

---

## 12. IMPORTANT IMPLEMENTATION NOTES

### Money Arithmetic
**Always use `decimal.js` for all price calculations.** Never use JavaScript float arithmetic for money.

```typescript
// ❌ WRONG
const total = 18.50 * 3 * 1.15;  // floating point errors

// ✅ CORRECT
import Decimal from 'decimal.js';
const total = new Decimal(18.50).mul(3).mul(1.15).toDecimalPlaces(2).toNumber();
```

Install: `npm install decimal.js`

### Price Snapshots
When a booking is created, **snapshot all pricing values** into the Booking record. Never recalculate from live config at a later date — rates may have changed.

### Platform Fee Visibility

**Hourly services (regular, one-off, same-day, deep):**
- Show the 5% service fee to customer in the quote breakdown (transparency builds trust)
- Do NOT show fee on the main price — show the total only
- On cleaner-facing views: show gross earnings, then "Rena platform fee: 10%", then net payout

**EOT and Airbnb — do NOT show any platform fee:**
- Customer sees: fixed price total only. No fee breakdown, no service fee line.
- Cleaner sees: "You will be paid £X for this job" — their deep rate × hours (× 1.10 for EOT)
- Cleaner also sees per add-on: "You earn £Y if the customer selects [add-on]"
- Never show the delta between customer price and cleaner payout on these services — that is Rena's internal margin and should not be visible to either party

### Recurring Booking Pricing
For weekly/fortnightly bookings, the price shown is **per visit**. Show this clearly:
- "£54.00 per visit" not "£54.00"
- "Billed after each clean"
- Do not bill upfront for future visits

### Same-Day Cutoff
Same-day bookings are only available before 12:00 noon for same-day delivery. After noon, the next available is next-day. Implement this check in the booking creation route.

```typescript
const isSameDay = (scheduledAt: Date): boolean => {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setHours(12, 0, 0, 0);
  return (
    scheduledAt.toDateString() === now.toDateString() &&
    now < cutoff
  );
};
```

---

## 13. BUILD ORDER

Execute in this sequence:

1. `schema.prisma` — add all new models
2. `prisma migrate dev --name add-pricing-engine`
3. `prisma/seeds/pricing.ts` — seed service types, fixed prices, config
4. `src/lib/services/pricing.service.ts` — core calculation logic
5. `src/app/api/pricing/quote/route.ts` — public quote endpoint
6. `src/app/api/pricing/services/route.ts` — services list endpoint
7. `src/app/api/admin/pricing/config/route.ts` — admin config endpoint
8. **Update existing quote widget** — wire to `/api/pricing/quote`, update fee labels, add EOT/Airbnb fixed price display and add-on checkboxes (do not rebuild the widget)
9. Update cleaner profile flow to include rate validation and 10% fee disclosure
10. `src/app/admin/pricing/page.tsx` — admin dashboard
11. Integration tests for `PricingService.calculateQuote()` covering all 6 service types

---

## 14. TEST CASES

Write tests in `src/lib/services/__tests__/pricing.service.test.ts`:

```typescript
describe('PricingService', () => {

  // Hourly — split fee verification
  it('regular weekly 3hrs at £16/hr: gross £48, cleaner earns £43.20 (90%), customer pays £50.40 (gross + 5%)', ...)
  it('regular fortnightly: applies 1.05 multiplier before fee split', ...)
  it('one-off: applies 1.15 multiplier before fee split', ...)
  it('same-day: applies 1.30 multiplier before fee split', ...)
  it('deep clean: minimum 3hrs enforced', ...)

  // Fixed price — EOT (deep rate × hours × 1.10 bonus, no fee deduction)
  it('EOT 2-bed at £16/hr: deep rate = £23.20, × 6hrs × 1.10 = cleaner earns £153.12', ...)
  it('EOT with oven addon: cleaner earns £34 (85% of £40), Rena keeps £6', ...)
  it('EOT with carpet deep clean addon: cleaner earns £38.25 (85% of £45)', ...)
  it('EOT: no platform fee deducted from cleaner base pay', ...)
  it('EOT: customer sees fixed total only, no fee breakdown', ...)

  // Fixed price — Airbnb (deep rate × hours, no fee deduction, no EOT bonus)
  it('Airbnb 1-bed at £16/hr: deep rate = £23.20, × 2hrs = cleaner earns £46.40', ...)
  it('Airbnb same-day addon: cleaner earns £21.25 (85% of £25)', ...)
  it('Airbnb post-party addon: cleaner earns £34 (85% of £40)', ...)
  it('Airbnb: no platform fee deducted from cleaner base pay', ...)
  it('Airbnb: customer sees fixed total only, no fee breakdown', ...)

  // Fee split correctness
  it('rena_total = cleaner_fee (10%) + customer_fee (5%) = ~15% of gross on hourly', ...)
  it('cleaner earns exactly 90% of gross on hourly bookings', ...)
  it('customer pays exactly gross × 1.05 on hourly bookings', ...)

  // Guardrails
  it('cleaner rate validation rejects below £14', ...)
  it('cleaner rate validation rejects above £35', ...)
  it('decimal precision: no floating point errors on any calculation', ...)

})
```

---

## 15. SUMMARY — KEY NUMBERS TO REMEMBER

| Metric | Value |
|---|---|
| Cleaner platform fee | 10% deducted from cleaner payout |
| Customer service fee | 5% added on top of cleaner rate |
| Rena total take (hourly) | ~15% of cleaner gross |
| EOT cleaner base pay | Deep rate × hours × 1.10 (EOT bonus) |
| Airbnb cleaner base pay | Deep rate × hours (no bonus) |
| Add-on cleaner split (EOT & Airbnb) | 85% to cleaner, 15% to Rena |
| Fee visibility (EOT & Airbnb) | Hidden — fixed price shown to customer, deep rate payout shown to cleaner |
| Min cleaner rate | £14.00/hr |
| Max cleaner rate | £35.00/hr |
| One-off multiplier | 1.15× |
| Same-day multiplier | 1.30× |
| Deep clean multiplier | 1.45× |
| Fortnightly vs weekly | 1.05× |
| EOT min price | £175 (studio) |
| EOT max price | £550 (5 bed+) |
| Airbnb min price | £55 (studio) |
| Airbnb max price | £155 (4 bed+) |
| Min booking (hourly) | 2 hrs (3 hrs for deep) |
| Same-day cutoff | 12:00 noon |
| Widget | Update existing — do not rebuild |
| Fee label (customer) | "Service fee" (not "platform fee") |

### Money flow — worked examples

**3hr regular clean, cleaner rate £16/hr:**
```
Cleaner gross:     £48.00   (£16 × 3hrs)
Customer pays:     £50.40   (£48 + 5% service fee = +£2.40)
Cleaner receives:  £43.20   (£48 − 10% platform fee = −£4.80)
Rena earns:        £7.20    (£4.80 from cleaner + £2.40 from customer)
```

**EOT 2-bed, cleaner standard rate £16/hr:**
```
Cleaner deep rate: £23.20   (£16 × 1.45 deep multiplier)
Cleaner gross:     £139.20  (£23.20 × 6 hrs estimated)
Cleaner receives:  £125.28  (£139.20 − 10% = −£13.92)
Customer pays:     £280.00  (fixed table price, 5% fee embedded)
Rena earns:        £154.72  (£280 − £125.28)
```

**Airbnb 1-bed, cleaner standard rate £16/hr:**
```
Cleaner deep rate: £23.20   (£16 × 1.45)
Cleaner gross:     £46.40   (£23.20 × 2 hrs estimated)
Cleaner receives:  £41.76   (£46.40 − 10% = −£4.64)
Customer pays:     £75.00   (fixed table price)
Rena earns:        £33.24   (£75 − £41.76)
```
