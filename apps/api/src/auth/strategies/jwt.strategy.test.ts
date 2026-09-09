import { strict as assert } from 'assert';
import { JwtStrategy } from './jwt.strategy';

const config: any = { get: () => 'test-secret' };
const user = { id: 'u1', email: 'u@example.test', fullName: 'Test', role: 'ADMIN', isActive: true, isLocked: false };
const prisma: any = { user: { findUnique: async () => user } };
const strategy = new JwtStrategy(config, prisma);

(async () => {
  const active = await strategy.validate({ sub: 'u1', email: user.email });
  assert.equal(active.id, 'u1');
  user.isLocked = true;
  await assert.rejects(() => strategy.validate({ sub: 'u1', email: user.email }), /Token không hợp lệ/);
  user.isLocked = false;
  user.isActive = false;
  await assert.rejects(() => strategy.validate({ sub: 'u1', email: user.email }), /Token không hợp lệ/);
  console.log('jwt strategy active/locked policy tests passed');
})().catch((error) => { console.error(error); process.exit(1); });
