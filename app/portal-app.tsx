"use client";

import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Download,
  FileCheck2,
  FileText,
  GraduationCap,
  Inbox,
  LayoutDashboard,
  Mail,
  Menu,
  MessageCircle,
  MoreHorizontal,
  PackageCheck,
  Paperclip,
  Search,
  Send,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Upload,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";

type Status = "Ready to order" | "In progress" | "Needs attention" | "Not started";
type School = {
  id: number;
  name: string;
  district: string;
  city: string;
  state: string;
  code: string;
  admin: string;
  email: string;
  students: number;
  thisYear: number;
  lastYear: number;
  status: Status;
  progress: number;
  eligibility: string;
  lastContact: string;
  initials: string;
  color: string;
};

const schools: School[] = [
  { id: 1, name: "Lincoln Elementary", district: "North Valley USD", city: "Portland", state: "OR", code: "LIN-4821", admin: "Maria Chen", email: "mchen@lincoln.edu", students: 426, thisYear: 18, lastYear: 14, status: "Ready to order", progress: 100, eligibility: "Eligible through Jun 2027", lastContact: "2 hours ago", initials: "LE", color: "mint" },
  { id: 2, name: "Roosevelt Middle School", district: "Evergreen Public Schools", city: "Seattle", state: "WA", code: "RMS-1937", admin: "James Wilson", email: "jwilson@roosevelt.edu", students: 612, thisYear: 12, lastYear: 11, status: "In progress", progress: 72, eligibility: "Eligible through Jun 2027", lastContact: "Yesterday", initials: "RM", color: "blue" },
  { id: 3, name: "Cedar Grove Academy", district: "Cedar Grove Charter", city: "Sacramento", state: "CA", code: "CGA-6405", admin: "Priya Shah", email: "pshah@cedargrove.org", students: 288, thisYear: 8, lastYear: 9, status: "Needs attention", progress: 44, eligibility: "Verification due", lastContact: "6 days ago", initials: "CG", color: "peach" },
  { id: 4, name: "Washington High School", district: "Metro Unified", city: "Denver", state: "CO", code: "WHS-7244", admin: "Robert Kim", email: "rkim@washingtonhs.edu", students: 904, thisYear: 21, lastYear: 17, status: "Ready to order", progress: 100, eligibility: "Eligible through Jun 2027", lastContact: "3 days ago", initials: "WH", color: "violet" },
  { id: 5, name: "Oakwood Primary", district: "Lake County Schools", city: "Madison", state: "WI", code: "OAK-3168", admin: "Elena Morales", email: "emorales@oakwood.edu", students: 341, thisYear: 6, lastYear: 10, status: "Not started", progress: 18, eligibility: "Eligible through Jun 2027", lastContact: "12 days ago", initials: "OP", color: "gold" },
  { id: 6, name: "Maple Arts Magnet", district: "Twin Cities Schools", city: "St. Paul", state: "MN", code: "MAM-8552", admin: "Tanya Brooks", email: "tbrooks@maplearts.edu", students: 507, thisYear: 15, lastYear: 12, status: "In progress", progress: 66, eligibility: "Eligible through Jun 2027", lastContact: "4 days ago", initials: "MA", color: "rose" },
];

const statusClass = (status: Status) => status.toLowerCase().replaceAll(" ", "-");

