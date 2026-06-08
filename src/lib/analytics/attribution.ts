import { prisma } from "@/lib/db/prisma";

export interface ChannelAttribution {
  channel: string;
  revenue: number;
  unitsSold: number;
  share: number;
  netRevenue: number;
  platformFeeRate: number;
}

export interface ProductAttribution {
  productId: string;
  title: string;
  totalRevenue: number;
  byChannel: Record<string, number>;
}

export interface AttributionReport {
  byChannel: ChannelAttribution[];
  byProduct: ProductAttribution[];
  totalRevenue: number;
  totalNetRevenue: number;
  periodDays: number;
  generatedAt: string;
}

const PLATFORM_FEES: Record<string, number> = {
  etsy: 0.065 + 0.03 + 0.002, // 6.5% transaction + 3% payment + $0.20 listing (approximated)
  gumroad: 0.10 + 0.03,       // 10% + payment processing
  pinterest: 0,                // No direct fees
  unknown: 0,
};

function mapChannel(utmSource?: string | null, platform?: string | null): string {
  if (utmSource === "pinterest") return "pinterest";
  if (platform === "etsy" || utmSource?.includes("etsy")) return "etsy";
  if (platform === "gumroad" || utmSource?.includes("gumroad")) return "gumroad";
  if (utmSource === "email") return "email";
  return "direct";
}

export async function buildAttributionReport(days = 30): Promise<AttributionReport> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const records = await prisma.revenueRecord.findMany({
    where: { date: { gte: since } },
  });

  const channelMap: Record<string, { revenue: number; sales: number }> = {};
  const productMap: Record<string, { title: string; revenue: number; byChannel: Record<string, number> }> = {};

  for (const r of records) {
    const channel = mapChannel(r.utmSource, r.platform);
    if (!channelMap[channel]) channelMap[channel] = { revenue: 0, sales: 0 };
    channelMap[channel].revenue += r.revenue;
    channelMap[channel].sales += r.sales;

    if (r.productId) {
      if (!productMap[r.productId]) productMap[r.productId] = { title: "", revenue: 0, byChannel: {} };
      productMap[r.productId].revenue += r.revenue;
      productMap[r.productId].byChannel[channel] = (productMap[r.productId].byChannel[channel] ?? 0) + r.revenue;
    }
  }

  const totalRevenue = Object.values(channelMap).reduce((a, b) => a + b.revenue, 0);

  // Enrich with product titles
  if (Object.keys(productMap).length > 0) {
    const products = await prisma.product.findMany({
      where: { id: { in: Object.keys(productMap) } },
      select: { id: true, title: true },
    });
    for (const p of products) {
      if (productMap[p.id]) productMap[p.id].title = p.title;
    }
  }

  const byChannel: ChannelAttribution[] = Object.entries(channelMap)
    .map(([channel, { revenue, sales }]) => {
      const feeRate = PLATFORM_FEES[channel] ?? 0;
      return {
        channel,
        revenue,
        unitsSold: sales,
        share: totalRevenue > 0 ? revenue / totalRevenue : 0,
        netRevenue: revenue * (1 - feeRate),
        platformFeeRate: feeRate,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  const byProduct: ProductAttribution[] = Object.entries(productMap)
    .map(([productId, { title, revenue, byChannel: bc }]) => ({ productId, title, totalRevenue: revenue, byChannel: bc }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, 20);

  const totalNetRevenue = byChannel.reduce((a, b) => a + b.netRevenue, 0);

  return { byChannel, byProduct, totalRevenue, totalNetRevenue, periodDays: days, generatedAt: new Date().toISOString() };
}
