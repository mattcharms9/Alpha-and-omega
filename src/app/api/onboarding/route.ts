import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { toSafeErrorMessage } from "@/lib/errors";

export interface OnboardingState {
  step1Done: boolean; // has ScanCache
  step2Done: boolean; // has Product
  step3Done: boolean; // has EtsyConnection
  step4Done: boolean; // has active EtsyListing
  step5Done: boolean; // has RevenueRecord from etsy
  allDone: boolean;
  completedAt: string | null;
}

export async function GET(): Promise<NextResponse> {
  try {
    const [scanCount, productCount, etsyConn, etsyListing, etsyRevenue] = await Promise.all([
      prisma.scanCache.count(),
      prisma.product.count(),
      prisma.etsyConnection.findFirst({ where: { isActive: true } }),
      prisma.etsyListing.findFirst({ where: { status: "active" } }),
      prisma.revenueRecord.findFirst({ where: { platform: "etsy" } }),
    ]);

    const state: OnboardingState = {
      step1Done: scanCount > 0,
      step2Done: productCount > 0,
      step3Done: etsyConn !== null,
      step4Done: etsyListing !== null,
      step5Done: etsyRevenue !== null,
      allDone: false,
      completedAt: null,
    };
    state.allDone = Object.values(state).filter((v) => typeof v === "boolean").every(Boolean);

    if (state.allDone) {
      // Check if user already marked completed
      const user = await prisma.user.findFirst({ select: { hasCompletedOnboarding: true, updatedAt: true } });
      if (!user?.hasCompletedOnboarding) {
        await prisma.user.updateMany({ data: { hasCompletedOnboarding: true } });
      }
      state.completedAt = user?.updatedAt.toISOString() ?? null;
    }

    return NextResponse.json({ success: true, data: state });
  } catch (error) {
    const { message, status } = toSafeErrorMessage(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
