import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { toSafeErrorMessage } from "@/lib/errors";
import { z } from "zod";

const CancelSchema = z.object({ id: z.string().min(1) });

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") ?? "list";

  try {
    if (action === "list") {
      const items = await prisma.pinQueue.findMany({
        where: { status: { in: ["queued", "failed"] } },
        include: { product: { select: { title: true } } },
        orderBy: { scheduledFor: "asc" },
        take: 50,
      });
      return NextResponse.json({ success: true, data: items });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (error) {
    const { message, status } = toSafeErrorMessage(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  try {
    const body = await req.json() as unknown;

    if (action === "cancel") {
      const { id } = CancelSchema.parse(body);
      await prisma.pinQueue.update({ where: { id }, data: { status: "cancelled" } });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: "Invalid request", details: error.issues }, { status: 400 });
    }
    const { message, status } = toSafeErrorMessage(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
