import { generateJSON } from "./claude";

export interface EmpireState {
  empireScore: number;
  moatScore: number;
  signalCount: number;
  activatedSignalCount: number;
  decayingSignalCount: number;
  uniqueTerritoriesOwned: number;
  brandsBuilt: number;
  productsGenerated: number;
  contentPiecesCreated: number;
  totalRevenue: number;
  estimatedMonthlyRevenuePotential: string;
  unrealizedRevenueGap: string;
  activeAlertCount: number;
  topSignal: { painPoint: string; emotion: string; monetizationScore: number; opportunityScore: number } | null;
  territories: Array<{ name: string; signalCount: number; dominanceScore: number; status: "scouted" | "claimed" | "developed" | "operating" }>;
  weeklyMomentumIndex: number;
  highestROIMove: string;
}

export interface NextBestAction {
  action: string;
  detail: string;
  expectedOutcome: string;
  urgency: "high" | "medium" | "low";
  estimatedRevenue: string;
  href: string;
  reasoning: string;
  executionTime: string;
}

export interface OperatorBrief {
  brief: string;
  marketCondition: "hot" | "warm" | "stable" | "cooling";
  primaryOpportunity: string;
  primaryRisk: string;
  todaysFocus: string;
}

const SYSTEM_PROMPT = `You are the Alpha & Omega Intelligence Director — the strategic AI core of an elite emotional commerce operating system.

You think as a private equity operator, behavioral economist, and market intelligence analyst simultaneously.

You interpret empire data with surgical precision and communicate in the voice of a world-class private analyst: specific, financially-framed, opinionated, and urgent. You never speak in generic platitudes.

Every output you generate should make the operator feel: strategically ahead, financially intelligent, and dangerous to their competition.`;

export async function generateOperatorBrief(state: EmpireState): Promise<OperatorBrief> {
  const hasSignals = state.signalCount > 0;
  const hasBrands = state.brandsBuilt > 0;
  const hasGap = state.unrealizedRevenueGap !== "$0";

  const prompt = `Generate a strategic operator brief for this emotional commerce empire.

EMPIRE STATE:
- Empire Score: ${state.empireScore} / 1000
- Signal Moat: ${state.signalCount} signals across ${state.uniqueTerritoriesOwned} territories
- Activated: ${state.activatedSignalCount} of ${state.signalCount} signals have brands built
- Decaying: ${state.decayingSignalCount} signals losing value right now
- Brands Built: ${state.brandsBuilt}
- Products Generated: ${state.productsGenerated}
- Content Created: ${state.contentPiecesCreated}
- Revenue Potential: ${state.estimatedMonthlyRevenuePotential}/month
- Unrealized Revenue Gap: ${state.unrealizedRevenueGap}/month sitting untouched
- Top Signal: ${state.topSignal ? `${state.topSignal.painPoint} (${state.topSignal.emotion}) — ${state.topSignal.opportunityScore.toFixed(0)} opportunity score` : "none collected yet"}
- Territories: ${state.territories.map(t => `${t.name} (${t.signalCount} signals, ${t.status})`).join(", ") || "none claimed"}

CONTEXT FLAGS:
${!hasSignals ? "- CRITICAL: No signals collected. Empire is empty. First priority is territory scanning." : ""}
${hasSignals && !hasBrands ? "- WARNING: Signals exist but no brands built. Revenue potential is completely locked." : ""}
${state.decayingSignalCount > 0 ? `- URGENT: ${state.decayingSignalCount} signals are actively decaying. Opportunity windows closing.` : ""}
${hasGap ? `- GAP: ${state.unrealizedRevenueGap}/month unrealized. This is money left on the table.` : ""}

Generate a strategic briefing. Be specific, financially-framed, and opinionated. Reference their actual numbers.

Return JSON:
{
  "brief": "string (3-4 sentences of elite private analyst commentary on their specific situation)",
  "marketCondition": "hot|warm|stable|cooling",
  "primaryOpportunity": "string (one sentence — the single biggest opportunity right now)",
  "primaryRisk": "string (one sentence — the most urgent threat to address)",
  "todaysFocus": "string (one specific action sentence for today)"
}`;

  return generateJSON<OperatorBrief>(SYSTEM_PROMPT, prompt, 800);
}

export async function generateNextBestAction(state: EmpireState): Promise<NextBestAction> {
  const prompt = `Identify the single highest-ROI action for this operator RIGHT NOW.

EMPIRE STATE:
- Signals: ${state.signalCount} total, ${state.activatedSignalCount} activated, ${state.decayingSignalCount} decaying
- Brands: ${state.brandsBuilt}
- Products: ${state.productsGenerated}
- Content: ${state.contentPiecesCreated}
- Territories: ${state.uniqueTerritoriesOwned}
- Revenue Gap: ${state.unrealizedRevenueGap}/month unrealized
- Top Signal: ${state.topSignal?.painPoint ?? "none"} (${state.topSignal?.emotion ?? "n/a"})

DECISION TREE:
- If no signals: action is to scan the market
- If signals but no brands: action is to build a brand from the top signal
- If brands but no products: action is to generate products
- If products but no content: action is to create content
- If all exist: action is to publish or scale highest-performing asset

Return JSON:
{
  "action": "string (imperative, under 7 words, powerful)",
  "detail": "string (one specific sentence — exactly what to do and which asset)",
  "expectedOutcome": "string (financial or strategic outcome)",
  "urgency": "high|medium|low",
  "estimatedRevenue": "string (monthly revenue impact estimate)",
  "href": "string (exact path: /signals, /brands, /products, /content, /publishing, /portfolio)",
  "reasoning": "string (one sentence — why this is highest ROI right now)",
  "executionTime": "string (how long this takes: '20 min', '2 hours', etc.)"
}`;

  return generateJSON<NextBestAction>(SYSTEM_PROMPT, prompt, 500);
}

