"use client";

import { useState, useEffect, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy, Calendar, Zap, AlertCircle, Clock, ChevronRight, X,
} from "lucide-react";
import { useActiveNiche } from "@/lib/stores/active-niche";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { apiFetch } from "@/lib/api";
import type { GameProductBlueprint, GameCalendarEvent } from "@/lib/ai/games-types";
import type { EventCategory, GameType, ProductFormat } from "@/lib/ai/mix-types";

const EVENT_GROUPS = [
  {
    label: "⚡ Sports Events",
    options: [
      { value: "super_bowl" as EventCategory, label: "Super Bowl" },
      { value: "march_madness" as EventCategory, label: "March Madness" },
      { value: "kentucky_derby" as EventCategory, label: "Kentucky Derby" },
      { value: "masters_golf" as EventCategory, label: "Masters Golf" },
      { value: "world_cup" as EventCategory, label: "World Cup" },
      { value: "nfl_season" as EventCategory, label: "NFL Season" },
      { value: "nba_playoffs" as EventCategory, label: "NBA Playoffs" },
      { value: "fantasy_sports" as EventCategory, label: "Fantasy Sports" },
    ],
  },
  {
    label: "🎉 Life Events",
    options: [
      { value: "wedding" as EventCategory, label: "Wedding" },
      { value: "bridal_shower" as EventCategory, label: "Bridal Shower" },
      { value: "bachelorette" as EventCategory, label: "Bachelorette" },
      { value: "baby_shower" as EventCategory, label: "Baby Shower" },
      { value: "birthday" as EventCategory, label: "Birthday" },
      { value: "retirement" as EventCategory, label: "Retirement" },
      { value: "graduation" as EventCategory, label: "Graduation" },
    ],
  },
  {
    label: "🎊 Party Events",
    options: [
      { value: "super_bowl_party" as EventCategory, label: "Super Bowl Party" },
      { value: "christmas_party" as EventCategory, label: "Christmas Party" },
      { value: "new_years_eve" as EventCategory, label: "New Year's Eve" },
      { value: "thanksgiving" as EventCategory, label: "Thanksgiving" },
      { value: "halloween_party" as EventCategory, label: "Halloween Party" },
      { value: "fourth_of_july" as EventCategory, label: "4th of July" },
      { value: "office_party" as EventCategory, label: "Office Party" },
    ],
  },
];

const GAME_TYPES: Array<{ value: GameType; label: string; emoji: string }> = [
  { value: "bingo", label: "Bingo Card", emoji: "🟨" },
  { value: "squares", label: "Squares Grid", emoji: "🔲" },
  { value: "bracket", label: "Tournament Bracket", emoji: "🏆" },
  { value: "pick_sheet", label: "Pick Sheet", emoji: "✏️" },
  { value: "prop_bets", label: "Prop Bets", emoji: "🎰" },
  { value: "trivia", label: "Trivia Game", emoji: "🧠" },
  { value: "how_well_do_you_know", label: "How Well Do You Know", emoji: "❓" },
  { value: "prediction_sheet", label: "Prediction Sheet", emoji: "🔮" },
  { value: "scavenger_hunt", label: "Scavenger Hunt", emoji: "🗺️" },
  { value: "word_search", label: "Word Search", emoji: "🔍" },
];

const FORMATS: Array<{ value: ProductFormat; label: string; price: string }> = [
  { value: "game_sheet", label: "Single Sheet", price: "$3–5" },
  { value: "game_pack", label: "Game Pack", price: "$7–12" },
  { value: "party_kit", label: "Party Kit", price: "$14–22" },
];

const URGENCY_CONFIG: Record<GameProductBlueprint["publishUrgency"], { label: string; color: string }> = {
  now: { label: "Publish Now", color: "var(--rose)" },
  this_week: { label: "This Week", color: "var(--amber)" },
  next_month: { label: "Next Month", color: "var(--cyan)" },
  plan_ahead: { label: "Plan Ahead", color: "var(--text-muted)" },
};

const VOLUME_CONFIG: Record<GameCalendarEvent["estimatedVolume"], { label: string; color: string }> = {
  massive: { label: "Massive", color: "var(--gold)" },
  high: { label: "High", color: "var(--rose)" },
  medium: { label: "Medium", color: "var(--amber)" },
  low: { label: "Low", color: "var(--text-muted)" },
};

