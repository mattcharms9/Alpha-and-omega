import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { GameContent } from "@/lib/ai/games-types";

const CELL_SIZE = 90;

const styles = StyleSheet.create({
  page: { padding: 32, backgroundColor: "#FFF" },
  title: { fontSize: 22, fontWeight: "bold", textAlign: "center", marginBottom: 16 },
  cardLabel: { fontSize: 9, textAlign: "center", color: "#999", marginBottom: 8 },
  grid: { flexDirection: "column", alignItems: "center" },
  row: { flexDirection: "row" },
  header: { flexDirection: "row", marginBottom: 2 },
  headerCell: { width: CELL_SIZE, height: 36, backgroundColor: "#1A1A1A", alignItems: "center", justifyContent: "center" },
  headerText: { color: "#FFF", fontWeight: "bold", fontSize: 18 },
  cell: { width: CELL_SIZE, height: CELL_SIZE, borderWidth: 1.5, borderColor: "#333", alignItems: "center", justifyContent: "center", padding: 4 },
  cellText: { fontSize: 8, textAlign: "center", color: "#1A1A1A", lineHeight: 1.3 },
  freeSpace: { backgroundColor: "#1A1A1A" },
  freeSpaceText: { color: "#FFF", fontWeight: "bold", fontSize: 10 },
  instructions: { marginTop: 16, fontSize: 9, color: "#666", textAlign: "center" },
});

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}

interface BingoCardProps {
  content: GameContent;
  title: string;
  cardNumber?: number;
  randomize?: boolean;
}

export function BingoCardTemplate({ content, title, cardNumber = 1, randomize = true }: BingoCardProps) {
  const squares = content.bingoSquares ?? [];
  const displaySquares = randomize ? shuffleArray(squares) : squares;
  const allSquares = [
    ...displaySquares.slice(0, 12),
    "FREE",
    ...displaySquares.slice(12, 24),
  ];
  const grid = [0, 1, 2, 3, 4].map((row) => allSquares.slice(row * 5, row * 5 + 5));

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.title}>{title || content.bingoTitle}</Text>
        {cardNumber > 1 && <Text style={styles.cardLabel}>Card #{cardNumber}</Text>}
        <View style={styles.grid}>
          <View style={styles.header}>
            {["B", "I", "N", "G", "O"].map((letter) => (
              <View key={letter} style={styles.headerCell}>
                <Text style={styles.headerText}>{letter}</Text>
              </View>
            ))}
          </View>
          {grid.map((row, rowIdx) => (
            <View key={rowIdx} style={styles.row}>
              {row.map((square, colIdx) => (
                <View key={colIdx} style={[styles.cell, square === "FREE" ? styles.freeSpace : {}]}>
                  <Text style={[styles.cellText, square === "FREE" ? styles.freeSpaceText : {}]}>
                    {square === "FREE" ? "FREE\nSPACE" : square}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </View>
        {content.bingoInstructions && <Text style={styles.instructions}>{content.bingoInstructions}</Text>}
      </Page>
    </Document>
  );
}
