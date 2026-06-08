import { NextRequest, NextResponse } from "next/server";
import { buffer } from "@/lib/integrations/buffer";
import { toSafeErrorMessage } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { z } from "zod";

const ScheduleSchema = z.object({
  profileIds: z.array(z.string().min(1)).min(1),
  text: z.string().min(1).max(2000),
  scheduledAt: z.string().datetime().optional(),
});

export async function GET(req: NextRequest) {
  const rl = rateLimit(req, { limit: 10, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json(
      { success: false, error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  if (action === "profiles") {
    try {
      const profiles = await buffer.getProfiles();
      return NextResponse.json({ success: true, data: profiles });
    } catch (error) {
      const { message, status } = toSafeErrorMessage(error);
      return NextResponse.json({ success: false, error: message }, { status });
    }
  }

  return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const rl = rateLimit(req, { limit: 10, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json(
      { success: false, error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  if (action === "schedule") {
    try {
      const body = await req.json();
      const { profileIds, text, scheduledAt } = ScheduleSchema.parse(body);

      const result = scheduledAt
        ? await buffer.schedulePost(profileIds, text, scheduledAt)
        : await buffer.schedulePostNow(profileIds, text);

      return NextResponse.json({ success: true, data: result });
    } catch (error) {
      const { message, status } = toSafeErrorMessage(error);
      return NextResponse.json({ success: false, error: message }, { status });
    }
  }

  return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
}
