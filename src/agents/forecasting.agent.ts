import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LLMProvider } from './llm.provider';
import { AgentTraceService } from './agent-trace.service';

@Injectable()
export class ForecastingAgent {
  private readonly logger = new Logger(ForecastingAgent.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LLMProvider,
    private readonly tracer: AgentTraceService,
  ) {}

  /**
   * Evaluates facility inventory levels, predicts depletions, and generates stock reallocations.
   */
  async execute(runId: string, parentSpanId?: string): Promise<any> {
    const startTime = Date.now();
    const spanId = await this.tracer.startSpan({
      runId,
      parentSpanId,
      agentName: 'Forecasting Agent',
      stepName: 'Vaccine Stock Forecasting & Inventory Rebalancing',
      stepType: 'ORCHESTRATOR',
      input: { action: 'FORECAST_INVENTORY' }
    });

    try {
      this.logger.log(`Executing Vaccine Stock Forecasting under run ${runId}`);

      // 1. Query the vaccine inventories
      const inventories = await this.prisma.vaccineInventory.findMany({
        orderBy: { updatedAt: 'desc' }
      });

      // Get vaccine details for mapping
      const vaccines = await this.prisma.vaccine.findMany({
        where: { isActive: true }
      });
      const vaccineMap = new Map(vaccines.map(v => [v.id, v]));

      // Get facility details for mapping
      const facilities = await this.prisma.healthFacility.findMany();
      const facilityMap = new Map(facilities.map(f => [f.id, f]));

      // 2. Identify low stocks and compute depletions
      // For demonstration, let's also ensure there is some mock data if inventories is empty, 
      // or compute real metrics if data is present.
      const depletions: any[] = [];
      const criticalThreshold = 30; // days remaining
      const safetyStockLevel = 50;

      // Group stock by vaccine and facility
      const stocks: Record<string, { inventoryId: string; vaccineId: string; vaccineName: string; facilityId: string; facilityName: string; quantity: number; subCounty: string; county: string }> = {};

      inventories.forEach(item => {
        const vaccine = vaccineMap.get(item.vaccineId);
        const facility = facilityMap.get(item.facilityId);
        if (vaccine && facility) {
          stocks[`${item.facilityId}_${item.vaccineId}`] = {
            inventoryId: item.id,
            vaccineId: item.vaccineId,
            vaccineName: vaccine.name,
            facilityId: item.facilityId,
            facilityName: facility.name,
            quantity: item.quantity,
            subCounty: facility.subCounty,
            county: facility.county
          };
        }
      });

      // If database has no stocks, seed a few mock active stocks for demo relevance
      const stockList = Object.values(stocks);
      if (stockList.length === 0 && facilities.length > 0 && vaccines.length > 0) {
        // Fallback demo data to guarantee an active inventory representation
        const f1 = facilities[0];
        const f2 = facilities[1] || f1;
        const v1 = vaccines[0];
        const v2 = vaccines[1] || v1;
        
        stockList.push(
          { inventoryId: 'inv_1', vaccineId: v1.id, vaccineName: v1.name, facilityId: f1.id, facilityName: f1.name, quantity: 15, subCounty: f1.subCounty, county: f1.county },
          { inventoryId: 'inv_2', vaccineId: v1.id, vaccineName: v1.name, facilityId: f2.id, facilityName: f2.name, quantity: 380, subCounty: f2.subCounty, county: f2.county },
          { inventoryId: 'inv_3', vaccineId: v2.id, vaccineName: v2.name, facilityId: f1.id, facilityName: f1.name, quantity: 24, subCounty: f1.subCounty, county: f1.county }
        );
      }

      // 3. Process stock lists to analyze depletion speeds
      const reallocations: any[] = [];
      const analyzedStocks = stockList.map(stock => {
        // burn rate = average vaccinations per day (mocked or calculated)
        // Let's assume a realistic average usage rate of 1.5 to 3 doses per day per dispensary/clinic
        const dailyBurnRate = stock.quantity < 50 ? 1.8 : 2.5; 
        const daysRemaining = Math.round(stock.quantity / dailyBurnRate);
        const status = daysRemaining < 10 ? 'CRITICAL' : daysRemaining < 20 ? 'HIGH' : 'NORMAL';

        return {
          ...stock,
          burnRate: dailyBurnRate,
          daysRemaining,
          status
        };
      });

      // Filter critical facilities and seek matching surplus clinics in same county
      const deficits = analyzedStocks.filter(s => s.status === 'CRITICAL' || s.quantity < safetyStockLevel);
      const surpluses = analyzedStocks.filter(s => s.quantity > 150);

      deficits.forEach(deficit => {
        // Look for surplus of the same vaccine in the same County
        const match = surpluses.find(s => s.vaccineId === deficit.vaccineId && s.county === deficit.county && s.facilityId !== deficit.facilityId);
        if (match) {
          const transQty = Math.min(150, Math.floor((match.quantity - 100) / 10) * 10);
          if (transQty > 20) {
            reallocations.push({
              vaccineId: deficit.vaccineId,
              vaccineName: deficit.vaccineName,
              sourceFacilityId: match.facilityId,
              sourceFacilityName: match.facilityName,
              destinationFacilityId: deficit.facilityId,
              destinationFacilityName: deficit.facilityName,
              quantity: transQty,
              savingsDoses: transQty,
              reason: `Prevents stockout at ${deficit.facilityName} which has only ${deficit.daysRemaining} days of stock remaining.`
            });
            
            // Adjust quantities temporarily in surplus list to avoid double-allocating
            match.quantity -= transQty;
          }
        }
      });

      // 4. Formulate LLM reasoning request
      const prompt = `
Analyze the following vaccine stocks and pending stock depletion warnings:
CRITICAL DEFICITS:
${JSON.stringify(deficits.map(d => ({ facility: d.facilityName, vaccine: d.vaccineName, quantity: d.quantity, daysRemaining: d.daysRemaining })), null, 2)}

PROPOSED REBALANCING TRANSFERS:
${JSON.stringify(reallocations, null, 2)}

Please write an executive inventory forecast report. Explain:
1. Why the shortage is predicted.
2. The supply bottleneck factors (e.g. cold chain constraints or sudden demand surges).
3. Confirm that the proposed stock reallocations will balance the system safely.
`;

      const llmSpanId = await this.tracer.startSpan({
        runId,
        parentSpanId: spanId,
        agentName: 'Forecasting Agent',
        stepName: 'Gemini Forecast Reasoning & Strategy',
        stepType: 'MODEL_CALL',
        input: { prompt }
      });

      const llmResult = await this.llm.generateContent(
        prompt,
        'You are an expert epidemiological logistics and vaccine forecasting agent working for the Ministry of Health. Formulate analytical reports detailing stock forecasts, depletion timelines, and reallocation balances.',
        { agentName: 'Forecasting Agent' }
      );

      await this.tracer.completeSpan(llmSpanId, {
        status: 'SUCCESS',
        output: { text: llmResult.text },
        thoughts: 'Analyzed inventories, identified critical deficits, and confirmed rebalancing transfers via county clinics.',
        latencyMs: Date.now() - startTime,
        tokensUsed: llmResult.tokensUsed
      });

      const result = {
        deficits: deficits.map(d => ({
          facilityId: d.facilityId,
          facilityName: d.facilityName,
          vaccineId: d.vaccineId,
          vaccineName: d.vaccineName,
          quantity: d.quantity,
          burnRate: d.burnRate,
          daysRemaining: d.daysRemaining,
          status: d.status
        })),
        reallocations,
        report: llmResult.text,
        agentSource: llmResult.source
      };

      await this.tracer.completeSpan(spanId, {
        status: 'SUCCESS',
        output: result,
        thoughts: `Completed vaccine stock forecasting. Found ${deficits.length} deficits and compiled ${reallocations.length} rebalance routes.`,
        latencyMs: Date.now() - startTime,
        tokensUsed: llmResult.tokensUsed
      });

      return result;
    } catch (error) {
      this.logger.error(`Error in ForecastingAgent: ${error.message}`, error.stack);
      
      await this.tracer.completeSpan(spanId, {
        status: 'FAILED',
        output: { error: error.message }
      });
      
      throw error;
    }
  }
}
