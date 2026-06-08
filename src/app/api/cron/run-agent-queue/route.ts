import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { runManagerAgent } from "@/lib/agents/manager-agent";
import { sendDailyQueueEmail } from "@/lib/notifications/queue-email";

// Schedule: 0 2 * * * (2am UTC daily)
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().slice(0, 10);

  const existing = await prisma.dailyQueue.findUnique({ where: { date: today } });
  if (existing?.status === "ready") {
    return NextResponse.json({ success: true, data: { message: "Queue already ready", date: today } });
  }

  try {
    const result = await runManagerAgent(today);

    void sendDailyQueueEmail(result).catch((err) => {
      console.error("[cron] Queue email failed:", err);
    });

    return NextResponse.json({
      success: true,
      data: { queueId: result.queueId, cardCount: result.cards.length, cost: result.totalAgentCost },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Agent run failed";
    console.error("[cron] Agent queue run failed:", err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
