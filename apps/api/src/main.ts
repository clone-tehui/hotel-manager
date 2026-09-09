import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.setGlobalPrefix('api', {
    exclude: [{ path: 'addons/sepay/webhook', method: RequestMethod.POST }],
  });

  const uploadsDir = join(process.cwd(), 'uploads');
  if (!existsSync(uploadsDir)) {
    mkdirSync(uploadsDir, { recursive: true });
  }
  app.useStaticAssets(uploadsDir, { prefix: '/uploads/' });

  // Baseline browser/API hardening. The Cloudflare tunnel terminates public TLS;
  // these headers also protect direct local access without changing route contracts.
  app.disable('x-powered-by');
  app.use((req: any, res: any, next: () => void) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  app.enableCors({
    origin: [
      'http://localhost:3000',
      'https://chiluxe.vn',
      'https://menu.chiluxe.vn',
      process.env.FRONTEND_URL,
    ].filter(Boolean) as string[],
    credentials: true,
  });

  // Rate-limit only AI CEO operations so existing bridge/webhook traffic is unaffected.
  const aiCeoHits = new Map<string, { count: number; resetAt: number }>();
  app.use('/api/ai-ceo-agent', (req: any, res: any, next: () => void) => {
    const now = Date.now();
    const key = String(req.user?.id || req.ip || 'unknown');
    const current = aiCeoHits.get(key);
    const state = !current || now >= current.resetAt ? { count: 0, resetAt: now + 60_000 } : current;
    state.count += 1;
    aiCeoHits.set(key, state);
    if (state.count > 60) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((state.resetAt - now) / 1000))));
      return res.status(429).json({ ok: false, error: 'Too many AI CEO requests' });
    }
    next();
  });

  // Global response format: { ok, data, meta }
  app.useGlobalInterceptors(new ResponseInterceptor());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // ── Swagger ─────────────────────────────────────────────────────────────────
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Hotel Management API')
    .setDescription(`
## Hệ thống quản lý đặt phòng lưu trú

### Response Format
Tất cả response đều theo chuẩn:
\`\`\`json
{ "ok": true, "data": {}, "meta": {} }
\`\`\`
Với danh sách: \`data\` là mảng items, \`meta\` chứa \`{ total, page, limit, totalPages }\`.
    `)
    .setVersion('2.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'JWT')
    .addTag('Auth', 'Đăng nhập, refresh token, thông tin tài khoản')
    .addTag('Health', 'Kiểm tra hệ thống')
    .addTag('Room Types', 'Quản lý loại phòng')
    .addTag('Rooms', 'Quản lý phòng')
    .addTag('Guests', 'Quản lý khách hàng')
    .addTag('Reservations', 'Quản lý đặt phòng')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = process.env.API_PORT || 3001;
  await app.listen(port);

  console.log(`\n🚀 API:     http://localhost:${port}/api`);
  console.log(`📄 Swagger: http://localhost:${port}/api/docs`);
  console.log(`🌐 Env:     ${process.env.NODE_ENV || 'development'}\n`);
}

bootstrap();
