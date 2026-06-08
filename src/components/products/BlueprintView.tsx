"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Monitor, Layers, ChevronDown, ChevronUp, Copy } from "lucide-react";
import { Card, CardBody, CardFooter } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import type { ProductBlueprint } from "@/lib/ai/product-engine";

function SectionCard({ section, index }: { section: ProductBlueprint["sections"][0]; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div onClick={() => setOpen(!open)} style={{ padding: "12px 14px", borderRadius: 8, background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", cursor: "pointer" }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div style={{ width: 22, height: 22, borderRadius: 6, background: "var(--gold-glow)", border: "1px solid rgba(201,168,76,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.65rem", fontWeight: 700, color: "var(--gold)", flexShrink: 0 }}>
            {index + 1}
          </div>
          <div>
            <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-primary)" }}>{section.name}</div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{section.pageCount} pages · {section.psychologicalMechanism}</div>
          </div>
        </div>
        {open ? <ChevronUp size={14} style={{ color: "var(--text-muted)" }} /> : <ChevronDown size={14} style={{ color: "var(--text-muted)" }} />}
      </div>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}>
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border-subtle)" }}>
              <div className="label mb-2">Purpose</div>
              <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: 10, lineHeight: 1.5 }}>{section.purpose}</p>
              <div className="label mb-2">Sample Prompts</div>
              <div className="flex flex-col gap-1.5">
                {section.prompts.slice(0, 4).map((prompt, i) => (
                  <div key={i} style={{ fontSize: "0.8rem", color: "var(--text-secondary)", padding: "6px 10px", borderRadius: 6, background: "var(--bg-card)", border: "1px solid var(--border-subtle)", lineHeight: 1.4 }}>
                    &ldquo;{prompt}&rdquo;
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function BlueprintView({ blueprint }: { blueprint: ProductBlueprint }) {
  function copyDescription() { navigator.clipboard.writeText(blueprint.descriptionLong); }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="flex flex-col gap-5">
      <Card gold>
        <CardBody>
          <div className="flex items-start gap-5">
            <div style={{ width: 64, height: 80, borderRadius: 8, background: `linear-gradient(135deg, ${blueprint.coverConcept.colorPalette[0] ?? "var(--gold)"} 0%, ${blueprint.coverConcept.colorPalette[1] ?? "var(--violet)"} 100%)`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <BookOpen size={24} color="white" opacity={0.9} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="gold">{blueprint.type}</Badge>
                <Badge variant="default">{blueprint.pageCount} pages</Badge>
                <Badge variant="violet">{blueprint.psychologicalFramework}</Badge>
              </div>
              <h2 style={{ fontSize: "1.375rem", fontWeight: 700, letterSpacing: "-0.03em", color: "var(--text-primary)", lineHeight: 1.2, marginBottom: 4 }}>{blueprint.title}</h2>
              <div style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginBottom: 6 }}>{blueprint.subtitle}</div>
              <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--gold)", fontStyle: "italic" }}>&ldquo;{blueprint.tagline}&rdquo;</div>
            </div>
          </div>
        </CardBody>
        <CardFooter>
          <div className="grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            <div><div className="label mb-1">Target Audience</div><div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{blueprint.targetAudience}</div></div>
            <div><div className="label mb-1">Transformation</div><div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{blueprint.transformationPromise}</div></div>
            <div><div className="label mb-1">Est. Monthly Revenue</div><div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--emerald)" }}>{blueprint.estimatedMonthlyRevenue}</div></div>
          </div>
        </CardFooter>
      </Card>

      <div className="grid gap-5" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <Card>
          <CardBody>
            <div className="label mb-3">Pricing Strategy</div>
            <div className="flex gap-3">
              {[{ label: "Print", value: blueprint.pricingStrategy.printPrice, icon: BookOpen }, { label: "Digital", value: blueprint.pricingStrategy.digitalPrice, icon: Monitor }, { label: "Bundle", value: blueprint.pricingStrategy.bundlePrice, icon: Layers }].map((p) => (
                <div key={p.label} style={{ flex: 1, padding: "10px 12px", borderRadius: 8, background: "var(--bg-elevated)", textAlign: "center" }}>
                  <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--gold)", letterSpacing: "-0.02em" }}>${p.value}</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 2 }}>{p.label}</div>
                </div>
              ))}
            </div>
            <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginTop: 10, lineHeight: 1.5 }}>{blueprint.pricingStrategy.reasoning}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="label mb-3">Emotional Hooks</div>
            <div className="flex flex-col gap-2">
              {blueprint.emotionalHooks.map((hook, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                  <span style={{ color: "var(--gold)", flexShrink: 0, marginTop: 1 }}>→</span>{hook}
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody>
          <div className="label mb-3">Product Sections ({blueprint.sections.length})</div>
          <div className="flex flex-col gap-2">{blueprint.sections.map((section, i) => <SectionCard key={i} section={section} index={i} />)}</div>
        </CardBody>
      </Card>

      <div className="grid gap-5" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <Card>
          <CardBody>
            <div className="label mb-3">Marketing Angles</div>
            <div className="flex flex-col gap-2">
              {blueprint.marketingAngles.map((angle, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                  <span style={{ color: "var(--violet)", flexShrink: 0 }}>◆</span>{angle}
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="label mb-2">Cover Concept</div>
            <div className="flex gap-2 mb-3">
              {blueprint.coverConcept.colorPalette.map((color, i) => (
                <div key={i} title={color} style={{ width: 24, height: 24, borderRadius: 6, background: color, border: "1px solid var(--border-default)" }} />
              ))}
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: 12, lineHeight: 1.5 }}>
              <strong style={{ color: "var(--text-primary)" }}>Theme:</strong> {blueprint.coverConcept.visualTheme}<br />
              <strong style={{ color: "var(--text-primary)" }}>Mood:</strong> {blueprint.coverConcept.mood}
            </div>
            <div className="label mb-2">SEO Keywords</div>
            <div className="flex flex-wrap gap-1.5">{blueprint.keywords.slice(0, 10).map((kw, i) => <Badge key={i} variant="muted">{kw}</Badge>)}</div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody>
          <div className="flex items-center justify-between mb-3">
            <div className="label">Product Description</div>
            <Button variant="ghost" size="sm" icon={<Copy size={12} />} onClick={copyDescription}>Copy</Button>
          </div>
          <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: 1.7 }}>{blueprint.descriptionLong}</p>
        </CardBody>
      </Card>
    </motion.div>
  );
}
