import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { ProductBlueprint } from "@/lib/ai/product-engine";

const ACCENT = "#1A1917";
const MUTED = "#6B6A65";
const SUBTLE = "#E8E7E4";
const BG = "#FAFAF8";

const styles = StyleSheet.create({
  coverPage: { padding: 72, backgroundColor: BG, fontFamily: "Helvetica", flex: 1, justifyContent: "center" },
  coverTitle: { fontSize: 28, fontWeight: "bold", color: ACCENT, marginBottom: 10, lineHeight: 1.2 },
  coverSubtitle: { fontSize: 13, color: MUTED, marginBottom: 20 },
  coverDivider: { borderTopWidth: 2, borderTopColor: ACCENT, width: 40, marginBottom: 20 },
  coverTagline: { fontSize: 11, color: MUTED, fontStyle: "italic" },
  page: { padding: "36 48", backgroundColor: BG, fontFamily: "Helvetica" },
  sectionLabel: { fontSize: 8, color: MUTED, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },
  monthHeader: { fontSize: 18, fontWeight: "bold", color: ACCENT, marginBottom: 2 },
  writingLine: { borderBottomWidth: 1, borderBottomColor: SUBTLE, marginBottom: 10, height: 18 },
  writingLineSmall: { borderBottomWidth: 1, borderBottomColor: SUBTLE, marginBottom: 7, height: 15 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  habitHeader: { fontSize: 8, color: MUTED, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 },
  habitRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  habitBox: { width: 10, height: 10, borderWidth: 1, borderColor: SUBTLE, borderRadius: 1, marginLeft: 2 },
  habitLabel: { fontSize: 8, color: MUTED, width: 80 },
  weekPage: { padding: "28 40", backgroundColor: BG, fontFamily: "Helvetica" },
  weekHeader: { fontSize: 14, fontWeight: "bold", color: ACCENT, marginBottom: 2 },
  weekRange: { fontSize: 9, color: MUTED, marginBottom: 10 },
  dayCol: { flex: 1, borderWidth: 1, borderColor: SUBTLE, marginRight: 4, padding: 4, minHeight: 80 },
  dayLabel: { fontSize: 8, fontWeight: "bold", color: ACCENT, marginBottom: 4 },
  priorityLine: { borderBottomWidth: 1, borderBottomColor: SUBTLE, marginBottom: 6, height: 14 },
  footer: { position: "absolute", bottom: 20, left: 48, right: 48, flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 7, color: "#CCC" },
  backCover: { padding: 72, backgroundColor: "#F2F1EF", fontFamily: "Helvetica", flex: 1, justifyContent: "center" },
});

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

function MonthPage({ monthName, idx }: { monthName: string; idx: number }) {
  return (
    <Page size="LETTER" style={styles.page}>
      <Text style={styles.sectionLabel}>Monthly Planner</Text>
      <Text style={styles.monthHeader}>{monthName}</Text>
      <View style={{ borderBottomWidth: 1, borderBottomColor: SUBTLE, marginBottom: 12 }} />

      <Text style={{ ...styles.sectionLabel, marginBottom: 6 }}>Monthly Intention</Text>
      {[0,1,2].map(i => <View key={i} style={styles.writingLine} />)}

      <Text style={{ ...styles.habitHeader, marginTop: 12 }}>Habit Tracker</Text>
      {["Habit 1","Habit 2","Habit 3","Habit 4","Habit 5"].map((label, h) => (
        <View key={h} style={styles.habitRow}>
          <Text style={styles.habitLabel}>{label}</Text>
          {Array.from({ length: 31 }).map((_, d) => <View key={d} style={styles.habitBox} />)}
        </View>
      ))}

      <Text style={{ ...styles.sectionLabel, marginTop: 12 }}>Monthly Reflection</Text>
      {[0,1,2,3].map(i => <View key={i} style={styles.writingLine} />)}

      <View style={styles.footer}>
        <Text style={styles.footerText}>{monthName}</Text>
        <Text style={styles.footerText}>{idx + 1} / 12</Text>
      </View>
    </Page>
  );
}

function WeekPage({ weekNum }: { weekNum: number }) {
  return (
    <Page size="LETTER" style={styles.weekPage}>
      <Text style={styles.weekHeader}>Week {weekNum}</Text>
      <Text style={styles.weekRange}>___ / ___ — ___ / ___</Text>

      <Text style={{ ...styles.sectionLabel, marginBottom: 6 }}>Weekly Intention</Text>
      {[0,1].map(i => <View key={i} style={styles.writingLineSmall} />)}

      <View style={{ flexDirection: "row", marginTop: 8, marginBottom: 8 }}>
        {DAYS.map(day => (
          <View key={day} style={styles.dayCol}>
            <Text style={styles.dayLabel}>{day}</Text>
            {[0,1,2].map(i => <View key={i} style={styles.priorityLine} />)}
          </View>
        ))}
      </View>

      <Text style={{ ...styles.sectionLabel, marginBottom: 4 }}>Weekly Wins</Text>
      {[0,1,2].map(i => <View key={i} style={styles.writingLineSmall} />)}

      <View style={styles.footer}>
        <Text style={styles.footerText}>Week {weekNum}</Text>
      </View>
    </Page>
  );
}

export default function PlannerTemplate({ blueprint }: { blueprint: ProductBlueprint }) {
  return (
    <Document title={blueprint.title} author="Alpha & Omega">
      {/* Cover */}
      <Page size="LETTER" style={styles.coverPage}>
        <Text style={styles.coverTitle}>{blueprint.title}</Text>
        <Text style={styles.coverSubtitle}>{blueprint.subtitle}</Text>
        <View style={styles.coverDivider} />
        <Text style={styles.coverTagline}>Plan your {blueprint.transformationPromise.toLowerCase()}</Text>
      </Page>

      {/* 12 monthly spreads */}
      {MONTHS.map((m, i) => <MonthPage key={m} monthName={m} idx={i} />)}

      {/* 52 weekly spreads (first 12 shown to keep file size reasonable) */}
      {Array.from({ length: 52 }).map((_, i) => <WeekPage key={i} weekNum={i + 1} />)}

      {/* Notes */}
      {[1,2,3,4,5,6,7,8,9,10].map(n => (
        <Page key={n} size="LETTER" style={styles.page}>
          <Text style={styles.sectionLabel}>Notes</Text>
          {Array.from({ length: 22 }).map((_, i) => <View key={i} style={styles.writingLine} />)}
          <View style={styles.footer}>
            <Text style={styles.footerText}>{blueprint.title}</Text>
            <Text style={styles.footerText}>Notes {n}</Text>
          </View>
        </Page>
      ))}

      {/* Back cover */}
      <Page size="LETTER" style={styles.backCover}>
        <Text style={{ fontSize: 13, fontStyle: "italic", color: MUTED }}>{blueprint.tagline}</Text>
      </Page>
    </Document>
  );
}
