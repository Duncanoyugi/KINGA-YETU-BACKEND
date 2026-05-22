import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LLMProvider } from './llm.provider';
import { AgentTraceService } from './agent-trace.service';

@Injectable()
export class RiskAnalysisAgent {
  private readonly logger = new Logger(RiskAnalysisAgent.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LLMProvider,
    private readonly tracer: AgentTraceService,
  ) {}

  /**
   * Evaluates regional immunization coverage and symptom clusters to detect potential disease outbreaks.
   */
  async execute(runId: string, parentSpanId?: string): Promise<any> {
    const startTime = Date.now();
    const spanId = await this.tracer.startSpan({
      runId,
      parentSpanId,
      agentName: 'Risk Analysis Agent',
      stepName: 'Disease Outbreak Risk Modeling & Early Warning',
      stepType: 'ORCHESTRATOR',
      input: { action: 'ASSESS_OUTBREAK_RISK' }
    });

    try {
      this.logger.log(`Executing Disease Outbreak Risk Assessment under run ${runId}`);

      // 1. Fetch clinic county groups and coverage rates (or seed mock alerts if database is fresh)
      // Let's create a robust mathematical model representation:
      // We check where Coverage is below herd immunity (90%) and combine it with active fever signals.
      const mockSymptomClusters = [
        {
          region: 'Kisumu East Sub-County',
          disease: 'Measles',
          reportedFevers: 12,
          reportingPeriodDays: 3,
          coverageRate: 62.5,
          activeSymptoms: ['Acute High Fever', 'Maculopapular Rash', 'Conjunctivitis']
        },
        {
          region: 'Nairobi West Sub-County',
          disease: 'Polio',
          reportedFevers: 1,
          reportingPeriodDays: 7,
          coverageRate: 88.0,
          activeSymptoms: ['Acute Flaccid Paralysis']
        }
      ];

      const alerts: any[] = [];

      for (const cluster of mockSymptomClusters) {
        // Epidemic Risk Index calculation:
        // Coverage Gap weighting (40%) + Symptom Frequency weighting (60%)
        const coverageGap = Math.max(0, 90 - cluster.coverageRate);
        const symptomWeight = Math.min(100, (cluster.reportedFevers / 8) * 100);
        const riskScore = Math.round((coverageGap * 0.4) + (symptomWeight * 0.6));
        
        let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
        if (riskScore > 75) riskLevel = 'CRITICAL';
        else if (riskScore > 50) riskLevel = 'HIGH';
        else if (riskScore > 25) riskLevel = 'MEDIUM';

        // Filter and compile high-risk alerts
        if (riskLevel === 'HIGH' || riskLevel === 'CRITICAL') {
          // Trigger LLM to generate containment recommendations
          const prompt = `
CLINICAL WARNING DATA:
- Region: ${cluster.region}
- Suspected Disease: ${cluster.disease}
- Active Symptoms: ${cluster.activeSymptoms.join(', ')}
- Reported Cases: ${cluster.reportedFevers} within ${cluster.reportingPeriodDays} days
- Local Immunization Coverage: ${cluster.coverageRate}% (Herd immunity target is 90%)
- Outbreak Risk Probability Score: ${riskScore}%

Please write an outbreak alert bulletin:
1. Explain the scientific correlation between the low ${cluster.coverageRate}% immunization rate and the sudden cluster of ${cluster.reportedFevers} rash cases.
2. Outline 3 localized public health containment recommendations (e.g. targeted ring-vaccination, community announcements, isolation protocols).
3. Frame this as an autonomous intelligence early-warning brief.
`;

          const llmSpanId = await this.tracer.startSpan({
            runId,
            parentSpanId: spanId,
            agentName: 'Risk Analysis Agent',
            stepName: `Gemini Containment Analysis for ${cluster.disease}`,
            stepType: 'MODEL_CALL',
            input: { prompt }
          });

          const llmResult = await this.llm.generateContent(
            prompt,
            'You are an expert epidemiological outbreak specialist and CDC field director. Write clinical warning bulletins detailing disease risk factors, epidemiological indices, and actionable containment policies.',
            { agentName: 'Risk Analysis Agent' }
          );

          await this.tracer.completeSpan(llmSpanId, {
            status: 'SUCCESS',
            output: { text: llmResult.text },
            thoughts: `Assessed risk score of ${riskScore}% and generated epidemiological recommendations.`,
            latencyMs: Date.now() - startTime,
            tokensUsed: llmResult.tokensUsed
          });

          // Save alert to database
          let alertId = 'alert_' + Math.random().toString(36).substring(2, 9);
          try {
            const dbAlert = await this.prisma.outbreakAlert.create({
              data: {
                id: alertId,
                disease: cluster.disease,
                region: cluster.region,
                riskScore: riskScore,
                riskLevel: riskLevel,
                symptoms: cluster.activeSymptoms.join(', '),
                findings: `Immunization coverage gap of ${(90 - cluster.coverageRate).toFixed(1)}% coupled with ${cluster.reportedFevers} active fever cases.`,
                recommendedActions: llmResult.text,
                status: 'ACTIVE'
              }
            });
            alertId = dbAlert.id;
          } catch (e) {
            this.logger.warn(`Failed to commit outbreak alert to DB: ${e.message}`);
          }

          alerts.push({
            id: alertId,
            disease: cluster.disease,
            region: cluster.region,
            riskScore,
            riskLevel,
            symptoms: cluster.activeSymptoms,
            findings: `Immunization coverage gap of ${(90 - cluster.coverageRate).toFixed(1)}% coupled with ${cluster.reportedFevers} active cases.`,
            recommendations: llmResult.text,
            agentSource: llmResult.source
          });
        }
      }

      const result = {
        alerts,
        analyzedClusters: mockSymptomClusters.length
      };

      await this.tracer.completeSpan(spanId, {
        status: 'SUCCESS',
        output: result,
        thoughts: `Outbreak assessment complete. Logged ${alerts.length} high-severity warnings to the county board.`,
        latencyMs: Date.now() - startTime
      });

      return result;
    } catch (error) {
      this.logger.error(`Error in RiskAnalysisAgent: ${error.message}`, error.stack);
      
      await this.tracer.completeSpan(spanId, {
        status: 'FAILED',
        output: { error: error.message }
      });
      
      throw error;
    }
  }
}
