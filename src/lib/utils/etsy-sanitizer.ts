export function sanitizeForEtsy(text: string): string {
  return text
    .replace(/—/g, " ")           // em dash → space
    .replace(/ - /g, ", ")             // " - " separator → ", "
    .replace(/--/g, " ")               // double hyphen → space
    .replace(/(?<=[a-zA-Z])-(?=[a-zA-Z])/g, ", ") // word-hyphen-word → ", "
    .replace(/  +/g, " ")              // collapse double spaces
    .trim();
}

export function sanitizeArrayForEtsy(items: string[]): string[] {
  return items.map(sanitizeForEtsy);
}

export function sanitizeObjectForEtsy(obj: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = sanitizeForEtsy(value);
  }
  return result;
}
