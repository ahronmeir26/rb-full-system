"use client";

import Image from "next/image";
import {
  ArrowLeft,
  BadgePercent,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Download,
  LogOut,
  Mail,
  MessageCircle,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShoppingBag,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DiscountProgram, OutreachStatus, School, SchoolStatus as Status } from "@/lib/types";
import type { Viewer } from "@/lib/auth";
import { initial2026SchoolCode } from "@/lib/school-code";
import { outreachStatusTone } from "@/lib/outreach-status";
import { DiscountsSection } from "./discounts-section";

const statusClass = (status: Status) => status.toLowerCase().replaceAll(" ", "-");

function Logo() {
  return (
    <div className="brand" aria-label="Appreciation Initiative by A.I.STONE">
      <Image className="brand-wordmark" src="/wordmark.png" alt="A.I.STONE" width={184} height={52} priority unoptimized />
      <span className="brand-product">Appreciation Initiative</span>
    </div>
  );
}

function StatCard({ icon, value, label, note, tone }: { icon: React.ReactNode; value: string; label: string; note: string; tone: string }) {
  return (
    <article className="stat-card">
      <div className={`stat-icon ${tone}`}>{icon}</div>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
        <div className="stat-note">{note}</div>
      </div>
    </article>
  );
}

function Avatar({ school, small = false }: { school: School; small?: boolean }) {
  return <span className={`school-avatar ${school.color} ${small ? "small" : ""}`}>{school.initials}</span>;
}

function OutreachPill({ status }: { status: string }) {
  return <span className="outreach-pill" data-tone={outreachStatusTone(status)}>{status}</span>;
}

function OrderFormDownload({ school, className = "secondary-button" }: { school: School; className?: string }) {
  if (!school.code.trim()) {
    return <button className={className} disabled title="Assign a 2026 coupon code before generating the form"><Download size={16} /> Coupon code required</button>;
  }

  return <a className={`${className} download-link`} href={`/api/forms/appreciation-order?schoolId=${school.id}`} download><Download size={16} /> Download order form</a>;
}

type CorrespondenceRecord = {
  id: string;
  direction: "outbound" | "inbound";
  channel: "email" | "phone" | "note";
  subject: string | null;
  body: string;
  from_email: string | null;
  to_email: string | null;
  status: string;
  contacted_at: string;
};

type GmailStatus = {
  configured: boolean;
  connected: boolean;
  connection?: {
    gmail_email: string;
    status: "connected" | "syncing" | "error";
    messages_synced: number;
    last_synced_at: string | null;
    last_sync_error: string | null;
  } | null;
};

type NewSchoolFields = {
  name: string;
  schoolType: "regular" | "chassidish";
  district: string;
  city: string;
  state: string;
  outreachStatus: string;
  code: string;
  admin: string;
  email: string;
  phone: string;
  students: string;
};