function Logo() {
  return (
    <div className="brand">
      <span className="brand-mark"><GraduationCap size={21} strokeWidth={2.3} /></span>
      <span>SchoolBridge</span>
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

function EmailModal({ school, onClose, onSent }: { school: School; onClose: () => void; onSent: () => void }) {
  const [subject, setSubject] = useState("Your school program forms and next steps");
  const [message, setMessage] = useState(`Hi ${school.admin.split(" ")[0]},\n\nGreat news — ${school.name} is eligible for this year's program. Please share the attached teacher guide with your staff and submit the completed order sheet when you're ready.\n\nLet me know if you have any questions.\n\nBest,\nAvery`);
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Compose email" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div><p className="eyebrow">New message</p><h2>Email {school.admin}</h2></div>
          <button className="icon-button" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>
        <div className="compose-row"><span>To</span><strong>{school.email}</strong></div>
        <label className="compose-field"><span>Subject</span><input value={subject} onChange={(e) => setSubject(e.target.value)} /></label>
        <label className="compose-field message-field"><span>Message</span><textarea value={message} onChange={(e) => setMessage(e.target.value)} /></label>
        <div className="attachment-pill"><Paperclip size={15} /> 2026-program-guide.pdf <button aria-label="Remove attachment"><X size={13} /></button></div>
        <div className="modal-actions">
          <button className="secondary-button" onClick={onClose}>Save draft</button>
          <button className="primary-button" onClick={onSent}><Send size={16} /> Send email</button>
        </div>
      </div>
    </div>
  );
}

function SchoolDetail({ school, onBack, onEmail, onPortal }: { school: School; onBack: () => void; onEmail: () => void; onPortal: () => void }) {
  const [tab, setTab] = useState<"overview" | "forms" | "messages" | "orders">("overview");
  const [queued, setQueued] = useState(false);
  return (
    <main className="content detail-content">
      <button className="back-link" onClick={onBack}><ArrowLeft size={16} /> All schools</button>
      <div className="detail-hero">
        <div className="detail-title"><Avatar school={school} /><div><div className="title-line"><h1>{school.name}</h1><span className={`status ${statusClass(school.status)}`}>{school.status}</span></div><p>{school.district} · {school.city}, {school.state} · <span className="code">{school.code}</span></p></div></div>
        <div className="detail-actions"><button className="secondary-button" onClick={onPortal}><UserRound size={16} /> View school portal</button><button className="primary-button" onClick={onEmail}><Mail size={16} /> Email administrator</button></div>
      </div>

      <div className="tabs" role="tablist">
        {(["overview", "forms", "messages", "orders"] as const).map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item === "messages" ? "Correspondence" : item}</button>)}
      </div>

      {tab === "overview" && <div className="detail-grid">
        <section className="panel wide-panel">
          <div className="panel-heading"><div><p className="eyebrow">2026 program</p><h2>Enrollment readiness</h2></div><span className="progress-number">{school.progress}%</span></div>
          <div className="progress-track large"><span style={{ width: `${school.progress}%` }} /></div>
          <div className="milestone-list">
            <div className="milestone done"><span><Check size={15} /></span><div><strong>Eligibility confirmed</strong><p>{school.eligibility}</p></div><small>Jun 12</small></div>
            <div className="milestone done"><span><Check size={15} /></span><div><strong>Administrator notified</strong><p>Program overview sent to {school.admin}</p></div><small>Jun 18</small></div>
            <div className={`milestone ${school.progress > 70 ? "done" : "current"}`}><span>{school.progress > 70 ? <Check size={15} /> : "3"}</span><div><strong>Teacher forms distributed</strong><p>Administrator shares the packet with teachers</p></div><small>{school.progress > 70 ? "Jul 02" : "Next"}</small></div>
            <div className="milestone"><span>4</span><div><strong>Order sheets submitted</strong><p>Review and prepare sheets for Shopify</p></div><small>Pending</small></div>
          </div>
        </section>
        <aside className="panel contact-card">
          <div className="panel-heading"><h2>School contact</h2><button className="icon-button"><MoreHorizontal size={19} /></button></div>
          <div className="contact-avatar">{school.admin.split(" ").map(n => n[0]).join("")}</div>
          <h3>{school.admin}</h3><p>Program Administrator</p>
          <a href={`mailto:${school.email}`}><Mail size={15} /> {school.email}</a>
          <div className="contact-meta"><div><span>Last contacted</span><strong>{school.lastContact}</strong></div><div><span>Students</span><strong>{school.students}</strong></div></div>
          <button className="secondary-button full" onClick={onEmail}><MessageCircle size={16} /> Open correspondence</button>
        </aside>
        <section className="panel metric-panel"><p>Orders this year</p><strong>{school.thisYear}</strong><span className="positive">+{Math.max(1, school.thisYear - school.lastYear)} vs. last year</span></section>
        <section className="panel metric-panel"><p>Orders last year</p><strong>{school.lastYear}</strong><span>2025 program year</span></section>
        <section className="panel metric-panel"><p>School code</p><strong className="metric-code">{school.code}</strong><span>Use on all order forms</span></section>
      </div>}

      {tab === "forms" && <FormsPanel school={school} />}
      {tab === "messages" && <Correspondence school={school} onEmail={onEmail} />}
      {tab === "orders" && <OrdersPanel school={school} queued={queued} onQueue={() => setQueued(true)} />}
    </main>
  );
}

