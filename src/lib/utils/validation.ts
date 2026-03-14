/**
 * Input validation utilities for the Rena Cleaning Network.
 */

/**
 * Validates an email address format.
 */
export function validateEmail(email: string): {
  valid: boolean
  error?: string
} {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required.' }
  }

  const trimmed = email.trim().toLowerCase()

  if (trimmed.length > 254) {
    return { valid: false, error: 'Email address is too long.' }
  }

  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
  if (!emailRegex.test(trimmed)) {
    return { valid: false, error: 'Please enter a valid email address.' }
  }

  return { valid: true }
}

/**
 * Validates a UK phone number.
 * Accepts formats: 07xxx, +447xxx, 00447xxx
 */
export function validatePhone(phone: string): {
  valid: boolean
  error?: string
} {
  if (!phone || typeof phone !== 'string') {
    return { valid: false, error: 'Phone number is required.' }
  }

  // Strip spaces, dashes, and parentheses
  const cleaned = phone.replace(/[\s\-()]/g, '')

  const ukPhoneRegex = /^(?:(?:\+44|0044)7\d{9}|07\d{9})$/
  if (!ukPhoneRegex.test(cleaned)) {
    return {
      valid: false,
      error: 'Please enter a valid UK mobile number (e.g. 07123 456789).',
    }
  }

  return { valid: true }
}

/**
 * Validates a UK postcode.
 * Accepts formats like: SW1A 1AA, EC1A 1BB, W1A 0AX, M1 1AE, B33 8TH
 */
export function validatePostcode(postcode: string): {
  valid: boolean
  error?: string
} {
  if (!postcode || typeof postcode !== 'string') {
    return { valid: false, error: 'Postcode is required.' }
  }

  const trimmed = postcode.trim().toUpperCase()

  const postcodeRegex =
    /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/
  if (!postcodeRegex.test(trimmed)) {
    return {
      valid: false,
      error: 'Please enter a valid UK postcode (e.g. SW1A 1AA).',
    }
  }

  return { valid: true }
}

/**
 * Validates a password meets security requirements.
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 */
export function validatePassword(password: string): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (!password || typeof password !== 'string') {
    return { valid: false, errors: ['Password is required.'] }
  }

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long.')
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter.')
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter.')
  }

  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number.')
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Sanitizes user input by stripping HTML tags to prevent XSS.
 */
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return ''
  }

  return input
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim()
}
