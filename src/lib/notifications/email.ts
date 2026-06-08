import { Resend } from "resend";
import type { PerformanceInsight } from "@/lib/analytics/revenue-aggregator";
import type { EmpireState } from "@/lib/ai/empire-engine";

let _resend: Resend | null = null;
function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

const FROM = "Alpha & Omega <alerts@alphaandomega.app>";
const ALERT_EMAIL = process.env.ALERT_EMAIL ?? "";

export async function addBuyerToAudience(params: {
  email: string;
  firstName?: string;
  productTitle: string;
  platform: string;
}): Promise<void> {
  const resend = getResend();
  const audienceId = process.env.RESEND_AUDIENCE_ID;
  if (!resend || !audienceId) return;

  await resend.contacts.create({
    audienceId,
    email: params.email,
    firstName: params.firstName,
    unsubscribed: false,
  });
}

export async function sendSaleAlert(params: {
  productTitle: string;
  revenue: number;
  platform: string;
  buyerEmail?: string;
  totalRevenue: number;
}): Promise<void> {
  const resend = getResend();
  if (!resend || !ALERT_EMAIL) return;

  await resend.emails.send({
    from: FROM,
    to: ALERT_EMAIL,
    subject: `💰 Sale: $${params.revenue.toFixed(2)} — ${params.productTitle}`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #0a0a0a; color: #e5e5e5; border-radius: 12px;">
        <div style="font-size: 11px; letter-spacing: 0.1em; color: #737373; margin-bottom: 16px;">ALPHA & OMEGA — SALE ALERT</div>
        <h1 style="font-size: 28px; font-weight: 700; color: #f0b429; margin: 0 0 8px 0;">$${params.revenue.toFixed(2)}</h1>
        <div style="font-size: 15px; color: #e5e5e5; margin-bottom: 4px;">${params.productTitle}</div>
        <div style="font-size: 13px; color: #737373; margin-bottom: 20px;">via ${params.platform}</div>
        <div style="padding: 12px 16px; background: #141414; border-radius: 8px; border: 1px solid #262626;">
          <div style="font-size: 11px; color: #737373; margin-bottom: 4px;">ALL-TIME REVENUE</div>
          <div style="font-size: 20px; font-weight: 700; color: #10b981;">$${params.totalRevenue.toFixed(2)}</div>
        </div>
      </div>
    `,
  });
}

export async function sendDailyBrief(params: {
  state: EmpireState;
  performance: PerformanceInsight;
}): Promise<void> {
  const resend = getResend();
  if (!resend || !ALERT_EMAIL) return;

  const { state, performance } = params;
  const topEmotions = performance.topEmotions.slice(0, 3);

  await resend.emails.send({
    from: FROM,
    to: ALERT_EMAIL,
    subject: `Empire Brief — Score ${state.empireScore}/1000 | ${new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; background: #0a0a0a; color: #e5e5e5; border-radius: 12px;">
        <div style="font-size: 11px; letter-spacing: 0.1em; color: #737373; margin-bottom: 16px;">ALPHA & OMEGA — DAILY EMPIRE BRIEF</div>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 24px;">
          ${[
            { label: "Empire Score", value: `${state.empireScore}/1000`, color: "#f0b429" },
            { label: "Signal Moat", value: `${state.moatScore}/100`, color: "#8b5cf6" },
            { label: "Revenue Gap", value: state.unrealizedRevenueGap, color: "#f43f5e" },
          ].map((s) => `
            <div style="padding: 12px; background: #141414; border-radius: 8px; border: 1px solid #262626;">
              <div style="font-size: 10px; color: #737373; margin-bottom: 4px;">${s.label.toUpperCase()}</div>
              <div style="font-size: 18px; font-weight: 700; color: ${s.color};">${s.value}</div>
            </div>
          `).join("")}
        </div>

        <div style="margin-bottom: 20px;">
          <div style="font-size: 11px; color: #737373; margin-bottom: 8px;">EMPIRE STATUS</div>
          <div style="padding: 12px 16px; background: #141414; border-radius: 8px; border: 1px solid #262626;">
            <div style="font-size: 13px; color: #a3a3a3; line-height: 1.6;">
              ${state.signalCount} signals &bull; ${state.brandsBuilt} brands &bull; ${state.productsGenerated} products &bull; ${state.contentPiecesCreated} content pieces
            </div>
          </div>
        </div>

        ${topEmotions.length > 0 ? `
        <div style="margin-bottom: 20px;">
          <div style="font-size: 11px; color: #737373; margin-bottom: 8px;">TOP PERFORMING EMOTIONS</div>
          ${topEmotions.map((e) => `
            <div style="display: flex; justify-content: space-between; padding: 8px 12px; border-bottom: 1px solid #1a1a1a; font-size: 13px;">
              <span style="color: #e5e5e5;">${e.emotion}</span>
              <span style="color: #10b981; font-weight: 600;">$${e.revenue.toFixed(0)}</span>
            </div>
          `).join("")}
        </div>
        ` : ""}

        ${state.decayingSignalCount > 0 ? `
        <div style="padding: 12px 16px; background: #1a0d00; border: 1px solid #7c2d12; border-radius: 8px; margin-bottom: 20px;">
          <div style="font-size: 12px; color: #fb923c; font-weight: 600;">⚠ ${state.decayingSignalCount} signal${state.decayingSignalCount > 1 ? "s" : ""} decaying — activate before they expire</div>
        </div>
        ` : ""}

        <div style="text-align: center; padding-top: 16px; border-top: 1px solid #1a1a1a;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}" style="font-size: 12px; color: #737373; text-decoration: none;">Open Empire Dashboard →</a>
        </div>
      </div>
    `,
  });
}
