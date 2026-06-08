"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Activity, Building2, Package, FileText, BarChart2,
  Send, Brain, Cpu, Zap, Map, TrendingUp, Settings, X,
  ArrowRight, Command, Crosshair, BookOpen, Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PaletteItem {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  href?: string;
  action?: () => void;
  category: string;
  keywords: string[];
  color: string;
}

const NAV_ITEMS: PaletteItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    description: "Empire command center & vitals",
    icon: Cpu,
    href: "/",
    category: "Navigate",
    keywords: ["home", "overview", "empire", "dashboard", "command"],
    color: "var(--gold)",
  },
  {
    id: "signals",
    label: "Signal Bank",
    description: "Emotional market intelligence vault",
    icon: Activity,
    href: "/signals",
    category: "Navigate",
    keywords: ["signals", "scan", "market", "intelligence", "trends", "emotional"],
    color: "var(--cyan)",
  },
  {
    id: "intelligence",
    label: "Intelligence Engine",
    description: "Deep market analysis & discovery",
    icon: Brain,
    href: "/intelligence",
    category: "Navigate",
    keywords: ["intelligence", "analysis", "research", "discover"],
    color: "var(--violet)",
  },
  {
    id: "niche-research",
    label: "Niche Research",
    description: "Expand emotions into targeted sub-niches",
    icon: Crosshair,
    href: "/niche-research",
    category: "Navigate",
    keywords: ["niche", "research", "expand", "emotion", "sub-niche", "audience"],
    color: "var(--gold)",
  },
  {
    id: "knowledge",
    label: "Knowledge Products",
    description: "Find capability anxiety gaps and generate how-to guides",
    icon: BookOpen,
    href: "/knowledge",
    category: "Navigate",
    keywords: ["knowledge", "guide", "workbook", "checklist", "adulting", "how-to", "capability"],
    color: "var(--cyan)",
  },
  {
    id: "games",
    label: "Games & Gambling",
    description: "Generate party games, squares grids, and sports event sheets",
    icon: Trophy,
    href: "/games",
    category: "Navigate",
    keywords: ["games", "bingo", "squares", "gambling", "party", "sports", "bracket", "prop"],
    color: "var(--rose)",
  },
  {
    id: "brands",
    label: "Brand Builder",
    description: "Architect emotional commerce brands",
    icon: Building2,
    href: "/brands",
    category: "Navigate",
    keywords: ["brand", "build", "architecture", "emotional"],
    color: "var(--gold)",
  },
  {
    id: "products",
    label: "Product Studio",
    description: "Generate high-converting digital products",
    icon: Package,
    href: "/products",
    category: "Navigate",
    keywords: ["products", "ebook", "course", "digital", "generate"],
    color: "var(--emerald)",
  },
  {
    id: "content",
    label: "Content Engine",
    description: "Create distribution-ready content",
    icon: FileText,
    href: "/content",
    category: "Navigate",
    keywords: ["content", "social", "copy", "write", "distribution"],
    color: "var(--rose)",
  },
  {
    id: "portfolio",
    label: "Portfolio",
    description: "Empire overview & revenue tracking",
    icon: BarChart2,
    href: "/portfolio",
    category: "Navigate",
    keywords: ["portfolio", "revenue", "performance", "analytics"],
    color: "var(--amber)",
  },
  {
    id: "publishing",
    label: "Publishing",
    description: "Deploy assets across platforms",
    icon: Send,
    href: "/publishing",
    category: "Navigate",
    keywords: ["publish", "deploy", "launch", "platforms"],
    color: "var(--cyan)",
  },
  {
    id: "competitors",
    label: "Competitor Intelligence",
    description: "Analyze market competition",
    icon: Map,
    href: "/intelligence",
    category: "Navigate",
    keywords: ["competitor", "competition", "market", "analysis"],
    color: "var(--violet)",
  },
  {
    id: "settings",
    label: "Settings",
    description: "Configure your intelligence system",
    icon: Settings,
    href: "/settings",
    category: "Navigate",
    keywords: ["settings", "configure", "api", "preferences"],
    color: "var(--text-secondary)",
  },
];

