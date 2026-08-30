import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true, // available in all modules without re-importing
      envFilePath: '.env',
    }),
  ],
})
export class ConfigModule {}
