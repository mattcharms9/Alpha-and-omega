"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Building2, Target, TrendingUp, ChevronRight, Users, Zap, BookOpen, BarChart3, Layers } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn, formatCurrency } from "@/lib/utils";
import type { BrandArchitecture } from "@/lib/ai/brand-engine";
import { apiFetch } from "@/lib/api";

const EMOTIONAL_NICHES = [
  "Anxiety & Overwhelm",
  "Self-Worth & Confidence",
  "Grief & Loss",
  "Anger & Resentment",
  "Loneliness & Connection",
  "Fear & Safety",
  "Shame & Guilt",
  "Identity & Purpose",
  "Burnout & Recovery",
  "Relationship Healing",
];

const AUDIENCE_ARCHETYPES = [
  "The Overwhelmed Achiever",
  "The Quiet Sufferer",
  "The Seeker",
  "The Broken Dreamer",
  "The Exhausted Caregiver",
  "The Lost Professional",
  "The Recovering Perfectionist",
  "The Invisible One",
  "The Reluctant Warrior",
  "The Hopeful Cynic",
];

const REVENUE_TARGETS = [
  "$5K/month — Side income",
  "$10K/month — Replace salary",
  "$25K/month — Scale phase",
  "$50K/month — Empire building",
  "$100K/month+ — Market leader",
];

function ScoreRing({ score, label, color }: { score: number; label: string; color: string }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-16 h-16">
        <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
          <circle cx="32" cy="32" r={radius} fill="none" stroke={color} strokeWidth="4"
            strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 1s ease" }} />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">{score}</span>
      </div>
      <span className="text-[10px] text-white/40 uppercase tracking-wider">{label}</span>
    </div>
  );
}

function OfferCard({ tier, name, price, format, promise, role }: {
  tier: number; name: string; price: number; format: string; promise: string; role: string;
}) {
  const tierColors = ["var(--amber)", "var(--violet)", "var(--emerald)", "var(--amber)", "var(--rose)"];
  const color = tierColors[(tier - 1) % tierColors.length];
  return (
    <div className="glass rounded-xl p-4 border border-white/5 hover:border-white/10 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-black" style={{ background: color }}>{tier}</div>
          <span className="text-sm font-semibold text-white">{name}</span>
        </div>
        <span className="text-sm font-bold" style={{ color }}>{price === 0 ? "FREE" : formatCurrency(price)}</span>
      </div>
      <p className="text-xs text-white/50 mb-1">{format}</p>
      <p className="text-xs text-white/70 mb-2">{promise}</p>
      <p className="text-[10px] text-white/30 italic">{role}</p>
    </div>
  );
}

