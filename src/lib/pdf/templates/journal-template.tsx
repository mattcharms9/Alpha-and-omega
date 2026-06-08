import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { ProductBlueprint } from "@/lib/ai/product-engine";

const ACCENT = "#1A1917";
const MUTED = "#6B6A65";
const SUBTLE = "#E8E7E4";

const styles = StyleSheet.create({
  coverPage: { padding: 72, backgroundColor: "#FAFAF8", fontFamily: "Helvetica", flex: 1, justifyContent: "center" },
  coverTitle: { fontSize: 30, fontWeight: "bold", color: ACCENT, marginBottom: 10, lineHeight: 1.2 },
  coverSubtitle: { fontSize: 13, color: MUTED, marginBottom: 20 },
  coverDivider: { borderTopWidth: 2, borderTopColor: ACCENT, width: 40, marginBottom: 20 },
  coverTagline: { fontSize: 11, color: MUTED, fontStyle: "italic" },
  coverAudience: { fontSize: 10, color: MUTED, marginTop: 32 },
  howToPage: { padding: 54, backgroundColor: "#FAFAF8", fontFamily: "Helvetica" },
  heading: { fontSize: 16, fontWeight: "bold", color: ACCENT, marginBottom: 12 },
  bodyText: { fontSize: 10, color: "#333", lineHeight: 1.7, marginBottom: 8 },
  promptPage: { padding: 54, backgroundColor: "#FAFAF8", fontFamily: "Helvetica" },
  promptHeader: { fontSize: 8, color: MUTED, marginBottom: 6 },
  promptText: { fontSize: 12, fontWeight: "bold", color: ACCENT, marginBottom: 20, lineHeight: 1.5 },
  writingLine: { borderBottomWidth: 1, borderBottomColor: SUBTLE, marginBottom: 15, height: 20 },
  milestoneHeader: { fontSize: 14, fontWeight: "bold", color: ACCENT, marginBottom: 8 },
  milestoneQuestion: { fontSize: 10, color: MUTED, marginBottom: 4 },
  milestoneLines: { borderBottomWidth: 1, borderBottomColor: SUBTLE, marginBottom: 14, height: 20 },
  footer: { position: "absolute", bottom: 28, left: 54, right: 54, flexDirection: "row", justifyContent: "space-between" },
  footerTitle: { fontSize: 7, color: "#CCC" },
  footerPage: { fontSize: 7, color: "#CCC" },
  backCover: { padding: 72, backgroundColor: "#F2F1EF", fontFamily: "Helvetica", flex: 1, justifyContent: "center" },
});

const MILESTONE_QUESTIONS = [
  "What patterns have you noticed in your responses?",
  "What has shifted for you since you began this journal?",
  "What are you most proud of in your journey so far?",
];

function JournalPromptPage({ prompt, pageNum, title }: { prompt: string; pageNum: number; title: string }) {
  const isMilestone = pageNum === 15 || pageNum === 30 || pageNum === 45 || pageNum === 60;

  if (isMilestone) {
    return (
      <Page size="LETTER" style={styles.promptPage}>
        <Text style={{ ...styles.milestoneHeader, fontSize: 10, color: MUTED, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
          Milestone Check-In · Page {pageNum}
        </Text>
        <Text style={styles.milestoneHeader}>How far have you come?</Text>
        {MILESTONE_QUESTIONS.map((q, i) => (
          <React.Fragment key={i}>
            <Text style={styles.milestoneQuestion}>{q}</Text>
            {[0,1,2,3].map(j => <View key={j} style={styles.milestoneLines} />)}
          </React.Fragment>
        ))}
        <View style={styles.footer}>
          <Text style={styles.footerTitle}>{title}</Text>
          <Text style={styles.footerPage}>{pageNum}</Text>
        </View>
      </Page>
    );
  }

  return (
    <Page size="LETTER" style={styles.promptPage}>
      <Text style={styles.promptHeader}>{title}</Text>
      <Text style={styles.promptText}>{prompt}</Text>
      {Array.from({ length: 12 }).map((_, i) => <View key={i} style={styles.writingLine} />)}
      <View style={styles.footer}>
        <Text style={styles.footerTitle}>{title}</Text>
        <Text style={styles.footerPage}>{pageNum}</Text>
      </View>
    </Page>
  );
}

export default function JournalTemplate({ blueprint }: { blueprint: ProductBlueprint }) {
  // Collect all prompts from all sections, target ~60 pages
  const allPrompts = (blueprint.sections ?? []).flatMap(s => s.prompts ?? []);
  const promptCount = 60;
  const prompts: string[] = [];
  for (let i = 0; i < promptCount; i++) {
    prompts.push(allPrompts[i % Math.max(allPrompts.length, 1)] ?? "Reflect on your day. What stood out to you and why?");
  }

  return (
    <Document title={blueprint.title} author="Alpha & Omega">
      {/* Cover */}
      <Page size="LETTER" style={styles.coverPage}>
        <Text style={styles.coverTitle}>{blueprint.title}</Text>
        <Text style={styles.coverSubtitle}>{blueprint.subtitle}</Text>
        <View style={styles.coverDivider} />
        <Text style={styles.coverTagline}>{blueprint.tagline}</Text>
        <Text style={styles.coverAudience}>A guided journal for {blueprint.targetAudience}</Text>
      </Page>

      {/* How to Use */}
      <Page size="LETTER" style={styles.howToPage}>
        <Text style={styles.heading}>How to Use This Journal</Text>
        <Text style={styles.bodyText}>
          This journal is built around one core idea: {blueprint.transformationPromise}.
          Each prompt has been carefully crafted to move you along a transformation arc.
        </Text>
        <Text style={styles.bodyText}>
          Spend 10–20 minutes with each prompt. Write without editing yourself.
          There are no wrong answers — only honest ones.
        </Text>
        <Text style={styles.bodyText}>
          You will encounter Milestone Check-Ins at pages 15, 30, 45, and 60.
          These are moments to pause, look back, and notice how you have changed.
        </Text>
        <Text style={{ ...styles.bodyText, marginTop: 16, fontStyle: "italic", color: MUTED }}>
          {blueprint.psychologicalFramework}
        </Text>
      </Page>

      {/* 60 journal pages */}
      {prompts.map((prompt, i) => (
        <JournalPromptPage key={i} prompt={prompt} pageNum={i + 1} title={blueprint.title} />
      ))}

      {/* Back cover */}
      <Page size="LETTER" style={styles.backCover}>
        <Text style={{ fontSize: 13, fontStyle: "italic", color: MUTED, marginBottom: 20 }}>
          {blueprint.tagline}
        </Text>
        <Text style={{ fontSize: 10, color: MUTED }}>Continue your journey at</Text>
        <View style={{ borderBottomWidth: 1, borderBottomColor: ACCENT, marginTop: 8, width: 200 }} />
      </Page>
    </Document>
  );
}
