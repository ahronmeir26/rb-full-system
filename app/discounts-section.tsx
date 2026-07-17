"use client";

import {
  BadgePercent,
  CheckCircle2,
  CircleAlert,
  CloudCog,
  LoaderCircle,
  RefreshCw,
  Save,
  Shirt,
  ShoppingBag,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DiscountProgram, DiscountValueType } from "@/lib/types";

type ShopifyCollection = {
  id: string;
  title: string;
  handle: string;
};

type Connection = {
  store: string;
  connected: boolean;
  functionConfigured: boolean;
};

function dateTimeInputValue(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function dateTimeFromInput(value: string) {
  return value ? new Date(value).toISOString() : "";
}

function discountLabel(type: DiscountValueType, value: number) {
  return type === "percentage" ? `${value || 0}%` : `$${(value || 0).toFixed(2)}`;
}

function ProductGroupCard({
  title,
  description,
  collectionId,
  collectionTitle,
  discountType,
  discountValue,
  collections,
  disabled,
  onCollection,
  onType,
  onValue,
}: {
  title: string;
  description: string;
  collectionId: string;
  collectionTitle: string;
  discountType: DiscountValueType;
  discountValue: number;
  collections: ShopifyCollection[];
  disabled: boolean;
  onCollection: (id: string, title: string) => void;
  onType: (type: DiscountValueType) => void;
  onValue: (value: number) => void;
}) {
  const [discountInputValue, setDiscountInputValue] = useState(String(discountValue));
  const discountInputFocused = useRef(false);
  const options = collectionId && !collections.some((collection) => collection.id === collectionId)
    ? [{ id: collectionId, title: collectionTitle || "Current Shopify collection", handle: "" }, ...collections]
    : collections;

  useEffect(() => {
    if (!discountInputFocused.current) {
      setDiscountInputValue(String(discountValue));
    }
  }, [discountValue]);

  return (
    <article className="discount-group-card">
      <div className="discount-group-icon"><Shirt size={20} /></div>
      <div className="discount-group-heading">
        <div><p className="eyebrow">Product group</p><h2>{title}</h2></div>
        <strong>{discountLabel(discountType, discountValue)} off</strong>
      </div>
      <p>{description}</p>
      <label className="discount-field">
        <span>Shopify collection</span>
        <select
          value={collectionId}
          disabled={disabled}
          onChange={(event) => {
            const collection = options.find((item) => item.id === event.target.value);
            onCollection(event.target.value, collection?.title || "");
          }}
        >
          <option value="">{disabled ? "Connect Shopify to choose a collection" : "Choose a collection"}</option>
          {options.map((collection) => <option value={collection.id} key={collection.id}>{collection.title}</option>)}
        </select>
      </label>
      <div className="discount-value-row">
        <label className="discount-field">
          <span>Discount type</span>
          <select value={discountType} onChange={(event) => onType(event.target.value as DiscountValueType)}>
            <option value="percentage">Percentage</option>
            <option value="fixed_amount">Fixed amount per item</option>
          </select>
        </label>
        <label className="discount-field">
          <span>{discountType === "percentage" ? "Percent off" : "Amount off"}</span>
          <div className="discount-number-input">
            <span>{discountType === "percentage" ? "%" : "$"}</span>
            <input
              type="number"
              min="0"
              max={discountType === "percentage" ? "100" : undefined}
              step="0.01"
              value={discountInputValue}
              onFocus={() => {
                discountInputFocused.current = true;
              }}
              onBlur={() => {
                discountInputFocused.current = false;
                setDiscountInputValue(String(discountValue));
              }}
              onChange={(event) => {
                const inputValue = event.target.value;
                setDiscountInputValue(inputValue);
                onValue(inputValue === "" ? 0 : Number(inputValue));
              }}
            />
          </div>
        </label>
      </div>
    </article>
  );
}

export function DiscountsSection({
  initialProgram,
  assignedSchoolCodes,
}: {
  initialProgram: DiscountProgram;
  assignedSchoolCodes: number;
}) {
  const [program, setProgram] = useState(initialProgram);
  const [collections, setCollections] = useState<ShopifyCollection[]>([]);
  const [connection, setConnection] = useState<Connection>({ store: "", connected: false, functionConfigured: false });
  const [collectionsLoading, setCollectionsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/shopify/collections")
      .then(async (response) => ({ response, result: await response.json().catch(() => null) }))
      .then(({ response, result }) => {
        if (!active) return;
        setConnection(result?.connection || { store: "", connected: false, functionConfigured: false });
        setCollections(response.ok ? result?.collections || [] : []);
        if (!response.ok && result?.error) setError(result.error);
        setCollectionsLoading(false);
      })
      .catch(() => {
        if (active) {
          setError("Unable to check the Shopify connection.");
          setCollectionsLoading(false);
        }
      });
    return () => { active = false; };
  }, []);

  const readyToSync = useMemo(() => Boolean(
    program.mainCode &&
    program.mensCollectionId &&
    program.boysCollectionId &&
    program.mensCollectionId !== program.boysCollectionId &&
    program.mensDiscountValue > 0 &&
    program.boysDiscountValue > 0 &&
    connection.connected &&
    connection.functionConfigured
  ), [program, connection]);

  function update<K extends keyof DiscountProgram>(key: K, value: DiscountProgram[K]) {
    setProgram((current) => ({ ...current, [key]: value }));
    setMessage("");
    setError("");
  }

  async function save(showConfirmation = true) {
    setSaving(true);
    setMessage("");
    setError("");
    const response = await fetch("/api/discounts/2026", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(program),
    });
    const result = await response.json().catch(() => null);
    setSaving(false);
    if (!response.ok) {
      setError(result?.error || "Unable to save the discount settings.");
      return null;
    }
    setProgram(result.program);
    if (showConfirmation) setMessage("2026 discount settings saved in Supabase.");
    return result.program as DiscountProgram;
  }

  async function sync() {
    setSyncing(true);
    setMessage("");
    setError("");
    const saved = await save(false);
    if (!saved) {
      setSyncing(false);
      return;
    }
    const response = await fetch("/api/discounts/2026/sync", { method: "POST" });
    const result = await response.json().catch(() => null);
    setSyncing(false);
    if (!response.ok) {
      setError(result?.error || "Unable to synchronize the Shopify discount.");
      return;
    }
    setProgram(result.program);
    const summary = result.summary;
    setMessage(summary.pending
      ? `Shopify is processing ${summary.codesQueuedForAdd} added and ${summary.codesQueuedForRemoval} removed codes.`
      : `Shopify is synchronized with ${summary.totalShopifyCodes} active 2026 codes.`);
  }

  return (
    <main className="content discounts-content">
      <div className="page-heading discount-page-heading">
        <div>
          <p className="eyebrow">Admin · Program year 2026</p>
          <h1>Discounts</h1>
          <p>One shared Shopify rule powers the main program code and every school&apos;s 2026 code.</p>
        </div>
        <div className="heading-actions">
          <button className="secondary-button" onClick={() => save()} disabled={saving || syncing}><Save size={16} /> {saving ? "Saving…" : "Save settings"}</button>
          <button className="primary-button" onClick={sync} disabled={!readyToSync || saving || syncing}>
            {syncing ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />}
            {syncing ? "Synchronizing…" : "Sync all 2026 codes"}
          </button>
        </div>
      </div>

      {!connection.connected && !collectionsLoading && <div className="discount-alert warning"><CircleAlert size={18} /><div><strong>Shopify connection required</strong><span>Add the Shopify store domain, client ID, and client secret to enable collections and synchronization.</span></div></div>}
      {connection.connected && !connection.functionConfigured && <div className="discount-alert warning"><CircleAlert size={18} /><div><strong>Discount Function setup required</strong><span>The store is connected, but the deployed Appreciation Discount Function ID has not been configured.</span></div></div>}
      {connection.connected && connection.functionConfigured && <div className="discount-alert connected"><CheckCircle2 size={18} /><div><strong>Shopify Plus connected</strong><span>{connection.store} · Custom two-group discount logic is ready.</span></div></div>}
      {message && <div className="success-banner dismissible"><CheckCircle2 size={18} /><div><strong>Discounts updated</strong><span>{message}</span></div></div>}
      {error && <div className="discount-alert error" role="alert"><CircleAlert size={18} /><div><strong>Action needed</strong><span>{error}</span></div></div>}

      <section className="discount-summary-grid" aria-label="Discount program summary">
        <article><span className="summary-icon blue-tone"><BadgePercent size={19} /></span><div><strong>{program.mainCode || "Not set"}</strong><small>Main 2026 code</small></div></article>
        <article><span className="summary-icon green-tone"><ShoppingBag size={19} /></span><div><strong>{assignedSchoolCodes.toLocaleString()}</strong><small>Assigned school codes</small></div></article>
        <article><span className="summary-icon orange-tone"><CloudCog size={19} /></span><div><strong className={`sync-label ${program.syncStatus}`}>{program.syncStatus}</strong><small>{program.lastSyncedAt ? `Last sync ${new Date(program.lastSyncedAt).toLocaleString()}` : "Not yet synchronized"}</small></div></article>
      </section>

      <section className="discount-settings-panel">
        <div className="discount-settings-head">
          <div><p className="eyebrow">Program-wide settings</p><h2>2026 Appreciation discount</h2><p>Changes here apply to the main code and every assigned school code.</p></div>
          <label className="switch-field"><input type="checkbox" checked={program.active} onChange={(event) => update("active", event.target.checked)} /><span /><strong>{program.active ? "Enabled" : "Paused"}</strong></label>
        </div>
        <div className="discount-settings-grid">
          <label className="discount-field"><span>Program title</span><input value={program.title} maxLength={120} onChange={(event) => update("title", event.target.value)} /></label>
          <label className="discount-field"><span>Main program code</span><input className="code-input" value={program.mainCode} maxLength={64} placeholder="APPRECIATION2026" onChange={(event) => update("mainCode", event.target.value.toUpperCase().replace(/\s/g, ""))} /></label>
          <label className="discount-field"><span>Starts</span><input type="datetime-local" value={dateTimeInputValue(program.startsAt)} onChange={(event) => update("startsAt", dateTimeFromInput(event.target.value))} /></label>
          <label className="discount-field"><span>Ends</span><input type="datetime-local" value={dateTimeInputValue(program.endsAt)} onChange={(event) => update("endsAt", dateTimeFromInput(event.target.value))} /></label>
          <label className="discount-field"><span>Total usage limit</span><input type="number" min="1" placeholder="Unlimited" value={program.usageLimit ?? ""} onChange={(event) => update("usageLimit", event.target.value ? Number(event.target.value) : null)} /></label>
          <label className="checkbox-field"><input type="checkbox" checked={program.appliesOncePerCustomer} onChange={(event) => update("appliesOncePerCustomer", event.target.checked)} /><span><strong>Limit once per customer</strong><small>Applies across the main code and school codes.</small></span></label>
        </div>
      </section>

      <section className="discount-groups-grid">
        <ProductGroupCard
          title="Pre-order men's shirts"
          description="Eligible men's preorder items receive this discount whenever any 2026 program code is used."
          collectionId={program.mensCollectionId}
          collectionTitle={program.mensCollectionTitle}
          discountType={program.mensDiscountType}
          discountValue={program.mensDiscountValue}
          collections={collections}
          disabled={!connection.connected || collectionsLoading}
          onCollection={(id, title) => { update("mensCollectionId", id); update("mensCollectionTitle", title); }}
          onType={(type) => update("mensDiscountType", type)}
          onValue={(value) => update("mensDiscountValue", value)}
        />
        <ProductGroupCard
          title="Pre-order boys' shirts"
          description="Eligible boys' preorder items receive their own rate under the same entered program code."
          collectionId={program.boysCollectionId}
          collectionTitle={program.boysCollectionTitle}
          discountType={program.boysDiscountType}
          discountValue={program.boysDiscountValue}
          collections={collections}
          disabled={!connection.connected || collectionsLoading}
          onCollection={(id, title) => { update("boysCollectionId", id); update("boysCollectionTitle", title); }}
          onType={(type) => update("boysDiscountType", type)}
          onValue={(value) => update("boysDiscountValue", value)}
        />
      </section>

    </main>
  );
}
