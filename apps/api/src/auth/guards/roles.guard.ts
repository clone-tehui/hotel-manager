import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, PermissionRole } from '../decorators/roles.decorator';

function toPermissionRole(dbRole: any): PermissionRole {
  return dbRole === 'ADMIN' ? 'ADMIN' : 'USER';
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<PermissionRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No role requirement => allow
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user;
    const role = toPermissionRole(user?.role);

    if (!role || !required.includes(role)) {
      throw new ForbiddenException('Bạn không có quyền truy cập chức năng này');
    }
    return true;
  }
}
