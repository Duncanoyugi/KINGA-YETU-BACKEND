import { Controller, Get, Post, Param, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AgentsService } from './agents.service';

// Previously this controller had NO auth guard at all: anyone on the
// internet, with no login, could trigger a full autonomous orchestrator
// run (real cost — LLM calls, real outreach to real families), read
// outbreak early-warning alerts and per-run explainability traces
// (operational public-health surveillance data), and post fabricated
// campaign-response feedback that would poison the system's own
// optimization loop. This is an internal ops/admin tool, not an
// end-user-facing feature — restricted accordingly.
@ApiTags('agents')
@ApiBearerAuth()
@Controller('agents')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Post('trigger')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Triggers the autonomous root public health coordination orchestrator run' })
  async triggerOrchestrator() {
    return this.agentsService.triggerRun();
  }

  @Get('status')
  @ApiOperation({ summary: 'Gets current operating statistics for the agents' })
  async getStatus() {
    return this.agentsService.getStatus();
  }

  @Get('traces')
  @ApiOperation({ summary: 'Gets a flat list of recent orchestrator runs' })
  async getRecentRuns() {
    return this.agentsService.getRecentRuns();
  }

  @Get('traces/:runId')
  @ApiOperation({ summary: 'Gets the nested span execution tree for a run (explainability tree)' })
  @ApiParam({ name: 'runId', type: String })
  async getRunTree(@Param('runId') runId: string) {
    return this.agentsService.getRunTree(runId);
  }

  @Get('campaigns')
  @ApiOperation({ summary: 'Gets active autonomous outreach campaigns' })
  async getCampaigns() {
    return this.agentsService.getCampaigns();
  }

  @Post('campaigns/:id/respond')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Records parent catchup response to update optimization feedback loop' })
  @ApiParam({ name: 'id', type: String })
  async recordResponse(
    @Param('id') campaignId: string,
    @Body() body: { channel: string; responded: boolean }
  ) {
    return this.agentsService.recordResponse(campaignId, body.channel, body.responded);
  }

  @Get('alerts')
  @ApiOperation({ summary: 'Gets active outbreak early warnings alerts' })
  async getAlerts() {
    return this.agentsService.getAlerts();
  }
}
