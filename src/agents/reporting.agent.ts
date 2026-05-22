import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LLMProvider } from './llm.provider';
import { AgentTraceService } from './agent-trace.service';

@Injectable()
export class ReportingAgent {
  private readonly logger = new Logger(ReportingAgent.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LLMProvider,
    private readonly tracer: AgentTraceService,
  ) {}

  /**
   * Aggregates findings from all sub-agents and synthesizes a professional public health briefing.
   */
  async execute(runId: string, contextSummary: any, parentSpanId?: string): Promise<any> {
    const startTime = Date.now();
    const spanId = await this.tracer.startSpan({
      runId,
      parentSpanId,
      agentName: 'Reporting Agent',
      stepName: 'Autonomous Public Health Briefing Synthesis',
      stepType: 'ORCHESTRATOR',
      input: { runId, reallocationsCount: contextSummary?.reallocations?.length || 0, targetsCount: contextSummary?.outreach?.targetsCount || 0, alertsCount: contextSummary?.risk?.alerts?.length || 0 }
    });

    try {
      this.logger.log(`Executing Briefing Generation under run ${runId}`);

      // 1. Construct prompt detailing findings of all agents
      const prompt = `
Please generate a formal, comprehensive Ministry of Health intelligence report summarizing the autonomous public health coordination operations executed during run "${runId}".

SUMMARY DATA:
1. VACCINE FORECASTING & REBALANCING:
- Critical Deficits Identified: ${contextSummary?.forecasting?.deficits?.length || 0} facilities
- Proposed Redistributive Reallocations: ${JSON.stringify(contextSummary?.forecasting?.reallocations, null, 2)}

2. MISSED IMMUNIZATION RECOVERY:
- Defaulters Targeted: ${contextSummary?.outreach?.targetsCount || 0} children
- Active Recovery Campaign ID: ${contextSummary?.outreach?.campaignId || 'N/A'}
- AI Channel Tuning Log: ${JSON.stringify(contextSummary?.outreach?.tuningLog, null, 2)}

3. OUTBREAK RISK ALERTS:
- Active High-Probability Outbreaks: ${contextSummary?.risk?.alerts?.length || 0} regions
- Outbreak Warnings: ${JSON.stringify(contextSummary?.risk?.alerts?.map(a => ({ disease: a.disease, region: a.region, riskScore: a.riskScore, findings: a.findings })), null, 2)}

Please write a highly polished, professional briefing in Markdown featuring:
- **Title**: KINGA YETU AI — AUTONOMOUS PUBLIC HEALTH INTELLIGENCE SUMMARY
- **Executive Summary**: A high-impact opening highlighting that the system proactively balanced inventories, optimized patient outreach, and mapped disease threats.
- **Detailed Vector Analysis Sections**: Stock Forecasting, Defaulter Campaigns, and Disease Risk Warning.
- **Strategic Impact Recommendations**: Concluding guidelines for NGOs, local clinics, and County Health Directors.
`;

      const llmSpanId = await this.tracer.startSpan({
        runId,
        parentSpanId: spanId,
        agentName: 'Reporting Agent',
        stepName: 'Gemini Executive Briefing Generation',
        stepType: 'MODEL_CALL',
        input: { prompt }
      });

      const llmResult = await this.llm.generateContent(
        prompt,
        'You are an expert Chief Medical Officer and public health director. Draft elegant, standard-compliant executive reports summarizing healthcare logistics, vaccine allocations, maternal outreach campaigns, and epidemiologic warning scores.',
        { agentName: 'Reporting Agent' }
      );

      await this.tracer.completeSpan(llmSpanId, {
        status: 'SUCCESS',
        output: { text: llmResult.text },
        thoughts: 'Synthesized executive markdown brief combining stock rebalances, defaulter outreach, and epidemiologic warnings.',
        latencyMs: Date.now() - startTime,
        tokensUsed: llmResult.tokensUsed
      });

      const result = {
        brief: llmResult.text,
        agentSource: llmResult.source
      };

      await this.tracer.completeSpan(spanId, {
        status: 'SUCCESS',
        output: result,
        thoughts: `Autonomous Briefing successfully completed for run ${runId}. Briefing length: ${llmResult.text.length} characters.`,
        latencyMs: Date.now() - startTime,
        tokensUsed: llmResult.tokensUsed
      });

      return result;
    } catch (error) {
      this.logger.error(`Error in ReportingAgent: ${error.message}`, error.stack);
      
      await this.tracer.completeSpan(spanId, {
        status: 'FAILED',
        output: { error: error.message }
      });
      
      throw error;
    }
  }
}
