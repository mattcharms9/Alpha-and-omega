import { generateJSON } from "./claude";
import type { AudienceGapReport, CapabilityGapReport, CapabilityGap, KnowledgeProductBlueprint } from "./knowledge-types";
import type { KnowledgeCategory, ProductFormat } from "./mix-types";

const SYSTEM_PROMPT = `You are an expert in the "adulting content" and life skills digital products market on Etsy and Gumroad.

THE SHAME ECONOMY:
The most profitable knowledge products target capability anxiety — the embarrassment people feel about not knowing things they feel they should already know. This shame creates strong buying behavior because:
1. People won't ask friends or Google publicly — they buy privately
2. The solution feels urgent (a life event is forcing the issue)
3. They'll pay more for something that acknowledges their situation without judging them

The single most powerful insight: your product title must acknowledge the shame while making the buyer feel SEEN rather than criticized.

WHAT WORKS:
- "Finally Understand Your Paycheck (No Financial Background Needed)"
- "The Adult Skills Nobody Taught You: Taxes Edition"
- "Adulting 101: How to Actually Read Your Lease"

WHAT DOESN'T WORK:
- "Budgeting for Beginners" (too generic, doesn't acknowledge shame)
- "Financial Literacy Guide" (sounds like homework)

AUDIENCE PSYCHOLOGY:
Sweet spots are life stage transitions that force people to confront gaps: first job, first apartment, first marriage, first home, first baby, first major health event, retirement.

ETSY SEARCH BEHAVIOR:
Buyers search for the specific skill + "printable" or "worksheet" or "guide".
High value terms: "adulting", "life skills", "how to", "beginner guide", "step by step", "printable worksheet", "fillable template"

CONTENT STRUCTURE THAT CONVERTS:
1. "What you'll learn" (outcomes first)
2. "Why this feels hard" (validates their experience)
3. Step-by-step core content with real examples
4. Practice worksheet or fillable template
5. Quick reference card / cheat sheet to keep
6. "What to do next"

PRICING PSYCHOLOGY:
- Checklists at $4-6: "less than a coffee"
- Guides at $7-9: "cheaper than an hour with an accountant"
- Workbooks at $14-19: "worth it to actually learn this properly"

COMPETITION: Low = under 500 Etsy results, Medium = 500-2000, High = 2000+

Score EVERYTHING on 0-100. Always return valid JSON matching the requested interface exactly.`;

export async function scanCapabilityGaps(
  targetAudience: string,
  category: KnowledgeCategory,
  existingTitles?: string[]
): Promise<CapabilityGapReport> {
  const avoidContext = existingTitles?.length
    ? `\nAVOID these — already have products for them:\n${existingTitles.join("\n")}`
    : "";

  const prompt = `Find 12-15 specific capability gaps for this audience and category.

Target audience: "${targetAudience}"
Category: "${category}"
Current month: ${new Date().getMonth() + 1} (${new Date().toLocaleString("en-US", { month: "long" })})
${avoidContext}

Requirements:
- Each gap must be a SPECIFIC skill, not a broad topic
  Bad: "understanding money" | Good: "understanding what each line item on their pay stub means"
- shameLevel: how embarrassed this audience feels not knowing this (0-100). Use the FULL range — calibration examples: "Still uses parents' Netflix password at 32" = 20 | "Never opened a retirement account at 40" = 65 | "Has never filed their own taxes at 35" = 90 | "Doesn't understand their paycheck deductions at 28" = 75. Most capability gaps score between 40 and 80.
- urgencyTrigger: the SPECIFIC life event forcing them to learn this NOW
- authenticLanguage: real phrases the person thinks at 2am, NOT marketing copy
- sampleTitles: use the shame-reframe formula (acknowledge the gap warmly)
- contentOutline: specific section headers, not vague categories
- etsySearchTerms: include product type words (printable, worksheet, guide, checklist)
- recommendedFormat: one of knowledge_guide, knowledge_workbook, checklist, template_pack
- opportunityScore: 0-100

Return JSON matching this interface exactly:
{
  "targetAudience": string,
  "category": string,
  "totalGapsFound": number,
  "gaps": [{
    "id": "kebab-case-id",
    "title": string,
    "category": string,
    "audience": string,
    "shameLevel": number,
    "urgencyTrigger": string,
    "whatTheyveSearched": [string],
    "authenticLanguage": [string],
    "opportunityScore": number,
    "competitionLevel": "low"|"medium"|"high",
    "etsySearchTerms": [string],
    "recommendedFormat": string,
    "recommendedPrice": number,
    "productTitleFormula": string,
    "sampleTitles": [string],
    "contentOutline": [string],
    "shameReframe": string,
    "evergreen": boolean,
    "peakMonths": [number]
  }],
  "topPick": { same as gap },
  "quickWins": [{ same as gap }],
  "audienceSummary": string,
  "marketContext": string,
  "titleStrategy": string,
  "bundleOpportunity": string
}`;

  return generateJSON<CapabilityGapReport>(SYSTEM_PROMPT, prompt, 10000, "knowledge-engine");
}

