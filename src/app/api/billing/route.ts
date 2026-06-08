import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { toSafeErrorMessage } from "@/lib/errors";
import { z } from "zod";

const CheckoutSchema = z.object({
  plan: z.enum(["starter", "pro", "unlimited"]),
  email: z.string().email(),
});

export async function GET(req: NextRequest) {
  const action = new URL(req.url).searchParams.get("action");

  if (action === "status") {
    try {
      const sub = await prisma.subscription.findFirst();
      return NextResponse.json({
        success: true,
        data: {
          plan: sub?.plan ?? "free",
          status: sub?.status ?? "inactive",
          currentPeriodEnd: sub?.currentPeriodEnd ?? null,
        },
      });
    } catch (error) {
      const { message, status } = toSafeErrorMessage(error);
      return NextResponse.json({ success: false, error: message }, { status });
    }
  }

  return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return NextResponse.json({ success: false, error: "Stripe not configured" }, { status: 503 });
    }

    const StripeLib = (await import("stripe")).default;
    const stripe = new StripeLib(stripeKey);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3090";

    if (action === "create-checkout") {
      const body = await req.json();
      const { plan, email } = CheckoutSchema.parse(body);

      const priceId = plan === "starter"
        ? process.env.STRIPE_STARTER_PRICE_ID
        : plan === "pro"
        ? process.env.STRIPE_PRO_PRICE_ID
        : process.env.STRIPE_UNLIMITED_PRICE_ID;

      if (!priceId) {
        return NextResponse.json({ success: false, error: "Price not configured for this plan" }, { status: 400 });
      }

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        customer_email: email,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${appUrl}/?billing=success`,
        cancel_url: `${appUrl}/pricing?billing=cancelled`,
        metadata: { plan },
      });

      return NextResponse.json({ success: true, data: { url: session.url } });
    }

    if (action === "portal") {
      const sub = await prisma.subscription.findFirst();
      if (!sub) return NextResponse.json({ success: false, error: "No active subscription" }, { status: 400 });

      const session = await stripe.billingPortal.sessions.create({
        customer: sub.stripeCustomerId,
        return_url: `${appUrl}/settings`,
      });

      return NextResponse.json({ success: true, data: { url: session.url } });
    }

    if (action === "webhook") {
      const sig = req.headers.get("stripe-signature") ?? "";
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
      const rawBody = await req.text();

      let event: ReturnType<typeof stripe.webhooks.constructEvent>;
      try {
        event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
      } catch {
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
      }

      if (
        event.type === "customer.subscription.created" ||
        event.type === "customer.subscription.updated" ||
        event.type === "customer.subscription.deleted"
      ) {
        const sub = event.data.object as unknown as {
          customer: string | { id: string };
          status: string;
          current_period_end: number;
          items: { data: Array<{ price: { id: string } }> };
        };
        const priceId = sub.items.data[0]?.price.id ?? "";
        const plan = priceId === process.env.STRIPE_PRO_PRICE_ID ? "pro"
          : priceId === process.env.STRIPE_UNLIMITED_PRICE_ID ? "unlimited"
          : priceId === process.env.STRIPE_STARTER_PRICE_ID ? "starter"
          : "free";

        const user = await prisma.user.findFirst();
        if (user) {
          const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
          await prisma.subscription.upsert({
            where: { stripeCustomerId: customerId },
            create: {
              userId: user.id,
              stripeCustomerId: customerId,
              stripePriceId: priceId,
              status: sub.status,
              plan,
              currentPeriodEnd: new Date(sub.current_period_end * 1000),
            },
            update: {
              status: sub.status,
              plan,
              currentPeriodEnd: new Date(sub.current_period_end * 1000),
            },
          });
          await prisma.user.update({ where: { id: user.id }, data: { plan } });
        }
      }

      return NextResponse.json({ received: true });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 });
    }
    const { message, status } = toSafeErrorMessage(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
