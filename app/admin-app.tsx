"use client";

import Image from "next/image";
import {
  ArrowLeft,
  BadgePercent,
  Bell,
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
  Search,
  Send,
  Settings,
  ShoppingBag,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DiscountProgram, OutreachStatus, School, SchoolStatus as Status } from "@/lib/types";
import type { Viewer } from "@/lib/auth";
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

function EditSchoolModal({ school, statuses, onClose, onSaved, onStatusCreated }: {
  school: School;
  statuses: OutreachStatus[];
  onClose: () => void;
  onSaved: (code: string, outreachStatus: string) => void;
  onStatusCreated: (status: OutreachStatus) => void;
}) {
  const [code, setCode] = useState(school.code);
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
      setError(result?.error || "Unable to record the email.");
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
          <button className="primary-button" onClick={send} disabled={!school.email || loading || !subject.trim() || !message.trim()}><Send size={16} /> {loading ? "Recording…" : "Send email"}</button>
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
              <div className="school-data-item"><span>Outreach status</span><strong><span className="outreach-pill">{school.outreachStatus}</span></strong></div>
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
    <div className="panel-heading correspondence-heading"><div><p className="eyebrow">Complete history</p><h2>Correspondence with {school.admin || school.name}</h2><p className="panel-description">Emails, phone calls, and notes for this school, all in one timeline.</p></div><button className="primary-button" onClick={onEmail} disabled={!school.email}><Mail size={18} /> New email</button></div>
    {loading ? <div className="empty-panel"><span className="empty-panel-icon"><Clock3 size={28} /></span><strong>Loading correspondence…</strong></div> : records.length ? <div className="correspondence-list">{records.map((record) => <article className="correspondence-entry" key={record.id}><div><span className="outreach-pill">{record.channel}</span><time>{new Date(record.contacted_at).toLocaleString()}</time></div><strong>{record.subject || `${record.direction} ${record.channel}`}</strong><p>{record.body}</p><small>{record.direction === "outbound" ? `To ${record.to_email || "school contact"}` : `From ${record.from_email || "school contact"}`} · {record.status}</small></article>)}</div> : <div className="empty-panel"><span className="empty-panel-icon"><Mail size={28} /></span><strong>No correspondence recorded</strong><p>Once you send an email or log a call, the complete conversation history will appear here.</p><button className="secondary-button empty-panel-action" onClick={onEmail} disabled={!school.email}><Mail size={17} /> Start a conversation</button></div>}
  </section>;
}

