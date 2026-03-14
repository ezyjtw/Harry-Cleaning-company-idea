import {
  validateEmail,
  validatePhone,
  validatePostcode,
  validatePassword,
  sanitizeInput,
} from '@/lib/utils/validation'

describe('validateEmail', () => {
  it('accepts a valid email', () => {
    expect(validateEmail('user@example.com')).toEqual({ valid: true })
  })

  it('accepts emails with subdomains', () => {
    expect(validateEmail('user@mail.example.co.uk')).toEqual({ valid: true })
  })

  it('accepts emails with plus addressing', () => {
    expect(validateEmail('user+tag@example.com')).toEqual({ valid: true })
  })

  it('trims whitespace and lowercases', () => {
    const result = validateEmail('  User@Example.COM  ')
    expect(result.valid).toBe(true)
  })

  it('rejects empty string', () => {
    const result = validateEmail('')
    expect(result.valid).toBe(false)
    expect(result.error).toBeDefined()
  })

  it('rejects null/undefined coerced to string', () => {
    const result = validateEmail(null as unknown as string)
    expect(result.valid).toBe(false)
  })

  it('rejects email without @', () => {
    const result = validateEmail('userexample.com')
    expect(result.valid).toBe(false)
    expect(result.error).toBeDefined()
  })

  it('rejects email without domain', () => {
    const result = validateEmail('user@')
    expect(result.valid).toBe(false)
  })

  it('rejects email without TLD', () => {
    const result = validateEmail('user@example')
    expect(result.valid).toBe(false)
  })

  it('rejects email exceeding 254 characters', () => {
    const longLocal = 'a'.repeat(250)
    const result = validateEmail(`${longLocal}@example.com`)
    expect(result.valid).toBe(false)
    expect(result.error).toContain('too long')
  })
})

describe('validatePhone', () => {
  it('accepts a valid UK mobile number', () => {
    expect(validatePhone('07123456789')).toEqual({ valid: true })
  })

  it('accepts number with +44 prefix', () => {
    expect(validatePhone('+447123456789')).toEqual({ valid: true })
  })

  it('accepts number with 0044 prefix', () => {
    expect(validatePhone('00447123456789')).toEqual({ valid: true })
  })

  it('accepts number with spaces', () => {
    expect(validatePhone('07123 456 789')).toEqual({ valid: true })
  })

  it('accepts number with dashes', () => {
    expect(validatePhone('07123-456-789')).toEqual({ valid: true })
  })

  it('rejects empty string', () => {
    const result = validatePhone('')
    expect(result.valid).toBe(false)
  })

  it('rejects null/undefined', () => {
    const result = validatePhone(null as unknown as string)
    expect(result.valid).toBe(false)
  })

  it('rejects landline numbers', () => {
    const result = validatePhone('02012345678')
    expect(result.valid).toBe(false)
  })

  it('rejects numbers that are too short', () => {
    const result = validatePhone('0712345')
    expect(result.valid).toBe(false)
  })

  it('rejects numbers that are too long', () => {
    const result = validatePhone('071234567890')
    expect(result.valid).toBe(false)
  })

  it('rejects non-numeric input', () => {
    const result = validatePhone('not-a-number')
    expect(result.valid).toBe(false)
  })
})

describe('validatePostcode', () => {
  it('accepts standard London postcode', () => {
    expect(validatePostcode('SW1A 1AA')).toEqual({ valid: true })
  })

  it('accepts postcode without space', () => {
    expect(validatePostcode('SW1A1AA')).toEqual({ valid: true })
  })

  it('accepts lowercase postcode', () => {
    expect(validatePostcode('sw1a 1aa')).toEqual({ valid: true })
  })

  it('accepts various valid postcodes', () => {
    const validPostcodes = ['EC1A 1BB', 'W1A 0AX', 'M1 1AE', 'B33 8TH', 'CR2 6XH']
    validPostcodes.forEach((pc) => {
      expect(validatePostcode(pc).valid).toBe(true)
    })
  })

  it('rejects empty string', () => {
    const result = validatePostcode('')
    expect(result.valid).toBe(false)
  })

  it('rejects null/undefined', () => {
    const result = validatePostcode(null as unknown as string)
    expect(result.valid).toBe(false)
  })

  it('rejects invalid format', () => {
    const result = validatePostcode('12345')
    expect(result.valid).toBe(false)
  })

  it('rejects US zip codes', () => {
    const result = validatePostcode('90210')
    expect(result.valid).toBe(false)
  })

  it('trims whitespace', () => {
    const result = validatePostcode('  SW1A 1AA  ')
    expect(result.valid).toBe(true)
  })
})

describe('validatePassword', () => {
  it('accepts a valid password', () => {
    const result = validatePassword('MyPassword1')
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('rejects empty string', () => {
    const result = validatePassword('')
    expect(result.valid).toBe(false)
  })

  it('rejects null/undefined', () => {
    const result = validatePassword(null as unknown as string)
    expect(result.valid).toBe(false)
  })

  it('rejects password shorter than 8 characters', () => {
    const result = validatePassword('Pass1')
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Password must be at least 8 characters long.')
  })

  it('rejects password without uppercase', () => {
    const result = validatePassword('mypassword1')
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Password must contain at least one uppercase letter.')
  })

  it('rejects password without lowercase', () => {
    const result = validatePassword('MYPASSWORD1')
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Password must contain at least one lowercase letter.')
  })

  it('rejects password without number', () => {
    const result = validatePassword('MyPassword')
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Password must contain at least one number.')
  })

  it('returns multiple errors for multiple violations', () => {
    const result = validatePassword('abc')
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThanOrEqual(2)
  })

  it('accepts a strong password with special characters', () => {
    const result = validatePassword('MyStr0ng!Pass#2025')
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })
})

describe('sanitizeInput', () => {
  it('returns empty string for empty input', () => {
    expect(sanitizeInput('')).toBe('')
  })

  it('returns empty string for null/undefined', () => {
    expect(sanitizeInput(null as unknown as string)).toBe('')
    expect(sanitizeInput(undefined as unknown as string)).toBe('')
  })

  it('strips HTML tags', () => {
    expect(sanitizeInput('<script>alert("xss")</script>')).not.toContain('<script>')
  })

  it('escapes ampersands', () => {
    const result = sanitizeInput('Tom & Jerry')
    expect(result).toContain('&amp;')
  })

  it('escapes angle brackets', () => {
    const result = sanitizeInput('5 < 10 > 3')
    expect(result).toContain('&lt;')
    expect(result).toContain('&gt;')
  })

  it('escapes double quotes', () => {
    const result = sanitizeInput('She said "hello"')
    expect(result).toContain('&quot;')
  })

  it('escapes single quotes', () => {
    const result = sanitizeInput("It's fine")
    expect(result).toContain('&#x27;')
  })

  it('trims whitespace', () => {
    expect(sanitizeInput('  hello  ')).toBe('hello')
  })

  it('handles normal text without modification (except trim)', () => {
    expect(sanitizeInput('Hello World')).toBe('Hello World')
  })

  it('strips nested HTML tags', () => {
    const result = sanitizeInput('<div><p>Hello</p></div>')
    expect(result).not.toContain('<div>')
    expect(result).not.toContain('<p>')
  })
})
