import twilio from "twilio";

const getClient = () =>
  twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

export async function sendSms(message: string): Promise<void> {
  const from = process.env.TWILIO_PHONE_NUMBER;
  const to = process.env.ALERT_PHONE_NUMBER;
  if (!from || !to) {
    console.error("[SMS] TWILIO_PHONE_NUMBER or ALERT_PHONE_NUMBER not set");
    return;
  }
  await getClient().messages.create({ from, to, body: message });
}

export function buildReminderSms(params: {
  posted: number;
  target: number;
  remaining: number;
  streak: number;
  appUrl: string;
}): string {
  const { posted, target, remaining, streak, appUrl } = params;
  const streakNote = streak > 0 ? ` You're on a ${streak}-day streak — don't break it!` : "";
  return `Alpha & Omega: ${posted}/${target} products posted today. ${remaining} more to hit your target.${streakNote} ${appUrl}/products`;
}

export function buildWeeklySms(params: {
  weekRevenue: number;
  productsThisWeek: number;
  daysHitTarget: number;
  streak: number;
}): string {
  const { weekRevenue, productsThisWeek, daysHitTarget, streak } = params;
  const revenueStr = weekRevenue > 0 ? `$${weekRevenue.toFixed(2)} revenue` : "no revenue recorded";
  return `Alpha & Omega Weekly: ${productsThisWeek} products posted, ${daysHitTarget}/7 days hit target, ${revenueStr}. Current streak: ${streak} days. Keep building.`;
}

export function buildMilestoneSms(streak: number): string {
  const messages: Record<number, string> = {
    7: `🔥 7-day streak! One week of consistency. Keep the momentum going.`,
    14: `💪 14-day streak! Two weeks strong. You're building a real habit.`,
    30: `🏆 30-day streak! One month of daily execution. That's elite.`,
    60: `⚡ 60-day streak! Two months. Most people quit — you didn't.`,
    100: `👑 100-day streak! Legendary. Alpha & Omega is becoming your empire.`,
  };
  return messages[streak] ?? `Alpha & Omega: ${streak}-day streak milestone! Keep publishing.`;
}

export function buildTargetHitSms(params: { posted: number; streak: number }): string {
  const { posted, streak } = params;
  const streakNote = streak > 1 ? ` ${streak}-day streak continues.` : "";
  return `Alpha & Omega: Daily target hit! ${posted} products posted today.${streakNote} Rest easy.`;
}
