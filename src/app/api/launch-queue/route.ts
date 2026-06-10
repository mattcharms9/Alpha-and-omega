import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { toSafeErrorMessage } from "@/lib/errors";
import { runBuildPipeline } from "@/lib/agents/build-pipeline";
import { runManagerAgent } from "@/lib/agents/manager-agent";
import { verifyEmailActionToken } from "@/lib/auth/email-action-tokens";
import { auth } from "@/lib/auth";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const DecideSchema = z.object({
  cardId: z.string().min(1),
  decision: z.enum(["approved", "skipped"]),
});

const RetrySchema = z.object({
  cardId: z.string().min(1),
});

export async function GET(req: NextRequest) {
  const rl = rateLimit(req, { limit: 20, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json({ success: false, error: "Rate limit exceeded" }, { status: 429 });
  }

  const { searchParams } = req.nextUrl;
  const action = searchParams.get("action");

  // Email deep-link handler: GET /api/launch-queue?approve={cardId}&token={token}
  // Works without browser session — for mobile email clients
  const approveCardId = searchParams.get("approve");
  const skipCardId = searchParams.get("skip");
  const emailToken = searchParams.get("token");

  if ((approveCardId || skipCardId) && emailToken) {
    const cardId = approveCardId ?? skipCardId!;
    const decision = approveCardId ? "approved" : "skipped";

    try {
      if (!verifyEmailActionToken(emailToken, cardId)) {
        return NextResponse.redirect(new URL("/launch-queue?error=invalid_token", req.url));
      }
      const card = await prisma.launchCard.findUnique({ where: { id: cardId } });
      if (!card || card.status !== "pending") {
        return NextResponse.redirect(new URL("/launch-queue?error=already_decided", req.url));
      }
      await prisma.launchCard.update({ where: { id: cardId }, data: { status: decision, decidedAt: new Date() } });
      if (decision === "approved") {
        void runBuildPipeline(cardId).catch((err) => { console.error("[launch-queue] Email-approve build failed:", err); });
      }
      return NextResponse.redirect(new URL(`/launch-queue?success=${decision}`, req.url));
    } catch (err) {
      const { message } = toSafeErrorMessage(err);
      return NextResponse.redirect(new URL(`/launch-queue?error=${encodeURIComponent(message)}`, req.url));
    }
  }

  try {
    if (action === "today") {
      const today = new Date().toISOString().slice(0, 10);
      const queue = await prisma.dailyQueue.findUnique({
        where: { date: today },
        include: { cards: { orderBy: { position: "asc" } } },
      });
      return NextResponse.json({ success: true, data: queue ?? null });
    }

    if (action === "history") {
      const days = Math.min(parseInt(searchParams.get("days") ?? "7", 10), 30);
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const queues = await prisma.dailyQueue.findMany({
        where: { date: { gte: since } },
        include: { cards: { select: { id: true, status: true, buildStatus: true, opportunityScore: true } } },
        orderBy: { date: "desc" },
      });
      return NextResponse.json({ success: true, data: queues });
    }

    if (action === "card") {
      const id = searchParams.get("id");
      if (!id) return NextResponse.json({ success: false, error: "id required" }, { status: 400 });
      const card = await prisma.launchCard.findUnique({ where: { id } });
      if (!card) return NextResponse.json({ success: false, error: "Card not found" }, { status: 404 });
      return NextResponse.json({ success: true, data: card });
    }

    if (action === "build-status") {
      const id = searchParams.get("id");
      if (!id) return NextResponse.json({ success: false, error: "id required" }, { status: 400 });
      const card = await prisma.launchCard.findUnique({
        where: { id },
        select: { id: true, buildStatus: true, buildStartedAt: true, buildCompletedAt: true, failureReason: true, etsyListingId: true, publishedAt: true, productId: true },
      });
      if (!card) return NextResponse.json({ success: false, error: "Card not found" }, { status: 404 });
      return NextResponse.json({ success: true, data: card });
    }

    if (action === "agent-runs") {
      const limit = Math.min(parseInt(searchParams.get("limit") ?? "10", 10), 50);
      const logs = await prisma.agentRunLog.findMany({
        orderBy: { startedAt: "desc" },
        take: limit * 6,
      });
      const byQueue: Record<string, typeof logs> = {};
      for (const log of logs) {
        if (!byQueue[log.queueId]) byQueue[log.queueId] = [];
        byQueue[log.queueId].push(log);
      }
      const grouped = Object.entries(byQueue)
        .slice(0, limit)
        .map(([queueId, agentLogs]) => ({
          queueId,
          agents: agentLogs,
          totalCost: agentLogs.reduce((s, l) => s + l.costEstimate, 0),
          totalTokens: agentLogs.reduce((s, l) => s + l.tokensUsed, 0),
          totalDurationMs: agentLogs.reduce((s, l) => s + l.durationMs, 0),
        }));
      return NextResponse.json({ success: true, data: grouped });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (err) {
    const { message, status } = toSafeErrorMessage(err);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function POST(req: NextRequest) {
  const rl = rateLimit(req, { limit: 10, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json({ success: false, error: "Rate limit exceeded" }, { status: 429 });
  }

  const { searchParams } = req.nextUrl;
  const action = searchParams.get("action");

  try {
    if (action === "decide") {
      const body = DecideSchema.safeParse(await req.json());
      if (!body.success) {
        return NextResponse.json({ success: false, error: body.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
      }
      const { cardId, decision } = body.data;

      const card = await prisma.launchCard.update({
        where: { id: cardId },
        data: { status: decision, decidedAt: new Date() },
      });

      if (decision === "approved") {
        void runBuildPipeline(cardId).catch((err) => {
          console.error("[launch-queue] Build pipeline failed:", err);
        });
        return NextResponse.json({ success: true, data: { message: "Build pipeline started", cardId: card.id } });
      }

      return NextResponse.json({ success: true, data: { cardId: card.id, status: decision } });
    }

    if (action === "trigger-run") {
      const session = await auth();
      if (!session) {
        return NextResponse.json({ success: false, error: "Sign in required" }, { status: 401 });
      }
      const today = new Date().toISOString().slice(0, 10);

      // Return existing queue if already ready — avoid duplicate runs
      const existing = await prisma.dailyQueue.findUnique({
        where: { date: today },
        include: { cards: { orderBy: { position: "asc" } } },
      });
      if (existing && (existing.status === "ready" || existing.status === "partial") && existing.cards.length > 0) {
        return NextResponse.json({ success: true, data: existing });
      }

      // Run synchronously — fire-and-forget with void kills the agent on serverless
      // because the function exits when the response is sent, terminating the process.
      try {
        await runManagerAgent(today);
      } catch (err) {
        console.error("[launch-queue] trigger-run agent failed:", err);
        // Fall through: return whatever partial results were saved
      }

      const queue = await prisma.dailyQueue.findUnique({
        where: { date: today },
        include: { cards: { orderBy: { position: "asc" } } },
      });
      return NextResponse.json({ success: true, data: queue ?? null });
    }

    if (action === "retry-build") {
      const body = RetrySchema.safeParse(await req.json());
      if (!body.success) {
        return NextResponse.json({ success: false, error: body.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
      }
      const { cardId } = body.data;
      await prisma.launchCard.update({
        where: { id: cardId },
        data: { buildStatus: "queued", failureReason: null },
      });
      void runBuildPipeline(cardId).catch((err) => {
        console.error("[launch-queue] Retry build failed:", err);
      });
      return NextResponse.json({ success: true, data: { message: "Build retry started", cardId } });
    }

    if (action === "email-approve") {
      // Handle email action token approval (deep-link from email)
      const cardId = searchParams.get("cardId");
      const token = searchParams.get("token");
      if (!cardId || !token) {
        return NextResponse.json({ success: false, error: "cardId and token required" }, { status: 400 });
      }
      if (!verifyEmailActionToken(token, cardId)) {
        return NextResponse.json({ success: false, error: "Invalid or expired token" }, { status: 401 });
      }
      const card = await prisma.launchCard.update({
        where: { id: cardId },
        data: { status: "approved", decidedAt: new Date() },
      });
      void runBuildPipeline(cardId).catch((err) => {
        console.error("[launch-queue] Email-approve build pipeline failed:", err);
      });
      return NextResponse.json({ success: true, data: { message: "Card approved, build started", cardId: card.id } });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (err) {
    const { message, status } = toSafeErrorMessage(err);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
