import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { HumanAdminGuard } from './guards/human-admin.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AiCeoAgentService } from './ai-ceo-agent.service';
import { AsyncAiRunService } from './runtime/async-run.service';

@ApiTags('AI CEO Agent')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard, HumanAdminGuard)
@Roles('ADMIN')
@Controller('ai-ceo-agent')
export class AiCeoAgentController {
  constructor(private readonly service: AiCeoAgentService, private readonly asyncRuns: AsyncAiRunService) {}

  @Get('status') getStatus() { return this.service.getStatus(); }
  @Get('runs') getRuns(@Query('limit') limit = '10') { return this.service.getRuns(Number(limit)); }
  @Get('campaigns') getCampaigns(@Query('status') status?: string) { return this.service.getCampaigns(status); }

  @Patch('campaigns/:id/status')
  transitionCampaign(@Param('id') id: string, @Body() body: { status: string; reason?: string }, @Req() req: any) {
    return this.service.transitionCampaign(id, body?.status, body?.reason, req.user?.id);
  }

  @Post('campaigns/:id/measure')
  @ApiOperation({ summary: 'Measure a completed campaign against its persisted proposal baseline' })
  measureCampaign(@Param('id') id: string, @Req() req: any) { return this.service.measureCampaign(id, req.user?.id); }

  @Post('campaigns/:id/lesson')
  @ApiOperation({ summary: 'Create a typed advisory lesson from a persisted measured campaign outcome' })
  createMeasuredCampaignLesson(@Param('id') id: string) { return this.service.createMeasuredCampaignLesson(id); }

  @Get('memories') getMemories(@Query('category') category?: string) { return this.service.getMemories(category); }

  @Patch('memories/:id')
  updateMemoryControl(@Param('id') id: string, @Body() body: { status?: string; expiresAt?: string | null; invalidationReason?: string }, @Req() req: any) {
    return this.service.updateMemoryControl(id, body, req.user?.id);
  }

  @Post('runs/:id/company-synthesis')
  synthesizeCompany(@Param('id') id: string) { return this.service.synthesizeCompany(id); }

  @Patch('config')
  @ApiOperation({ summary: 'Configure model/runtime. OpenRouter key remains environment-only.' })
  updateConfig(@Body() body: { model?: string; enabled?: boolean; maxTokens?: number; apiKey?: string; endpoint?: string; runControls?: { maxRunsPerDay?: number; maxBatchesPerRun?: number; maxConcurrentRuns?: number; failureThreshold?: number; cooldownMs?: number } }) { return this.service.updateConfig(body); }


  @Post('runs')
  @HttpCode(202)
  createRun(@Body() body: { periodKeys?: string[]; runMode?: string; roomIds?: string[] }, @Req() req: any) { return this.asyncRuns.enqueue(body, req.user); }

  @Post('campaigns/:id/retry-ai')
  @HttpCode(202)
  async retryFallbackCampaign(@Param('id') id: string, @Req() req: any) {
    const campaign = await this.service.getFallbackCampaign(id);
    return this.asyncRuns.enqueue({ roomIds: [campaign.roomId], periodKeys: [campaign.periodKey], runMode: `RETRY_FALLBACK_${campaign.id}` }, req.user);
  }

  @Get('runs/:id')
  getRun(@Param('id') id: string) { return this.asyncRuns.getRun(id); }

  @Post('runs/:id/cancel')
  cancelRun(@Param('id') id: string) { return this.asyncRuns.cancel(id); }

  @Post('run')
  @HttpCode(202)
  @ApiOperation({ summary: 'Queue advisory/read-only CEO analysis using the validated async pipeline' })
  run(@Body() body: { periodKeys?: string[] }, @Req() req: any) { return this.asyncRuns.enqueue({ periodKeys: body?.periodKeys, runMode: 'PORTFOLIO_REVIEW' }, req.user); }
}
