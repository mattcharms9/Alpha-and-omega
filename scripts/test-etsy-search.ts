/**
 * Diagnostic script — run with: npx tsx scripts/test-etsy-search.ts
 * Tests the Etsy public search API directly and prints raw responses.
 */
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const ETSY_BASE = "https://openapi.etsy.com/v3";
const API_KEY = process.env.ETSY_API_KEY;

const API_SECRET = process.env.ETSY_API_SECRET;

if (!API_KEY) {
  console.error("ETSY_API_KEY not set in .env — cannot run test");
  process.exit(1);
}
if (!API_SECRET) {
  console.error("ETSY_API_SECRET not set in .env — cannot run test");
  process.exit(1);
}

const AUTH_HEADER = `${API_KEY}:${API_SECRET}`;
console.log(`\n✅ ETSY_API_KEY found: ${API_KEY.slice(0, 6)}...${API_KEY.slice(-4)}`);
console.log(`✅ ETSY_API_SECRET found: ${API_SECRET.slice(0, 4)}...${API_SECRET.slice(-2)}`);
console.log(`✅ x-api-key will be: ${AUTH_HEADER.slice(0, 12)}...\n`);

async function testSearch(label: string, params: Record<string, string>): Promise<void> {
  const qs = new URLSearchParams(params).toString();
  const url = `${ETSY_BASE}/application/listings/active?${qs}`;
  console.log(`\n── ${label} ──`);
  console.log(`URL: ${url}`);

  const res = await fetch(url, {
    headers: { "x-api-key": AUTH_HEADER },
  });

  console.log(`Status: ${res.status} ${res.statusText}`);

  const body = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    console.log("Body (raw):", body.slice(0, 500));
    return;
  }

  const d = parsed as Record<string, unknown>;
  if (d.count !== undefined) {
    console.log(`count: ${d.count}`);
  }
  const results = d.results as unknown[];
  if (Array.isArray(results)) {
    console.log(`results length: ${results.length}`);
    if (results.length > 0) {
      const first = results[0] as Record<string, unknown>;
      console.log("First result:", JSON.stringify({
        listing_id: first.listing_id,
        title: (first.title as string)?.slice(0, 60),
        state: first.state,
        num_favorers: first.num_favorers,
      }, null, 2));
    }
  } else {
    console.log("Response (no results array):", JSON.stringify(d, null, 2).slice(0, 500));
  }
}

async function main() {
  const query = "grief journal printable";

  // Test 1: Current implementation (type=digital, sort_on=score)
  await testSearch("Test 1: current impl (type=digital, sort_on=score)", {
    keywords: query,
    sort_on: "score",
    limit: "5",
    type: "digital",
  });

  // Test 2: No type filter, to see if that's blocking results
  await testSearch("Test 2: no type filter", {
    keywords: query,
    sort_on: "score",
    limit: "5",
  });

  // Test 3: listing_type=download (v3 correct param name)
  await testSearch("Test 3: listing_type=download", {
    keywords: query,
    sort_on: "score",
    limit: "5",
    listing_type: "download",
  });

  // Test 4: sort_on=created (known-valid sort value)
  await testSearch("Test 4: sort_on=created, no type filter", {
    keywords: query,
    sort_on: "created",
    limit: "5",
  });

  // Test 5: Minimal query to isolate auth issues
  await testSearch("Test 5: minimal — just keywords+limit", {
    keywords: query,
    limit: "3",
  });
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
