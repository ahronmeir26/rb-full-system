export type OutreachStatusTone =
  | "neutral"
  | "info"
  | "negative"
  | "positive"
  | "attention"
  | "complete"
  | "custom";

const builtInTones: Record<string, OutreachStatusTone> = {
  "not contacted": "neutral",
  "sent invite": "info",
  "not interested": "negative",
  interested: "positive",
  sent: "complete",
  "not invited": "neutral",
  invited: "info",
  ordered: "positive",
  complete: "complete",
};

export function outreachStatusTone(status: string): OutreachStatusTone {
  const normalized = status.trim().toLowerCase().replace(/\s+/g, " ");
  const builtInTone = builtInTones[normalized];
  if (builtInTone) return builtInTone;

  if (/\b(not interested|declined|rejected|opted out|do not contact)\b/.test(normalized)) return "negative";
  if (/\b(interested|ready|accepted|approved)\b/.test(normalized)) return "positive";
  if (/\b(follow up|pending|waiting|needs attention)\b/.test(normalized)) return "attention";
  if (/\b(sent|complete|completed|done|confirmed)\b/.test(normalized)) return "complete";
  if (/\b(contacted|invite|invited|emailed|called)\b/.test(normalized)) return "info";
  if (/\b(not contacted|no response|new)\b/.test(normalized)) return "neutral";

  return "custom";
}
