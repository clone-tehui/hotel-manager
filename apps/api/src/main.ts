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

  app.enableCors({
    origin: [
      'http://localhost:3000',
      'https://tehui.io.vn',
      'https://chihomeoder.tehui.io.vn',
      'https://menu.chiluxe.vn',
      process.env.FRONTEND_URL,
    ].filter(Boolean) as string[],
    credentials: true,
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
