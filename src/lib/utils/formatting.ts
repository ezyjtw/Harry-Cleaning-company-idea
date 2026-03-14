/**
 * Formatting utilities for the Rena Cleaning Network.
 * All currency formatting uses GBP (British Pounds).
 */

/**
 * Formats a number as GBP currency.
 * @example formatCurrency(25.5) => "£25.50"
 * @example formatCurrency(1000) => "£1,000.00"
 */
export function formatCurrency(
  amount: number | string,
  options?: { showDecimals?: boolean }
): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount

  if (isNaN(numAmount)) {
    return '£0.00'
  }

  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: options?.showDecimals === false ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(numAmount)
}

/**
 * Formats a Date object or ISO string into a human-readable date.
 * @example formatDate(new Date()) => "14 March 2026"
 * @example formatDate(new Date(), 'short') => "14/03/2026"
 */
export function formatDate(
  date: Date | string,
  style: 'long' | 'short' | 'relative' = 'long'
): string {
  const d = typeof date === 'string' ? new Date(date) : date

  if (isNaN(d.getTime())) {
    return 'Invalid date'
  }

  if (style === 'relative') {
    return getRelativeTime(d)
  }

  if (style === 'short') {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(d)
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d)
}

/**
 * Returns a relative time string (e.g., "2 hours ago", "in 3 days").
 */
function getRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSecs = Math.floor(Math.abs(diffMs) / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)
  const isPast = diffMs > 0

  if (diffSecs < 60) {
    return 'just now'
  }

  const format = (value: number, unit: string) => {
    const plural = value === 1 ? '' : 's'
    return isPast
      ? `${value} ${unit}${plural} ago`
      : `in ${value} ${unit}${plural}`
  }

  if (diffMins < 60) {
    return format(diffMins, 'minute')
  }
  if (diffHours < 24) {
    return format(diffHours, 'hour')
  }
  if (diffDays < 30) {
    return format(diffDays, 'day')
  }

  const diffMonths = Math.floor(diffDays / 30)
  if (diffMonths < 12) {
    return format(diffMonths, 'month')
  }

  const diffYears = Math.floor(diffMonths / 12)
  return format(diffYears, 'year')
}

/**
 * Formats a time string (HH:mm) into 12-hour format.
 * @example formatTime("14:30") => "2:30 PM"
 * @example formatTime("09:00") => "9:00 AM"
 */
export function formatTime(
  time: string,
  use24Hour = false
): string {
  const [hoursStr, minutesStr] = time.split(':')
  const hours = parseInt(hoursStr, 10)
  const minutes = parseInt(minutesStr, 10)

  if (isNaN(hours) || isNaN(minutes)) {
    return time
  }

  if (use24Hour) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
  }

  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours % 12 || 12
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`
}

/**
 * Formats a duration in hours to a human-readable string.
 * @example formatDuration(1.5) => "1h 30m"
 * @example formatDuration(2) => "2h"
 * @example formatDuration(0.75) => "45m"
 */
export function formatDuration(hours: number | string): string {
  const numHours = typeof hours === 'string' ? parseFloat(hours) : hours

  if (isNaN(numHours) || numHours <= 0) {
    return '0m'
  }

  const wholeHours = Math.floor(numHours)
  const minutes = Math.round((numHours - wholeHours) * 60)

  if (wholeHours === 0) {
    return `${minutes}m`
  }

  if (minutes === 0) {
    return `${wholeHours}h`
  }

  return `${wholeHours}h ${minutes}m`
}

/**
 * Formats a UK phone number into a readable format.
 * @example formatPhoneNumber("07123456789") => "07123 456 789"
 * @example formatPhoneNumber("+447123456789") => "+44 7123 456 789"
 */
export function formatPhoneNumber(phone: string): string {
  if (!phone) {
    return ''
  }

  const cleaned = phone.replace(/[\s\-()]/g, '')

  // +44 format
  if (cleaned.startsWith('+44')) {
    const number = cleaned.slice(3)
    return `+44 ${number.slice(0, 4)} ${number.slice(4, 7)} ${number.slice(7)}`
  }

  // 0044 format
  if (cleaned.startsWith('0044')) {
    const number = cleaned.slice(4)
    return `+44 ${number.slice(0, 4)} ${number.slice(4, 7)} ${number.slice(7)}`
  }

  // 07xxx format
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    return `${cleaned.slice(0, 5)} ${cleaned.slice(5, 8)} ${cleaned.slice(8)}`
  }

  return phone
}

/**
 * Truncates text to a specified length with an ellipsis.
 * @example truncateText("Hello World", 5) => "Hello..."
 */
export function truncateText(
  text: string,
  maxLength: number,
  suffix = '...'
): string {
  if (!text || typeof text !== 'string') {
    return ''
  }

  if (text.length <= maxLength) {
    return text
  }

  return text.slice(0, maxLength).trimEnd() + suffix
}
