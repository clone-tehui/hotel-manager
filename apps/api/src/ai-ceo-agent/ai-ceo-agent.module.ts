import { Module } from '@nestjs/common';
import { AiCeoAgentController } from './ai-ceo-agent.controller';
import { RoomIntelligenceService } from './room-intelligence.service';
import { ToolRegistry } from './tools/tool-registry';
import { AiCeoReadTools } from './tools/read-tools';
import { AsyncAiRunService } from './runtime/async-run.service';
import { PrismaToolAuditSink } from './runtime/prisma-tool-audit';
import { BatchAnalysisService } from './runtime/batch-analysis.service';
import { AiCeoAgentService } from './ai-ceo-agent.service';
import { DashboardModule } from '../dashboard/dashboard.module';
import { HumanAdminGuard } from './guards/human-admin.guard';

@Module({
  imports: [DashboardModule],
  controllers: [AiCeoAgentController],
  providers: [AiCeoAgentService, RoomIntelligenceService, ToolRegistry, AiCeoReadTools, AsyncAiRunService, PrismaToolAuditSink, BatchAnalysisService, HumanAdminGuard],
})
export class AiCeoAgentModule {}
