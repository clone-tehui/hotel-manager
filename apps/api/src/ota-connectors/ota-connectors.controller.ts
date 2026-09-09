import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { HumanAdminGuard } from '../ai-ceo-agent/guards/human-admin.guard';
import { OtaConnectorsService } from './ota-connectors.service';
@ApiTags('OTA Connectors') @ApiBearerAuth('JWT') @UseGuards(JwtAuthGuard, RolesGuard, HumanAdminGuard) @Roles('ADMIN') @Controller('ota-connectors')
export class OtaConnectorsController {
 constructor(private readonly service:OtaConnectorsService){}
 @Get() list(){return this.service.list()}
 @Patch(':channel') configure(@Param('channel') channel:string,@Body() body:{credentials:Record<string,string>;enabled?:boolean},@Req() req:any){return this.service.configure(channel,body?.credentials,body?.enabled,req.user?.id)}
 @Post(':id/preview') @ApiOperation({summary:'Validate local OTA state; never calls an OTA'}) preview(@Param('id') id:string,@Req() req:any){return this.service.preview(id,req.user?.id)}
 @Post(':id/execute') @ApiOperation({summary:'Human-only gate; fails closed until reviewed adapter exists'}) execute(@Param('id') id:string,@Req() req:any){return this.service.execute(id,req.user?.id)}
 @Get(':id/audits') audits(@Param('id')id:string){return this.service.audits(id)}
}
