import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface TraceSpan {
  id: string;
  spanId: string;
  runId: string;
  parentSpanId?: string | null;
  agentName: string;
  stepName: string;
  stepType: 'THOUGHT' | 'TOOL_CALL' | 'MODEL_CALL' | 'ACTION' | 'ORCHESTRATOR';
  input: string;
  output: string;
  thoughts?: string | null;
  latencyMs: number;
  tokensUsed: number;
  status: 'SUCCESS' | 'FAILED';
  createdAt: Date;
}

@Injectable()
export class AgentTraceService {
  private readonly logger = new Logger(AgentTraceService.name);
  
  // Resilient fallback storage in case database write fails or migrations are pending
  private memoryTraces: TraceSpan[] = [];

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper to generate a random string ID mimicking CUID
   */
  private generateId(): string {
    return 'span_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  /**
   * Starts a new trace span and returns its ID
   */
  async startSpan(params: {
    runId: string;
    parentSpanId?: string;
    agentName: string;
    stepName: string;
    stepType: 'THOUGHT' | 'TOOL_CALL' | 'MODEL_CALL' | 'ACTION' | 'ORCHESTRATOR';
    input: any;
  }): Promise<string> {
    const spanId = this.generateId();
    const newSpan: TraceSpan = {
      id: spanId,
      spanId: spanId,
      runId: params.runId,
      parentSpanId: params.parentSpanId || null,
      agentName: params.agentName,
      stepName: params.stepName,
      stepType: params.stepType,
      input: typeof params.input === 'string' ? params.input : JSON.stringify(params.input),
      output: '',
      thoughts: '',
      latencyMs: 0,
      tokensUsed: 0,
      status: 'SUCCESS',
      createdAt: new Date(),
    };

    this.memoryTraces.push(newSpan);
    
    // Attempt database save (non-blocking, failures captured gracefully)
    try {
      await this.prisma.agentTrace.create({
        data: {
          id: newSpan.id,
          spanId: newSpan.spanId,
          runId: newSpan.runId,
          parentSpanId: newSpan.parentSpanId,
          agentName: newSpan.agentName,
          stepName: newSpan.stepName,
          stepType: newSpan.stepType,
          input: newSpan.input,
          output: newSpan.output,
          thoughts: newSpan.thoughts,
          latencyMs: newSpan.latencyMs,
          tokensUsed: newSpan.tokensUsed,
          status: newSpan.status,
          createdAt: newSpan.createdAt,
        },
      });
    } catch (e) {
      this.logger.warn(`Failed to commit span ${spanId} to database: ${e.message}. Fallback to memory-trace active.`);
    }

    return spanId;
  }

  /**
   * Completes an existing span with output and telemetry
   */
  async completeSpan(
    spanId: string,
    params: {
      status: 'SUCCESS' | 'FAILED';
      output: any;
      thoughts?: string;
      latencyMs?: number;
      tokensUsed?: number;
    },
  ): Promise<void> {
    const outputString = typeof params.output === 'string' ? params.output : JSON.stringify(params.output);
    const thoughtsString = params.thoughts || '';
    const tokens = params.tokensUsed || 0;

    // Update memory
    const memSpan = this.memoryTraces.find(s => s.id === spanId);
    let calculatedLatency = params.latencyMs;
    if (calculatedLatency === undefined) {
      if (memSpan) {
        calculatedLatency = Date.now() - memSpan.createdAt.getTime();
      } else {
        calculatedLatency = 0;
      }
    }

    if (memSpan) {
      memSpan.status = params.status;
      memSpan.output = outputString;
      memSpan.thoughts = thoughtsString;
      memSpan.latencyMs = calculatedLatency;
      memSpan.tokensUsed = tokens;
    }

    // Update database
    try {
      await this.prisma.agentTrace.update({
        where: { id: spanId },
        data: {
          status: params.status,
          output: outputString,
          thoughts: thoughtsString,
          latencyMs: calculatedLatency,
          tokensUsed: tokens,
        },
      });
    } catch (e) {
      this.logger.warn(`Failed to complete span ${spanId} in database: ${e.message}`);
    }
  }

  /**
   * Lists recent distinct agent runs for the tracking selector
   */
  async getRecentRuns(limit: number = 20): Promise<Array<{ runId: string; agentName: string; stepName: string; durationMs: number; spanCount: number; status: string; createdAt: Date }>> {
    try {
      const dbTraces = await this.prisma.agentTrace.findMany({
        orderBy: { createdAt: 'desc' },
      });
      
      return this.aggregateRuns(dbTraces as unknown as TraceSpan[], limit);
    } catch (e) {
      this.logger.warn(`Failed to load runs from DB, using memory fallback: ${e.message}`);
      return this.aggregateRuns(this.memoryTraces, limit);
    }
  }

  /**
   * Internal helper to aggregate flat spans into distinct execution runs
   */
  private aggregateRuns(spans: TraceSpan[], limit: number): any[] {
    const runsMap = new Map<string, {
      runId: string;
      agentName: string;
      stepName: string;
      durationMs: number;
      spanCount: number;
      status: string;
      createdAt: Date;
    }>();

    // Process from oldest to newest to capture accurate root and cumulative durations
    const sorted = [...spans].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    
    for (const span of sorted) {
      const existing = runsMap.get(span.runId);
      if (!existing) {
        runsMap.set(span.runId, {
          runId: span.runId,
          agentName: span.agentName,
          stepName: span.stepName,
          durationMs: span.latencyMs,
          spanCount: 1,
          status: span.status,
          createdAt: span.createdAt,
        });
      } else {
        existing.spanCount += 1;
        existing.durationMs += span.latencyMs;
        if (span.status === 'FAILED') {
          existing.status = 'FAILED';
        }
      }
    }

    return Array.from(runsMap.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  /**
   * Fetches flat list of spans in a run
   */
  async getRunSpans(runId: string): Promise<TraceSpan[]> {
    try {
      const dbSpans = await this.prisma.agentTrace.findMany({
        where: { runId },
        orderBy: { createdAt: 'asc' },
      });
      if (dbSpans.length > 0) {
        return dbSpans as unknown as TraceSpan[];
      }
    } catch (e) {
      this.logger.warn(`Failed to read run spans from DB: ${e.message}`);
    }
    return this.memoryTraces.filter(s => s.runId === runId).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  /**
   * Compiles flat run spans into an explainable nested tree node structure
   */
  async getRunTree(runId: string): Promise<any> {
    const spans = await this.getRunSpans(runId);
    if (spans.length === 0) return null;

    const spanMap = new Map<string, any>();
    const roots: any[] = [];

    // Initialize all spans in map
    spans.forEach(span => {
      spanMap.set(span.id, {
        id: span.id,
        runId: span.runId,
        parentSpanId: span.parentSpanId,
        agentName: span.agentName,
        stepName: span.stepName,
        stepType: span.stepType,
        input: this.safeParse(span.input),
        output: this.safeParse(span.output),
        thoughts: span.thoughts,
        latencyMs: span.latencyMs,
        tokensUsed: span.tokensUsed,
        status: span.status,
        createdAt: span.createdAt,
        children: [],
      });
    });

    // Nest children
    spanMap.forEach(spanNode => {
      if (spanNode.parentSpanId && spanMap.has(spanNode.parentSpanId)) {
        spanMap.get(spanNode.parentSpanId).children.push(spanNode);
      } else {
        roots.push(spanNode);
      }
    });

    return roots.length > 0 ? roots[0] : null;
  }

  private safeParse(value: string): any {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
}
