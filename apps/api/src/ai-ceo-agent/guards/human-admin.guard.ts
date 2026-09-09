import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

/** AI CEO controls are human ADMIN operations; integration API keys cannot invoke them. */
@Injectable()
export class HumanAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest().user;
    if (user?.authType === 'apiKey') throw new ForbiddenException('API key cannot access AI CEO controls');
    return true;
  }
}
