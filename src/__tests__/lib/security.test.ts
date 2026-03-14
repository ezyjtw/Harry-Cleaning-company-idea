import { validateBody } from '@/lib/utils/api-validation';
import { checkPasswordStrength, validatePasswordPolicy } from '@/lib/utils/password-policy';
import { hasPermission, hasAllPermissions, hasAnyPermission } from '@/lib/utils/rbac';
import { sanitizeString, sanitizeObject, containsDangerousContent } from '@/lib/utils/sanitize';

// Mock next/server to avoid Request polyfill issues in Jest
jest.mock('next/server', () => ({
  NextResponse: { json: jest.fn() },
}));

describe('Password Policy', () => {
  describe('checkPasswordStrength', () => {
    it('should rate weak passwords low', () => {
      const result = checkPasswordStrength('abc');
      expect(result.score).toBeLessThanOrEqual(1);
      expect(result.isAcceptable).toBe(false);
    });

    it('should rate strong passwords high', () => {
      const result = checkPasswordStrength('MyStr0ng!Pass');
      expect(result.score).toBeGreaterThanOrEqual(3);
      expect(result.isAcceptable).toBe(true);
    });

    it('should penalize common patterns', () => {
      const result = checkPasswordStrength('password123');
      expect(result.score).toBeLessThanOrEqual(2);
    });

    it('should provide suggestions for weak passwords', () => {
      const result = checkPasswordStrength('abc');
      expect(result.suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('validatePasswordPolicy', () => {
    it('should reject short passwords', () => {
      const result = validatePasswordPolicy('Ab1');
      expect(result.valid).toBe(false);
    });

    it('should accept valid passwords', () => {
      const result = validatePasswordPolicy('MyPassword1');
      expect(result.valid).toBe(true);
    });

    it('should require uppercase', () => {
      const result = validatePasswordPolicy('mypassword1');
      expect(result.valid).toBe(false);
    });

    it('should require digits', () => {
      const result = validatePasswordPolicy('MyPassword');
      expect(result.valid).toBe(false);
    });
  });
});

describe('Input Sanitization', () => {
  describe('sanitizeString', () => {
    it('should encode HTML entities', () => {
      expect(sanitizeString('<script>alert("xss")</script>')).not.toContain('<script>');
    });

    it('should handle empty input', () => {
      expect(sanitizeString('')).toBe('');
    });

    it('should trim whitespace', () => {
      expect(sanitizeString('  hello  ')).toBe('hello');
    });

    it('should remove null bytes', () => {
      expect(sanitizeString('hello\0world')).toBe('helloworld');
    });
  });

  describe('sanitizeObject', () => {
    it('should sanitize string values in objects', () => {
      const result = sanitizeObject({ name: '<b>Test</b>', age: 25 });
      expect(result.name).not.toContain('<b>');
      expect(result.age).toBe(25);
    });

    it('should handle nested objects', () => {
      const result = sanitizeObject({ nested: { value: '<script>bad</script>' } });
      expect((result.nested as Record<string, string>).value).not.toContain('<script>');
    });
  });

  describe('containsDangerousContent', () => {
    it('should detect script tags', () => {
      expect(containsDangerousContent('<script>alert(1)</script>')).toBe(true);
    });

    it('should detect javascript: protocol', () => {
      expect(containsDangerousContent('javascript:alert(1)')).toBe(true);
    });

    it('should detect event handlers', () => {
      expect(containsDangerousContent('onload = alert(1)')).toBe(true);
    });

    it('should pass safe content', () => {
      expect(containsDangerousContent('Hello World')).toBe(false);
    });
  });
});

describe('RBAC', () => {
  describe('hasPermission', () => {
    it('should allow CLIENT to create bookings', () => {
      expect(hasPermission('CLIENT', 'booking:create')).toBe(true);
    });

    it('should not allow CLIENT to access admin dashboard', () => {
      expect(hasPermission('CLIENT', 'admin:dashboard')).toBe(false);
    });

    it('should allow ADMIN all permissions', () => {
      expect(hasPermission('ADMIN', 'admin:dashboard')).toBe(true);
      expect(hasPermission('ADMIN', 'booking:create')).toBe(true);
      expect(hasPermission('ADMIN', 'payment:refund')).toBe(true);
    });

    it('should allow CLEANER to update their profile', () => {
      expect(hasPermission('CLEANER', 'cleaner:update')).toBe(true);
    });

    it('should not allow CLEANER to create bookings', () => {
      expect(hasPermission('CLEANER', 'booking:create')).toBe(false);
    });
  });

  describe('hasAllPermissions', () => {
    it('should return true when all permissions are present', () => {
      expect(hasAllPermissions('ADMIN', ['booking:create', 'booking:read'])).toBe(true);
    });

    it('should return false when any permission is missing', () => {
      expect(hasAllPermissions('CLIENT', ['booking:create', 'admin:dashboard'])).toBe(false);
    });
  });

  describe('hasAnyPermission', () => {
    it('should return true when any permission is present', () => {
      expect(hasAnyPermission('CLIENT', ['booking:create', 'admin:dashboard'])).toBe(true);
    });

    it('should return false when no permissions match', () => {
      expect(hasAnyPermission('CLIENT', ['admin:dashboard', 'admin:settings'])).toBe(false);
    });
  });
});

describe('API Validation', () => {
  describe('validateBody', () => {
    it('should validate required fields', () => {
      const errors = validateBody({}, [{ field: 'name', required: true }]);
      expect(errors.length).toBe(1);
      expect(errors[0].field).toBe('name');
    });

    it('should validate email format', () => {
      const errors = validateBody({ email: 'invalid' }, [{ field: 'email', type: 'email' }]);
      expect(errors.length).toBe(1);
    });

    it('should pass valid email', () => {
      const errors = validateBody({ email: 'test@example.com' }, [
        { field: 'email', type: 'email' },
      ]);
      expect(errors.length).toBe(0);
    });

    it('should validate min length', () => {
      const errors = validateBody({ name: 'ab' }, [{ field: 'name', minLength: 3 }]);
      expect(errors.length).toBe(1);
    });

    it('should validate number range', () => {
      const errors = validateBody({ age: 150 }, [{ field: 'age', type: 'number', max: 120 }]);
      expect(errors.length).toBe(1);
    });

    it('should pass valid data', () => {
      const errors = validateBody({ name: 'John', email: 'john@test.com', age: 30 }, [
        { field: 'name', required: true, minLength: 2 },
        { field: 'email', required: true, type: 'email' },
        { field: 'age', type: 'number', min: 18, max: 120 },
      ]);
      expect(errors.length).toBe(0);
    });
  });
});
