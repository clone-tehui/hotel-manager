import { SetMetadata } from '@nestjs/common';

// We keep the stored DB roles for backward compatibility (ADMIN/MANAGER/RECEPTIONIST/VIEWER),
// but enforce only 2 permission tiers at runtime: ADMIN and USER.
export type PermissionRole = 'ADMIN' | 'USER';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: PermissionRole[]) => SetMetadata(ROLES_KEY, roles);
