import React, { useCallback, useEffect, useState } from "react";
import { Building2, CreditCard, RefreshCw, ShieldCheck, Clock3, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";
import { apiClient } from "@/api/client";

const STATUS_OPTIONS = [
  { value: "trialing", label: "Trial" },
  { value: "active", label: "Active" },
  { value: "past_due", label: "Past due" },
  { value: "canceled", label: "Canceled" },
  { value: "suspended", label: "Suspended" }
];

function dateLabel(value) {
  if (!value) return "Not set";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not set" : date.toLocaleDateString();
}

function StatusPill({ enabled, status }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${enabled ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
      {enabled ? "Access enabled" : status === "trialing" ? "Trial expired" : status}
    </span>
  );
}

export default function AdminSubscription() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";
  const [subscriptions, setSubscriptions] = useState([]);
  const [plans, setPlans] = useState([]);
  const [current, setCurrent] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (isSuperAdmin) {
        const [subscriptionData, planData] = await Promise.all([
          apiClient.request("/api/subscriptions"),
          apiClient.request("/api/subscriptions/plans")
        ]);
        const rows = apiClient.normalize(subscriptionData.subscriptions || []);
        setSubscriptions(rows);
        setPlans(apiClient.normalize(planData));
        setDrafts(Object.fromEntries(rows.map(row => [row.restaurant?.id, {
          planCode: row.plan?.code || row.planCode,
          status: row.status
        }])));
      } else {
        const data = await apiClient.request("/api/subscriptions/current");
        setCurrent(apiClient.normalize(data));
      }
    } catch (err) {
      setError(err.message || "Could not load subscription information.");
    } finally {
      setLoading(false);
    }
  }, [isSuperAdmin]);

  useEffect(() => { load(); }, [load]);

  const updateDraft = (restaurantId, field, value) => {
    setDrafts(previous => ({
      ...previous,
      [restaurantId]: { ...previous[restaurantId], [field]: value }
    }));
  };

  const save = async (restaurantId) => {
    const draft = drafts[restaurantId];
    if (!draft) return;
    setSavingId(restaurantId);
    setError("");
    setNotice("");
    try {
      await apiClient.request(`/api/subscriptions/${restaurantId}`, {
        method: "PATCH",
        body: draft
      });
      setNotice("Subscription settings saved.");
      await load();
    } catch (err) {
      setError(err.message || "Could not save subscription settings.");
    } finally {
      setSavingId("");
    }
  };

  if (loading) {
    return <div className="flex h-56 items-center justify-center"><RefreshCw className="animate-spin text-stone-400" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-stone-900">{isSuperAdmin ? "SaaS Subscriptions" : "Your Plan"}</h1>
          <p className="mt-1 text-sm text-stone-500">{isSuperAdmin ? "Manage tenant plans and service access. Billing integrations are intentionally disabled for now." : "Review your current plan, limits, and service access."}</p>
        </div>
        <Button variant="outline" onClick={load}><RefreshCw size={15} className="mr-2" /> Refresh</Button>
      </div>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</div>}

      {isSuperAdmin ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border bg-white p-4"><p className="text-xs text-stone-500">Tenants</p><p className="mt-1 text-2xl font-bold">{subscriptions.length}</p></div>
            <div className="rounded-2xl border bg-white p-4"><p className="text-xs text-stone-500">Access enabled</p><p className="mt-1 text-2xl font-bold">{subscriptions.filter(row => row.accessEnabled).length}</p></div>
            <div className="rounded-2xl border bg-white p-4"><p className="text-xs text-stone-500">Needs attention</p><p className="mt-1 text-2xl font-bold">{subscriptions.filter(row => !row.accessEnabled).length}</p></div>
          </div>

          <div className="space-y-3">
            {subscriptions.map(row => {
              const restaurantId = row.restaurant?.id;
              const draft = drafts[restaurantId] || {};
              return (
                <section key={row.id} className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-100"><Building2 size={18} className="text-stone-600" /></div>
                      <div>
                        <h2 className="font-semibold text-stone-900">{row.restaurant?.name || "Unknown restaurant"}</h2>
                        <p className="text-xs text-stone-500">/{row.restaurant?.slug || "no-slug"}</p>
                      </div>
                    </div>
                    <StatusPill enabled={row.accessEnabled} status={row.status} />
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <label className="space-y-1 text-xs font-medium text-stone-600">Plan
                      <select value={draft.planCode || ""} onChange={e => updateDraft(restaurantId, "planCode", e.target.value)} className="h-10 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-900">
                        {plans.map(plan => <option key={plan.code} value={plan.code}>{plan.name}</option>)}
                      </select>
                    </label>
                    <label className="space-y-1 text-xs font-medium text-stone-600">Status
                      <select value={draft.status || row.status} onChange={e => updateDraft(restaurantId, "status", e.target.value)} className="h-10 w-full rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-900">
                        {STATUS_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </label>
                    <div className="space-y-1 text-xs font-medium text-stone-600">Trial ends
                      <div className="flex h-10 items-center rounded-lg border border-stone-200 px-3 text-sm text-stone-800">{dateLabel(row.trialEndsAt)}</div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-stone-500">{row.plan?.limits?.menuItems ?? "—"} menu items · {row.plan?.limits?.arItems ?? "—"} AR models · {row.plan?.limits?.monthlyOrders ?? "—"} orders/month</p>
                    <Button size="sm" onClick={() => save(restaurantId)} disabled={!restaurantId || savingId === restaurantId}>
                      {savingId === restaurantId ? "Saving…" : "Save changes"}
                    </Button>
                  </div>
                </section>
              );
            })}
            {subscriptions.length === 0 && <div className="rounded-2xl border bg-white p-10 text-center text-sm text-stone-500">No subscriptions have been provisioned yet.</div>}
          </div>
        </>
      ) : current ? (
        <div className="space-y-4">
          <section className="rounded-2xl border bg-white p-5 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50"><CreditCard className="text-amber-700" /></div>
                <div>
                  <p className="text-xs text-stone-500">Current plan</p>
                  <h2 className="text-xl font-bold text-stone-900">{current.plan?.name || current.planCode}</h2>
                </div>
              </div>
              <StatusPill enabled={current.accessEnabled} status={current.status} />
            </div>
            <p className="mt-4 text-sm text-stone-600">{current.plan?.description}</p>
            {!current.accessEnabled && <div className="mt-4 flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800"><AlertTriangle size={17} className="mt-0.5 shrink-0" /> Your trial or subscription has ended. Contact the Kistet platform administrator to restore access.</div>}
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-stone-50 p-3"><p className="text-xs text-stone-500">Trial ends</p><p className="mt-1 font-semibold text-stone-900">{dateLabel(current.trialEndsAt)}</p></div>
              <div className="rounded-xl bg-stone-50 p-3"><p className="text-xs text-stone-500">Service started</p><p className="mt-1 font-semibold text-stone-900">{dateLabel(current.startsAt)}</p></div>
            </div>
          </section>
          <section className="rounded-2xl border bg-white p-5">
            <div className="mb-4 flex items-center gap-2"><ShieldCheck size={18} className="text-emerald-700" /><h3 className="font-semibold text-stone-900">Current usage</h3></div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[["Menu items", current.usage?.menuItems, current.plan?.limits?.menuItems], ["Categories", current.usage?.categories, current.plan?.limits?.categories], ["Orders this month", current.usage?.monthlyOrders, current.plan?.limits?.monthlyOrders], ["AR models", current.usage?.arItems, current.plan?.limits?.arItems]].map(([label, used, limit]) => <div key={label} className="rounded-xl border border-stone-100 p-3"><p className="text-xs text-stone-500">{label}</p><p className="mt-1 text-lg font-semibold text-stone-900">{used ?? 0} <span className="text-xs font-normal text-stone-500">/ {limit ?? "—"}</span></p><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full bg-amber-500" style={{ width: `${limit ? Math.min(100, ((used || 0) / limit) * 100) : 0}%` }} /></div></div>)}
            </div>
          </section>
          <section className="rounded-2xl border bg-white p-5">
            <div className="mb-4 flex items-center gap-2"><ShieldCheck size={18} className="text-emerald-700" /><h3 className="font-semibold text-stone-900">Plan limits</h3></div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["Menu items", current.plan?.limits?.menuItems],
                ["Categories", current.plan?.limits?.categories],
                ["Orders / month", current.plan?.limits?.monthlyOrders],
                ["AR models", current.plan?.limits?.arItems],
                ["Max asset size", current.plan?.limits?.assetBytes ? `${Math.round(current.plan.limits.assetBytes / 1024 / 1024)} MB` : "—"]
              ].map(([label, value]) => <div key={label} className="rounded-xl border border-stone-100 p-3"><p className="text-xs text-stone-500">{label}</p><p className="mt-1 text-lg font-semibold text-stone-900">{value ?? "—"}</p></div>)}
            </div>
          </section>
          <div className="flex items-start gap-2 text-xs text-stone-500"><Clock3 size={15} className="mt-0.5 shrink-0" /> Online subscription payments are not enabled yet. Your platform administrator manages plan changes manually.</div>
        </div>
      ) : null}
    </div>
  );
}
