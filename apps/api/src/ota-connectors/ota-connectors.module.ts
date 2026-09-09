import { Module } from '@nestjs/common';
import { HumanAdminGuard } from '../ai-ceo-agent/guards/human-admin.guard';
import { OtaConnectorsController } from './ota-connectors.controller';
import { OtaConnectorsService } from './ota-connectors.service';
@Module({controllers:[OtaConnectorsController],providers:[OtaConnectorsService,HumanAdminGuard]}) export class OtaConnectorsModule {}
