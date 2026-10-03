import { Module } from '@nestjs/common';
import { ApiKeyGuard } from '../api-keys/api-key.guard';
import { HousekeepingSyncController } from './housekeeping-sync.controller';
import { HousekeepingSyncService } from './housekeeping-sync.service';

@Module({
  controllers: [HousekeepingSyncController],
  providers: [HousekeepingSyncService, ApiKeyGuard],
})
export class HousekeepingSyncModule {}
