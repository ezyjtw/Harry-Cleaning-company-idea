export type Permission =
  | 'booking:create'
  | 'booking:read'
  | 'booking:update'
  | 'booking:cancel'
  | 'booking:admin'
  | 'cleaner:read'
  | 'cleaner:update'
  | 'cleaner:manage'
  | 'review:create'
  | 'review:moderate'
  | 'message:send'
  | 'message:read'
  | 'payment:process'
  | 'payment:refund'
  | 'dispute:create'
  | 'dispute:resolve'
  | 'admin:dashboard'
  | 'admin:users'
  | 'admin:settings'
  | 'admin:analytics';

const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  CLIENT: [
    'booking:create',
    'booking:read',
    'booking:cancel',
    'cleaner:read',
    'review:create',
    'message:send',
    'message:read',
    'dispute:create',
  ],
  CLEANER: [
    'booking:read',
    'booking:update',
    'cleaner:read',
    'cleaner:update',
    'message:send',
    'message:read',
    'dispute:create',
  ],
  ADMIN: [
    'booking:create',
    'booking:read',
    'booking:update',
    'booking:cancel',
    'booking:admin',
    'cleaner:read',
    'cleaner:update',
    'cleaner:manage',
    'review:create',
    'review:moderate',
    'message:send',
    'message:read',
    'payment:process',
    'payment:refund',
    'dispute:create',
    'dispute:resolve',
    'admin:dashboard',
    'admin:users',
    'admin:settings',
    'admin:analytics',
  ],
};

export function hasPermission(role: string, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;
  return permissions.includes(permission);
}

export function hasAnyPermission(role: string, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

export function hasAllPermissions(role: string, permissions: Permission[]): boolean {
  return permissions.every((p) => hasPermission(role, p));
}

export function getPermissions(role: string): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function requirePermission(role: string, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new Error(`Insufficient permissions: ${permission} required`);
  }
}
