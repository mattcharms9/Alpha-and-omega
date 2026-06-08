import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { ProductBlueprint, ProductSection } from "@/lib/ai/product-engine";

const ACCENT = "#1A1917";
const MUTED = "#6B6A65";
const SUBTLE = "#E8E7E4";
const PAGE_BG = "#FAFAF8";

const styles = StyleSheet.create({
  page: { padding: 54, backgroundColor: PAGE_BG, fontFamily: "Helvetica" },
  coverPage: { padding: 72, backgroundColor: PAGE_BG, fontFamily: "Helvetica", flex: 1, justifyContent: "center" },
  coverTitle: { fontSize: 28, fontWeight: "bold", color: ACCENT, marginBottom: 12, lineHeight: 1.2 },
  coverSubtitle: { fontSize: 14, color: MUTED, marginBottom: 24 },
  coverTagline: { fontSize: 11, color: MUTED, fontStyle: "italic", borderTopWidth: 1, borderTopColor: SUBTLE, paddingTop: 16, marginTop: 16 },
  coverAudience: { fontSize: 10, color: MUTED, marginTop: 8 },
  sectionHeaderPage: { padding: 72, backgroundColor: "#F2F1EF", fontFamily: "Helvetica", flex: 1, justifyContent: "center" },
  sectionNumber: { fontSize: 48, fontWeight: "bold", color: SUBTLE, marginBottom: 8 },
  sectionTitle: { fontSize: 22, fontWeight: "bold", color: ACCENT, marginBottom: 12 },
  sectionObjective: { fontSize: 12, color: MUTED, lineHeight: 1.5 },
  bodyText: { fontSize: 10, color: "#333", lineHeight: 1.65, marginBottom: 8 },
  heading: { fontSize: 14, fontWeight: "bold", color: ACCENT, marginTop: 16, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: SUBTLE, paddingBottom: 4 },
  stepRow: { flexDirection: "row", marginBottom: 14 },
  stepBadge: { width: 26, height: 26, backgroundColor: ACCENT, borderRadius: 13, alignItems: "center", justifyContent: "center", marginRight: 12, flexShrink: 0 },
  stepBadgeText: { fontSize: 10, color: "#fff", fontWeight: "bold" },
  checkRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 10 },
  checkbox: { width: 14, height: 14, borderWidth: 1.5, borderColor: "#999", borderRadius: 2, marginRight: 10, marginTop: 1, flexShrink: 0 },
  worksheetBox: { borderWidth: 1, borderColor: SUBTLE, borderRadius: 6, padding: 14, marginBottom: 14, backgroundColor: "#fff" },
  worksheetLabel: { fontSize: 9, color: MUTED, marginBottom: 4, textTransform: "uppercase" },
  writingLine: { borderBottomWidth: 1, borderBottomColor: SUBTLE, marginBottom: 14, height: 22 },
  termRow: { flexDirection: "row", marginBottom: 8, backgroundColor: "#F2F1EF", padding: 8, borderRadius: 4 },
  termWord: { fontSize: 10, fontWeight: "bold", color: ACCENT, width: 120, flexShrink: 0 },
  termDef: { fontSize: 10, color: "#555", flex: 1, lineHeight: 1.4 },
  exampleCard: { borderWidth: 1, borderColor: SUBTLE, borderRadius: 6, padding: 12, marginBottom: 10 },
  exampleHeader: { fontSize: 10, fontWeight: "bold", color: ACCENT, marginBottom: 4 },
  progressPage: { padding: 54, backgroundColor: PAGE_BG, fontFamily: "Helvetica" },
  progressRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  progressBox: { width: 16, height: 16, borderWidth: 1.5, borderColor: "#999", borderRadius: 3, marginRight: 12 },
  footer: { position: "absolute", bottom: 28, left: 54, right: 54, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: SUBTLE, paddingTop: 6 },
  footerText: { fontSize: 8, color: "#AAA" },
});

