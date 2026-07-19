"use client";

import { FilePlus2, Mail, Plus, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { EmailTemplate } from "@/lib/types";

export async function fetchEmailTemplates() {
  const response = await fetch("/api/email-templates");
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error || "Unable to load email templates.");
  return (Array.isArray(result?.templates) ? result.templates : []) as EmailTemplate[];
}

type TemplateDraft = Pick<EmailTemplate, "name" | "subject" | "body" | "sortOrder">;

function draftFrom(template: EmailTemplate): TemplateDraft {
  return {
    name: template.name,
    subject: template.subject,
    body: template.body,
    sortOrder: template.sortOrder,
  };
}

function emptyDraft(templates: EmailTemplate[]): TemplateDraft {
  return {
    name: "",
    subject: "",
    body: "",
    sortOrder: (templates.at(-1)?.sortOrder ?? 0) + 10,
  };
}

export function EmailTemplateManager({
  onClose,
  initialTemplates,
  initialTemplateId,
  onTemplatesChanged,
}: {
  onClose: () => void;
  initialTemplates?: EmailTemplate[];
  initialTemplateId?: string;
  onTemplatesChanged?: (templates: EmailTemplate[]) => void;
}) {
  const [templates, setTemplates] = useState<EmailTemplate[]>(initialTemplates ?? []);
  const [selectedId, setSelectedId] = useState<string | null>(initialTemplateId ?? initialTemplates?.[0]?.id ?? null);
  const [draft, setDraft] = useState<TemplateDraft>(() => {
    const initial = initialTemplates?.find((template) => template.id === initialTemplateId) ?? initialTemplates?.[0];
    return initial ? draftFrom(initial) : emptyDraft(initialTemplates ?? []);
  });
  const [creating, setCreating] = useState(initialTemplates?.length === 0);
  const [loading, setLoading] = useState(!initialTemplates);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedId) ?? null,
    [selectedId, templates],
  );

  const replaceTemplates = useCallback((next: EmailTemplate[]) => {
    const sorted = [...next].sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name));
    setTemplates(sorted);
    onTemplatesChanged?.(sorted);
  }, [onTemplatesChanged]);

  useEffect(() => {
    if (initialTemplates) return;
    let active = true;
    fetchEmailTemplates()
      .then((loaded) => {
        if (!active) return;
        replaceTemplates(loaded);
        const initial = loaded.find((template) => template.id === initialTemplateId) ?? loaded[0];
        if (initial) {
          setSelectedId(initial.id);
          setDraft(draftFrom(initial));
        } else {
          setCreating(true);
        }
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "Unable to load email templates.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [initialTemplateId, initialTemplates, replaceTemplates]);

  function selectTemplate(template: EmailTemplate) {
    setSelectedId(template.id);
    setDraft(draftFrom(template));
    setCreating(false);
    setConfirmDelete(false);
    setError("");
    setNotice("");
  }

  function startNewTemplate() {
    setSelectedId(null);
    setDraft(emptyDraft(templates));
    setCreating(true);
    setConfirmDelete(false);
    setError("");
    setNotice("");
  }

  function updateDraft(field: keyof TemplateDraft, value: string | number) {
    setDraft((current) => ({ ...current, [field]: value }));
    setNotice("");
  }

  async function saveTemplate(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    const response = await fetch(creating ? "/api/email-templates" : `/api/email-templates/${selectedId}`, {
      method: creating ? "POST" : "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(draft),
    });
    const result = await response.json().catch(() => null);
    setSaving(false);
    if (!response.ok || !result?.template) {
      setError(result?.error || "Unable to save the email template.");
      return;
    }
    const saved = result.template as EmailTemplate;
    replaceTemplates(creating
      ? [...templates, saved]
      : templates.map((template) => template.id === saved.id ? saved : template));
    setSelectedId(saved.id);
    setDraft(draftFrom(saved));
    setCreating(false);
    setNotice("Template saved.");
  }

  async function deleteTemplate() {
    if (!selectedTemplate) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    setError("");
    setNotice("");
    const response = await fetch(`/api/email-templates/${selectedTemplate.id}`, { method: "DELETE" });
    const result = response.status === 204 ? null : await response.json().catch(() => null);
    setDeleting(false);
    if (!response.ok) {
      setError(result?.error || "Unable to delete the email template.");
      return;
    }
    const remaining = templates.filter((template) => template.id !== selectedTemplate.id);
    replaceTemplates(remaining);
    const next = remaining[0];
    setSelectedId(next?.id ?? null);
    setDraft(next ? draftFrom(next) : emptyDraft(remaining));
    setCreating(!next);
    setConfirmDelete(false);
    setNotice("Template deleted.");
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div className="modal template-manager-modal" role="dialog" aria-modal="true" aria-labelledby="template-manager-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div><p className="eyebrow">Email library</p><h2 id="template-manager-title">Manage templates</h2></div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close template manager"><X size={20} /></button>
        </div>
        <p className="template-manager-intro">Create reusable messages for school outreach. Placeholders are filled when a template is selected.</p>
        <div className="template-manager-layout">
          <aside className="template-manager-list" aria-label="Email templates">
            <button type="button" className="template-new-button" onClick={startNewTemplate}><Plus size={15} /> New template</button>
            {loading ? <div className="template-manager-status">Loading templates…</div>
              : templates.map((template) => <button type="button" key={template.id} className={template.id === selectedId && !creating ? "active" : ""} onClick={() => selectTemplate(template)}>
                <span><Mail size={14} /></span>
                <div><strong>{template.name}</strong><small>{template.subject}</small></div>
              </button>)}
            {!loading && templates.length === 0 && !creating && <div className="template-manager-empty"><FilePlus2 size={20} /><span>No templates yet</span></div>}
          </aside>
          <form className="template-editor" onSubmit={saveTemplate}>
            <label><span>Template name</span><input autoFocus={creating} required maxLength={80} value={draft.name} onChange={(event) => updateDraft("name", event.target.value)} placeholder="e.g. Follow-up reminder" /></label>
            <label><span>Subject</span><input required maxLength={250} value={draft.subject} onChange={(event) => updateDraft("subject", event.target.value)} placeholder="Email subject" /></label>
            <label><span>Message</span><textarea required maxLength={20_000} value={draft.body} onChange={(event) => updateDraft("body", event.target.value)} placeholder="Write the reusable message…" /></label>
            <div className="template-token-help"><strong>Available placeholders</strong><span>{"{firstName}"} · {"{school}"} · {"{code}"} · {"{orderLink}"}</span></div>
            {error && <div className="login-error" role="alert">{error}</div>}
            {notice && <div className="settings-success" role="status">{notice}</div>}
            <div className="template-editor-actions">
              {!creating && selectedTemplate && <button type="button" className={confirmDelete ? "danger-button confirm" : "danger-button"} disabled={deleting || saving} onClick={deleteTemplate}><Trash2 size={14} /> {deleting ? "Deleting…" : confirmDelete ? "Click again to delete" : "Delete"}</button>}
              <button type="submit" className="primary-button" disabled={saving || deleting || !draft.name.trim() || !draft.subject.trim() || !draft.body.trim()}>{saving ? "Saving…" : creating ? "Create template" : "Save changes"}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
