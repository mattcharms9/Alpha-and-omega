import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";

export interface AgentMeta {
  tokens?: number;
  cost?: number;
  durationMs?: number;
  error?: string;
}

export type LogFn = (agentName: string, data: object, output: object, meta: AgentMeta) => Promise<void>;

export function makeLogFn(queueId: string): LogFn {
  return async (agentName, inputData, outputData, meta) => {
    await prisma.agentRunLog.create({
      data: {
        queueId,
        agentName,
        status: meta.error ? "failed" : "complete",
        inputData: inputData as Prisma.InputJsonValue,
        outputData: outputData as Prisma.InputJsonValue,
        tokensUsed: meta.tokens ?? 0,
        costEstimate: meta.cost ?? 0,
        durationMs: meta.durationMs ?? 0,
        errorMessage: meta.error ?? null,
        completedAt: new Date(),
      },
    }).catch(() => {}); // Non-fatal — never let logging break the pipeline
  };
}

export function estimateCost(tokens: number): number {
  // Claude Sonnet 4.6: ~$3/M input, ~$15/M output — rough blended estimate
  return (tokens / 1_000_000) * 9;
}
