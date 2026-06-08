import { Resend } from "resend";

let _resend: Resend | null = null;
function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

const FROM = "Alpha & Omega <hello@alphaandomega.app>";

export async function sendWelcomeEmail(email: string, productTitle: string): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `Your copy of "${productTitle}" is ready!`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
        <h2 style="margin: 0 0 16px; font-size: 22px; color: #1a1917;">Thanks for your purchase!</h2>
        <p style="color: #4b4a46; line-height: 1.6;">Your copy of <strong>${productTitle}</strong> is attached to your order. Here are a few tips to get the most out of it:</p>
        <ul style="color: #4b4a46; line-height: 1.8;">
          <li>Print at home or use it digitally — both work great</li>
          <li>Start small: even 5 minutes a day creates real momentum</li>
          <li>Come back whenever you need a reset</li>
        </ul>
        <p style="color: #9e9d98; font-size: 14px;">Questions? Just reply to this email.</p>
      </div>
    `,
  });
}

export async function sendDay3Email(email: string, productTitle: string): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `How's "${productTitle}" working for you?`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
        <h2 style="margin: 0 0 16px; font-size: 22px; color: #1a1917;">Day 3 check-in</h2>
        <p style="color: #4b4a46; line-height: 1.6;">It's been a few days since you got <strong>${productTitle}</strong>. How's it going?</p>
        <p style="color: #4b4a46; line-height: 1.6;">If it's been helpful, we'd love a quick review — it takes 30 seconds and helps others find it.</p>
        <p style="color: #4b4a46; line-height: 1.6;">And if there's anything that could be better, just reply. We read every message.</p>
        <p style="color: #9e9d98; font-size: 14px;">— The Alpha & Omega team</p>
      </div>
    `,
  });
}

export async function sendDay7Email(
  email: string,
  productTitle: string,
  productId?: string
): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  let recommendationHtml = "";
  if (productId) {
    try {
      const { getNextProductRecommendation } = await import("@/lib/ai/recommendation-engine");
      const rec = await getNextProductRecommendation(productId, email);
      if (rec) {
        recommendationHtml = `
          <div style="margin: 16px 0; padding: 16px; background: #f7f7f5; border-radius: 8px;">
            <p style="color: #4b4a46; font-weight: 600; margin: 0 0 8px;">You might also love:</p>
            <p style="color: #4b4a46; line-height: 1.6; margin: 0;">${rec.emailBodySnippet}</p>
            <p style="color: #1a1917; font-weight: 600; margin: 8px 0 0;"><em>${rec.product.title}</em></p>
          </div>`;
      }
    } catch {
      // Non-fatal — recommendation failure must not break the nurture email
    }
  }

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `Week 1 with "${productTitle}"`,
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
        <h2 style="margin: 0 0 16px; font-size: 22px; color: #1a1917;">One week in!</h2>
        <p style="color: #4b4a46; line-height: 1.6;">You've had <strong>${productTitle}</strong> for a week now. People who use it consistently see results in weeks 2–3, so you're just getting started.</p>
        ${recommendationHtml}
        <p style="color: #9e9d98; font-size: 14px; margin-top: 24px;">— The Alpha & Omega team</p>
      </div>
    `,
  });
}
