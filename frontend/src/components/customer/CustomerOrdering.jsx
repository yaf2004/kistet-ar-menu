import React, { useEffect, useMemo, useState } from "react";
import { API_BASE_URL } from "@/api/client";
import { ShoppingBag, Plus, Minus, X, CheckCircle2, RefreshCw } from "lucide-react";

function makeIdempotencyKey() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `order_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export default function CustomerOrdering({ restaurantSlug, tableNumber, items, currency = "$" }) {
  const [cart, setCart] = useState({});
  const [open, setOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [tracking, setTracking] = useState(null);
  const [trackingToken, setTrackingToken] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(makeIdempotencyKey());
  const [refreshing, setRefreshing] = useState(false);

  const selected = useMemo(() => Object.entries(cart)
    .map(([id, quantity]) => ({ item: items.find((item) => item.id === id), quantity }))
    .filter((line) => line.item && line.quantity > 0), [cart, items]);
  const count = selected.reduce((sum, line) => sum + line.quantity, 0);
  const total = selected.reduce((sum, line) => sum + line.item.price * line.quantity, 0);

  function add(item) {
    setCart((current) => ({ ...current, [item.id]: Math.min(50, (current[item.id] || 0) + 1) }));
    setError("");
  }

  useEffect(() => {
    const onAdd = (event) => {
      const item = event.detail;
      if (item?.id && items.some((candidate) => candidate.id === item.id)) add(item);
    };
    window.addEventListener("kistet:add-to-order", onAdd);
    return () => window.removeEventListener("kistet:add-to-order", onAdd);
  }, [items]);

  function change(itemId, delta) {
    setCart((current) => {
      const quantity = Math.max(0, Math.min(50, (current[itemId] || 0) + delta));
      const next = { ...current };
      if (quantity) next[itemId] = quantity;
      else delete next[itemId];
      return next;
    });
  }

  async function submitOrder(event) {
    event.preventDefault();
    if (!selected.length) return setError("Your order is empty.");
    if (customerName.trim().length < 2) return setError("Please enter your name.");
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/orders/${encodeURIComponent(restaurantSlug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({
          items: selected.map(({ item, quantity }) => ({ itemId: item.id, quantity })),
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          notes: notes.trim(),
          tableNumber: tableNumber || null
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "We could not place your order. Please try again.");
      setTracking(data.order);
      setTrackingToken(data.trackingToken);
      setCart({});
      setIdempotencyKey(makeIdempotencyKey());
    } catch (err) {
      setError(err.message || "Order failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function refreshStatus() {
    if (!trackingToken) return;
    setRefreshing(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/orders/track/${encodeURIComponent(trackingToken)}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not refresh order status");
      setTracking(data);
    } catch (err) { setError(err.message); }
    finally { setRefreshing(false); }
  }

  const statusLabels = {
    new: "Received",
    accepted: "Accepted by restaurant",
    preparing: "Being prepared",
    ready: "Ready",
    completed: "Completed",
    cancelled: "Cancelled"
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-stone-900 px-5 py-3.5 text-sm font-semibold text-white shadow-xl hover:bg-stone-700"
        aria-label={`Open order cart, ${count} items`}
      >
        <ShoppingBag size={18} /> Order {count > 0 && <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs">{count}</span>}
      </button>

      {open && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 sm:items-center" role="dialog" aria-modal="true" aria-label="Your order">
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 text-stone-900 shadow-2xl sm:rounded-3xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">{tracking ? "Order received" : "Your order"}</h2>
                <p className="mt-1 text-xs text-stone-500">{tableNumber ? `Table ${tableNumber}` : "Pickup / pay at restaurant"}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close order" className="rounded-full p-2 hover:bg-stone-100"><X size={20} /></button>
            </div>

            {tracking ? (
              <div className="space-y-4">
                <div className="rounded-2xl bg-emerald-50 p-4 text-emerald-900">
                  <CheckCircle2 className="mb-2" size={24} />
                  <p className="font-semibold">Order {tracking.orderNumber}</p>
                  <p className="mt-1 text-sm">{statusLabels[tracking.status] || tracking.status}</p>
                  <p className="mt-2 text-sm">Total: {currency}{Number(tracking.total).toFixed(2)}</p>
                </div>
                {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
                <div className="space-y-2">
                  {tracking.items?.map((line, index) => (
                    <div key={index} className="flex justify-between gap-3 text-sm">
                      <span>{line.quantity} × {line.name}</span>
                      <span>{currency}{Number(line.lineTotal).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <p className="rounded-xl bg-stone-100 p-3 text-xs text-stone-600">Payment is due at the restaurant. This confirmation does not mean an online payment was made.</p>
                <button type="button" onClick={refreshStatus} disabled={refreshing} className="flex w-full items-center justify-center gap-2 rounded-xl border border-stone-200 py-3 text-sm font-semibold disabled:opacity-50">
                  <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} /> Refresh order status
                </button>
                <button type="button" onClick={() => { setTracking(null); setTrackingToken(""); setCustomerName(""); setCustomerPhone(""); setNotes(""); setOpen(false); }} className="w-full rounded-xl bg-stone-900 py-3 text-sm font-semibold text-white">Done</button>
              </div>
            ) : (
              <form onSubmit={submitOrder} className="space-y-4">
                {selected.length ? selected.map(({ item, quantity }) => (
                  <div key={item.id} className="flex items-center gap-3 border-b border-stone-100 pb-3">
                    {item.image_url && <img src={item.image_url} alt="" className="h-14 w-14 rounded-xl object-cover" />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{item.name}</p>
                      <p className="text-xs text-stone-500">{currency}{Number(item.price).toFixed(2)} each</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => change(item.id, -1)} aria-label={`Remove one ${item.name}`} className="rounded-full border p-1.5"><Minus size={14} /></button>
                      <span className="w-4 text-center text-sm tabular-nums">{quantity}</span>
                      <button type="button" onClick={() => change(item.id, 1)} aria-label={`Add one ${item.name}`} className="rounded-full border p-1.5"><Plus size={14} /></button>
                    </div>
                  </div>
                )) : <p className="rounded-xl bg-stone-50 p-5 text-center text-sm text-stone-500">Your cart is empty. Choose a dish from the menu to get started.</p>}

                <div className="flex justify-between border-b border-stone-200 pb-3 text-base font-bold">
                  <span>Estimated total</span><span>{currency}{total.toFixed(2)}</span>
                </div>
                <label className="block text-sm font-medium">Your name *
                  <input required minLength={2} maxLength={120} value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="mt-1.5 w-full rounded-xl border border-stone-200 px-3 py-2.5 font-normal" autoComplete="name" />
                </label>
                <label className="block text-sm font-medium">Phone (optional)
                  <input maxLength={40} value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="mt-1.5 w-full rounded-xl border border-stone-200 px-3 py-2.5 font-normal" autoComplete="tel" />
                </label>
                <label className="block text-sm font-medium">Order notes (optional)
                  <textarea maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1.5 w-full rounded-xl border border-stone-200 px-3 py-2.5 font-normal" placeholder="Allergies, preferences, or special instructions…" />
                </label>
                <p className="text-xs text-stone-500">Prices are confirmed by the restaurant when the order is accepted. Payment is made at the restaurant.</p>
                {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
                <button type="submit" disabled={!selected.length || submitting} className="w-full rounded-xl bg-stone-900 py-3.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">
                  {submitting ? "Placing order…" : `Place order · ${currency}${total.toFixed(2)}`}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
