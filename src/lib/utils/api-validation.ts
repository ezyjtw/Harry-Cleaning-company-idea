import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export interface ValidationRule {
  field: string;
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'email' | 'date' | 'array';
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  custom?: (value: unknown) => string | null;
}

export interface ValidationError {
  field: string;
  message: string;
}

export function validateBody(
  body: Record<string, unknown>,
  rules: ValidationRule[]
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const rule of rules) {
    const value = body[rule.field];

    // Required check
    if (rule.required && (value === undefined || value === null || value === '')) {
      errors.push({ field: rule.field, message: `${rule.field} is required` });
      continue;
    }

    if (value === undefined || value === null) continue;

    // Type check
    if (rule.type === 'email' && typeof value === 'string') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        errors.push({ field: rule.field, message: `${rule.field} must be a valid email` });
      }
    } else if (rule.type === 'date' && typeof value === 'string') {
      if (isNaN(Date.parse(value))) {
        errors.push({ field: rule.field, message: `${rule.field} must be a valid date` });
      }
    } else if (rule.type === 'array') {
      if (!Array.isArray(value)) {
        errors.push({ field: rule.field, message: `${rule.field} must be an array` });
      }
    } else if (rule.type && typeof value !== rule.type) {
      errors.push({ field: rule.field, message: `${rule.field} must be of type ${rule.type}` });
    }

    // String validations
    if (typeof value === 'string') {
      if (rule.minLength && value.length < rule.minLength) {
        errors.push({
          field: rule.field,
          message: `${rule.field} must be at least ${rule.minLength} characters`,
        });
      }
      if (rule.maxLength && value.length > rule.maxLength) {
        errors.push({
          field: rule.field,
          message: `${rule.field} must be at most ${rule.maxLength} characters`,
        });
      }
      if (rule.pattern && !rule.pattern.test(value)) {
        errors.push({ field: rule.field, message: `${rule.field} format is invalid` });
      }
    }

    // Number validations
    if (typeof value === 'number') {
      if (rule.min !== undefined && value < rule.min) {
        errors.push({ field: rule.field, message: `${rule.field} must be at least ${rule.min}` });
      }
      if (rule.max !== undefined && value > rule.max) {
        errors.push({ field: rule.field, message: `${rule.field} must be at most ${rule.max}` });
      }
    }

    // Custom validation
    if (rule.custom) {
      const error = rule.custom(value);
      if (error) {
        errors.push({ field: rule.field, message: error });
      }
    }
  }

  return errors;
}

export function validationErrorResponse(errors: ValidationError[]) {
  return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 400 });
}

export async function parseAndValidate<T>(
  request: NextRequest,
  rules: ValidationRule[]
): Promise<{ data: T; errors: ValidationError[] }> {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return { data: {} as T, errors: [{ field: '_body', message: 'Invalid JSON body' }] };
  }

  const errors = validateBody(body, rules);
  return { data: body as T, errors };
}
