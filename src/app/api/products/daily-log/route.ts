import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { toSafeErrorMessage } from "@/lib/errors";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const date = new URL(req.url).searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  try {
    const log = await prisma.dailyBatchLog.findUnique({ where: { date } });
    if (!log) {
      return NextResponse.json({ success: true, data: { batchesRun: 0, productsGenerated: 0, targetProducts: 20 } });
    }
    return NextResponse.json({ success: true, data: { batchesRun: log.batchesRun, productsGenerated: log.productsGenerated, targetProducts: log.targetProducts } });
  } catch (error) {
    const { message, status } = toSafeErrorMessage(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
