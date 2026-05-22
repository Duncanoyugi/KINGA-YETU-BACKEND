import { Injectable, Logger } from '@nestjs/common';
import { AgentTraceService } from './agent-trace.service';
import { ForecastingAgent } from './forecasting.agent';
import { OutreachAgent } from './outreach.agent';
import { RiskAnalysisAgent } from './risk-analysis.agent';
import { ReportingAgent } from './reporting.agent';

@Injectable()
export class RootOrchestratorAgent {
  private readonly logger = new Logger(RootOrchestratorAgent.name);

  constructor(
    private readonly tracer: AgentTraceService,
    private readonly forecastingAgent: ForecastingAgent,
    private readonly outreachAgent: OutreachAgent,
    private readonly riskAnalysisAgent: RiskAnalysisAgent,
    private readonly reportingAgent: ReportingAgent,
  ) {}

  /**
   * Generates a new distinct run ID
   */
  private generateRunId(): string {
    return 'run_' + Math.random().toString(36).substring(2, 10);
  }

  /**
   * Executes a complete multi-agent operational coordination run.
   * Tracks telemetry, triggers sub-agents, and aggregates reports.
   */
  async executeRun(): Promise<{ runId: string; durationMs: number; status: string; results: any }> {
    const startTime = Date.now();
    const runId = this.generateRunId();
    
    this.logger.log(`[Root Orchestrator] Triggering Autonomous Coordination Run: ${runId}`);

    const rootSpanId = await this.tracer.startSpan({
      runId,
      agentName: 'Root Orchestrator',
      stepName: 'Autonomous Multi-Agent Public Health Coordination Run',
      stepType: 'ORCHESTRATOR',
      input: { triggerSource: 'MANUAL_DASHBOARD_INVOCATION', timestamp: new Date() }
    });

    try {
      // 1. Invoke vaccine stock forecasting
      this.logger.log(`[Root Orchestrator] [Run: ${runId}] Step 1/4: Vaccine Inventory Forecasting...`);
      const forecastingResults = await this.forecastingAgent.execute(runId, rootSpanId);

      // 2. Invoke defaulter recovery and outreach campaign
      this.logger.log(`[Root Orchestrator] [Run: ${runId}] Step 2/4: Missed Immunization Defaulter Outreach...`);
      const outreachResults = await this.outreachAgent.execute(runId, rootSpanId);

      // 3. Invoke outbreak risk modeling
      this.logger.log(`[Root Orchestrator] [Run: ${runId}] Step 3/4: Disease Outbreak Early Warning Risk Modeling...`);
      const riskResults = await this.riskAnalysisAgent.execute(runId, rootSpanId);

      // 4. Combine results and generate professional brief
      this.logger.log(`[Root Orchestrator] [Run: ${runId}] Step 4/4: Ministry Brief Synthesis...`);
      const combinedSummary = {
        forecasting: forecastingResults,
        outreach: outreachResults,
        risk: riskResults
      };
      
      const reportingResults = await this.reportingAgent.execute(runId, combinedSummary, rootSpanId);

      const durationMs = Date.now() - startTime;
      
      const finalResults = {
        forecasting: forecastingResults,
        outreach: outreachResults,
        risk: riskResults,
        reporting: reportingResults
      };

      await this.tracer.completeSpan(rootSpanId, {
        status: 'SUCCESS',
        output: { runId, durationMs, summary: 'Run completed successfully with all vectors balanced.' },
        thoughts: 'Multi-agent cycle completed. Inventory depletions forecasted and balanced, defaulters mapped to campaigns with active tuning, symptom warnings recorded, and executive brief synthesized.',
        latencyMs: durationMs
      });

      this.logger.log(`[Root Orchestrator] Run ${runId} completed successfully in ${durationMs}ms`);

      return {
        runId,
        durationMs,
        status: 'SUCCESS',
        results: finalResults
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      this.logger.error(`[Root Orchestrator] Run ${runId} failed after ${durationMs}ms: ${error.message}`, error.stack);

      await this.tracer.completeSpan(rootSpanId, {
        status: 'FAILED',
        output: { error: error.message },
        latencyMs: durationMs
      });

      return {
        runId,
        durationMs,
        status: 'FAILED',
        results: { error: error.message }
      };
    }
  }
}
