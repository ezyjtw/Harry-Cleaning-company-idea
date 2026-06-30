import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { isValidPostcode } from '@/lib/utils/postcode';

// A12: server-side proxy for getAddress.io postcode lookup. The API key NEVER
// leaves the server — the browser calls THIS endpoint, which calls getAddress.io
// with the secret key. Rate-limited because getAddress.io is a paid/metered API.
//
// GET /api/address/lookup?postcode=SW1A1AA
//   200 → { postcode, addresses: [{ line1, line2, city, postcode }] }
//   400 → invalid/missing postcode
//   404 → postcode not found (caller should offer manual entry)
//   429 → rate limited
//   503 → lookup unavailable (no API key configured, or upstream error) — caller
//         should fall back to manual structured entry.

interface GetAddressExpanded {
  line_1?: string;
  line_2?: string;
  line_3?: string;
  line_4?: string;
  locality?: string;
  town_or_city?: string;
  county?: string;
}

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(`address-lookup:${ip}`, 30, 60 * 1000); // 30/min per IP
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many lookups. Please slow down.' }, { status: 429 });
  }

  const raw = new URL(request.url).searchParams.get('postcode')?.trim() ?? '';
  if (!raw || !isValidPostcode(raw)) {
    return NextResponse.json({ error: 'Please enter a valid UK postcode.' }, { status: 400 });
  }

  const apiKey = process.env.GETADDRESS_API_KEY;
  if (!apiKey) {
    // Not configured — tell the client to fall back to manual entry.
    return NextResponse.json(
      { error: 'Address lookup is unavailable. Please enter your address manually.' },
      { status: 503 }
    );
  }

  const normalized = raw.toUpperCase().replace(/\s+/g, '');

  let upstream: Response;
  try {
    upstream = await fetch(
      `https://api.getAddress.io/find/${encodeURIComponent(normalized)}?api-key=${encodeURIComponent(apiKey)}&expand=true`,
      { headers: { Accept: 'application/json' } }
    );
  } catch {
    return NextResponse.json(
      { error: 'Address lookup is temporarily unavailable. Please enter your address manually.' },
      { status: 503 }
    );
  }

  if (upstream.status === 404) {
    return NextResponse.json(
      { error: 'No addresses found for that postcode. Please check it or enter manually.' },
      { status: 404 }
    );
  }
  if (!upstream.ok) {
    // 401 (bad key), 429 (upstream quota), 5xx — never leak the key/upstream body.
    return NextResponse.json(
      { error: 'Address lookup is temporarily unavailable. Please enter your address manually.' },
      { status: 503 }
    );
  }

  let data: { postcode?: string; addresses?: GetAddressExpanded[] };
  try {
    data = await upstream.json();
  } catch {
    return NextResponse.json(
      { error: 'Address lookup is temporarily unavailable. Please enter your address manually.' },
      { status: 503 }
    );
  }

  const formattedPostcode = formatPostcode(data.postcode || raw);
  const addresses = (data.addresses ?? []).map((a) => {
    // getAddress.io splits the address across line_1..line_4 + locality. We keep
    // line1 as the primary line and fold the remaining street/locality parts into
    // line2 (deduped, non-empty).
    const line2 = [a.line_2, a.line_3, a.line_4, a.locality]
      .map((s) => (s ?? '').trim())
      .filter(Boolean)
      .join(', ');
    return {
      line1: (a.line_1 ?? '').trim(),
      line2: line2 || undefined,
      city: (a.town_or_city ?? a.county ?? '').trim(),
      postcode: formattedPostcode,
    };
  });

  return NextResponse.json({ postcode: formattedPostcode, addresses });
}

// Re-insert the single space before the inward code (e.g. "SW1A1AA" → "SW1A 1AA").
function formatPostcode(pc: string): string {
  const clean = pc.toUpperCase().replace(/\s+/g, '');
  if (clean.length < 5) return clean;
  return `${clean.slice(0, clean.length - 3)} ${clean.slice(clean.length - 3)}`;
}
