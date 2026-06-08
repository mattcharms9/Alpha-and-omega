import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { KnowledgeProductBlueprint, KnowledgeSection } from "@/lib/ai/knowledge-types";

const styles = StyleSheet.create({
  page: { padding: 48, backgroundColor: "#FAFAF8", fontFamily: "Helvetica" },
  header: { marginBottom: 24, paddingBottom: 16, borderBottomWidth: 2, borderBottomColor: "#2D2D2D" },
  title: { fontSize: 22, fontWeight: "bold", color: "#1A1A1A", marginBottom: 6 },
  subtitle: { fontSize: 12, color: "#666" },
  outcomesBox: { backgroundColor: "#F0F7F0", borderLeftWidth: 4, borderLeftColor: "#4A9B6F", padding: 14, marginBottom: 20, borderRadius: 4 },
  outcomesTitle: { fontSize: 11, fontWeight: "bold", color: "#4A9B6F", marginBottom: 8 },
  outcomeItem: { fontSize: 10, color: "#333", marginBottom: 4, paddingLeft: 12 },
  sectionTitle: { fontSize: 14, fontWeight: "bold", color: "#1A1A1A", marginTop: 20, marginBottom: 10, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: "#E0E0E0" },
  bodyText: { fontSize: 10, color: "#333", lineHeight: 1.6, marginBottom: 6 },
  checklistItem: { flexDirection: "row", alignItems: "flex-start", marginBottom: 8 },
  checkbox: { width: 14, height: 14, borderWidth: 1.5, borderColor: "#999", borderRadius: 2, marginRight: 10, marginTop: 1 },
  stepNumber: { width: 24, height: 24, backgroundColor: "#1A1A1A", borderRadius: 12, alignItems: "center", justifyContent: "center", marginRight: 12 },
  stepNumberText: { fontSize: 11, color: "#FFF", fontWeight: "bold" },
  worksheetBox: { borderWidth: 1, borderColor: "#DDD", borderRadius: 6, padding: 14, marginTop: 12, marginBottom: 12, backgroundColor: "#FFF" },
  worksheetLabel: { fontSize: 10, color: "#999", marginBottom: 4 },
  writingLine: { borderBottomWidth: 1, borderBottomColor: "#DDD", marginBottom: 12, height: 24 },
  keyTermsBox: { backgroundColor: "#F5F5F5", padding: 12, borderRadius: 4, marginTop: 10 },
  keyTerm: { flexDirection: "row", marginBottom: 6 },
  keyTermWord: { fontSize: 10, fontWeight: "bold", color: "#1A1A1A", width: 120 },
  keyTermDef: { fontSize: 10, color: "#555", flex: 1, lineHeight: 1.4 },
  footer: { position: "absolute", bottom: 32, left: 48, right: 48, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: "#E0E0E0", paddingTop: 8 },
  footerText: { fontSize: 8, color: "#AAA" },
});

function renderSection(section: KnowledgeSection, sectionIdx: number) {
  return (
    <Page key={sectionIdx} size="LETTER" style={styles.page}>
      <Text style={styles.sectionTitle}>{section.title}</Text>

      {section.type === "steps" && section.content.map((step, i) => (
        <View key={i} style={{ flexDirection: "row", marginBottom: 12 }}>
          <View style={styles.stepNumber}><Text style={styles.stepNumberText}>{i + 1}</Text></View>
          <Text style={{ ...styles.bodyText, flex: 1 }}>{step}</Text>
        </View>
      ))}

      {section.type === "checklist" && section.content.map((item, i) => (
        <View key={i} style={styles.checklistItem}>
          <View style={styles.checkbox} />
          <Text style={{ ...styles.bodyText, flex: 1 }}>{item}</Text>
        </View>
      ))}

      {(section.type === "explainer" || section.type === "examples") && section.content.map((para, i) => (
        <Text key={i} style={styles.bodyText}>{para}</Text>
      ))}

      {section.type === "key_terms" && (
        <View style={styles.keyTermsBox}>
          {section.content.map((term, i) => {
            const colonIdx = term.indexOf(":");
            const word = colonIdx > -1 ? term.slice(0, colonIdx) : term;
            const def = colonIdx > -1 ? term.slice(colonIdx + 1).trim() : "";
            return (
              <View key={i} style={styles.keyTerm}>
                <Text style={styles.keyTermWord}>{word}:</Text>
                <Text style={styles.keyTermDef}>{def}</Text>
              </View>
            );
          })}
        </View>
      )}

      {section.hasWorksheet && (
        <View style={styles.worksheetBox}>
          <Text style={styles.worksheetLabel}>Practice — fill this in:</Text>
          {[1, 2, 3, 4].map((i) => <View key={i} style={styles.writingLine} />)}
        </View>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>{""}</Text>
        <Text style={styles.footerText}>Page {sectionIdx + 2}</Text>
      </View>
    </Page>
  );
}

interface KnowledgeGuideTemplateProps {
  blueprint: KnowledgeProductBlueprint;
}

export function KnowledgeGuideTemplate({ blueprint }: KnowledgeGuideTemplateProps) {
  return (
    <Document>
      <Page size="LETTER" style={{ ...styles.page, justifyContent: "center" }}>
        <View style={{ alignItems: "center" }}>
          <Text style={{ fontSize: 32, fontWeight: "bold", color: "#1A1A1A", marginBottom: 12, textAlign: "center" }}>{blueprint.title}</Text>
          <Text style={{ fontSize: 14, color: "#666", marginBottom: 32, textAlign: "center" }}>{blueprint.subtitle}</Text>
          <View style={styles.outcomesBox}>
            <Text style={styles.outcomesTitle}>After this guide you will be able to:</Text>
            {blueprint.learningOutcomes.map((outcome, i) => (
              <Text key={i} style={styles.outcomeItem}>✓  {outcome}</Text>
            ))}
          </View>
        </View>
      </Page>
      {blueprint.sections.map((section, i) => renderSection(section, i))}
    </Document>
  );
}
