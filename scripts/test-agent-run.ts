// Run with: npx tsx scripts/test-agent-run.ts
// Tests the full agent pipeline end-to-end and reports the result.

// dotenv must be registered before any module imports resolve
import "dotenv/config";
import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  // Dynamically import after env is loaded to avoid ESM hoisting issue with Prisma
  const { runManagerAgent } = await import("../src/lib/agents/manager-agent");

  const today = new Date().toISOString().slice(0, 10);
  console.log(`\n[smoke-test] Running agent for date: ${today}\n`);
  const start = Date.now();

  try {
    const result = await runManagerAgent(today);
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`\n✅ Agent run PASSED in ${elapsed}s`);
    console.log(`   Queue ID:   ${result.queueId}`);
    console.log(`   Cards:      ${result.cards.length}`);
    console.log(`   Cost:       $${result.totalAgentCost.toFixed(4)}`);
    console.log(`   Manager:    "${result.managerNote}"`);
    if (result.cards.length > 0) {
      const first = result.cards[0]!;
      console.log(`\n   First card: "${first.productTitle}"`);
      console.log(`   Format:     ${first.productFormat}`);
      console.log(`   Score:      ${first.opportunityScore}/100`);
      console.log(`   Confidence: ${first.confidenceLevel}`);
      console.log(`   Source:     ${first.dataSource}`);
    }
  } catch (err) {
    console.error(`\n❌ Agent run FAILED:`, err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