function FormsPanel({ school }: { school: School }) {
  const [uploaded, setUploaded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  return <section className="panel tab-panel">
    <div className="panel-heading"><div><p className="eyebrow">Shared documents</p><h2>Forms & submissions</h2></div><button className="primary-button" onClick={() => inputRef.current?.click()}><Upload size={16} /> Upload completed form</button><input ref={inputRef} type="file" hidden accept=".pdf,.xlsx,.xls,.csv" onChange={() => setUploaded(true)} /></div>
    {uploaded && <div className="success-banner"><CheckCircle2 size={18} /> <div><strong>Form uploaded successfully</strong><span>It’s ready for the program team to review.</span></div></div>}
    <div className="document-list">
      <div className="document-row"><span className="file-icon pdf"><FileText size={20} /></span><div><strong>2026 Teacher Program Guide</strong><p>PDF · Updated June 12, 2026</p></div><span className="doc-label">Program form</span><button className="secondary-button" onClick={() => alert("Demo download started: 2026 Teacher Program Guide")}><Download size={15} /> Download</button></div>
      <div className="document-row"><span className="file-icon sheet"><FileCheck2 size={20} /></span><div><strong>{school.name} Order Sheet</strong><p>XLSX · Customized with code {school.code}</p></div><span className="doc-label">Order sheet</span><button className="secondary-button" onClick={() => alert(`Demo download started: ${school.name} Order Sheet`)}><Download size={15} /> Download</button></div>
      <div className="document-row"><span className="file-icon pdf"><FileText size={20} /></span><div><strong>Family Information Handout</strong><p>PDF · English & Spanish</p></div><span className="doc-label">Handout</span><button className="secondary-button" onClick={() => alert("Demo download started: Family Information Handout")}><Download size={15} /> Download</button></div>
    </div>
  </section>;
}

function Correspondence({ school, onEmail }: { school: School; onEmail: () => void }) {
  return <section className="panel tab-panel correspondence">
    <div className="panel-heading"><div><p className="eyebrow">Complete history</p><h2>Correspondence with {school.admin}</h2></div><button className="primary-button" onClick={onEmail}><Mail size={16} /> New email</button></div>
    <div className="thread">
      <div className="thread-item outbound"><span className="thread-avatar staff">AR</span><div><div className="thread-meta"><strong>Avery Reed</strong><span>Jul 14 · 10:24 AM</span></div><h3>Re: Program materials for your teachers</h3><p>Thanks, {school.admin.split(" ")[0]}! Once your teachers complete the order sheets, you can upload them directly in your school portal. I’ll review everything from there.</p><span className="thread-tag"><Check size={12} /> Delivered</span></div></div>
      <div className="thread-item"><span className="thread-avatar">{school.admin.split(" ").map(n => n[0]).join("")}</span><div><div className="thread-meta"><strong>{school.admin}</strong><span>Jul 14 · 9:48 AM</span></div><h3>Re: Program materials for your teachers</h3><p>Wonderful — I’ve shared the guide with our staff and included the program in Friday’s teacher update. Where should I send the completed order sheets?</p></div></div>
      <div className="thread-item outbound"><span className="thread-avatar staff">AR</span><div><div className="thread-meta"><strong>Avery Reed</strong><span>Jul 10 · 2:16 PM</span></div><h3>Program materials for your teachers</h3><p>Good news! {school.name} is eligible for our 2026 program. I’ve attached the teacher guide and your customized order form. Please share these with your teachers.</p><span className="attachment-pill"><Paperclip size={14} /> 2 attachments</span></div></div>
    </div>
  </section>;
}

function OrdersPanel({ school, queued, onQueue }: { school: School; queued: boolean; onQueue: () => void }) {
  return <section className="panel tab-panel">
    <div className="panel-heading"><div><p className="eyebrow">Submitted order sheets</p><h2>Order review</h2></div><span className="integration-note"><ShoppingBag size={15} /> Shopify connection coming later</span></div>
    {queued && <div className="success-banner"><CheckCircle2 size={18} /><div><strong>Order approved for the Shopify queue</strong><span>It will be ready when the integration is connected.</span></div></div>}
    <div className="order-card">
      <div className="order-top"><div><span className="file-icon sheet"><FileCheck2 size={20} /></span><div><strong>Grade 3 — Teacher order bundle</strong><p>Submitted by {school.admin} · July 14, 2026</p></div></div><span className="status in-progress">Ready for review</span></div>
      <div className="order-summary"><div><span>Teachers</span><strong>6</strong></div><div><span>Line items</span><strong>24</strong></div><div><span>Estimated total</span><strong>$1,248.00</strong></div><div><span>School code</span><strong>{school.code}</strong></div></div>
      <div className="order-actions"><button className="secondary-button"><FileText size={15} /> View order sheet</button><button className="primary-button" onClick={onQueue} disabled={queued}>{queued ? <><Check size={16} /> Approved</> : <><PackageCheck size={16} /> Approve for Shopify</>}</button></div>
    </div>
  </section>;
}

function SchoolPortal({ school, onExit }: { school: School; onExit: () => void }) {
  const [uploaded, setUploaded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  return <div className="portal-shell">
    <header className="portal-header"><Logo /><div className="portal-school"><Avatar school={school} small /><div><strong>{school.name}</strong><span>Administrator portal</span></div><ChevronDown size={16} /></div></header>
    <main className="portal-content">
      <button className="back-link" onClick={onExit}><ArrowLeft size={16} /> Return to program admin</button>
      <section className="portal-welcome"><div><span className="portal-kicker"><ShieldCheck size={15} /> 2026 program access</span><h1>Welcome back, {school.admin.split(" ")[0]}</h1><p>Everything your school needs for this year’s program is right here.</p></div><div className="eligibility-card"><CheckCircle2 size={26} /><div><strong>Your school is eligible</strong><span>Through June 2027 · Code {school.code}</span></div></div></section>
      <section className="portal-steps"><div className="section-heading"><div><p className="eyebrow">Your checklist</p><h2>Let’s get your teachers ready</h2></div><span>3 of 4 complete</span></div><div className="portal-step-grid">
        <article className="portal-step done"><span className="step-number"><Check size={18} /></span><div><p>Step 1</p><h3>Confirm eligibility</h3><span>Completed June 12</span></div></article>
        <article className="portal-step done"><span className="step-number"><Check size={18} /></span><div><p>Step 2</p><h3>Download materials</h3><button onClick={() => alert("Demo download started: Teacher Program Guide")}>Download again</button></div></article>
        <article className="portal-step done"><span className="step-number"><Check size={18} /></span><div><p>Step 3</p><h3>Share with teachers</h3><span>Marked complete July 10</span></div></article>
        <article className="portal-step current"><span className="step-number">4</span><div><p>Step 4</p><h3>Submit order forms</h3><button onClick={() => inputRef.current?.click()}>Upload now <ArrowRight size={14} /></button><input ref={inputRef} hidden type="file" onChange={() => setUploaded(true)} /></div></article>
      </div></section>
      {uploaded && <div className="success-banner portal-success"><CheckCircle2 size={20} /><div><strong>Your form was submitted</strong><span>The program team will review it and follow up if anything is needed.</span></div></div>}
      <div className="portal-lower">
        <section className="panel resource-panel"><div className="panel-heading"><div><p className="eyebrow">School resources</p><h2>Forms ready to use</h2></div></div><div className="resource-grid"><div><span className="file-icon pdf"><FileText size={21} /></span><strong>Teacher Program Guide</strong><small>PDF · 2.4 MB</small><button onClick={() => alert("Demo download started: Teacher Program Guide")}><Download size={15} /> Download</button></div><div><span className="file-icon sheet"><FileCheck2 size={21} /></span><strong>Custom Order Sheet</strong><small>Excel · Code {school.code}</small><button onClick={() => alert("Demo download started: Custom Order Sheet")}><Download size={15} /> Download</button></div><div><span className="file-icon pdf"><FileText size={21} /></span><strong>Family Handout</strong><small>PDF · 1.1 MB</small><button onClick={() => alert("Demo download started: Family Handout")}><Download size={15} /> Download</button></div></div></section>
        <aside className="panel help-card"><span><CircleHelp size={22} /></span><h2>Need a hand?</h2><p>Your program coordinator Avery is here to help.</p><button><Mail size={16} /> Message Avery</button><small>Usually replies within one business day</small></aside>
      </div>
    </main>
  </div>;
}

export function PortalApp() {
  const [selected, setSelected] = useState<School | null>(null);
  const [portalSchool, setPortalSchool] = useState<School | null>(null);
  const [emailSchool, setEmailSchool] = useState<School | null>(null);
  const [sent, setSent] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Status | "All">("All");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const filtered = useMemo(() => schools.filter((school) => {
    const matchesSearch = `${school.name} ${school.district} ${school.admin} ${school.code}`.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (filter === "All" || school.status === filter);
  }), [search, filter]);

  if (portalSchool) return <SchoolPortal school={portalSchool} onExit={() => setPortalSchool(null)} />;

  return <div className="app-shell">
    {sidebarOpen && <button className="sidebar-scrim" aria-label="Close menu" onClick={() => setSidebarOpen(false)} />}
    <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
      <Logo />
      <nav className="primary-nav" aria-label="Main navigation">
        <button className={!selected ? "active" : ""} onClick={() => { setSelected(null); setSidebarOpen(false); }}><LayoutDashboard size={18} /> Overview</button>
        <button className={selected ? "active" : ""} onClick={() => setSidebarOpen(false)}><Building2 size={18} /> Schools <span>24</span></button>
        <button><Inbox size={18} /> Forms & orders <span className="nav-badge">7</span></button>
        <button><Mail size={18} /> Correspondence <span className="nav-dot" /></button>
      </nav>
      <div className="nav-label">Workspace</div>
      <nav className="primary-nav lower"><button><UsersRound size={18} /> Administrators</button><button><Settings size={18} /> Settings</button></nav>
      <div className="sidebar-spacer" />
      <button className="demo-portal" onClick={() => setPortalSchool(schools[0])}><span><UserRound size={17} /></span><div><strong>Preview school portal</strong><small>View as Maria Chen</small></div><ChevronRight size={16} /></button>
      <div className="user-card"><span className="user-avatar">AR</span><div><strong>Avery Reed</strong><span>Program admin</span></div><MoreHorizontal size={17} /></div>
    </aside>

    <div className="main-shell">
      <header className="topbar"><button className="mobile-menu icon-button" onClick={() => setSidebarOpen(true)} aria-label="Open menu"><Menu size={20} /></button><div className="topbar-search"><Search size={17} /><input aria-label="Global search" placeholder="Search schools, admins, or forms…" value={search} onChange={(e) => setSearch(e.target.value)} /><kbd>⌘ K</kbd></div><div className="topbar-actions"><button className="icon-button notification" aria-label="Notifications"><Bell size={19} /><span /></button><button className="help-button"><CircleHelp size={17} /> Help</button></div></header>

      {selected ? <SchoolDetail school={selected} onBack={() => setSelected(null)} onEmail={() => setEmailSchool(selected)} onPortal={() => setPortalSchool(selected)} /> : <main className="content">
        <div className="page-heading"><div><p className="eyebrow">Program year 2026</p><h1>Good morning, Avery</h1><p>Here’s what’s happening across your school network.</p></div><button className="primary-button" onClick={() => setEmailSchool(schools[2])}><Mail size={16} /> Email a school</button></div>

        {sent && <div className="success-banner dismissible"><CheckCircle2 size={18} /><div><strong>Email sent</strong><span>Your correspondence timeline has been updated.</span></div><button onClick={() => setSent(false)} aria-label="Dismiss"><X size={16} /></button></div>}

        <section className="stats-grid" aria-label="Program summary">
          <StatCard icon={<Building2 size={20} />} value="24" label="Participating schools" note="3 added this year" tone="blue-tone" />
          <StatCard icon={<ShoppingBag size={20} />} value="118" label="Orders this year" note="↑ 18% from last year" tone="green-tone" />
          <StatCard icon={<Clock3 size={20} />} value="7" label="Forms awaiting review" note="2 need attention" tone="orange-tone" />
          <StatCard icon={<MessageCircle size={20} />} value="5" label="Replies needed" note="Oldest is 3 days" tone="violet-tone" />
        </section>

        <section className="attention-card">
          <div className="attention-icon"><Bell size={19} /></div><div><strong>3 schools need your attention</strong><p>Eligibility follow-up or administrator outreach is overdue.</p></div><button onClick={() => setFilter("Needs attention")}>Review schools <ArrowRight size={15} /></button>
        </section>

        <section className="schools-section">
          <div className="section-heading"><div><h2>Schools</h2><p>Track eligibility, engagement, and orders across every school.</p></div><div className="table-tools"><label className="table-search"><Search size={15} /><input aria-label="Search schools" placeholder="Search schools" value={search} onChange={(e) => setSearch(e.target.value)} /></label><label className="filter-select"><span>Status:</span><select value={filter} onChange={(e) => setFilter(e.target.value as Status | "All")}><option>All</option><option>Ready to order</option><option>In progress</option><option>Needs attention</option><option>Not started</option></select><ChevronDown size={14} /></label></div></div>
          <div className="school-table-wrap"><table className="school-table"><thead><tr><th>School</th><th>Program status</th><th>Orders this year</th><th>Last year</th><th>School code</th><th>Administrator</th><th><span className="sr-only">Open</span></th></tr></thead><tbody>{filtered.map((school) => <tr key={school.id} onClick={() => setSelected(school)}><td><div className="school-cell"><Avatar school={school} small /><div><strong>{school.name}</strong><span>{school.district} · {school.city}, {school.state}</span></div></div></td><td><span className={`status ${statusClass(school.status)}`}>{school.status}</span><div className="mini-progress"><span style={{ width: `${school.progress}%` }} /></div></td><td><strong className="number-cell">{school.thisYear}</strong></td><td><span className="muted-number">{school.lastYear}</span></td><td><span className="code">{school.code}</span></td><td><div className="admin-cell"><span>{school.admin}</span><small>{school.email}</small></div></td><td><button className="row-arrow" aria-label={`Open ${school.name}`}><ChevronRight size={17} /></button></td></tr>)}</tbody></table>{filtered.length === 0 && <div className="empty-state"><Search size={24} /><strong>No schools found</strong><p>Try a different search or status filter.</p></div>}</div>
          <div className="table-footer"><span>Showing {filtered.length} of 24 schools</span><div><button disabled><ArrowLeft size={15} /></button><button className="active">1</button><button>2</button><button>3</button><button><ArrowRight size={15} /></button></div></div>
        </section>
      </main>}
    </div>
    {emailSchool && <EmailModal school={emailSchool} onClose={() => setEmailSchool(null)} onSent={() => { setEmailSchool(null); setSent(true); }} />}
  </div>;
}
