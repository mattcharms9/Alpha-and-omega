type LogLevel = "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  route: string;
  action?: string;
  durationMs?: number;
  tokensUsed?: number;
  status: number;
  ip?: string;
  userId?: string;
  error?: string;
  timestamp: string;
}

export function log(entry: Omit<LogEntry, "timestamp">): void {
  const full: LogEntry = { ...entry, timestamp: new Date().toISOString() };
  if (entry.level === "error") {
    console.error(JSON.stringify(full));
  } else {
    console.log(JSON.stringify(full));
  }
}

export function logAICall(params: {
  engine: string;
  action: string;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  cached: boolean;
  userId?: string;
}): void {
  log({
    level: "info",
    route: `ai/${params.engine}`,
    action: params.action,
    durationMs: params.durationMs,
    tokensUsed: params.inputTokens + params.outputTokens,
    status: 200,
    userId: params.userId,
  });

  const inputCost = params.cached
    ? params.inputTokens * 0.000003 * 0.1
    : params.inputTokens * 0.000003;
  const outputCost = params.outputTokens * 0.000015;
  const totalCost = inputCost + outputCost;

  console.log(
    JSON.stringify({
      type: "ai_cost",
      engine: params.engine,
      estimatedCostUsd: totalCost.toFixed(6),
      cached: params.cached,
      timestamp: new Date().toISOString(),
    })
  );
}