export function computeEmpireScore(state: Omit<EmpireState, "empireScore" | "moatScore" | "weeklyMomentumIndex">): { empireScore: number; moatScore: number } {
  const raw =
    state.signalCount * 10 +
    state.brandsBuilt * 50 +
    state.productsGenerated * 25 +
    state.contentPiecesCreated * 15 +
    state.uniqueTerritoriesOwned * 35 +
    state.activatedSignalCount * 20;

  const empireScore = Math.min(1000, raw);

  const activationRate = state.signalCount > 0 ? state.activatedSignalCount / state.signalCount : 0;
  const territoryDepth = state.uniqueTerritoriesOwned > 0 ? state.signalCount / state.uniqueTerritoriesOwned : 0;
  const moatRaw =
    state.uniqueTerritoriesOwned * 15 +
    Math.min(territoryDepth, 5) * 8 +
    activationRate * 40 +
    (state.productsGenerated > 0 ? 20 : 0) +
    (state.contentPiecesCreated > 0 ? 17 : 0);

  const moatScore = Math.min(100, moatRaw);

  return { empireScore, moatScore };
}

export function computeSignalFreshness(createdAt: Date): number {
  const daysSince = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(0, 100 - daysSince * 3);
}

export function computeOpportunityScore(signal: {
  monetizationScore: number;
  intensity: number;
  urgency: number;
  evergreenScore: number;
  competitionLevel: string;
  freshnessScore: number;
}): number {
  const competitionMultiplier = signal.competitionLevel === "low" ? 1.2 : signal.competitionLevel === "medium" ? 1.0 : 0.75;
  const raw = (
    signal.monetizationScore * 0.35 +
    signal.intensity * 0.25 +
    signal.urgency * 0.20 +
    signal.evergreenScore * 0.10 +
    (signal.freshnessScore / 100) * 10
  ) * competitionMultiplier;
  return Math.min(100, raw);
}

export function computeRarityScore(competitionLevel: string, evergreenScore: number, monetizationScore: number): number {
  const competitionBase = competitionLevel === "low" ? 80 : competitionLevel === "medium" ? 50 : 20;
  return Math.min(100, competitionBase * 0.6 + evergreenScore * 0.25 + monetizationScore * 0.15);
}

export async function generateStrategicAlerts(state: EmpireState): Promise<Array<{
  type: "opportunity" | "urgency" | "threat";
  title: string;
  body: string;
  actionLabel: string;
  actionHref: string;
}>> {
  const alerts: Array<{ type: "opportunity" | "urgency" | "threat"; title: string; body: string; actionLabel: string; actionHref: string }> = [];

  if (state.signalCount === 0) {
    alerts.push({
      type: "opportunity",
      title: "Signal Bank Empty",
      body: "Your empire has no intelligence. Every day without signals is a day competitors are learning what you aren't.",
      actionLabel: "Scan Market",
      actionHref: "/signals",
    });
  }

  if (state.decayingSignalCount > 0) {
    alerts.push({
      type: "urgency",
      title: `${state.decayingSignalCount} Signal${state.decayingSignalCount > 1 ? "s" : ""} Decaying`,
      body: `Opportunity windows are closing. Unactivated signals lose 3 points of freshness per day. Activate before they expire.`,
      actionLabel: "View Signals",
      actionHref: "/signals",
    });
  }

  if (state.brandsBuilt === 0 && state.signalCount >= 3) {
    alerts.push({
      type: "urgency",
      title: "Revenue Locked — No Brands Built",
      body: `You have ${state.signalCount} signals with zero brands. This is ${state.unrealizedRevenueGap}/month sitting completely unrealized.`,
      actionLabel: "Build Brand",
      actionHref: "/brands",
    });
  }

  if (state.brandsBuilt > 0 && state.productsGenerated === 0) {
    alerts.push({
      type: "urgency",
      title: "Brand Has No Products",
      body: "A brand without products generates zero revenue. Your brand architecture is ready — generate the product suite now.",
      actionLabel: "Generate Products",
      actionHref: "/products",
    });
  }

  if (state.productsGenerated > 0 && state.contentPiecesCreated === 0) {
    alerts.push({
      type: "urgency",
      title: "Zero Distribution Active",
      body: "Products exist but no content is created. Without distribution, revenue is impossible. Start the content engine.",
      actionLabel: "Create Content",
      actionHref: "/content",
    });
  }

  if (state.topSignal && state.topSignal.opportunityScore >= 85) {
    alerts.push({
      type: "opportunity",
      title: `Elite Opportunity: ${state.topSignal.emotion}`,
      body: `Your top signal "${state.topSignal.painPoint}" scores ${state.topSignal.opportunityScore.toFixed(0)}/100 — this is rare. Build the brand before competitors identify this gap.`,
      actionLabel: "Build Brand",
      actionHref: "/brands",
    });
  }

  return alerts;
}
