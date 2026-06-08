# Prompt Quality Log — Alpha & Omega

Track prompt changes, quality assessments, and improvements for all AI engine system prompts.

---

## Format

Each entry documents:
- **Engine:** which engine file contains the prompt
- **Date:** when assessed or changed
- **Version:** increment on every meaningful change
- **Token Estimate:** approximate system prompt token count
- **Quality Score:** 1–10 (output quality, JSON reliability, type adherence)
- **Issues:** any problems observed
- **Changes:** what was modified and why

---

## intelligence-engine.ts

**File:** `src/lib/ai/intelligence-engine.ts`  
**Function(s):** `scanEmotionalTrends()`, `scoreSignal()`

### v1.0 — 2026-05-25
**Token Estimate:** ~800  
**Quality Score:** 8/10  
**Output Reliability:** High — `EmotionalTrend[]` JSON well-formed on most calls  
**Issues:**
- `platforms` sometimes returned as a comma-separated string instead of array (fixed by Zod coercion in route)
- `productOpportunities` occasionally too brief (1–2 words) — prompt says "2-4 specific product opportunities"

**Notes:** Prompt uses "You are an emotional intelligence analyst" framing. Works well for niche identification and pain point mapping. No changes applied this session.

---

## brand-engine.ts

**File:** `src/lib/ai/brand-engine.ts`  
**Function(s):** `buildBrandArchitecture()`, `generateBrandBible()`

### v1.0 — 2026-05-25
**Token Estimate:** ~2,200 (highest in codebase)  
**Quality Score:** 9/10  
**Output Reliability:** High — `BrandArchitecture` JSON reliably formed  
**Issues:**
- System prompt is ~2,200 tokens — prompt caching (now implemented) is essential here
- `estimatedMonthlyRevenue` sometimes returns a range string ("$8,000–$15,000") — acceptable, stored as string
- `brandScore` and `defensibilityScore` occasionally out of 0–100 range (returned as 0–10 scale) — add explicit scale instruction

**Improvement Opportunity:** Add "Score on a scale of 0 to 100, not 0 to 10" to the scoring instructions.

---

## competitor-engine.ts

**File:** `src/lib/ai/competitor-engine.ts`  
**Function(s):** `analyzeCompetitiveLandscape()`, `findEmotionalGaps()`, `generateCounterStrategy()`

### v1.0 — 2026-05-25
**Token Estimate:** ~1,100  
**Quality Score:** 7/10  
**Output Reliability:** Medium — `flankingMoves` key name had a space bug at launch (fixed)  
**Issues:**
- Landscape analysis sometimes hallucinates specific revenue numbers ($X/month) for named brands — framed as "estimated" which is acceptable
- `opportunityScore` for gaps sometimes outside 0–100 — needs explicit range instruction

---

## product-engine.ts

**File:** `src/lib/ai/product-engine.ts`  
**Function(s):** `generateProductBlueprint()`

### v1.0 — 2026-05-25
**Token Estimate:** ~1,600  
**Quality Score:** 9/10  
**Output Reliability:** High — `ProductBlueprint` JSON reliably formed  
**Issues:**
- `pricingStrategy.competitorRange` sometimes omitted — not breaking (optional-ish field)
- `sections` array length varies (4–12) — expected, driven by `pageCount`

**Notes:** Prompt uses "You are a publishing empire architect" framing. Strong emotional specificity in output. Prompt caching now applied.

---

## content-engine.ts

**File:** `src/lib/ai/content-engine.ts`  
**Function(s):** `generateContentBatch()`

### v1.0 — 2026-05-25
**Token Estimate:** ~1,400  
**Quality Score:** 8/10  
**Output Reliability:** High — `ContentBatch` JSON reliably formed  
**Issues:**
- `hashtags` array sometimes includes `#` prefix (should be without) — Zod strips in some cases but not all
- `estimatedViews` returns a range string ("50K–200K") — stored as string, acceptable

---

## empire-engine.ts

**File:** `src/lib/ai/empire-engine.ts`  
**Function(s):** `generateOperatorBrief()`, `generateNextBestAction()`

