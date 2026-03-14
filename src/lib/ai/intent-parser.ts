/**
 * AI Intent Parser
 * Parses natural language messages to detect user intents
 * and extract relevant entities for the booking/scheduling system.
 */

export type Intent =
  | 'BOOK_CLEANING'
  | 'MODIFY_BOOKING'
  | 'CANCEL_BOOKING'
  | 'GET_ESTIMATE'
  | 'CHECK_AVAILABILITY'
  | 'ASK_SERVICE_QUESTION'
  | 'TRACK_CLEANER'
  | 'MANAGE_SCHEDULE'
  | 'ACCEPT_JOB'
  | 'DECLINE_JOB'
  | 'BLOCK_AVAILABILITY'
  | 'REQUEST_NAVIGATION'
  | 'UNKNOWN';

export interface ParsedIntent {
  intent: Intent;
  confidence: number; // 0-1
  entities: Record<string, string | number | boolean>;
  originalMessage: string;
}

// Keyword patterns for intent detection
const INTENT_PATTERNS: Array<{ intent: Intent; patterns: RegExp[]; requiredEntities?: string[] }> =
  [
    {
      intent: 'BOOK_CLEANING',
      patterns: [
        /\b(book|schedule|arrange|need|want)\b.*\b(clean|cleaning|cleaner|service)\b/i,
        /\b(clean|cleaning)\b.*\b(book|schedule|arrange)\b/i,
        /\bbook\s+(a|an|my)\b/i,
      ],
    },
    {
      intent: 'CANCEL_BOOKING',
      patterns: [/\b(cancel|remove|delete)\b.*\b(booking|appointment|clean)\b/i, /\bcancel\b/i],
    },
    {
      intent: 'MODIFY_BOOKING',
      patterns: [
        /\b(change|modify|reschedule|update|move)\b.*\b(booking|appointment|clean|time|date)\b/i,
        /\breschedule\b/i,
      ],
    },
    {
      intent: 'GET_ESTIMATE',
      patterns: [/\b(how much|price|cost|estimate|quote)\b/i, /\b(pricing|rates?)\b/i],
    },
    {
      intent: 'CHECK_AVAILABILITY',
      patterns: [/\b(available|availability|free|open)\b/i, /\bwhen\b.*\b(available|free)\b/i],
    },
    {
      intent: 'ASK_SERVICE_QUESTION',
      patterns: [
        /\b(what|which|how|do you|can you|does)\b.*\b(service|offer|provide|include)\b/i,
        /\b(tell me|explain|info|information)\b/i,
      ],
    },
    {
      intent: 'TRACK_CLEANER',
      patterns: [/\b(where|track|eta|arriving|on the way)\b.*\b(cleaner|they)\b/i, /\btrack\b/i],
    },
    {
      intent: 'MANAGE_SCHEDULE',
      patterns: [
        /\b(schedule|calendar|availability)\b.*\b(set|update|change|manage)\b/i,
        /\bmy schedule\b/i,
      ],
    },
    {
      intent: 'ACCEPT_JOB',
      patterns: [/\b(accept|take|confirm)\b.*\b(job|booking|assignment)\b/i, /\baccept\b/i],
    },
    {
      intent: 'DECLINE_JOB',
      patterns: [/\b(decline|reject|pass|skip)\b.*\b(job|booking|assignment)\b/i, /\bdecline\b/i],
    },
    {
      intent: 'BLOCK_AVAILABILITY',
      patterns: [/\b(block|off|unavailable|holiday|vacation|day off)\b/i, /\btake\b.*\boff\b/i],
    },
  ];

// Entity extraction patterns
const ENTITY_PATTERNS: Array<{
  name: string;
  pattern: RegExp;
  transform?: (match: string) => string | number;
}> = [
  {
    name: 'date',
    pattern:
      /\b(\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*(?:\s+\d{4})?)/i,
  },
  { name: 'date', pattern: /\b(today|tomorrow|next\s+\w+day|this\s+\w+day)/i },
  { name: 'time', pattern: /\b(\d{1,2}(?::\d{2})?\s*(?:am|pm))/i },
  { name: 'time', pattern: /\b(morning|afternoon|evening)\b/i },
  {
    name: 'duration',
    pattern: /\b(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\b/i,
    transform: (m) => parseFloat(m),
  },
  {
    name: 'serviceType',
    pattern:
      /\b(deep\s*clean|regular\s*clean|standard\s*clean|end\s*of\s*tenancy|move[\s-](?:in|out)|airbnb|office)\b/i,
  },
  { name: 'rooms', pattern: /\b(\d+)\s*(?:bed(?:room)?s?|bath(?:room)?s?)\b/i },
  { name: 'postcode', pattern: /\b([A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2})\b/i },
  { name: 'bookingId', pattern: /\b(?:booking\s*(?:#|id|ref)?:?\s*)([A-Z0-9-]+)\b/i },
];

export function parseIntent(message: string): ParsedIntent {
  let bestMatch: { intent: Intent; confidence: number } = { intent: 'UNKNOWN', confidence: 0 };

  for (const { intent, patterns } of INTENT_PATTERNS) {
    let matchCount = 0;
    for (const pattern of patterns) {
      if (pattern.test(message)) {
        matchCount++;
      }
    }

    if (matchCount > 0) {
      const confidence = Math.min(matchCount / patterns.length + 0.3, 1.0);
      if (confidence > bestMatch.confidence) {
        bestMatch = { intent, confidence };
      }
    }
  }

  // Extract entities
  const entities: Record<string, string | number | boolean> = {};
  for (const { name, pattern, transform } of ENTITY_PATTERNS) {
    const match = message.match(pattern);
    if (match && match[1]) {
      entities[name] = transform ? transform(match[1]) : match[1];
    }
  }

  return {
    intent: bestMatch.intent,
    confidence: bestMatch.confidence,
    entities,
    originalMessage: message,
  };
}

export function requiresConfirmation(intent: Intent): boolean {
  return ['CANCEL_BOOKING', 'MODIFY_BOOKING', 'DECLINE_JOB', 'BLOCK_AVAILABILITY'].includes(intent);
}