function CreateSchoolModal({ statuses, onClose, onCreated }: {
  statuses: OutreachStatus[];
  onClose: () => void;
  onCreated: (school: School) => void;
}) {
  const [fields, setFields] = useState<NewSchoolFields>({
    name: "",
    schoolType: "regular",
    district: "",
    city: "",
    state: "",
    outreachStatus: statuses.find((status) => status.name === "Not contacted")?.name || statuses[0]?.name || "",
    code: "",
    admin: "",
    email: "",
    phone: "",
    students: "",
  });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  function update<K extends keyof NewSchoolFields>(field: K, value: NewSchoolFields[K]) {
    setFields((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const response = await fetch("/api/schools", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(fields),
    });
    const result = await response.json().catch(() => null);
    setLoading(false);
    if (!response.ok) {
      setMessage(result?.error || "Unable to add the school.");
      return;
    }
    onCreated(result.school);
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
    <div className="modal create-school-modal" role="dialog" aria-modal="true" aria-labelledby="create-school-title" onMouseDown={(event) => event.stopPropagation()}>
      <div className="modal-head"><div><p className="eyebrow">School directory</p><h2 id="create-school-title">Add a school</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close"><X size={20} /></button></div>
      <form className="school-create-form" onSubmit={submit}>
        <div className="school-create-grid">
          <label className="school-create-wide"><span>School name</span><input autoFocus required maxLength={160} value={fields.name} onChange={(event) => update("name", event.target.value)} placeholder="School name" /></label>
          <label><span>School type</span><select value={fields.schoolType} onChange={(event) => update("schoolType", event.target.value as NewSchoolFields["schoolType"])}><option value="regular">Regular</option><option value="chassidish">Chassidish</option></select></label>
          <label><span>Outreach status</span><select required value={fields.outreachStatus} onChange={(event) => update("outreachStatus", event.target.value)}>{statuses.map((status) => <option key={status.name}>{status.name}</option>)}</select></label>
          <label className="school-create-wide"><span>District</span><input maxLength={120} value={fields.district} onChange={(event) => update("district", event.target.value)} placeholder="District or network" /></label>
          <label><span>City</span><input maxLength={120} value={fields.city} onChange={(event) => update("city", event.target.value)} placeholder="City" /></label>
          <label><span>State</span><input maxLength={64} value={fields.state} onChange={(event) => update("state", event.target.value)} placeholder="State" /></label>
          <label><span>Administrator</span><input maxLength={160} value={fields.admin} onChange={(event) => update("admin", event.target.value)} placeholder="Contact name" /></label>
          <label><span>Administrator email</span><input type="email" maxLength={254} value={fields.email} onChange={(event) => update("email", event.target.value)} placeholder="name@school.org" /></label>
          <label><span>Phone</span><input type="tel" maxLength={64} value={fields.phone} onChange={(event) => update("phone", event.target.value)} placeholder="Phone number" /></label>
          <label><span>Students</span><input type="number" min={0} max={1000000} step={1} value={fields.students} onChange={(event) => update("students", event.target.value)} placeholder="0" /></label>
          <label className="school-create-wide"><span>2026 coupon code</span><input className="code-input" maxLength={64} value={fields.code} onChange={(event) => update("code", event.target.value)} placeholder="Optional" /></label>
        </div>
        <small>You can leave optional details blank and complete them later.</small>
        {message && <div className="login-error" role="alert">{message}</div>}
        <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={loading || !fields.name.trim() || !fields.outreachStatus}>{loading ? "Adding…" : "Add school"}</button></div>
      </form>
    </div>
  </div>;
}

function EditSchoolModal({ school, statuses, onClose, onSaved, onStatusCreated }: {
  school: School;
  statuses: OutreachStatus[];
  onClose: () => void;
  onSaved: (code: string, outreachStatus: string) => void;
  onStatusCreated: (status: OutreachStatus) => void;
}) {
  const [code, setCode] = useState(() => initial2026SchoolCode(school));
  const [outreachStatus, setOutreachStatus] = useState(school.outreachStatus);
  const [newStatus, setNewStatus] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function createStatus() {
    if (!newStatus.trim()) return;
    setLoading(true);
    setMessage("");
    const response = await fetch("/api/outreach-statuses", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: newStatus }),
    });
    const result = await response.json().catch(() => null);
    setLoading(false);
    if (!response.ok) {
      setMessage(result?.error || "Unable to create the status.");
      return;
    }
    onStatusCreated(result);
    setOutreachStatus(result.name);
    setNewStatus("");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const response = await fetch(`/api/schools/${school.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, outreachStatus }),
    });
    const result = await response.json().catch(() => null);
    setLoading(false);
    if (!response.ok) {
      setMessage(result?.error || "Unable to save the school.");
      return;
    }
    onSaved(result.code, result.outreachStatus);
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
    <div className="modal edit-school-modal" role="dialog" aria-modal="true" aria-label={`Edit ${school.name}`} onMouseDown={(event) => event.stopPropagation()}>
      <div className="modal-head"><div><p className="eyebrow">School settings</p><h2>Edit {school.name}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={20} /></button></div>
      <form className="school-edit-form" onSubmit={submit}>
        <label><span>Outreach status</span><select value={outreachStatus} onChange={(event) => setOutreachStatus(event.target.value)}>{statuses.map((status) => <option key={status.name}>{status.name}</option>)}</select></label>
        <div className="new-status-row"><label><span>New status</span><input value={newStatus} onChange={(event) => setNewStatus(event.target.value)} maxLength={64} placeholder="Create a custom status" /></label><button type="button" className="secondary-button" onClick={createStatus} disabled={loading || !newStatus.trim()}>Add status</button></div>
        <label><span>2026 coupon code</span><input value={code} onChange={(event) => setCode(event.target.value)} maxLength={64} autoFocus placeholder="Enter a coupon code" /></label>
        <small>This code is printed on the school&apos;s downloadable order form. Leave it blank to remove the code.</small>
        {message && <div className="login-error" role="alert">{message}</div>}
        <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={loading}>{loading ? "Saving…" : "Save school"}</button></div>
      </form>
    </div>
  </div>;
}

function EmailModal({ school, onClose, onSent }: { school: School; onClose: () => void; onSent: () => void }) {
  const contactName = school.admin || "school administrator";
  const [subject, setSubject] = useState("Your school program forms and next steps");
  const [message, setMessage] = useState(`Hi ${contactName.split(" ")[0]},\n\nPlease review your school's program information and next steps below.\n\nLet us know if you have any questions.\n\nBest,\nProgram Team`);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function send() {
    setLoading(true);
    setError("");
    const response = await fetch("/api/correspondence", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ schoolIds: [school.id], subject, message }),
    });
    const result = await response.json().catch(() => null);
    setLoading(false);
    if (!response.ok) {
      setError(result?.error || "Unable to send the email.");
      return;
    }
    if (result?.failed) {
      setError(`${result.queued} email${result.queued === 1 ? "" : "s"} queued, but ${result.failed} failed.`);
      return;
    }
    onSent();
  }
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Compose email" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div><p className="eyebrow">New message</p><h2>Email {school.admin || school.name}</h2></div>
          <button className="icon-button" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>
        <div className="compose-row"><span>To</span><strong>{school.email || "No email address recorded"}</strong></div>
        <label className="compose-field"><span>Subject</span><input value={subject} onChange={(e) => setSubject(e.target.value)} /></label>
        <label className="compose-field message-field"><span>Message</span><textarea value={message} onChange={(e) => setMessage(e.target.value)} /></label>
        {error && <div className="login-error" role="alert">{error}</div>}
        <div className="modal-actions">
          <button className="secondary-button" onClick={onClose}>Save draft</button>
          <button className="primary-button" onClick={send} disabled={!school.email || loading || !subject.trim() || !message.trim()}><Send size={16} /> {loading ? "Sending…" : "Send email"}</button>
        </div>
      </div>
    </div>
  );
}