function RevenueProjection({ projection }: { projection: BrandArchitecture["revenueProjection"] }) {
  const months = [
    { label: "Month 1", value: projection.month1 },
    { label: "Month 3", value: projection.month3 },
    { label: "Month 6", value: projection.month6 },
    { label: "Month 12", value: projection.month12 },
  ];
  return (
    <div className="grid grid-cols-4 gap-3">
      {months.map((m, i) => (
        <div key={m.label} className="glass rounded-xl p-3 text-center border border-white/5">
          <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">{m.label}</div>
          <div className="text-sm font-bold" style={{ color: `hsl(${40 + i * 20}, 70%, 60%)` }}>{m.value}</div>
        </div>
      ))}
    </div>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <div className="text-sm font-semibold text-white mb-4">{children}</div>;
}

export default function BrandsPage() {
  const [step, setStep] = useState<"input" | "building" | "result">("input");
  const [emotionalNiche, setEmotionalNiche] = useState("");
  const [audienceArchetype, setAudienceArchetype] = useState("");
  const [revenueTarget, setRevenueTarget] = useState("");
  const [customNiche, setCustomNiche] = useState("");
  const [customAudience, setCustomAudience] = useState("");
  const [brand, setBrand] = useState<BrandArchitecture | null>(null);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  const effectiveNiche = customNiche || emotionalNiche;
  const effectiveAudience = customAudience || audienceArchetype;
  const canBuild = effectiveNiche && effectiveAudience && revenueTarget;

  async function handleBuild() {
    setStep("building");
    setError("");
    try {
      const res = await apiFetch("/api/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emotionalNiche: effectiveNiche, audienceArchetype: effectiveAudience, revenueTarget }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? "Build failed");
      setBrand(json.data);
      setStep("result");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setStep("input");
    }
  }

  const tabs = [
    { id: "overview", label: "Overview", icon: Building2 },
    { id: "psychology", label: "Psychology", icon: Target },
    { id: "offers", label: "Offer Stack", icon: Layers },
    { id: "content", label: "Content", icon: BookOpen },
    { id: "funnel", label: "Funnel", icon: BarChart3 },
    { id: "launch", label: "Launch", icon: Zap },
  ];

  return (
    <div style={{ padding: "0 0 48px" }}>
      {/* Page Header */}
      <div style={{ padding: "32px 36px 24px", borderBottom: "1px solid var(--border-subtle)" }}>
        <div className="flex items-center gap-4">
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Building2 size={20} style={{ color: "var(--gold)" }} />
          </div>
          <div>
            <h1 style={{ fontSize: "1.375rem", fontWeight: 700, letterSpacing: "-0.025em", color: "var(--text-primary)", lineHeight: 1.2 }}>Brand Builder</h1>
            <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginTop: 3 }}>Architect complete emotional commerce empires — not just products</p>
          </div>
        </div>
      </div>

      <div style={{ padding: "28px 36px" }}>
        <AnimatePresence mode="wait">
          {step === "input" && (
            <motion.div key="input" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-8">
              <div className="grid grid-cols-3 gap-6">
                {/* Step 1 */}
                <Card>
                  <CardBody>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center">
                        <span className="text-gold font-bold text-sm">1</span>
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white">Emotional Niche</h3>
                        <p className="text-xs text-white/40">The pain territory you&apos;ll own</p>
                      </div>
                    </div>
                    <div className="space-y-1.5 mb-4">
                      {EMOTIONAL_NICHES.map((n) => (
                        <button key={n} onClick={() => { setEmotionalNiche(n); setCustomNiche(""); }}
                          className={cn("w-full text-left px-3 py-2 rounded-lg text-sm transition-all",
                            emotionalNiche === n && !customNiche
                              ? "bg-gold/20 text-gold border border-gold/30"
                              : "text-white/60 hover:text-white hover:bg-white/5 border border-transparent")}>
                          {n}
                        </button>
                      ))}
                    </div>
                    <input type="text" placeholder="Or enter custom niche..." value={customNiche}
                      onChange={(e) => { setCustomNiche(e.target.value); setEmotionalNiche(""); }}
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-white/30 focus:outline-none focus:border-gold/30" />
                  </CardBody>
                </Card>

                {/* Step 2 */}
                <Card>
                  <CardBody>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-8 h-8 rounded-lg bg-violet/10 flex items-center justify-center">
                        <span className="text-violet font-bold text-sm">2</span>
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white">Audience Archetype</h3>
                        <p className="text-xs text-white/40">Who you&apos;re building for</p>
                      </div>
                    </div>
                    <div className="space-y-1.5 mb-4">
                      {AUDIENCE_ARCHETYPES.map((a) => (
                        <button key={a} onClick={() => { setAudienceArchetype(a); setCustomAudience(""); }}
                          className={cn("w-full text-left px-3 py-2 rounded-lg text-sm transition-all",
                            audienceArchetype === a && !customAudience
                              ? "bg-violet/20 text-violet border border-violet/30"
                              : "text-white/60 hover:text-white hover:bg-white/5 border border-transparent")}>
                          {a}
                        </button>
                      ))}
                    </div>
                    <input type="text" placeholder="Or enter custom archetype..." value={customAudience}
                      onChange={(e) => { setCustomAudience(e.target.value); setAudienceArchetype(""); }}
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-white/30 focus:outline-none focus:border-violet/30" />
                  </CardBody>
                </Card>

                {/* Step 3 */}
                <Card>
                  <CardBody>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-8 h-8 rounded-lg bg-emerald/10 flex items-center justify-center">
                        <span className="text-emerald font-bold text-sm">3</span>
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white">Revenue Target</h3>
                        <p className="text-xs text-white/40">Define your ambition level</p>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {REVENUE_TARGETS.map((r) => (
                        <button key={r} onClick={() => setRevenueTarget(r)}
                          className={cn("w-full text-left px-3 py-2 rounded-lg text-sm transition-all",
                            revenueTarget === r
                              ? "bg-emerald/20 text-emerald border border-emerald/30"
                              : "text-white/60 hover:text-white hover:bg-white/5 border border-transparent")}>
                          {r}
                        </button>
                      ))}
                    </div>
                    <div className="mt-6 p-4 rounded-xl bg-white/3 border border-white/5">
                      <div className="text-xs text-white/40 mb-3">Selected Parameters</div>
                      <div className="space-y-2">
                        {[
                          { k: "Niche", v: effectiveNiche, color: "text-gold" },
                          { k: "Audience", v: effectiveAudience, color: "text-violet" },
                          { k: "Revenue", v: revenueTarget, color: "text-emerald" },
                        ].map(({ k, v, color }) => (
                          <div key={k} className="flex justify-between text-xs">
                            <span className="text-white/40">{k}</span>
                            <span className={cn("font-medium truncate ml-2 max-w-[120px]", v ? color : "text-white/20")}>{v || "—"}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <Button onClick={handleBuild} disabled={!canBuild} variant="gold" className="w-full mt-4">
                      <Sparkles className="w-4 h-4 mr-2" />
                      Architect Brand
                    </Button>
                    {error && <p className="mt-3 text-xs text-rose text-center">{error}</p>}
                  </CardBody>
                </Card>
              </div>

              <div className="glass rounded-2xl p-6 border border-white/5">
                <h3 className="text-sm font-semibold text-white mb-4">What the Brand Builder produces</h3>
                <div className="grid grid-cols-4 gap-4">
                  {[
                    { icon: Building2, label: "Complete Brand Architecture", desc: "Jungian archetype, positioning, voice, visual identity" },
                    { icon: Target, label: "Audience Psychology Map", desc: "Core desires, deep fears, secret shame, buying triggers" },
                    { icon: Layers, label: "Full Offer Ecosystem", desc: "Lead magnet → core offer → upsell → subscription → high ticket" },
                    { icon: TrendingUp, label: "Revenue Roadmap", desc: "12-month projections with weekly launch milestones" },
                  ].map(({ icon: Icon, label, desc }) => (
                    <div key={label} className="flex gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-4 h-4 text-gold" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-white mb-1">{label}</div>
                        <div className="text-[11px] text-white/40">{desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {step === "building" && (
            <motion.div key="building" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-24 gap-6">
              <div className="relative w-20 h-20">
                <div className="absolute inset-0 rounded-full border-2 border-gold/20" />
                <div className="absolute inset-0 rounded-full border-t-2 border-gold animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Building2 className="w-8 h-8 text-gold" />
                </div>
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold text-white mb-2">Architecting your brand empire</h3>
                <p className="text-sm text-white/40 max-w-md">Analyzing emotional territories, mapping psychological triggers, structuring offer ecosystems...</p>
              </div>
              <div className="flex gap-2">
                {["Psychology", "Positioning", "Offers", "Content", "Revenue"].map((phase, i) => (
                  <div key={phase} className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
                    <span className="text-xs text-white/30">{phase}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {step === "result" && brand && (
            <motion.div key="result" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              {/* Brand Header */}
              <div className="glass rounded-2xl p-8 border border-gold/10">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <Badge variant="gold">{brand.emotionalCategory}</Badge>
                      <Badge variant="violet">{brand.positioning.jungianArchetype}</Badge>
                    </div>
                    <h1 className="text-4xl font-bold text-gold mb-2">{brand.brandName}</h1>
                    <p className="text-lg text-white/60 italic">&ldquo;{brand.tagline}&rdquo;</p>
                    <p className="text-sm text-white/40 mt-2">{brand.positioning.categoryFrame}</p>
                  </div>
                  <div className="flex gap-4">
                    <ScoreRing score={brand.brandScore} label="Brand" color="var(--amber)" />
                    <ScoreRing score={brand.defensibilityScore} label="Moat" color="var(--violet)" />
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  {[
                    { label: "Scale Revenue", value: brand.estimatedMonthlyRevenue, color: "var(--emerald)" },
                    { label: "Target Emotion", value: brand.targetEmotion, color: "var(--text-primary)" },
                    { label: "Audience", value: brand.audienceArchetype, color: "var(--text-primary)" },
                    { label: "Moat", value: brand.competitiveMoat.slice(0, 60) + "…", color: "var(--text-secondary)" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="glass rounded-xl p-4 border border-white/5">
                      <div className="text-xs text-white/40 mb-1">{label}</div>
                      <div className="text-sm font-semibold" style={{ color }}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 p-1 glass rounded-xl border border-white/5 w-fit">
                {tabs.map(({ id, label, icon: Icon }) => (
                  <button key={id} onClick={() => setActiveTab(id)}
                    className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                      activeTab === id ? "bg-gold/20 text-gold" : "text-white/40 hover:text-white hover:bg-white/5")}>
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                {activeTab === "overview" && (
                  <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-2 gap-6">
                    <Card>
                      <CardBody>
                        <SectionTitle>Brand Positioning</SectionTitle>
                        <div className="space-y-4">
                          <div>
                            <div className="text-xs text-white/40 mb-1">Unique Value Proposition</div>
                            <p className="text-sm text-white">{brand.positioning.uniqueValueProposition}</p>
                          </div>
                          <div>
                            <div className="text-xs text-white/40 mb-1">Emotional Promise</div>
                            <p className="text-sm text-white/80">{brand.positioning.emotionalPromise}</p>
                          </div>
                          <div>
                            <div className="text-xs text-white/40 mb-2">Brand Personality</div>
                            <div className="flex flex-wrap gap-2">
                              {brand.positioning.brandPersonality.map((t) => <Badge key={t} variant="default">{t}</Badge>)}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-white/40 mb-1">Brand Voice</div>
                            <p className="text-sm text-white/60 italic">{brand.positioning.brandVoice}</p>
                          </div>
                        </div>
                      </CardBody>
                    </Card>

                    <Card>
                      <CardBody>
                        <SectionTitle>Messaging Framework</SectionTitle>
                        <div className="space-y-4">
                          <div>
                            <div className="text-xs text-white/40 mb-1">Master Headline</div>
                            <p className="text-base font-semibold text-gold leading-tight">{brand.messagingFramework.masterHeadline}</p>
                          </div>
                          <div>
                            <div className="text-xs text-white/40 mb-1">Subheadline</div>
                            <p className="text-sm text-white/80">{brand.messagingFramework.subheadline}</p>
                          </div>
                          <div>
                            <div className="text-xs text-white/40 mb-1">Identity Shift</div>
                            <p className="text-sm text-violet font-medium">{brand.messagingFramework.identityShift}</p>
                          </div>
                          <div>
                            <div className="text-xs text-white/40 mb-1">Closing Statement</div>
                            <p className="text-sm text-white/60">{brand.messagingFramework.closingStatement}</p>
                          </div>
                        </div>
                      </CardBody>
                    </Card>

                    <div className="col-span-2">
                      <Card>
                        <CardBody>
                          <SectionTitle>Revenue Projection</SectionTitle>
                          <RevenueProjection projection={brand.revenueProjection} />
                          <div className="mt-4 p-4 rounded-xl bg-gold/5 border border-gold/10">
                            <div className="text-xs text-white/40 mb-2">Highest Leverage Action</div>
                            <p className="text-sm text-gold font-medium">{brand.revenueProjection.highestLeverageAction}</p>
                          </div>
                        </CardBody>
                      </Card>
                    </div>
                  </motion.div>
                )}

                {activeTab === "psychology" && (
                  <motion.div key="psychology" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-2 gap-6">
                    <Card>
                      <CardBody>
                        <SectionTitle>Core Desires</SectionTitle>
                        <div className="space-y-2">
                          {brand.audiencePsychology.coreDesires.map((d, i) => (
                            <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-white/3">
                              <div className="w-5 h-5 rounded-full bg-gold/20 flex items-center justify-center text-[10px] text-gold flex-shrink-0 mt-0.5">{i + 1}</div>
                              <p className="text-sm text-white/80">{d}</p>
                            </div>
                          ))}
                        </div>
                      </CardBody>
                    </Card>

                    <Card>
                      <CardBody>
                        <SectionTitle>Deep Fears</SectionTitle>
                        <div className="space-y-2">
                          {brand.audiencePsychology.deepFears.map((f, i) => (
                            <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-rose/5 border border-rose/10">
                              <div className="w-5 h-5 rounded-full bg-rose/20 flex items-center justify-center text-[10px] text-rose flex-shrink-0 mt-0.5">{i + 1}</div>
                              <p className="text-sm text-white/80">{f}</p>
                            </div>
                          ))}
                        </div>
                      </CardBody>
                    </Card>

                    <div className="col-span-2">
                      <Card>
                        <CardBody>
                          <SectionTitle>Audience Inner World</SectionTitle>
                          <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-4">
                              <div>
                                <div className="text-xs text-white/40 mb-2">Secret Shame</div>
                                <p className="text-sm text-white/80 p-3 rounded-lg bg-violet/5 border border-violet/10">{brand.audiencePsychology.secretShame}</p>
                              </div>
                              <div>
                                <div className="text-xs text-white/40 mb-2">Internal Dialogue (2am)</div>
                                <p className="text-sm text-white/70 italic p-3 rounded-lg bg-white/3 border border-white/5">&ldquo;{brand.audiencePsychology.internalDialogue}&rdquo;</p>
                              </div>
                            </div>
                            <div className="space-y-4">
                              <div>
                                <div className="text-xs text-white/40 mb-2">Current Pain State</div>
                                <p className="text-sm text-white/80">{brand.audiencePsychology.currentPainState}</p>
                              </div>
                              <div>
                                <div className="text-xs text-white/40 mb-2">Desired Transformation</div>
                                <p className="text-sm text-emerald">{brand.audiencePsychology.desiredTransformation}</p>
                              </div>
                              <div>
                                <div className="text-xs text-white/40 mb-2">Aspirational Identity</div>
                                <p className="text-sm text-gold font-medium">{brand.audiencePsychology.aspirationalIdentity}</p>
                              </div>
                            </div>
                          </div>
                        </CardBody>
                      </Card>
                    </div>
                  </motion.div>
                )}

                {activeTab === "offers" && (
                  <motion.div key="offers" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                    <Card>
                      <CardBody>
                        <SectionTitle>Product Ladder</SectionTitle>
                        <div className="grid grid-cols-2 gap-3">
                          {brand.productLadder.map((tier) => (
                            <OfferCard key={tier.tier} tier={tier.tier} name={tier.name} price={tier.price}
                              format={tier.format} promise={tier.transformationPromise} role={tier.psychologicalRole} />
                          ))}
                        </div>
                      </CardBody>
                    </Card>

                    <div className="grid grid-cols-2 gap-6">
                      <Card>
                        <CardBody>
                          <SectionTitle>Lead Magnet</SectionTitle>
                          <div className="space-y-2">
                            <div className="text-base font-semibold text-white">{brand.offerStack.leadMagnet.name}</div>
                            <Badge variant="default">{brand.offerStack.leadMagnet.format}</Badge>
                            <p className="text-sm text-white/60">{brand.offerStack.leadMagnet.emotionalHook}</p>
                            <div className="flex items-center gap-2 pt-2">
                              <Users className="w-3.5 h-3.5 text-emerald" />
                              <span className="text-xs text-emerald">Est. conversion: {brand.offerStack.leadMagnet.estimatedConversionRate}</span>
                            </div>
                          </div>
                        </CardBody>
                      </Card>

                      <Card>
                        <CardBody>
                          <SectionTitle>High Ticket</SectionTitle>
                          <div className="space-y-2">
                            <div className="text-base font-semibold text-white">{brand.offerStack.highTicket.name}</div>
                            <div className="text-2xl font-bold text-gold">{formatCurrency(brand.offerStack.highTicket.price)}</div>
                            <Badge variant="gold">{brand.offerStack.highTicket.deliveryFormat}</Badge>
                            <p className="text-sm text-white/60">{brand.offerStack.highTicket.qualificationCriteria}</p>
                          </div>
                        </CardBody>
                      </Card>
                    </div>
                  </motion.div>
                )}

                {activeTab === "content" && (
                  <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-2 gap-6">
                    <Card>
                      <CardBody>
                        <SectionTitle>Content Strategy</SectionTitle>
                        <div className="space-y-4">
                          <div>
                            <div className="text-xs text-white/40 mb-2">Primary Platform</div>
                            <Badge variant="gold">{brand.contentStrategy.primaryPlatform}</Badge>
                          </div>
                          <div>
                            <div className="text-xs text-white/40 mb-2">Secondary Platforms</div>
                            <div className="flex flex-wrap gap-2">
                              {brand.contentStrategy.secondaryPlatforms.map((p) => <Badge key={p} variant="default">{p}</Badge>)}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-white/40 mb-2">Content Pillars</div>
                            <div className="space-y-1">
                              {brand.contentStrategy.contentPillars.map((p, i) => (
                                <div key={i} className="flex items-center gap-2 text-sm text-white/70">
                                  <ChevronRight className="w-3 h-3 text-gold" />{p}
                                </div>
                              ))}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-white/40 mb-1">Weekly Rhythm</div>
                            <p className="text-sm text-white/60">{brand.contentStrategy.weeklyContentRhythm}</p>
                          </div>
                        </div>
                      </CardBody>
                    </Card>

                    <Card>
                      <CardBody>
                        <SectionTitle>Viral Angles</SectionTitle>
                        <div className="space-y-2 mb-6">
                          {brand.contentStrategy.viralAngles.map((a, i) => (
                            <div key={i} className="p-3 rounded-lg bg-white/3 border border-white/5">
                              <p className="text-sm text-white/80">{a}</p>
                            </div>
                          ))}
                        </div>
                        <div>
                          <div className="text-xs text-white/40 mb-2">Email Welcome Sequence</div>
                          <div className="space-y-1">
                            {brand.contentStrategy.emailSequence.map((e, i) => (
                              <div key={i} className="flex items-center gap-2 text-sm text-white/60">
                                <span className="text-[10px] text-white/30 w-6">#{i + 1}</span>{e}
                              </div>
                            ))}
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  </motion.div>
                )}

                {activeTab === "funnel" && (
                  <motion.div key="funnel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-2 gap-6">
                    <Card>
                      <CardBody>
                        <SectionTitle>Awareness & Interest</SectionTitle>
                        <div className="space-y-4">
                          <div>
                            <div className="text-xs text-white/40 mb-1">Awareness Strategy</div>
                            <p className="text-sm text-white/80">{brand.funnelMap.awarenessStrategy}</p>
                          </div>
                          <div>
                            <div className="text-xs text-white/40 mb-2">Awareness Hooks</div>
                            {brand.funnelMap.awarenessHooks.map((h, i) => (
                              <div key={i} className="p-2 rounded-lg bg-white/3 mb-1 text-sm text-white/70">{h}</div>
                            ))}
                          </div>
                          <div>
                            <div className="text-xs text-white/40 mb-2">Interest Content</div>
                            {brand.funnelMap.interestContent.map((c, i) => (
                              <div key={i} className="text-sm text-white/60 flex items-center gap-2">
                                <ChevronRight className="w-3 h-3 text-violet" />{c}
                              </div>
                            ))}
                          </div>
                        </div>
                      </CardBody>
                    </Card>

                    <Card>
                      <CardBody>
                        <SectionTitle>Conversion & Retention</SectionTitle>
                        <div className="space-y-4">
                          <div>
                            <div className="text-xs text-white/40 mb-2">Conversion Mechanisms</div>
                            {brand.funnelMap.conversionMechanisms.map((m, i) => (
                              <div key={i} className="p-2 rounded-lg bg-emerald/5 border border-emerald/10 mb-1 text-sm text-white/70">{m}</div>
                            ))}
                          </div>
                          <div>
                            <div className="text-xs text-white/40 mb-1">Onboarding Experience</div>
                            <p className="text-sm text-white/70">{brand.funnelMap.onboardingExperience}</p>
                          </div>
                          <div>
                            <div className="text-xs text-white/40 mb-1">Retention Loop</div>
                            <p className="text-sm text-white/70">{brand.funnelMap.retentionLoop}</p>
                          </div>
                          <div>
                            <div className="text-xs text-white/40 mb-1">Win-back Strategy</div>
                            <p className="text-sm text-white/70">{brand.funnelMap.winbackStrategy}</p>
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  </motion.div>
                )}

                {activeTab === "launch" && (
                  <motion.div key="launch" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                    {brand.launchRoadmap.map((week) => (
                      <div key={week.week} className="glass rounded-xl p-5 border border-white/5 hover:border-white/10 transition-colors">
                        <div className="flex items-start gap-4">
                          <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-gold font-bold text-sm">W{week.week}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-sm font-semibold text-white">{week.milestone}</h4>
                              <div className="text-xs text-white/40">{week.kpi}</div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <div className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Actions</div>
                                <div className="space-y-1">
                                  {week.actions.map((a, i) => (
                                    <div key={i} className="flex items-start gap-2 text-xs text-white/60">
                                      <div className="w-1 h-1 rounded-full bg-gold mt-1.5 flex-shrink-0" />{a}
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <div className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Expected Outcome</div>
                                <p className="text-xs text-emerald">{week.expectedOutcome}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              <Button variant="ghost" onClick={() => { setStep("input"); setBrand(null); setActiveTab("overview"); }}>
                Build Another Brand
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