function SectionContent({ section, sectionIdx }: { section: ProductSection; sectionIdx: number }) {
  const allPrompts = section.prompts ?? [];

  if (allPrompts.length === 0) {
    return (
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.heading}>{section.name}</Text>
        <Text style={styles.bodyText}>{section.purpose}</Text>
        {[0,1,2,3,4].map(i => <View key={i} style={styles.writingLine} />)}
        <View style={styles.footer}>
          <Text style={styles.footerText}>{section.name}</Text>
          <Text style={styles.footerText}>Section {sectionIdx + 1}</Text>
        </View>
      </Page>
    );
  }

  // Split into pages of ~3 prompts each
  const pages: string[][] = [];
  for (let i = 0; i < allPrompts.length; i += 3) pages.push(allPrompts.slice(i, i + 3));

  return (
    <>
      {pages.map((pagePrompts, pIdx) => (
        <Page key={pIdx} size="LETTER" style={styles.page}>
          <Text style={styles.heading}>{section.name}</Text>
          {pagePrompts.map((prompt, i) => (
            <View key={i} style={styles.worksheetBox}>
              <Text style={styles.worksheetLabel}>Prompt {i + pIdx * 3 + 1}</Text>
              <Text style={styles.bodyText}>{prompt}</Text>
              {[0,1,2,3].map(j => <View key={j} style={styles.writingLine} />)}
            </View>
          ))}
          <View style={styles.footer}>
            <Text style={styles.footerText}>{section.name}</Text>
            <Text style={styles.footerText}>pg {pIdx + 1}</Text>
          </View>
        </Page>
      ))}
    </>
  );
}

export default function WorkbookTemplate({ blueprint }: { blueprint: ProductBlueprint }) {
  return (
    <Document title={blueprint.title} author="Alpha & Omega">
      {/* Cover */}
      <Page size="LETTER" style={styles.coverPage}>
        <Text style={styles.coverTitle}>{blueprint.title}</Text>
        <Text style={styles.coverSubtitle}>{blueprint.subtitle}</Text>
        <Text style={styles.coverTagline}>{blueprint.tagline}</Text>
        <Text style={styles.coverAudience}>For {blueprint.targetAudience}</Text>
      </Page>

      {/* How to Use */}
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.heading}>How to Use This Workbook</Text>
        <Text style={styles.bodyText}>
          This workbook is designed to guide you through {blueprint.psychologicalFramework.toLowerCase()}.
          Work through each section in order, taking your time with the exercises.
        </Text>
        <Text style={styles.bodyText}>{blueprint.transformationPromise}</Text>
        <View style={{ marginTop: 16 }}>
          {(blueprint.emotionalHooks ?? []).slice(0, 4).map((hook, i) => (
            <View key={i} style={styles.checkRow}>
              <View style={styles.checkbox} />
              <Text style={{ ...styles.bodyText, flex: 1 }}>{hook}</Text>
            </View>
          ))}
        </View>
      </Page>

      {/* Section header + content pages */}
      {(blueprint.sections ?? []).map((section, i) => (
        <React.Fragment key={i}>
          <Page size="LETTER" style={styles.sectionHeaderPage}>
            <Text style={styles.sectionNumber}>{String(i + 1).padStart(2, "0")}</Text>
            <Text style={styles.sectionTitle}>{section.name}</Text>
            <Text style={styles.sectionObjective}>{section.purpose}</Text>
          </Page>
          <SectionContent section={section} sectionIdx={i} />
        </React.Fragment>
      ))}

      {/* Progress tracker */}
      <Page size="LETTER" style={styles.progressPage}>
        <Text style={styles.heading}>Progress Tracker</Text>
        <Text style={{ ...styles.bodyText, marginBottom: 16 }}>Check off each section as you complete it.</Text>
        {(blueprint.sections ?? []).map((section, i) => (
          <View key={i} style={styles.progressRow}>
            <View style={styles.progressBox} />
            <Text style={styles.bodyText}>{section.name}</Text>
          </View>
        ))}
      </Page>

      {/* Notes */}
      {[1,2,3,4].map(n => (
        <Page key={n} size="LETTER" style={styles.page}>
          <Text style={styles.heading}>Notes {n > 1 ? `(${n})` : ""}</Text>
          {Array.from({ length: 18 }).map((_, i) => <View key={i} style={styles.writingLine} />)}
          <View style={styles.footer}>
            <Text style={styles.footerText}>{blueprint.title}</Text>
            <Text style={styles.footerText}>Notes</Text>
          </View>
        </Page>
      ))}
    </Document>
  );
}