function SchoolDetail({ school, correspondenceVersion, onBack, onEmail, onEdit }: { school: School; correspondenceVersion: number; onBack: () => void; onEmail: () => void; onEdit: () => void }) {
  const location = [school.city, school.state].filter(Boolean).join(", ") || "Location not provided";

  return (
    <main className="content detail-content">
      <button className="back-link" onClick={onBack}><ArrowLeft size={16} /> All schools</button>
      <div className="detail-hero">
        <div className="detail-title">
          <Avatar school={school} />
          <div className="detail-title-copy">
            <div className="title-line"><h1>{school.name}</h1><span className={`status ${statusClass(school.status)}`}>{school.status}</span></div>
            <div className="detail-meta">
              <span>{[school.district, location].filter(Boolean).join(" · ")}</span>
              <span className={`detail-code ${school.code ? "" : "unassigned"}`}><span>2026 code</span>{school.code || "Not assigned"}</span>
            </div>
          </div>
        </div>
        <div className="detail-actions"><button className="secondary-button" onClick={onEdit}><Pencil size={16} /> Edit school</button><OrderFormDownload school={school} /><button className="primary-button" onClick={onEmail} disabled={!school.email}><Mail size={16} /> Email administrator</button></div>
      </div>
      <div className="school-correspondence-layout">
        <Correspondence school={school} refreshVersion={correspondenceVersion} onEmail={onEmail} />
        <aside className="detail-sidebar" aria-label="School details">
          <section className="panel school-summary-panel">
            <div className="sidebar-panel-heading"><p className="eyebrow">School details</p><h2>At a glance</h2></div>
            <div className="school-data-grid">
              <div className="school-data-item"><span>Outreach status</span><strong><OutreachPill status={school.outreachStatus} /></strong></div>
              <div className="school-data-item"><span>Last contacted</span><strong>{school.lastContactedAt ? new Date(school.lastContactedAt).toLocaleDateString() : "No contact recorded"}</strong></div>
              <div className="school-data-item school-data-wide"><span>Administrator</span><strong>{school.admin || "Not provided"}</strong><small>{school.email || "Email not provided"}</small></div>
              <div className="school-data-item"><span>Phone</span><strong>{school.phone || "Not provided"}</strong></div>
              <div className="school-data-item"><span>Location</span><strong>{location}</strong></div>
            </div>
          </section>
          <section className="panel school-orders-panel">
            <div className="sidebar-panel-heading"><p className="eyebrow">Program activity</p><h2>Order history</h2></div>
            <div className="school-year-list">
              <div className="school-year-row"><span>2026</span><strong>{school.orders2026.toLocaleString()} <small>orders</small></strong><code>{school.code || "Code not assigned"}</code></div>
              <div className="school-year-row"><span>2025</span><strong>{school.orders2025.toLocaleString()} <small>orders</small></strong><code>{school.code2025 || "Code not provided"}</code></div>
              <div className="school-year-row"><span>2024</span><strong>{school.orders2024.toLocaleString()} <small>orders</small></strong><code>{school.code2024 || "Code not provided"}</code></div>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}

function Correspondence({ school, refreshVersion, onEmail }: { school: School; refreshVersion: number; onEmail: () => void }) {
  const [records, setRecords] = useState<CorrespondenceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const incomingCount = records.filter((record) => record.direction === "inbound").length;
  const outgoingCount = records.length - incomingCount;

  useEffect(() => {
    let active = true;
    fetch(`/api/correspondence?schoolId=${school.id}`)
      .then(async (response) => ({ response, result: await response.json().catch(() => null) }))
      .then(({ response, result }) => {
        if (!active) return;
        setRecords(response.ok ? result?.correspondence ?? [] : []);
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [school.id, refreshVersion]);

  return <section className="panel tab-panel correspondence">
    <div className="panel-heading correspondence-heading"><div><p className="eyebrow">Complete history</p><h2>Correspondence with {school.admin || school.name}</h2><p className="panel-description">Incoming and sent emails, phone calls, and notes for this school. Select a message to expand it.</p></div><button className="primary-button" onClick={onEmail} disabled={!school.email}><Mail size={18} /> New email</button></div>
    {!loading && records.length > 0 && <div className="correspondence-overview" aria-label="Correspondence totals">
      <span><i><MessageCircle size={15} /></i><small>All messages</small><strong>{records.length.toLocaleString()}</strong></span>
      <span className="incoming"><i><Mail size={15} /></i><small>Incoming</small><strong>{incomingCount.toLocaleString()}</strong></span>
      <span className="outgoing"><i><Send size={14} /></i><small>Sent</small><strong>{outgoingCount.toLocaleString()}</strong></span>
    </div>}
    {loading ? <div className="empty-panel"><span className="empty-panel-icon"><Clock3 size={28} /></span><strong>Loading correspondence…</strong></div> : records.length ? <div className="correspondence-list">{records.map((record) => {
      const incoming = record.direction === "inbound";
      const from = record.from_email || (incoming ? "School contact" : "Appreciation Initiative");
      const to = record.to_email || (incoming ? "Appreciation Initiative" : "School contact");
      const contactedAt = new Date(record.contacted_at);
      const date = contactedAt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
      const time = contactedAt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
      const preview = record.body.replace(/\s+/g, " ").trim();
      return <details className={`correspondence-entry ${incoming ? "incoming" : "outgoing"}`} key={record.id}>
        <summary>
          <span className="correspondence-avatar" aria-hidden="true">{incoming ? <Mail size={17} /> : <Send size={16} />}</span>
          <span className="correspondence-summary-copy">
            <span className="correspondence-kicker"><b>{incoming ? "Incoming" : "Sent"}</b><span>{incoming ? from : `To ${to}`}</span></span>
            <strong>{record.subject || `${incoming ? "Incoming" : "Sent"} ${record.channel}`}</strong>
            <small className="correspondence-preview">{preview || "No message preview available"}</small>
          </span>
          <span className="correspondence-summary-time"><time><strong>{date}</strong><small>{time}</small></time><ChevronDown size={17} aria-hidden="true" /></span>
        </summary>
        <div className="correspondence-message">
          <div className="correspondence-message-heading"><span><MessageCircle size={14} /> Message details</span><small>{incoming ? "Received" : "Sent"} {date} at {time}</small></div>
          <div className="correspondence-metadata">
            <span><small>From</small><strong>{from}</strong></span>
            <span><small>To</small><strong>{to}</strong></span>
          </div>
          <div className="correspondence-body">{record.body}</div>
          <div className="correspondence-status"><span>{record.channel}</span><span>{record.status}</span></div>
        </div>
      </details>;
    })}</div> : <div className="empty-panel"><span className="empty-panel-icon"><Mail size={28} /></span><strong>No correspondence recorded</strong><p>Once you send or receive an email or log a call, the complete conversation history will appear here.</p><button className="secondary-button empty-panel-action" onClick={onEmail} disabled={!school.email}><Mail size={17} /> Start a conversation</button></div>}
  </section>;
}

function SettingsModal({ email, onClose, onCorrespondenceChanged }: {
  email: string;
  onClose: () => void;
  onCorrespondenceChanged: () => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [gmailStatus, setGmailStatus] = useState<GmailStatus | null>(null);
  const [gmailLoading, setGmailLoading] = useState(false);
  const [gmailMessage, setGmailMessage] = useState("");

  async function loadGmailStatus() {
    const response = await fetch("/api/gmail/status");
    const result = await response.json().catch(() => null);
    if (response.ok) setGmailStatus(result);
  }

  useEffect(() => {
    loadGmailStatus().catch(() => undefined);
  }, []);

  async function syncGmail() {
    setGmailLoading(true);
    setGmailMessage("");
    const response = await fetch("/api/gmail/sync", { method: "POST" });
    const result = await response.json().catch(() => null);
    setGmailLoading(false);
    if (!response.ok) {
      setGmailMessage(result?.error || "Unable to sync Gmail.");
      await loadGmailStatus();
      return;
    }
    setGmailMessage(result.skipped
      ? "A Gmail sync is already in progress."
      : `Gmail is up to date${result.imported ? ` · ${result.imported} new email${result.imported === 1 ? "" : "s"}` : ""}.`);
    if (result.imported) onCorrespondenceChanged();
    await loadGmailStatus();
  }

  async function disconnectGmail() {
    setGmailLoading(true);
    setGmailMessage("");
    const response = await fetch("/api/gmail/disconnect", { method: "POST" });
    const result = await response.json().catch(() => null);
    setGmailLoading(false);
    if (!response.ok) {
      setGmailMessage(result?.error || "Unable to disconnect Gmail.");
      return;
    }
    setGmailMessage("Gmail disconnected. Previously imported emails remain in each school timeline.");
    await loadGmailStatus();
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setMessage("The new passwords do not match.");
      return;
    }
    setLoading(true);
    setMessage("");
    const response = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const result = await response.json().catch(() => null);
    setLoading(false);
    if (!response.ok) {
      setMessage(result?.error || "Unable to update the password.");
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setMessage("Password updated successfully.");
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
    <div className="modal settings-modal" role="dialog" aria-modal="true" aria-label="Account settings" onMouseDown={(event) => event.stopPropagation()}>
      <div className="modal-head"><div><p className="eyebrow">Account settings</p><h2>Settings</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={20} /></button></div>
      <div className="settings-email"><span>Signed in as</span><strong>{email}</strong></div>
      <section className="gmail-settings" aria-labelledby="gmail-settings-title">
        <div className="settings-section-heading">
          <div><h3 id="gmail-settings-title">Gmail sync</h3><p>Pull school conversations into the matching school timeline every 10 minutes.</p></div>
          {gmailStatus?.connected && <span className="gmail-connected-dot">Connected</span>}
        </div>
        {!gmailStatus ? <div className="gmail-status-line"><RefreshCw className="spin" size={16} /> Checking Gmail…</div>
          : !gmailStatus.configured ? <div className="gmail-setup-note">Gmail setup is not enabled for this site yet.</div>
            : gmailStatus.connected && gmailStatus.connection ? <>
              <div className="gmail-account">
                <span className="gmail-icon"><Mail size={18} /></span>
                <div><strong>{gmailStatus.connection.gmail_email}</strong><small>{gmailStatus.connection.last_synced_at ? `Last synced ${new Date(gmailStatus.connection.last_synced_at).toLocaleString()}` : "Ready for the first sync"} · {gmailStatus.connection.messages_synced.toLocaleString()} emails imported</small></div>
              </div>
              {gmailStatus.connection.last_sync_error && <div className="login-error" role="alert">{gmailStatus.connection.last_sync_error}</div>}
              <div className="gmail-actions"><button type="button" className="secondary-button" disabled={gmailLoading} onClick={disconnectGmail}>Disconnect</button><button type="button" className="primary-button" disabled={gmailLoading} onClick={syncGmail}><RefreshCw className={gmailLoading ? "spin" : ""} size={15} /> {gmailLoading ? "Syncing…" : "Sync now"}</button></div>
            </> : <>
              <p className="gmail-explainer">Connect the Gmail account you use with schools. Access is read-only, and you can disconnect it at any time.</p>
              <button type="button" className="primary-button gmail-connect-button" onClick={() => window.location.assign("/api/gmail/connect")}><Mail size={16} /> Connect Gmail</button>
            </>}
        {gmailMessage && <div className={gmailMessage.startsWith("Unable") ? "login-error" : "settings-success"} role="status">{gmailMessage}</div>}
      </section>
      <div className="settings-divider" />
      <div className="settings-section-heading security-heading"><div><h3>Security</h3><p>Change the password for this admin account.</p></div></div>
      <form className="settings-form" onSubmit={submit}>
        <label>Current password<input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required /></label>
        <label>New password<input type="password" autoComplete="new-password" minLength={10} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required /></label>
        <label>Confirm new password<input type="password" autoComplete="new-password" minLength={10} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></label>
        <small>At least 10 characters. Supabase Auth stores only the secure password hash.</small>
        {message && <div className={message.includes("successfully") ? "settings-success" : "login-error"} role="status">{message}</div>}
        <button className="primary-button" disabled={loading}>{loading ? "Updating…" : "Change password"}</button>
      </form>
    </div>
  </div>;
}

export function AdminApp({ initialSchools, initialOutreachStatuses, initialDiscountProgram, dataSource, viewer }: { initialSchools: School[]; initialOutreachStatuses: OutreachStatus[]; initialDiscountProgram: DiscountProgram; dataSource: "supabase" | "workbook"; viewer: Viewer }) {
  const [schools, setSchools] = useState(initialSchools);
  const [outreachStatuses, setOutreachStatuses] = useState(initialOutreachStatuses);
  const [selected, setSelected] = useState<School | null>(null);
  const [createSchoolOpen, setCreateSchoolOpen] = useState(false);
  const [editSchool, setEditSchool] = useState<School | null>(null);
  const [emailSchool, setEmailSchool] = useState<School | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [section, setSection] = useState<"overview" | "discounts">("overview");
  const [sent, setSent] = useState(false);
  const [correspondenceVersion, setCorrespondenceVersion] = useState(0);
  const [gmailNotice, setGmailNotice] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [visibleCount, setVisibleCount] = useState(30);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const schoolsSectionRef = useRef<HTMLElement>(null);
  const returningSchoolIdRef = useRef<number | null>(null);
  const selectedSchoolIdRef = useRef<number | null>(null);
  const gmailSyncingRef = useRef(false);

  const filtered = useMemo(() => schools.filter((school) => {
    const matchesSearch = `${school.name} ${school.district} ${school.admin} ${school.code}`.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (filter === "All" || school.outreachStatus === filter);
  }), [schools, search, filter]);
  const visibleSchools = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  useEffect(() => {
    if (selected) return;
    const target = loadMoreRef.current;
    if (!target || !hasMore) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) setVisibleCount((count) => Math.min(count + 30, filtered.length));
    }, { rootMargin: "320px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [selected, hasMore, filtered.length, visibleCount]);

  useEffect(() => {
    if (selected || returningSchoolIdRef.current === null) return;
    const schoolId = returningSchoolIdRef.current;
    const frame = requestAnimationFrame(() => {
      const row = schoolsSectionRef.current?.querySelector<HTMLElement>(`[data-school-id="${schoolId}"]`);
      (row ?? schoolsSectionRef.current)?.scrollIntoView({ block: row ? "center" : "start" });
      returningSchoolIdRef.current = null;
    });
    return () => cancelAnimationFrame(frame);
  }, [selected]);

  useEffect(() => {
    selectedSchoolIdRef.current = selected?.id ?? null;
  }, [selected]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const result = url.searchParams.get("gmail");
    if (!result) return;
    setGmailNotice(result === "connected"
      ? "Gmail connected. Your first school email sync is starting now."
      : result === "setup-required"
        ? "Gmail needs one-time setup before it can be connected."
        : result === "cancelled"
          ? "Gmail connection was cancelled."
          : "Gmail could not be connected. Please try again.");
    url.searchParams.delete("gmail");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  useEffect(() => {
    let active = true;
    async function syncGmailInBackground() {
      if (gmailSyncingRef.current) return;
      gmailSyncingRef.current = true;
      try {
        const statusResponse = await fetch("/api/gmail/status");
        const status = await statusResponse.json().catch(() => null);
        if (!active || !statusResponse.ok || !status?.connected) return;
        const response = await fetch("/api/gmail/sync", { method: "POST" });
        const result = await response.json().catch(() => null);
        if (active && response.ok && result?.imported) {
          setCorrespondenceVersion((version) => version + 1);
        }
      } finally {
        gmailSyncingRef.current = false;
      }
    }
    const initialTimer = window.setTimeout(syncGmailInBackground, 1500);
    const interval = window.setInterval(syncGmailInBackground, 5 * 60_000);
    return () => {
      active = false;
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    function selectSchoolFromLocation() {
      const schoolId = Number(new URL(window.location.href).searchParams.get("school"));
      const school = Number.isInteger(schoolId) ? schools.find((item) => item.id === schoolId) : undefined;
      const previousSchoolId = selectedSchoolIdRef.current;
      if (school) {
        selectedSchoolIdRef.current = school.id;
        setSection("overview");
        setSelected(school);
        return;
      }
      if (previousSchoolId !== null) returningSchoolIdRef.current = previousSchoolId;
      selectedSchoolIdRef.current = null;
      setSelected(null);
    }

    selectSchoolFromLocation();
    window.addEventListener("popstate", selectSchoolFromLocation);
    return () => window.removeEventListener("popstate", selectSchoolFromLocation);
  }, [schools]);
  const totals = useMemo(() => schools.reduce((sum, school) => ({
    orders2026: sum.orders2026 + school.orders2026,
    orders2025: sum.orders2025 + school.orders2025,
    orders2024: sum.orders2024 + school.orders2024,
    attention: sum.attention + (school.email.includes("@") ? 0 : 1),
  }), { orders2026: 0, orders2025: 0, orders2024: 0, attention: 0 }), [schools]);
  const recipientCount = useMemo(() => schools.filter((school) => school.email.includes("@")).length, [schools]);
  const assignedSchoolCodes = useMemo(() => schools.filter((school) => school.code.trim()).length, [schools]);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.reload();
  }

  function saveSchool(school: School, code: string, outreachStatus: string) {
    const updated = { ...school, code, outreachStatus };
    setSchools((current) => current.map((item) => item.id === school.id ? updated : item));
    setSelected((current) => current?.id === school.id ? updated : current);
    setEditSchool(null);
  }

  function schoolCreated(school: School) {
    setSchools((current) => [...current, school].sort((left, right) => left.name.localeCompare(right.name)));
    setCreateSchoolOpen(false);
    setSearch("");
    setFilter("All");
    openSchool(school);
  }

  function openSchool(school: School) {
    const url = new URL(window.location.href);
    url.searchParams.set("school", String(school.id));
    window.history.pushState({ ...window.history.state, schoolView: true }, "", `${url.pathname}${url.search}${url.hash}`);
    selectedSchoolIdRef.current = school.id;
    setSection("overview");
    setSelected(school);
  }

  function returnToSchoolList() {
    const url = new URL(window.location.href);
    if (url.searchParams.has("school") && window.history.state?.schoolView) {
      window.history.back();
      return;
    }
    if (selectedSchoolIdRef.current !== null) returningSchoolIdRef.current = selectedSchoolIdRef.current;
    url.searchParams.delete("school");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    selectedSchoolIdRef.current = null;
    setSelected(null);
  }

  function toggleDiscounts() {
    const url = new URL(window.location.href);
    if (url.searchParams.has("school")) {
      url.searchParams.delete("school");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }
    selectedSchoolIdRef.current = null;
    setSelected(null);
    setSection((current) => current === "discounts" ? "overview" : "discounts");
  }

  return <div className="app-shell">
    <div className="main-shell">
      <header className="topbar">
        <Logo />
        <label className="topbar-search"><Search size={17} /><input aria-label="Global search" placeholder="Search schools, admins, or forms…" value={search} onChange={(e) => { setSearch(e.target.value); setVisibleCount(30); }} /><kbd>⌘ K</kbd></label>
        <div className="topbar-actions">
          <button className={`topbar-control ${section === "discounts" ? "active" : ""}`} onClick={toggleDiscounts}><BadgePercent size={16} /><span>{section === "discounts" ? "Overview" : "Discounts"}</span></button>
          <button className="topbar-control" onClick={() => setSettingsOpen(true)}><Settings size={16} /><span>Settings</span></button>
          <div className="topbar-account">
            <span className="user-avatar">{viewer.displayName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span>
            <div className="topbar-account-copy"><strong>{viewer.displayName}</strong><span>Admin</span></div>
            <button className="icon-button" onClick={signOut} aria-label="Sign out" title="Sign out"><LogOut size={17} /></button>
          </div>
        </div>
      </header>

      {section === "discounts" ? <DiscountsSection initialProgram={initialDiscountProgram} assignedSchoolCodes={assignedSchoolCodes} /> : selected ? <SchoolDetail school={selected} correspondenceVersion={correspondenceVersion} onBack={returnToSchoolList} onEmail={() => setEmailSchool(selected)} onEdit={() => setEditSchool(selected)} /> : <main className="content">
        <div className="page-heading overview-heading">
          <div><p className="eyebrow">Admin · Program year 2026</p><h1>Welcome, {viewer.displayName}</h1><p>Manage every school, program record, form, and communication from one place.</p></div>
          <section className="stats-grid" aria-label="Program summary">
            <StatCard icon={<Building2 size={17} />} value={schools.length.toLocaleString()} label="Schools in directory" note={`${recipientCount.toLocaleString()} have email contacts`} tone="blue-tone" />
            <StatCard icon={<ShoppingBag size={17} />} value={totals.orders2026.toLocaleString()} label="2026 orders" note="This year" tone="green-tone" />
            <StatCard icon={<Clock3 size={17} />} value={totals.orders2025.toLocaleString()} label="2025 orders" note="Workbook import" tone="orange-tone" />
            <StatCard icon={<MessageCircle size={17} />} value={totals.orders2024.toLocaleString()} label="2024 orders" note="Workbook import" tone="violet-tone" />
          </section>
        </div>

        {sent && <div className="success-banner dismissible"><CheckCircle2 size={18} /><div><strong>Email sent</strong><span>Your correspondence timeline has been updated.</span></div><button onClick={() => setSent(false)} aria-label="Dismiss"><X size={16} /></button></div>}
        {gmailNotice && <div className="success-banner dismissible"><Mail size={18} /><div><strong>Gmail</strong><span>{gmailNotice}</span></div><button onClick={() => setGmailNotice("")} aria-label="Dismiss"><X size={16} /></button></div>}

        <section ref={schoolsSectionRef} className="schools-section">
          <div className="section-heading"><div><div className="schools-title-row"><h2>Schools</h2><span className="source-badge schools-source-badge"><span /> {dataSource === "supabase" ? "Live from Supabase" : "Workbook import"}</span></div><p>Track eligibility, engagement, codes, and three years of orders.</p></div><div className="table-tools"><button className="primary-button add-school-button" onClick={() => setCreateSchoolOpen(true)}><Plus size={16} /> Add school</button><label className="table-search"><Search size={15} /><input aria-label="Search schools" placeholder="Search schools" value={search} onChange={(e) => { setSearch(e.target.value); setVisibleCount(30); }} /></label><label className="filter-select"><span>Communication:</span><span className="filter-select-value">{filter}</span><select aria-label="Filter by communication status" value={filter} onChange={(e) => { setFilter(e.target.value); setVisibleCount(30); }}><option>All</option>{outreachStatuses.map((status) => <option key={status.name}>{status.name}</option>)}</select><ChevronDown size={14} /></label></div></div>
          <div className="school-table-wrap"><table className="school-table"><thead><tr><th>School</th><th>Outreach status</th><th>2026 orders</th><th>2025 orders</th><th>2024 orders</th><th>2026 code</th><th>Administrator</th><th><span className="sr-only">Open</span></th></tr></thead><tbody>{visibleSchools.map((school) => <tr key={school.id} data-school-id={school.id} onClick={() => openSchool(school)}><td><div className="school-cell"><Avatar school={school} small /><div><strong>{school.name}</strong><span>{[school.city, school.state].filter(Boolean).join(", ") || "Location not provided"}</span></div></div></td><td><OutreachPill status={school.outreachStatus} /></td><td><strong className="number-cell">{school.orders2026}</strong></td><td><span className="muted-number">{school.orders2025}</span></td><td><span className="muted-number">{school.orders2024}</span></td><td><span className="code">{school.code || "Not assigned"}</span></td><td><div className="admin-cell"><span>{school.admin || "Not provided"}</span><small>{school.email || "Email not provided"}</small></div></td><td><button className="row-arrow" aria-label={`Open ${school.name}`}><ChevronRight size={17} /></button></td></tr>)}</tbody></table>{filtered.length === 0 && <div className="empty-state"><Search size={24} /><strong>No schools found</strong><p>Try a different search or communication status.</p></div>}</div>
          <div ref={loadMoreRef} className="lazy-load-sentinel" aria-live="polite">{hasMore ? `Loading more schools… ${visibleSchools.length.toLocaleString()} of ${filtered.length.toLocaleString()}` : `Showing all ${filtered.length.toLocaleString()} schools`}</div>
        </section>
      </main>}
    </div>
    {createSchoolOpen && <CreateSchoolModal statuses={outreachStatuses} onClose={() => setCreateSchoolOpen(false)} onCreated={schoolCreated} />}
    {emailSchool && <EmailModal school={emailSchool} onClose={() => setEmailSchool(null)} onSent={() => { setEmailSchool(null); setSent(true); setCorrespondenceVersion((version) => version + 1); }} />}
    {settingsOpen && <SettingsModal email={viewer.email} onClose={() => setSettingsOpen(false)} onCorrespondenceChanged={() => setCorrespondenceVersion((version) => version + 1)} />}
    {editSchool && <EditSchoolModal school={editSchool} statuses={outreachStatuses} onClose={() => setEditSchool(null)} onSaved={(code, outreachStatus) => saveSchool(editSchool, code, outreachStatus)} onStatusCreated={(status) => setOutreachStatuses((current) => current.some((item) => item.name === status.name) ? current : [...current, status])} />}
  </div>;
}
