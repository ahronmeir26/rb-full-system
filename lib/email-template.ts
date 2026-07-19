import type { EmailTemplate } from "@/lib/types";

type EmailTemplateRow = {
  id: string;
  name: string;
  subject: string;
  body: string;
  sort_order: number;
};

export function mapEmailTemplate(row: EmailTemplateRow): EmailTemplate {
  return {
    id: row.id,
    name: row.name,
    subject: row.subject,
    body: row.body,
    sortOrder: row.sort_order,
  };
}

export function validateEmailTemplate(input: unknown) {
  const value = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const name = typeof value.name === "string" ? value.name.trim().replace(/\s+/g, " ") : "";
  const subject = typeof value.subject === "string" ? value.subject.trim() : "";
  const body = typeof value.body === "string" ? value.body.trim() : "";
  const sortOrder = Number.isInteger(Number(value.sortOrder)) ? Number(value.sortOrder) : 0;

  if (!name || name.length > 80) return { error: "Template names must be between 1 and 80 characters." } as const;
  if (!subject || subject.length > 250) return { error: "Subjects must be between 1 and 250 characters." } as const;
  if (!body || body.length > 20_000) return { error: "Messages must be between 1 and 20,000 characters." } as const;
  if (sortOrder < -10_000 || sortOrder > 10_000) return { error: "Template order is out of range." } as const;

  return { name, subject, body, sortOrder } as const;
}
