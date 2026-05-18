import { parseIntent } from './intent-parser';
import type { ParsedIntent } from './intent-parser';

export interface AssistantResponse {
  message: string;
  action?: string;
  data?: Record<string, unknown>;
  requiresConfirmation?: boolean;
  suggestedActions?: string[];
}

export class CustomerAssistant {
  /**
   * Process a customer message and return appropriate response
   */
  static async processMessage(
    userId: string,
    message: string,
    conversationContext?: Record<string, unknown>
  ): Promise<AssistantResponse> {
    const parsed = parseIntent(message);

    if (parsed.confidence < 0.3) {
      return {
        message:
          "I'm not sure I understood that. I can help you with:\n- Booking a cleaning\n- Getting a price estimate\n- Checking cleaner availability\n- Modifying or cancelling a booking\n- Tracking your cleaner\n\nWhat would you like to do?",
        suggestedActions: ['Book a cleaning', 'Get an estimate', 'Check availability'],
      };
    }

    return this.handleIntent(userId, parsed, conversationContext);
  }

  private static async handleIntent(
    userId: string,
    parsed: ParsedIntent,
    _context?: Record<string, unknown>
  ): Promise<AssistantResponse> {
    switch (parsed.intent) {
      case 'BOOK_CLEANING':
        return this.handleBooking(parsed);
      case 'GET_ESTIMATE':
        return this.handleEstimate(parsed);
      case 'CHECK_AVAILABILITY':
        return this.handleAvailability(parsed);
      case 'CANCEL_BOOKING':
        return this.handleCancellation(parsed);
      case 'MODIFY_BOOKING':
        return this.handleModification(parsed);
      case 'TRACK_CLEANER':
        return this.handleTracking(parsed);
      case 'ASK_SERVICE_QUESTION':
        return this.handleQuestion(parsed);
      default:
        return {
          message:
            'I can help you with booking, estimates, availability, and managing your cleanings. What would you like to do?',
          suggestedActions: ['Book a cleaning', 'Get an estimate', 'View my bookings'],
        };
    }
  }

  private static async handleBooking(parsed: ParsedIntent): Promise<AssistantResponse> {
    const missing: string[] = [];
    if (!parsed.entities.date) missing.push('preferred date');
    if (!parsed.entities.serviceType)
      missing.push('type of cleaning (standard, deep, end-of-tenancy)');
    if (!parsed.entities.postcode) missing.push('postcode');

    if (missing.length > 0) {
      return {
        message: `I'd love to help you book a cleaning! I just need a few more details:\n${missing.map((m) => `- ${m}`).join('\n')}`,
        action: 'COLLECT_BOOKING_INFO',
        data: { collected: parsed.entities },
      };
    }

    return {
      message: `Great! I'll set up a ${parsed.entities.serviceType} cleaning for ${parsed.entities.date}. Let me find the best available cleaners in your area (${parsed.entities.postcode}).`,
      action: 'FIND_CLEANERS',
      data: parsed.entities,
      requiresConfirmation: true,
      suggestedActions: ['View available cleaners', 'Change date', 'Change service type'],
    };
  }

  private static async handleEstimate(parsed: ParsedIntent): Promise<AssistantResponse> {
    if (!parsed.entities.rooms && !parsed.entities.serviceType) {
      return {
        message:
          'I can give you a price estimate! Could you tell me:\n- How many bedrooms and bathrooms?\n- What type of cleaning? (standard, deep, end-of-tenancy)\n- Any extras needed? (oven, windows, fridge)',
        action: 'COLLECT_ESTIMATE_INFO',
      };
    }

    return {
      message: 'Let me calculate an estimate for you based on those details.',
      action: 'CALCULATE_ESTIMATE',
      data: parsed.entities,
    };
  }

  private static async handleAvailability(parsed: ParsedIntent): Promise<AssistantResponse> {
    return {
      message: parsed.entities.date
        ? `Let me check cleaner availability for ${parsed.entities.date}.`
        : 'When would you like your cleaning? I can check what is available.',
      action: 'CHECK_AVAILABILITY',
      data: parsed.entities,
    };
  }

  private static async handleCancellation(parsed: ParsedIntent): Promise<AssistantResponse> {
    return {
      message: parsed.entities.bookingId
        ? `I'll look up booking ${parsed.entities.bookingId} for cancellation. Please confirm you'd like to proceed.`
        : 'Which booking would you like to cancel? Please provide the booking reference or I can show your upcoming bookings.',
      action: 'CANCEL_BOOKING',
      data: parsed.entities,
      requiresConfirmation: true,
      suggestedActions: ['Show my bookings', 'Cancel'],
    };
  }

  private static async handleModification(parsed: ParsedIntent): Promise<AssistantResponse> {
    return {
      message:
        'What would you like to change about your booking? I can help with the date, time, or service type.',
      action: 'MODIFY_BOOKING',
      data: parsed.entities,
      requiresConfirmation: true,
    };
  }

  private static async handleTracking(parsed: ParsedIntent): Promise<AssistantResponse> {
    return {
      message: "Let me check your cleaner's status for today's booking.",
      action: 'TRACK_CLEANER',
      data: parsed.entities,
    };
  }

  private static async handleQuestion(_parsed: ParsedIntent): Promise<AssistantResponse> {
    return {
      message:
        "We offer several cleaning services:\n\n**Regular Clean** - Routine maintenance cleaning\n**One-Off Clean** - Single visit, no commitment\n**Same-Day Clean** - Need it today? We can help\n**Deep Clean** - Thorough top-to-bottom cleaning\n**End of Tenancy** - Fixed-price move-out clean (from £175)\n**Airbnb Turnover** - Fixed-price turnaround for short lets (from £55)\n\nAll cleaners are vetted, insured, and ID-verified. Just a small 6% service fee on top of the cleaner's rate.\n\nWould you like a quote for any of these services?",
      suggestedActions: ['Get a quote', 'Book now', 'View cleaners'],
    };
  }
}
