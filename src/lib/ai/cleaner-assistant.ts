import { parseIntent } from './intent-parser';
import type { ParsedIntent } from './intent-parser';

export interface CleanerAssistantResponse {
  message: string;
  action?: string;
  data?: Record<string, unknown>;
  requiresConfirmation?: boolean;
  suggestedActions?: string[];
}

export class CleanerAssistant {
  /**
   * Process a cleaner's message and return appropriate response
   */
  static async processMessage(
    cleanerId: string,
    message: string,
    context?: Record<string, unknown>
  ): Promise<CleanerAssistantResponse> {
    const parsed = parseIntent(message);

    if (parsed.confidence < 0.3) {
      return {
        message:
          'I can help you with:\n- Accepting or declining jobs\n- Managing your schedule\n- Blocking availability\n- Viewing your earnings\n- Getting directions to your next job\n\nWhat would you like to do?',
        suggestedActions: ['View my jobs', 'Manage schedule', 'View earnings'],
      };
    }

    return this.handleIntent(cleanerId, parsed, context);
  }

  private static async handleIntent(
    cleanerId: string,
    parsed: ParsedIntent,
    _context?: Record<string, unknown>
  ): Promise<CleanerAssistantResponse> {
    switch (parsed.intent) {
      case 'ACCEPT_JOB':
        return this.handleAcceptJob(parsed);
      case 'DECLINE_JOB':
        return this.handleDeclineJob(parsed);
      case 'MANAGE_SCHEDULE':
        return this.handleSchedule(parsed);
      case 'BLOCK_AVAILABILITY':
        return this.handleBlockAvailability(parsed);
      case 'REQUEST_NAVIGATION':
        return this.handleNavigation(parsed);
      case 'CHECK_AVAILABILITY':
        return this.handleCheckSchedule(parsed);
      default:
        return {
          message: 'How can I help you today? I can assist with jobs, schedule, or earnings.',
          suggestedActions: ['View pending jobs', 'Update schedule', 'View earnings'],
        };
    }
  }

  private static async handleAcceptJob(parsed: ParsedIntent): Promise<CleanerAssistantResponse> {
    return {
      message: parsed.entities.bookingId
        ? `Accepting job ${parsed.entities.bookingId}. Please confirm.`
        : 'Which job would you like to accept? Here are your pending assignments.',
      action: 'ACCEPT_JOB',
      data: parsed.entities,
      requiresConfirmation: true,
      suggestedActions: ['View pending jobs'],
    };
  }

  private static async handleDeclineJob(parsed: ParsedIntent): Promise<CleanerAssistantResponse> {
    return {
      message:
        'Are you sure you want to decline this job? It will be reassigned to another cleaner. Please note: frequent declines may affect your ranking.',
      action: 'DECLINE_JOB',
      data: parsed.entities,
      requiresConfirmation: true,
    };
  }

  private static async handleSchedule(_parsed: ParsedIntent): Promise<CleanerAssistantResponse> {
    return {
      message:
        "Here's your schedule overview. Would you like to:\n- View this week's bookings\n- Update your weekly availability\n- Block specific dates",
      action: 'VIEW_SCHEDULE',
      suggestedActions: ['This week', 'Update availability', 'Block dates'],
    };
  }

  private static async handleBlockAvailability(
    parsed: ParsedIntent
  ): Promise<CleanerAssistantResponse> {
    if (parsed.entities.date) {
      return {
        message: `I'll block ${parsed.entities.date} from your availability. Any existing bookings on this date will need to be rescheduled. Confirm?`,
        action: 'BLOCK_DATE',
        data: parsed.entities,
        requiresConfirmation: true,
      };
    }

    return {
      message: 'Which date(s) would you like to block? You can specify a single date or a range.',
      action: 'COLLECT_BLOCK_DATES',
    };
  }

  private static async handleNavigation(parsed: ParsedIntent): Promise<CleanerAssistantResponse> {
    return {
      message: 'Let me get the address for your next booking and prepare directions.',
      action: 'GET_NAVIGATION',
      data: parsed.entities,
    };
  }

  private static async handleCheckSchedule(
    _parsed: ParsedIntent
  ): Promise<CleanerAssistantResponse> {
    return {
      message: 'Let me pull up your schedule. Which period?\n- Today\n- This week\n- Next week',
      action: 'CHECK_SCHEDULE',
      suggestedActions: ['Today', 'This week', 'Next week'],
    };
  }
}
