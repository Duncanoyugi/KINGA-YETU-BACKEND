import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';
import { AgentTraceService } from './agent-trace.service';
import { LLMProvider } from './llm.provider';
import { RootOrchestratorAgent } from './root-orchestrator.agent';
import { ForecastingAgent } from './forecasting.agent';
import { OutreachAgent } from './outreach.agent';
import { RiskAnalysisAgent } from './risk-analysis.agent';
import { ReportingAgent } from './reporting.agent';

@Module({
  imports: [PrismaModule],
  controllers: [AgentsController],
  providers: [
    AgentsService,
    AgentTraceService,
    LLMProvider,
    RootOrchestratorAgent,
    ForecastingAgent,
    OutreachAgent,
    RiskAnalysisAgent,
    ReportingAgent
  ],
  exports: [
    AgentsService,
    AgentTraceService,
    LLMProvider,
    RootOrchestratorAgent,
    ForecastingAgent,
    OutreachAgent,
    RiskAnalysisAgent,
    ReportingAgent
  ]
})
export class AgentsModule {}
