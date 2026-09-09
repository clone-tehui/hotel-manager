import { strict as assert } from 'assert';
import { HumanAdminGuard } from './human-admin.guard';

function context(user: any): any { return { switchToHttp: () => ({ getRequest: () => ({ user }) }) }; }
const guard = new HumanAdminGuard();
assert.equal(guard.canActivate(context({ role: 'ADMIN' })), true);
assert.throws(() => guard.canActivate(context({ role: 'ADMIN', authType: 'apiKey' })), /API key cannot access AI CEO controls/);
console.log('human admin guard tests passed');