export async function generateKnowledgeProduct(
  gap: CapabilityGap,
  format: ProductFormat
): Promise<KnowledgeProductBlueprint> {
  const prompt = `Generate a complete knowledge product blueprint.

Capability gap: "${gap.title}"
Target audience: "${gap.audience}"
Shame level: ${gap.shameLevel}/100
Format: ${format}
Price: $${gap.recommendedPrice}
Urgency trigger: "${gap.urgencyTrigger}"
Authentic language they use: ${gap.authenticLanguage.join(", ")}

Return JSON matching this interface exactly:
{
  "title": string (shame-reframe formula — warm, acknowledges gap, no judgment),
  "subtitle": string,
  "targetGap": { copy the gap object },
  "format": "${format}",
  "price": number,
  "pageCount": number,
  "sections": [{
    "title": string,
    "type": "explainer"|"steps"|"checklist"|"worksheet"|"key_terms"|"examples",
    "content": [string],
    "hasWorksheet": boolean,
    "estimatedPages": number
  }],
  "learningOutcomes": [string],
  "prerequisiteKnowledge": string,
  "toneGuidance": string,
  "designNotes": string,
  "etsyDescription": string (opens with urgency trigger, validates shame, describes contents),
  "tags": [string] (exactly 13 Etsy tags),
  "coverConceptDescription": string (clean, minimal, professional, no people, flat lay)
}`;

  return generateJSON<KnowledgeProductBlueprint>(SYSTEM_PROMPT, prompt, 8000, "knowledge-engine");
}

export async function scanAudienceGaps(targetAudience: string): Promise<AudienceGapReport> {
  const prompt = `Perform an audience-first gap analysis. Instead of starting with a category, start with the person.

Target audience: "${targetAudience}"

Discover 8-10 knowledge gaps by deeply understanding this person's identity, tensions, and desires. What do they desperately need to learn but won't admit? What capability would change their self-image?

Return JSON matching this interface exactly:
{
  "targetAudience": string,
  "audienceProfile": string (3-sentence psychographic portrait),
  "coreIdentityTension": string (the one tension that drives all their self-improvement purchases),
  "gaps": [{
    "gap": string (specific skill or knowledge gap),
    "painPoint": string (the exact moment they feel this pain),
    "desiredTransformation": string (who they want to become by solving this),
    "blockers": [string] (why they haven't solved it yet),
    "searchIntent": [string] (what they'd type into Etsy/Google at 2am),
    "idealProductType": string (guide, workbook, checklist, template pack, etc.),
    "priceWillingness": string (e.g. "$7-12 — cheaper than a therapist session"),
    "opportunityScore": number (0-100)
  }],
  "topOpportunity": { same as gap object },
  "bundleIdea": string (how 2-3 gaps could become a bundle),
  "audienceLanguage": [string] (8-10 phrases this audience actually uses),
  "totalGapsFound": number
}`;

  return generateJSON<AudienceGapReport>(SYSTEM_PROMPT, prompt, 14000, "knowledge-engine");
}
