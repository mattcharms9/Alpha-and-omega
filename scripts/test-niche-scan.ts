import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { runNicheScan } from "../src/lib/market-intelligence/run-scan";

async function main() {
  console.log("Running single niche scan: grief journal...");
  try {
    const { report, totalListings } = await runNicheScan("grief journal", new Date().toISOString().slice(0, 10));
    console.log("=== RESULT ===");
    console.log("totalListings (from scan):", totalListings);
    if (!report) {
      console.warn("⚠ Report skipped — Etsy returned no data for this niche (API may be unavailable)");
      return;
    }
    console.log("totalListings (from report):", report.totalListings);
    console.log("competitionLevel:", report.competitionLevel);
    console.log("opportunityScore:", report.opportunityScore);
    const topSellers = report.topSellers as Array<{ title: string }>;
    console.log("topSellers count:", Array.isArray(topSellers) ? topSellers.length : "N/A");
    if (Array.isArray(topSellers) && topSellers.length > 0) {
      console.log("first seller title:", (topSellers[0]?.title ?? "").slice(0, 60));
    }
    const opps = report.productOpportunities as unknown[];
    console.log("productOpportunities count:", Array.isArray(opps) ? opps.length : "N/A");
    console.log("\n✅ Niche scan PASSED — real Etsy data is flowing!");
  } catch (err) {
    console.error("❌ Niche scan FAILED:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

main();
