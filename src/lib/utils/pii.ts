/**
 * Lightweight contact-info (PII) detection for message content. Used BOTH client-
 * side (to warn the sender before send) and server-side (to auto-flag for admin
 * moderation). It never blocks or redacts — it only signals "this looks like
 * contact info" so we can warn + flag.
 */

// Standard email shape — tight, low false-positive.
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

// A run of 10+ phone-like digits, allowing +, spaces, dots, dashes and parens
// between them. Catches UK formats: "07700 900123", "+44 7700 900123",
// "020 7946 0958", "447700900123". 10-digit floor keeps short numbers / prices out.
const PHONE = /(?:\+?\d[\s().-]?){9,}\d/;

export interface ContactInfoMatch {
  email: boolean;
  phone: boolean;
  any: boolean;
}

export function detectContactInfo(text: string): ContactInfoMatch {
  if (typeof text !== 'string') return { email: false, phone: false, any: false };
  const email = EMAIL.test(text);
  const phone = PHONE.test(text);
  return { email, phone, any: email || phone };
}