### v1.0 — 2026-05-26
**Token Estimate:** ~900 each  
**Quality Score:** 8/10  
**Output Reliability:** High — simple string output (not JSON), high reliability  
**Notes:** These are the most expensive calls (3 parallel Claude calls on every dashboard refresh). Prompt caching applied. Consider memoizing the brief with a 15-minute TTL to reduce cost when empire state hasn't changed significantly.

---

## variant-engine.ts

**File:** `src/lib/ai/variant-engine.ts`  
**Function(s):** `generateListingVariants()`

### v1.0 — 2026-05-26
**Token Estimate:** ~1,000  
**Quality Score:** 8/10  
**Output Reliability:** High — 3-variant structured output reliably formed  
**Notes:** Generates benefit/problem/transformation variant trio. Pricing variation logic is simple and deterministic. No issues observed.

---

## image-engine.ts

**File:** `src/lib/ai/image-engine.ts`  
**Function(s):** `generateCoverImagePlan()`

### v1.0 — 2026-05-26
**Token Estimate:** ~700  
**Quality Score:** Unrated  
**Output Reliability:** High — generates DALL-E prompts (not images directly)  
**Notes:** Quality depends on downstream DALL-E 3 execution. Need to track cover image CTR on Etsy once live to measure real effectiveness.

---

## market-research-engine.ts

**File:** `src/lib/ai/market-research-engine.ts`  
**Function(s):** `analyzeEtsyMarket()`

### v1.0 — 2026-05-26
**Token Estimate:** ~1,100  
**Quality Score:** 6/10 (estimated)  
**Output Reliability:** Medium — relies on Claude's Etsy market knowledge  
**Issues:** Market data is based on training knowledge, not live Etsy API. Accuracy degrades over time as Etsy market conditions change.  
**Improvement:** Wire real Etsy search data when Etsy OAuth is built.

---

## pinterest-engine.ts

**File:** `src/lib/ai/pinterest-engine.ts`  
**Function(s):** `generatePinterestPinPlan()`

### v1.0 — 2026-05-26
**Token Estimate:** ~900  
**Quality Score:** 7/10 (estimated)  
**Output Reliability:** High — simple structured output  
**Issues:** Pin image URLs fail in dev (TD-013). Production testing needed.  
**Notes:** Auto-pins fire on every Gumroad publish. No quality feedback loop yet.

---

## mix-engine.ts

**File:** `src/lib/ai/mix-engine.ts`  
**Function(s):** `generateBatchPlan()`, `suggestNextBatch()`

### v1.0 — 2026-05-27
**Token Estimate:** ~800  
**Quality Score:** 8/10  
**Output Reliability:** High — batch plans are well-structured  
**Notes:** Pricing overridden by PRICING_TIERS constants regardless of AI output. Bundle slot depends on other slots completing — ordering is critical.

---

## batch-engine.ts

**File:** `src/lib/ai/batch-engine.ts`  
**Function(s):** `generateSingleProductForSlot()`

### v1.0 — 2026-05-27
**Token Estimate:** ~1,600 (delegates to product-engine system prompt)  
**Quality Score:** 9/10  
**Output Reliability:** High — reuses product-engine prompt  
**Notes:** Injects slot-specific overrides (format, pricing tier) into the product prompt. Bundle slots additionally receive constituent titles.

---

## niche-expansion-engine.ts

**File:** `src/lib/ai/niche-expansion-engine.ts`  
**Function(s):** `expandEmotion()`, `drillDeeper()`, `compareNiches()`

### v1.0 — 2026-05-27
**Token Estimate:** ~800 system prompt + ~400 user prompt = ~1,200 per call  
**Max Output Tokens:** 12,000 (8 rich sub-niches with full profiles)  
**Quality Score:** 9/10  
**Output Reliability:** High — detailed JSON schema in user prompt; explicit count constraint (8 sub-niches)  
**Notes:**
- System prompt positions Claude as "world-class market research analyst specializing in digital product niches" — sets authority frame
- User prompt injects current month for seasonal relevance accuracy
- `existingNicheNames` passed on drill-deeper to prevent overlap with already-researched niches
- Score fields (opportunityScore, evergreenScore, trendingScore, monetizationScore, currentSeasonalRelevance) all constrained to 0–100 in prompt
- `compareNiches()` uses a lighter prompt — ranking + recommendation, no full profile regeneration

