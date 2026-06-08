import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { GameContent } from "@/lib/ai/games-types";

const styles = StyleSheet.create({
  page: { padding: 40, backgroundColor: "#FFF" },
  title: { fontSize: 20, fontWeight: "bold", textAlign: "center", marginBottom: 6 },
  subtitle: { fontSize: 11, color: "#666", textAlign: "center", marginBottom: 24 },
  questionCard: { borderWidth: 1, borderColor: "#E0E0E0", borderRadius: 6, padding: 14, marginBottom: 12, backgroundColor: "#FAFAFA" },
  questionNumber: { fontSize: 9, color: "#999", marginBottom: 4 },
  questionText: { fontSize: 11, color: "#1A1A1A", fontWeight: "bold", marginBottom: 8 },
  optionsRow: { flexDirection: "row", flexWrap: "wrap" },
  optionBubble: { borderWidth: 1, borderColor: "#CCC", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, marginRight: 8, marginBottom: 4 },
  optionText: { fontSize: 9, color: "#333" },
  writeInLine: { borderBottomWidth: 1, borderBottomColor: "#CCC", marginTop: 8, height: 24 },
  pointsBadge: { backgroundColor: "#1A1A1A", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, alignSelf: "flex-end" },
  pointsText: { fontSize: 8, color: "#FFF", fontWeight: "bold" },
  scoringSection: { marginTop: 16, padding: 12, backgroundColor: "#F5F5F5", borderRadius: 6 },
  scoringTitle: { fontSize: 10, fontWeight: "bold", color: "#333", marginBottom: 6 },
  scoringLine: { fontSize: 9, color: "#555" },
});

export function HowWellDoYouKnowTemplate({ content, title }: { content: GameContent; title: string }) {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>How well do you know {content.coupleOrPersonName ?? "them"}?</Text>
        {content.questions?.map((q, i) => (
          <View key={i} style={styles.questionCard}>
            <Text style={styles.questionNumber}>Question {i + 1}</Text>
            <Text style={styles.questionText}>{q.question}</Text>
            {q.answerType === "multiple_choice" && q.options && (
              <View style={styles.optionsRow}>
                {q.options.map((opt, j) => (
                  <View key={j} style={styles.optionBubble}>
                    <Text style={styles.optionText}>{opt}</Text>
                  </View>
                ))}
              </View>
            )}
            {q.answerType === "write_in" && <View style={styles.writeInLine} />}
            <View style={{ alignItems: "flex-end", marginTop: 6 }}>
              <View style={styles.pointsBadge}>
                <Text style={styles.pointsText}>{q.points} pts</Text>
              </View>
            </View>
          </View>
        ))}
        {content.scoringGuide && (
          <View style={styles.scoringSection}>
            <Text style={styles.scoringTitle}>Scoring</Text>
            <Text style={styles.scoringLine}>{content.scoringGuide}</Text>
          </View>
        )}
      </Page>
    </Document>
  );
}