const ACTION_ITEMS: PaletteItem[] = [
  {
    id: "scan-signals",
    label: "Scan Market Signals",
    description: "Discover new emotional territories now",
    icon: Activity,
    href: "/signals",
    category: "Quick Actions",
    keywords: ["scan", "market", "signals", "discover", "run"],
    color: "var(--gold)",
  },
  {
    id: "build-brand",
    label: "Build a Brand",
    description: "Start a new emotional commerce brand",
    icon: Building2,
    href: "/brands",
    category: "Quick Actions",
    keywords: ["build", "new", "brand", "start", "create"],
    color: "var(--gold)",
  },
  {
    id: "generate-products",
    label: "Generate Products",
    description: "Create new digital product suite",
    icon: Package,
    href: "/products",
    category: "Quick Actions",
    keywords: ["generate", "products", "create", "new"],
    color: "var(--emerald)",
  },
  {
    id: "create-content",
    label: "Create Content",
    description: "Write high-converting social content",
    icon: FileText,
    href: "/content",
    category: "Quick Actions",
    keywords: ["write", "content", "social", "copy", "create"],
    color: "var(--rose)",
  },
  {
    id: "view-territories",
    label: "View Territory Map",
    description: "See all owned emotional territories",
    icon: Map,
    href: "/signals",
    category: "Quick Actions",
    keywords: ["territory", "map", "signals", "owned"],
    color: "var(--cyan)",
  },
  {
    id: "analyze-competitors",
    label: "Analyze Competitors",
    description: "Run competitive intelligence scan",
    icon: TrendingUp,
    href: "/intelligence",
    category: "Quick Actions",
    keywords: ["competitor", "analyze", "intelligence", "scan"],
    color: "var(--violet)",
  },
];

const ALL_ITEMS = [...NAV_ITEMS, ...ACTION_ITEMS];

function scoreItem(item: PaletteItem, query: string): number {
  const q = query.toLowerCase();
  if (item.label.toLowerCase().startsWith(q)) return 100;
  if (item.label.toLowerCase().includes(q)) return 80;
  if (item.description.toLowerCase().includes(q)) return 60;
  if (item.keywords.some((k) => k.startsWith(q))) return 70;
  if (item.keywords.some((k) => k.includes(q))) return 50;
  return 0;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const filteredItems = query.trim()
    ? ALL_ITEMS
        .map((item) => ({ item, score: scoreItem(item, query) }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
        .map(({ item }) => item)
    : ALL_ITEMS.slice(0, 8);

  const executeItem = useCallback((item: PaletteItem) => {
    setOpen(false);
    setQuery("");
    if (item.action) {
      item.action();
    } else if (item.href) {
      router.push(item.href);
    }
  }, [router]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
        return;
      }
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    if (open) {
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
    }
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filteredItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && filteredItems[selectedIndex]) {
      executeItem(filteredItems[selectedIndex]);
    }
  }

  const grouped = filteredItems.reduce<Record<string, PaletteItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  let globalIndex = 0;

  return (
    <>
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />

            {/* Palette */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -8 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="fixed inset-x-0 top-[15vh] mx-auto z-50 w-full max-w-xl px-4"
            >
              <div
                className="rounded-2xl overflow-hidden shadow-2xl"
                style={{
                  background: "rgba(12, 12, 16, 0.98)",
                  border: "1px solid rgba(201, 168, 76, 0.2)",
                  backdropFilter: "blur(24px)",
                }}
              >
                {/* Search Input */}
                <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/5">
                  <Search className="w-4 h-4 text-white/40 flex-shrink-0" />
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="Search pages, actions, signals..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="flex-1 bg-transparent text-sm text-white placeholder-white/30 outline-none"
                  />
                  {query && (
                    <button onClick={() => setQuery("")} className="text-white/30 hover:text-white/60 transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-white/10 text-[10px] text-white/30">
                    ESC
                  </div>
                </div>

                {/* Results */}
                <div className="max-h-80 overflow-y-auto py-2">
                  {filteredItems.length === 0 ? (
                    <div className="py-8 text-center text-sm text-white/30">No results for &ldquo;{query}&rdquo;</div>
                  ) : (
                    Object.entries(grouped).map(([category, items]) => (
                      <div key={category}>
                        <div className="px-4 py-1.5 text-[10px] font-semibold text-white/25 uppercase tracking-widest">
                          {category}
                        </div>
                        {items.map((item) => {
                          const idx = globalIndex++;
                          const isSelected = idx === selectedIndex;
                          const Icon = item.icon;
                          return (
                            <button
                              key={item.id}
                              onClick={() => executeItem(item)}
                              onMouseEnter={() => setSelectedIndex(idx)}
                              className={cn(
                                "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all",
                                isSelected ? "bg-white/5" : "hover:bg-white/3"
                              )}
                            >
                              <div
                                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ background: `${item.color}15`, border: `1px solid ${item.color}25` }}
                              >
                                <Icon className="w-3.5 h-3.5" style={{ color: item.color }} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-white">{item.label}</div>
                                <div className="text-xs text-white/40 truncate">{item.description}</div>
                              </div>
                              {isSelected && <ArrowRight className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    ))
                  )}
                </div>

                {/* Footer hint */}
                <div className="px-4 py-2.5 border-t border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-3 text-[10px] text-white/25">
                    <span className="flex items-center gap-1"><Command className="w-3 h-3" />K to toggle</span>
                    <span>↑↓ navigate</span>
                    <span>↵ open</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-3 h-3 text-gold/40" />
                    <span className="text-[10px] text-white/25">Alpha & Omega</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

export function useCommandPalette() {
  function open() {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
  }
  return { open };
}