function UrgencyBadge({ urgency, days }: { urgency: GameProductBlueprint["publishUrgency"]; days: number }) {
  const cfg = URGENCY_CONFIG[urgency];
  return (
    <div className="flex items-center gap-1.5">
      <Clock size={11} style={{ color: cfg.color }} />
      <span style={{ fontSize: "0.7rem", fontWeight: 600, color: cfg.color }}>{cfg.label}</span>
      {days > 0 && <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>{days}d</span>}
    </div>
  );
}

function BlueprintResult({ blueprint }: { blueprint: GameProductBlueprint }) {
  const [copied, setCopied] = useState(false);

  function copyDescription() {
    void navigator.clipboard.writeText(blueprint.etsyDescription).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col gap-4">
      <Card gold>
        <CardBody>
          <div className="flex items-start justify-between gap-3 mb-3">
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>{blueprint.title}</div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{blueprint.subtitle}</div>
            </div>
            <UrgencyBadge urgency={blueprint.publishUrgency} days={blueprint.daysUntilPeak} />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="gold">${blueprint.price}</Badge>
            <Badge variant="muted">{blueprint.itemCount} items</Badge>
            <Badge variant="muted">{blueprint.gameType.replace(/_/g, " ")}</Badge>
            <Badge variant="muted">{blueprint.eventCategory.replace(/_/g, " ")}</Badge>
            {blueprint.isEvergreen && <Badge variant="emerald">evergreen</Badge>}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <div className="label mb-2">Etsy Title</div>
          <div style={{ fontSize: "0.825rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>{blueprint.etsyTitle}</div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <div className="flex items-center justify-between mb-3">
            <div className="label">Etsy Description</div>
            <button
              onClick={copyDescription}
              style={{ fontSize: "0.72rem", color: copied ? "var(--emerald)" : "var(--cyan)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
            >
              {copied ? "✓ Copied" : "Copy →"}
            </button>
          </div>
          <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.6, maxHeight: 160, overflow: "auto" }}>
            {blueprint.etsyDescription}
          </div>
        </CardBody>
      </Card>

      {blueprint.coverConceptDescription && (
        <Card>
          <CardBody>
            <div className="label mb-2">Cover Concept</div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.5, fontStyle: "italic" }}>
              {blueprint.coverConceptDescription}
            </div>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardBody>
          <div className="label mb-3">Etsy Tags (13)</div>
          <div className="flex flex-wrap gap-1.5">
            {blueprint.etsyTags.map((tag, i) => (
              <Badge key={i} variant="muted">{tag}</Badge>
            ))}
          </div>
        </CardBody>
      </Card>
    </motion.div>
  );
}

function CalendarList({ events, onGenerate }: { events: GameCalendarEvent[]; onGenerate: (cat: EventCategory) => void }) {
  return (
    <div className="flex flex-col gap-3">
      {events.map((event, i) => {
        const volCfg = VOLUME_CONFIG[event.estimatedVolume];
        return (
          <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
            <Card hover>
              <CardBody>
                <div className="flex items-start gap-3">
                  <div style={{ flex: 1 }}>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)" }}>{event.eventName}</span>
                      <span style={{ fontSize: "0.68rem", fontWeight: 700, color: volCfg.color, textTransform: "uppercase", letterSpacing: "0.05em" }}>{volCfg.label}</span>
                      {event.isEvergreen && <Badge variant="muted">evergreen</Badge>}
                    </div>
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }} title={event.dateIsApproximate ? "Date is approximate — verify before publishing" : undefined}>
                        {event.eventDate}{event.dateIsApproximate ? " *" : ""}
                      </span>
                      <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Publish by {event.publishBy}</span>
                      <span style={{ fontSize: "0.72rem", color: "var(--cyan)", fontWeight: 600 }}>Peak: {event.peakBuyingWindow}</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {event.topGameTypes.slice(0, 4).map((gt, j) => (
                        <Badge key={j} variant="muted">{gt.replace(/_/g, " ")}</Badge>
                      ))}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "var(--emerald)", fontWeight: 600 }}>{event.revenueOpportunity}</div>
                    {event.topEtsyTerms.length > 0 && (
                      <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {event.topEtsyTerms.slice(0, 5).map((term, j) => (
                          <span key={j} style={{ fontSize: "0.65rem", color: "var(--text-muted)", background: "var(--bg-elevated)", padding: "2px 6px", borderRadius: 4 }}>{term}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => onGenerate(event.eventCategory)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 8,
                      border: "1px solid var(--border-default)",
                      background: "var(--bg-elevated)",
                      color: "var(--text-secondary)",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      flexShrink: 0,
                    }}
                  >
                    Generate <ChevronRight size={12} />
                  </button>
                </div>
              </CardBody>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}

function GamesPageInner() {
  const [activeTab, setActiveTab] = useState<"generate" | "calendar">("generate");
  const { activeNiche, clearActiveNiche } = useActiveNiche();

  // Generate tab state
  const [eventCategory, setEventCategory] = useState<EventCategory>("super_bowl");
  const [gameType, setGameType] = useState<GameType>("bingo");
  const [format, setFormat] = useState<ProductFormat>("game_sheet");
  const [names, setNames] = useState("");
  const [namesTeam2, setNamesTeam2] = useState("");
  const [theme, setTheme] = useState("");
  const [guestCount, setGuestCount] = useState("");

  const needsNames = ["how_well_do_you_know", "squares", "bracket"].includes(gameType);
  const needsTheme = ["bingo", "trivia", "scavenger_hunt"].includes(gameType);
  const [generating, setGenerating] = useState(false);
  const [blueprint, setBlueprint] = useState<GameProductBlueprint | null>(null);
  const [genError, setGenError] = useState<string | null>(null);

  // Calendar tab state
  const [calLoaded, setCalLoaded] = useState(false);
  const [calLoading, setCalLoading] = useState(false);
  const [calEvents, setCalEvents] = useState<GameCalendarEvent[]>([]);
  const [calError, setCalError] = useState<string | null>(null);

  // Pre-fill theme from active niche
  useEffect(() => {
    if (activeNiche) {
      setTheme(`${activeNiche.nicheName} - ${activeNiche.parentEmotion}`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeTab === "calendar" && !calLoaded) {
      void loadCalendar();
    }
  }, [activeTab, calLoaded]);

  async function loadCalendar() {
    setCalLoading(true);
    setCalError(null);
    try {
      const res = await apiFetch("/api/games?action=calendar");
      const json = await res.json() as { success: boolean; data?: GameCalendarEvent[]; error?: string };
      if (!json.success || !json.data) throw new Error(json.error ?? "Failed to load calendar");
      setCalEvents(json.data);
      setCalLoaded(true);
    } catch (err) {
      setCalError(err instanceof Error ? err.message : "Failed to load calendar");
    } finally {
      setCalLoading(false);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    setGenError(null);
    setBlueprint(null);
    try {
      const res = await apiFetch("/api/games?action=generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventCategory,
          gameType,
          format,
          names: gameType === "squares"
            ? [names.trim(), namesTeam2.trim()].filter(Boolean).length > 0
              ? [names.trim(), namesTeam2.trim()].filter(Boolean)
              : undefined
            : names.trim() ? names.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
          theme: theme.trim() || undefined,
          guestCount: guestCount.trim() ? Number(guestCount) : undefined,
        }),
      });
      const json = await res.json() as { success: boolean; data?: { blueprint: GameProductBlueprint; savedId: string }; error?: string };
      if (!json.success || !json.data) throw new Error(json.error ?? "Generation failed");
      setBlueprint(json.data.blueprint);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  function handleGenerateFromCalendar(cat: EventCategory) {
    setEventCategory(cat);
    setBlueprint(null);
    setGenError(null);
    setActiveTab("generate");
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      <PageHeader
        icon={Trophy}
        title="Games & Gambling Sheets"
        iconColor="var(--rose)"
        subtitle="Generate printable party games and sports event sheets — bingo cards, squares grids, brackets, prop bets, and more."
      />

      <div style={{ padding: "24px 36px" }}>
        {/* Active niche banner */}
        {activeNiche && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              display: "flex", alignItems: "center", gap: 12, marginBottom: 20,
              padding: "10px 16px", borderRadius: 10,
              background: "var(--emerald-bg)", border: "1px solid var(--emerald-border)",
            }}
          >
            <Zap size={14} style={{ color: "var(--emerald)", flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--emerald)", fontWeight: 600 }}>Active Niche · </span>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
                &ldquo;{activeNiche.nicheName}&rdquo; — theme pre-filled below
              </span>
            </div>
            <button onClick={clearActiveNiche} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4, display: "flex", alignItems: "center" }}>
              <X size={13} />
            </button>
          </motion.div>
        )}

        {/* Tab bar */}
        <div className="flex gap-2 mb-6">
          {(["generate", "calendar"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "6px 16px",
                borderRadius: 20,
                fontSize: "0.8rem",
                fontWeight: activeTab === tab ? 600 : 400,
                background: activeTab === tab ? "var(--bg-elevated)" : "transparent",
                border: `1px solid ${activeTab === tab ? "var(--border-default)" : "transparent"}`,
                color: activeTab === tab ? "var(--text-primary)" : "var(--text-muted)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {tab === "generate" ? <Zap size={12} /> : <Calendar size={12} />}
              {tab === "generate" ? "Generate" : "Event Calendar"}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* Generate tab */}
          {activeTab === "generate" && (
            <motion.div key="generate" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="grid gap-6" style={{ gridTemplateColumns: "360px 1fr" }}>
                {/* Selectors */}
                <div className="flex flex-col gap-4">
                  <Card>
                    <CardBody>
                      <div className="label mb-2">Event / Occasion</div>
                      <select
                        value={eventCategory}
                        onChange={(e) => { setEventCategory(e.target.value as EventCategory); setBlueprint(null); }}
                        style={{ width: "100%", padding: "8px 12px", borderRadius: 8, background: "var(--bg-elevated)", border: "1px solid var(--border-default)", color: "var(--text-primary)", fontSize: "0.875rem" }}
                      >
                        {EVENT_GROUPS.map((group) => (
                          <optgroup key={group.label} label={group.label}>
                            {group.options.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>

                      <div className="label mb-2 mt-4">Game Type</div>
                      <div className="grid gap-1.5" style={{ gridTemplateColumns: "1fr 1fr" }}>
                        {GAME_TYPES.map((g) => (
                          <button
                            key={g.value}
                            onClick={() => { setGameType(g.value); setBlueprint(null); }}
                            style={{
                              padding: "7px 10px",
                              borderRadius: 8,
                              fontSize: "0.72rem",
                              background: gameType === g.value ? "var(--gold-glow)" : "var(--bg-elevated)",
                              border: `1px solid ${gameType === g.value ? "rgba(201,168,76,0.3)" : "var(--border-subtle)"}`,
                              color: gameType === g.value ? "var(--gold)" : "var(--text-secondary)",
                              cursor: "pointer",
                              textAlign: "left",
                              fontWeight: gameType === g.value ? 600 : 400,
                            }}
                          >
                            {g.emoji} {g.label}
                          </button>
                        ))}
                      </div>

                      <div className="label mb-2 mt-4">Format</div>
                      <div className="flex flex-col gap-2">
                        {FORMATS.map((f) => (
                          <button
                            key={f.value}
                            onClick={() => { setFormat(f.value as ProductFormat); setBlueprint(null); }}
                            style={{
                              padding: "8px 12px",
                              borderRadius: 8,
                              fontSize: "0.8rem",
                              background: format === f.value ? "var(--gold-glow)" : "var(--bg-elevated)",
                              border: `1px solid ${format === f.value ? "rgba(201,168,76,0.3)" : "var(--border-subtle)"}`,
                              color: format === f.value ? "var(--gold)" : "var(--text-secondary)",
                              cursor: "pointer",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              fontWeight: format === f.value ? 600 : 400,
                            }}
                          >
                            <span>{f.label}</span>
                            <span style={{ fontSize: "0.7rem", opacity: 0.7 }}>{f.price}</span>
                          </button>
                        ))}
                      </div>
                    </CardBody>
                  </Card>

                  <Card>
                    <CardBody>
                      <div className="label mb-3">Customization (Optional)</div>
                      <div className="flex flex-col gap-3">
                        {needsNames && (
                          <>
                            <div>
                              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: 4 }}>
                                {gameType === "how_well_do_you_know" ? "Couple / Person name(s)" : gameType === "squares" ? "Team 1 name" : "Participant names (comma-separated)"}
                              </div>
                              <input
                                value={names}
                                onChange={(e) => setNames(e.target.value)}
                                placeholder={gameType === "squares" ? "e.g. Chiefs" : gameType === "how_well_do_you_know" ? "e.g. Sarah & Mike" : "e.g. Alice, Bob, Carol"}
                                style={{ width: "100%", padding: "7px 10px", borderRadius: 8, background: "var(--bg-elevated)", border: "1px solid var(--border-default)", color: "var(--text-primary)", fontSize: "0.8rem" }}
                              />
                            </div>
                            {gameType === "squares" && (
                              <div>
                                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: 4 }}>Team 2 name</div>
                                <input
                                  value={namesTeam2}
                                  onChange={(e) => setNamesTeam2(e.target.value)}
                                  placeholder="e.g. Eagles"
                                  style={{ width: "100%", padding: "7px 10px", borderRadius: 8, background: "var(--bg-elevated)", border: "1px solid var(--border-default)", color: "var(--text-primary)", fontSize: "0.8rem" }}
                                />
                              </div>
                            )}
                          </>
                        )}
                        {needsTheme && (
                          <div>
                            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: 4 }}>Theme</div>
                            <input
                              value={theme}
                              onChange={(e) => setTheme(e.target.value)}
                              placeholder="e.g. Rustic, Tropical, 80s Retro"
                              style={{ width: "100%", padding: "7px 10px", borderRadius: 8, background: "var(--bg-elevated)", border: "1px solid var(--border-default)", color: "var(--text-primary)", fontSize: "0.8rem" }}
                            />
                          </div>
                        )}
                        {!needsNames && !needsTheme && (
                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontStyle: "italic", padding: "4px 0" }}>
                            No custom fields for this game type.
                          </div>
                        )}
                        <div>
                          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: 4 }}>Guest Count</div>
                          <input
                            type="number"
                            value={guestCount}
                            onChange={(e) => setGuestCount(e.target.value)}
                            placeholder="e.g. 25"
                            min={1}
                            style={{ width: "100%", padding: "7px 10px", borderRadius: 8, background: "var(--bg-elevated)", border: "1px solid var(--border-default)", color: "var(--text-primary)", fontSize: "0.8rem" }}
                          />
                        </div>
                      </div>
                    </CardBody>
                  </Card>

                  <Button variant="gold" icon={<Zap size={13} />} onClick={() => void handleGenerate()} loading={generating} fullWidth>
                    Generate Game →
                  </Button>
                  {genError && (
                    <div style={{ fontSize: "0.8rem", color: "var(--rose)", display: "flex", alignItems: "center", gap: 6 }}>
                      <AlertCircle size={13} />{genError}
                    </div>
                  )}
                </div>

                {/* Result panel */}
                <div>
                  {generating && (
                    <div className="flex flex-col gap-3">
                      {[240, 120, 180, 100].map((h, i) => (
                        <div key={i} style={{ height: h, borderRadius: 10, overflow: "hidden" }}>
                          <div className="shimmer" style={{ width: "100%", height: "100%" }} />
                        </div>
                      ))}
                    </div>
                  )}
                  {blueprint && !generating && <BlueprintResult blueprint={blueprint} />}
                  {!blueprint && !generating && (
                    <div style={{ padding: "60px 32px", textAlign: "center", color: "var(--text-muted)" }}>
                      <div style={{ width: 72, height: 72, borderRadius: 18, background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
                        <Trophy size={32} style={{ color: "var(--rose)" }} />
                      </div>
                      <div style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>Configure &amp; Generate</div>
                      <div style={{ fontSize: "0.825rem", maxWidth: 320, margin: "0 auto", lineHeight: 1.6 }}>
                        Select an event, game type, and format. The engine generates a complete printable game with Etsy listing copy, urgency scoring, and seasonal timing.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* Calendar tab */}
          {activeTab === "calendar" && (
            <motion.div key="calendar" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)" }}>Upcoming Game Events</div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Sorted by publish deadline — hit the window or miss the revenue</div>
                </div>
                <div className="flex items-center gap-3">
                  {(Object.entries(VOLUME_CONFIG) as Array<[string, { label: string; color: string }]>).map(([k, v]) => (
                    <div key={k} className="flex items-center gap-1">
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: v.color }} />
                      <span style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>{v.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {calLoading && (
                <div className="flex flex-col gap-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} style={{ height: 120, borderRadius: 10, overflow: "hidden" }}>
                      <div className="shimmer" style={{ width: "100%", height: "100%" }} />
                    </div>
                  ))}
                </div>
              )}

              {calError && (
                <div style={{ padding: 32, textAlign: "center", color: "var(--rose)" }}>
                  <AlertCircle size={28} style={{ marginBottom: 12 }} />
                  <div style={{ fontSize: "0.875rem" }}>{calError}</div>
                </div>
              )}

              {!calLoading && !calError && calEvents.length > 0 && (
                <CalendarList events={calEvents} onGenerate={handleGenerateFromCalendar} />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function GamesPage() {
  return (
    <Suspense>
      <GamesPageInner />
    </Suspense>
  );
}