**Observed weaknesses:**
- Occasionally returns fewer than 8 niches when the emotion is very narrow — acceptable for drill-deeper but suboptimal at top level
- `estimatedMonthlySearches` is AI-estimated, not from Etsy API — directionally useful, not precise

---

## knowledge-engine.ts

**File:** `src/lib/ai/knowledge-engine.ts`  
**Function(s):** `scanCapabilityGaps()`, `generateKnowledgeProduct()`

### v1.0 — 2026-05-27
**Token Estimate:** ~600 system + ~300 user = ~900 per scan call; ~900 system + ~500 user = ~1,400 per generate call  
**Max Output Tokens:** 8,000 (scan: 5 gaps; generate: full blueprint with sections)  
**Quality Score:** 8/10  
**Output Reliability:** High — explicit JSON schema with constrained scoring fields (0–100); shame/opportunity score bounds specified in prompt  
**Notes:**
- System prompt positions Claude as "expert in the adulting content and life skills digital products market" — grounds output in real Etsy market dynamics
- `scanCapabilityGaps()` passes `existingTitles` to prevent duplicate generation — prompt instructs engine to avoid topics already in the list
- `generateKnowledgeProduct()` passes the full `CapabilityGap` object so the engine can reference authentic language and urgency triggers verbatim
- Section types (`steps | checklist | explainer | key_terms | examples | worksheet`) constrained in prompt — reliable output for PDF template rendering

**Observed weaknesses:**
- Shame scores can cluster in the 60–80 range — prompt could benefit from explicit examples at 20, 50, and 90 to calibrate spread

---

## games-engine.ts

**File:** `src/lib/ai/games-engine.ts`  
**Function(s):** `generateGameProduct()`, `generateGameCalendar()`, `generateGameNiches()`

### v1.0 — 2026-05-27
**Token Estimate:** ~700 system + ~400 user = ~1,100 per generate call; ~400 system + ~200 user = ~600 per calendar/niches call  
**Max Output Tokens:** 8,000 (generate: full blueprint + game content); 6,000 (calendar: ~12 events); 3,000 (niches: 6 niches)  
**Quality Score:** 8/10  
**Output Reliability:** High — game content is type-specific; prompt explicitly lists which fields apply to each game type  
**Notes:**
- System prompt positions Claude as "expert in the printable party games and sports event sheets market on Etsy" — produces market-aware Etsy titles and tags
- `generateGameProduct()` accepts optional `customization` (names, theme, guestCount) — passed as a structured override block in the user prompt so the engine integrates naturally rather than appending
- `publishUrgency` constrained to 4 values in the prompt schema; `daysUntilPeak` anchors the urgency label to a specific number
- `generateGameCalendar()` produces ~12 events sorted by `publishBy` date — prompt instructs the engine to cover both recurring annual events and the current year's specifics
- `isEvergreen: boolean` correctly separates birthday/baby shower (sell year-round) from sports sheets (short buying window)

**Observed weaknesses:**
- `generateGameCalendar()` relies on the model's training data for event dates — Super Bowl date shifts slightly year to year; `daysUntilPeak` may be off by ~7 days
- `squaresTeam1/squaresTeam2` fields are speculative before the actual matchup is known — the engine outputs generic team placeholders, which is correct behavior for a template product

---

## Prompt Caching Status

| Engine | System Prompt Cached | Since |
|--------|----------------------|-------|
| `claude.ts` `generateWithClaude()` | ✅ Yes — `cache_control: ephemeral` | 2026-05-26 Session 004 |
| All engines that use `generateWithClaude` | ✅ Inherited | 2026-05-26 Session 004 |

---

## Overall Prompt Health

| Metric | Value |
|--------|-------|
| Total engine files | 14 |
| Engines with quality scores | 10 |
| Engines not yet rated in production | 4 (image-engine, market-research-engine, pinterest-engine, batch-engine) |
| Average quality score (rated) | 8.3 / 10 |
| JSON parse failures observed | 0 in production (retry catches edge cases) |
| Highest cost endpoint | `/api/empire?action=brief` (3 parallel calls, now cached 15 min) |
| Most reliable output | `product-engine.ts`, `content-engine.ts`, `batch-engine.ts` |
| Most improvement opportunity | `brand-engine.ts` scoring scale, `competitor-engine.ts` opportunityScore bounds, `market-research-engine.ts` live data |
