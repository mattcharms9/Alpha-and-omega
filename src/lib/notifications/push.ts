import webpush from "web-push";
import { prisma } from "@/lib/db/prisma";

let vapidInitialized = false;

function ensureVapid() {
  if (vapidInitialized) return;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) {
    console.error("[Push] VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY not set");
    return;
  }
  webpush.setVapidDetails("mailto:admin@alphaandomega.app", pub, priv);
  vapidInitialized = true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export async function sendPushToAll(payload: PushPayload): Promise<void> {
  ensureVapid();
  if (!vapidInitialized) return;

  const subscriptions = await prisma.pushSubscription.findMany();
  if (subscriptions.length === 0) return;

  const data = JSON.stringify(payload);
  const results = await Promise.allSettled(
    subscriptions.map((sub: { endpoint: string; p256dh: string; auth: string }) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        data
      )
    )
  );

  const expired: string[] = [];
  results.forEach((result: PromiseSettledResult<webpush.SendResult>, i: number) => {
    if (result.status === "rejected") {
      const err = result.reason as { statusCode?: number };
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        expired.push(subscriptions[i].endpoint);
      } else {
        console.error("[Push] Failed to send:", result.reason);
      }
    }
  });

  if (expired.length > 0) {
    await prisma.pushSubscription.deleteMany({
      where: { endpoint: { in: expired } },
    });
  }
}

export function buildReminderPush(params: {
  posted: number;
  target: number;
  remaining: number;
  streak: number;
}): PushPayload {
  const { posted, target, remaining, streak } = params;
  const streakNote = streak > 0 ? ` (${streak}-day streak)` : "";
  return {
    title: `Daily Target: ${posted}/${target}${streakNote}`,
    body: `${remaining} more product${remaining === 1 ? "" : "s"} to hit your goal today. Don't stop now.`,
    url: "/products",
    tag: "daily-reminder",
  };
}

export function buildMilestonePush(streak: number): PushPayload {
  const labels: Record<number, string> = {
    7: "7-Day Streak!",
    14: "14-Day Streak!",
    30: "30-Day Streak!",
    60: "60-Day Streak!",
    100: "100-Day Streak!",
  };
  const bodies: Record<number, string> = {
    7: "One week of consistency. You're building something real.",
    14: "Two weeks strong. Most people quit — you didn't.",
    30: "One month. Elite level consistency.",
    60: "Two months of daily publishing. Unstoppable.",
    100: "100 days. Legendary. Your empire is real.",
  };
  return {
    title: labels[streak] ?? `${streak}-Day Streak!`,
    body: bodies[streak] ?? `${streak} consecutive days of execution.`,
    url: "/products",
    tag: "milestone",
  };
}
