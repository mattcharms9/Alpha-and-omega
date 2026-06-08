import { Resend } from "resend";
import { sendPushToAll } from "@/lib/notifications/push";

let _resend: Resend | null = null;
function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

const FROM = "Alpha & Omega <alerts@alphaandomega.app>";
const ALERT_EMAIL = process.env.ALERT_EMAIL ?? "";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://alphaandomega.app";

interface CardSummary {
  id: string;
  productTitle: string;
  buildStartedAt: Date | null;
  buildCompletedAt: Date | null;
}

interface ProductSummary {
  id: string;
  title: string;
  coverImagePath: string | null;
  pricingStrategy: unknown;
}

interface EtsyResult {
  listingId: string;
  listingUrl: string;
}

function buildDurationStr(startedAt: Date | null, completedAt: Date | null): string {
  if (!startedAt || !completedAt) return "";
  const ms = completedAt.getTime() - startedAt.getTime();
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

export async function sendBuildCompleteNotification(
  card: CardSummary,
  product: ProductSummary,
  etsyResult: EtsyResult
): Promise<void> {
  const resend = getResend();
  const duration = buildDurationStr(card.buildStartedAt, card.buildCompletedAt ?? new Date());

  const pricingAny = product.pricingStrategy as Record<string, unknown> | null;
  const price = pricingAny?.digitalPrice ?? pricingAny?.price ?? "—";

  if (resend && ALERT_EMAIL) {
    const html = `
<!DOCTYPE html>
<html>
<body style="margin: 0; padding: 0; background: #050505; font-family: system-ui, sans-serif;">
  <div style="max-width: 480px; margin: 0 auto; padding: 32px 16px;">
    <div style="font-size: 11px; letter-spacing: 0.1em; color: #525252; margin-bottom: 16px; text-transform: uppercase;">Alpha &amp; Omega — Build Complete</div>
    <h1 style="font-size: 20px; font-weight: 700; color: #22c55e; margin: 0 0 6px 0;">✅ Published</h1>
    <p style="font-size: 16px; color: #f5f5f5; margin: 0 0 20px 0;">"${card.productTitle}"</p>

    ${product.coverImagePath ? `<img src="${APP_URL}${product.coverImagePath}" alt="cover" style="width: 100%; border-radius: 8px; margin-bottom: 20px;">` : ""}

    <div style="background: #111; border: 1px solid #1a1a1a; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
      <div style="font-size: 13px; color: #737373; margin-bottom: 4px;">Price</div>
      <div style="font-size: 16px; font-weight: 600; color: #f5f5f5;">$${price}</div>
      ${duration ? `<div style="font-size: 12px; color: #525252; margin-top: 8px;">Build time: ${duration}</div>` : ""}
    </div>

    <div style="display: flex; gap: 10px; margin-bottom: 24px;">
      <a href="${etsyResult.listingUrl}" style="flex: 1; display: block; background: #f5a623; color: #0a0a0a; font-size: 13px; font-weight: 700; padding: 10px 0; border-radius: 6px; text-decoration: none; text-align: center;">View on Etsy →</a>
      <a href="${APP_URL}/products/${product.id}" style="flex: 1; display: block; background: #1a1a1a; color: #a3a3a3; font-size: 13px; font-weight: 600; padding: 10px 0; border-radius: 6px; text-decoration: none; text-align: center;">View in Portfolio →</a>
    </div>

    <div style="font-size: 11px; color: #404040; text-align: center;">
      Next step: Monitor views in Portfolio → Etsy Analytics
    </div>
  </div>
</body>
</html>`;

    await resend.emails.send({
      from: FROM,
      to: ALERT_EMAIL,
      subject: `✅ Published: "${card.productTitle}"`,
      html,
    });
  }

  void sendPushToAll({
    title: `✅ ${card.productTitle} is live`,
    body: `Published to Etsy${duration ? ` in ${duration}` : ""}. Tap to view.`,
    url: etsyResult.listingUrl,
  }).catch(() => {});
}

export async function sendBuildFailureAlert(
  card: CardSummary,
  errorMessage: string
): Promise<void> {
  const resend = getResend();
  if (!resend || !ALERT_EMAIL) return;

  const safe = errorMessage.replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const html = `
<!DOCTYPE html>
<html>
<body style="margin: 0; padding: 0; background: #050505; font-family: system-ui, sans-serif;">
  <div style="max-width: 480px; margin: 0 auto; padding: 32px 16px;">
    <div style="font-size: 11px; letter-spacing: 0.1em; color: #525252; margin-bottom: 16px; text-transform: uppercase;">Alpha &amp; Omega — Build Failed</div>
    <h1 style="font-size: 20px; font-weight: 700; color: #ef4444; margin: 0 0 6px 0;">⚠️ Build Failed</h1>
    <p style="font-size: 16px; color: #f5f5f5; margin: 0 0 20px 0;">"${card.productTitle}"</p>

    <div style="background: #1a0a0a; border: 1px solid #3f1515; border-radius: 8px; padding: 14px; margin-bottom: 20px;">
      <div style="font-size: 12px; color: #a3a3a3; font-family: monospace;">${safe}</div>
    </div>

    <a href="${APP_URL}/launch-queue" style="display: inline-block; background: #1a1a1a; color: #f5f5f5; font-size: 13px; font-weight: 600; padding: 10px 20px; border-radius: 6px; text-decoration: none;">Retry in App →</a>
  </div>
</body>
</html>`;

  await resend.emails.send({
    from: FROM,
    to: ALERT_EMAIL,
    subject: `⚠️ Build failed: "${card.productTitle}"`,
    html,
  });
}
