import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { GameContent } from "@/lib/ai/games-types";

const CELL = 50;

const styles = StyleSheet.create({
  page: { padding: 24, backgroundColor: "#FFF" },
  title: { fontSize: 18, fontWeight: "bold", textAlign: "center", marginBottom: 4 },
  teams: { fontSize: 11, textAlign: "center", color: "#555", marginBottom: 12 },
  grid: { flexDirection: "column" },
  row: { flexDirection: "row" },
  cell: { width: CELL, height: CELL, borderWidth: 1, borderColor: "#CCC", alignItems: "center", justifyContent: "center" },
  headerCell: { width: CELL, height: CELL, backgroundColor: "#1A1A1A", alignItems: "center", justifyContent: "center" },
  headerText: { fontSize: 8, color: "#FFF", fontWeight: "bold", textAlign: "center" },
  cornerLabel: { fontSize: 6, color: "#999", textAlign: "center" },
  cellNumber: { fontSize: 7, color: "#CCC" },
  instructions: { marginTop: 10, fontSize: 8, color: "#666" },
  prizeLine: { fontSize: 8, color: "#333", marginTop: 4 },
});

export function SquaresGridTemplate({ content, title }: { content: GameContent; title: string }) {
  const team1 = content.squaresTeam1 ?? "Team 1";
  const team2 = content.squaresTeam2 ?? "Team 2";

  const rows = Array.from({ length: 11 }, (_, r) =>
    Array.from({ length: 11 }, (_, c) => ({ r, c }))
  );

  return (
    <Document>
      <Page size="LETTER" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>{title || content.squaresTitle}</Text>
        <Text style={styles.teams}>{team1} vs {team2}</Text>
        <View style={styles.grid}>
          {rows.map((row, rowIdx) => (
            <View key={rowIdx} style={styles.row}>
              {row.map(({ c: colIdx }) => {
                if (rowIdx === 0 && colIdx === 0) {
                  return (
                    <View key={colIdx} style={[styles.headerCell, { backgroundColor: "#FFF", borderWidth: 1, borderColor: "#CCC" }]}>
                      <Text style={styles.cornerLabel}>{team2} →{"\n"}↓ {team1}</Text>
                    </View>
                  );
                }
                if (rowIdx === 0) {
                  return (
                    <View key={colIdx} style={styles.headerCell}>
                      <Text style={styles.headerText}>{colIdx - 1}</Text>
                    </View>
                  );
                }
                if (colIdx === 0) {
                  return (
                    <View key={colIdx} style={styles.headerCell}>
                      <Text style={styles.headerText}>{rowIdx - 1}</Text>
                    </View>
                  );
                }
                const squareNum = (rowIdx - 1) * 10 + (colIdx - 1) + 1;
                return (
                  <View key={colIdx} style={styles.cell}>
                    <Text style={styles.cellNumber}>{squareNum}</Text>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
        {content.squaresInstructions && <Text style={styles.instructions}>{content.squaresInstructions}</Text>}
        {content.squaresPrizeSuggestions?.map((prize, i) => (
          <Text key={i} style={styles.prizeLine}>• {prize}</Text>
        ))}
      </Page>
    </Document>
  );
}
