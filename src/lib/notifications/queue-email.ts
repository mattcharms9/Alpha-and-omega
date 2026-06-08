import { Resend } from "resend";
import { generateEmailActionToken } from "@/lib/auth/email-action-tokens";
import type { LaunchCardData } from "@/lib/agents/agent-types";

let _resend: Resend | null = null;
function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

const FROM = "Alpha & Omega <alerts@alphaandomega.app>";
const ALERT_EMAIL = process.env.ALERT_EMAIL ?? "";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://alphaandomega.app";

function competitionBadge(level: string): string {
  const map: Record<string, string> = {
    low: "🟢 Low",
    medium: "🟡 Medium",
    high: "🔴 High",
    saturated: "⛔ Saturated",
  };
  return map[level] ?? level;
}

function confidenceColor(level: string): string {
  return level === "high" ? "#22c55e" : level === "medium" ? "#f59e0b" : "#6b7280";
}

export async function sendDailyQueueEmail(result: {
  queueId: string;
  cards: LaunchCardData[];
  managerNote: string;
  totalAgentCost: number;
}): Promise<void> {
  const resend = getResend();
  if (!resend || !ALERT_EMAIL) return;

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const costStr = result.totalAgentCost.toFixed(2);

  const cardRows = result.cards
    .slice(0, 15)
    .map((card) => {
      const approveToken = generateEmailActionToken(card.position.toString());
      return `
        <tr style="border-bottom: 1px solid #1a1a1a;">
          <td style="padding: 14px 0; vertical-align: top;">
            <div style="display: flex; align-items: flex-start; gap: 12px;">
              <div style="min-width: 28px; height: 28px; background: #1a1a1a; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: #737373; flex-shrink: 0; padding-top: 6px; text-align: center;">#${card.position}</div>
              <div style="flex: 1;">
                <div style="font-weight: 600; font-size: 14px; color: #f5f5f5; margin-bottom: 2px;">${card.productTitle}</div>
                <div style="font-size: 12px; color: #737373; margin-bottom: 6px;">${card.productFormat} · $${card.suggestedPrice.toFixed(2)} · ${competitionBadge(card.competitionLevel)} competition</div>
                <div style="font-size: 12px; color: #a3a3a3; margin-bottom: 8px; font-style: italic;">"${card.whyNow}"</div>
                <div style="display: flex; gap: 8px;">
                  <a href="${APP_URL}/launch-queue?approve=${card.position}&queueId=${result.queueId}&token=${approveToken}" style="display: inline-block; background: #22c55e; color: white; font-size: 12px; font-weight: 600; padding: 6px 14px; border-radius: 6px; text-decoration: none;">APPROVE</a>
                  <a href="${APP_URL}/launch-queue" style="display: inline-block; background: #1a1a1a; color: #a3a3a3; font-size: 12px; font-weight: 500; padding: 6px 14px; border-radius: 6px; text-decoration: none;">SKIP</a>
                  <span style="font-size: 11px; color: ${confidenceColor(card.confidenceLevel)}; padding: 6px 0; font-weight: 600;">${card.opportunityScore}/100</span>
                </div>
              </div>
            </div>
          </td>
        </tr>`;
    })
    .join("");

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin: 0; padding: 0; background: #050505; font-family: system-ui, -apple-system, sans-serif;">
  <div style="max-width: 560px; margin: 0 auto; padding: 32px 16px;">

    <div style="margin-bottom: 24px;">
      <div style="font-size: 11px; letter-spacing: 0.1em; color: #525252; margin-bottom: 8px; text-transform: uppercase;">Alpha &amp; Omega — Daily Queue</div>
      <h1 style="font-size: 22px; font-weight: 700; color: #f5f5f5; margin: 0 0 4px 0;">🚀 ${result.cards.length} opportunities ready</h1>
      <div style="font-size: 13px; color: #737373;">${today}</div>
    </div>

    <div style="background: #111; border: 1px solid #1a1a1a; border-radius: 10px; padding: 16px; margin-bottom: 24px;">
      <div style="font-size: 11px; font-weight: 600; color: #525252; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px;">Manager's Note</div>
      <div style="font-size: 14px; color: #d4d4d4; line-height: 1.6; font-style: italic;">"${result.managerNote}"</div>
    </div>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
      <tbody>${cardRows}</tbody>
    </table>

    <div style="text-align: center; margin-bottom: 24px;">
      <a href="${APP_URL}/launch-queue" style="display: inline-block; background: #f5f5f5; color: #0a0a0a; font-size: 14px; font-weight: 700; padding: 12px 28px; border-radius: 8px; text-decoration: none;">Open Full Review in App →</a>
    </div>

    <div style="border-top: 1px solid #1a1a1a; padding-top: 16px; font-size: 11px; color: #404040; text-align: center;">
      Agent run cost: $${costStr} · ${result.cards.length} opportunities · ${new Date().toLocaleTimeString("en-US", { timeZone: "UTC", hour: "2-digit", minute: "2-digit" })} UTC
    </div>
  </div>
</body>
</html>`;

  await resend.emails.send({
    from: FROM,
    to: ALERT_EMAIL,
    subject: `🚀 ${result.cards.length} opportunities ready — ${today} Launch Queue`,
    html,
  });
}
