export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function toSafeErrorMessage(error: unknown): { message: string; status: number } {
  if (error instanceof AppError) {
    return { message: error.message, status: error.statusCode };
  }
  if (error instanceof SyntaxError) {
    return { message: "Service temporarily unavailable", status: 500 };
  }
  if (error instanceof Error) {
    const msg = error.message;
    const isInfrastructureError =
      msg.includes("://") ||
      msg.includes("SQLITE") ||
      msg.includes("ENOENT") ||
      msg.includes("ECONNREFUSED") ||
      msg.includes("prisma") ||
      msg.toLowerCase().includes("database");

    if (isInfrastructureError) {
      console.error("[API] Infrastructure error (sanitized from client):", msg);
      return { message: "Service temporarily unavailable", status: 500 };
    }
    return { message: msg, status: 500 };
  }
  return { message: "An unexpected error occurred", status: 500 };
}