function SettingsModal({ email, onClose }: { email: string; onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

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
      <div className="modal-head"><div><p className="eyebrow">Account settings</p><h2>Security</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={20} /></button></div>
      <div className="settings-email"><span>Signed in as</span><strong>{email}</strong></div>
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
  const [editSchool, setEditSchool] = useState<School | null>(null);
  const [emailSchool, setEmailSchool] = useState<School | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [section, setSection] = useState<"overview" | "discounts">("overview");
  const [sent, setSent] = useState(false);
  const [correspondenceVersion, setCorrespondenceVersion] = useState(0);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Status | "All">("All");
  const [visibleCount, setVisibleCount] = useState(30);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const schoolsSectionRef = useRef<HTMLElement>(null);
  const returningSchoolIdRef = useRef<number | null>(null);
  const selectedSchoolIdRef = useRef<number | null>(null);

  const filtered = useMemo(() => schools.filter((school) => {
    const matchesSearch = `${school.name} ${school.district} ${school.admin} ${school.code}`.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (filter === "All" || school.status === filter);
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
        <div className="page-heading"><div><p className="eyebrow">Admin · Program year 2026</p><h1>Welcome, {viewer.displayName}</h1><p>Manage every school, program record, form, and communication from one place.</p><span className="source-badge"><span /> {dataSource === "supabase" ? "Live from Supabase" : "Workbook import · Supabase ready"}</span></div></div>

        {sent && <div className="success-banner dismissible"><CheckCircle2 size={18} /><div><strong>Email sent</strong><span>Your correspondence timeline has been updated.</span></div><button onClick={() => setSent(false)} aria-label="Dismiss"><X size={16} /></button></div>}

        <section className="stats-grid" aria-label="Program summary">
          <StatCard icon={<Building2 size={20} />} value={schools.length.toLocaleString()} label="Schools in directory" note={`${recipientCount.toLocaleString()} have email contacts`} tone="blue-tone" />
          <StatCard icon={<ShoppingBag size={20} />} value={totals.orders2026.toLocaleString()} label="2026 orders" note="This year" tone="green-tone" />
          <StatCard icon={<Clock3 size={20} />} value={totals.orders2025.toLocaleString()} label="2025 orders" note="Imported from the workbook" tone="orange-tone" />
          <StatCard icon={<MessageCircle size={20} />} value={totals.orders2024.toLocaleString()} label="2024 orders" note="Imported from the workbook" tone="violet-tone" />
        </section>

        <section className="attention-card">
          <div className="attention-icon"><Bell size={19} /></div><div><strong>{totals.attention.toLocaleString()} schools need contact information</strong><p>These records are missing a usable administrator email.</p></div>
        </section>

        <section ref={schoolsSectionRef} className="schools-section">
          <div className="section-heading"><div><h2>Schools</h2><p>Track eligibility, engagement, codes, and three years of orders.</p></div><div className="table-tools"><label className="table-search"><Search size={15} /><input aria-label="Search schools" placeholder="Search schools" value={search} onChange={(e) => { setSearch(e.target.value); setVisibleCount(30); }} /></label><label className="filter-select"><span>Status:</span><select value={filter} onChange={(e) => { setFilter(e.target.value as Status | "All"); setVisibleCount(30); }}><option>All</option><option>Ready to order</option><option>In progress</option><option>Needs attention</option><option>Not started</option></select><ChevronDown size={14} /></label></div></div>
          <div className="school-table-wrap"><table className="school-table"><thead><tr><th>School</th><th>Outreach status</th><th>2026 orders</th><th>2025 orders</th><th>2024 orders</th><th>2026 code</th><th>Administrator</th><th><span className="sr-only">Open</span></th></tr></thead><tbody>{visibleSchools.map((school) => <tr key={school.id} data-school-id={school.id} onClick={() => openSchool(school)}><td><div className="school-cell"><Avatar school={school} small /><div><strong>{school.name}</strong><span>{[school.city, school.state].filter(Boolean).join(", ") || "Location not provided"}</span></div></div></td><td><span className="outreach-pill">{school.outreachStatus}</span></td><td><strong className="number-cell">{school.orders2026}</strong></td><td><span className="muted-number">{school.orders2025}</span></td><td><span className="muted-number">{school.orders2024}</span></td><td><span className="code">{school.code || "Not assigned"}</span></td><td><div className="admin-cell"><span>{school.admin || "Not provided"}</span><small>{school.email || "Email not provided"}</small></div></td><td><button className="row-arrow" aria-label={`Open ${school.name}`}><ChevronRight size={17} /></button></td></tr>)}</tbody></table>{filtered.length === 0 && <div className="empty-state"><Search size={24} /><strong>No schools found</strong><p>Try a different search or status filter.</p></div>}</div>
          <div ref={loadMoreRef} className="lazy-load-sentinel" aria-live="polite">{hasMore ? `Loading more schools… ${visibleSchools.length.toLocaleString()} of ${filtered.length.toLocaleString()}` : `Showing all ${filtered.length.toLocaleString()} schools`}</div>
        </section>
      </main>}
    </div>
    {emailSchool && <EmailModal school={emailSchool} onClose={() => setEmailSchool(null)} onSent={() => { setEmailSchool(null); setSent(true); setCorrespondenceVersion((version) => version + 1); }} />}
    {settingsOpen && <SettingsModal email={viewer.email} onClose={() => setSettingsOpen(false)} />}
    {editSchool && <EditSchoolModal school={editSchool} statuses={outreachStatuses} onClose={() => setEditSchool(null)} onSaved={(code, outreachStatus) => saveSchool(editSchool, code, outreachStatus)} onStatusCreated={(status) => setOutreachStatuses((current) => current.some((item) => item.name === status.name) ? current : [...current, status])} />}
  </div>;
}
