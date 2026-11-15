import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardList, RefreshCw, ChefHat, CheckCircle2, XCircle } from "lucide-react";
import { apiClient } from "@/api/client";
import { useAuth } from "@/lib/AuthContext";

const nextAction = {
  new: { status: "accepted", label: "Accept order" },
  accepted: { status: "preparing", label: "Start preparing" },
  preparing: { status: "ready", label: "Mark ready" },
  ready: { status: "completed", label: "Complete order" }
};
const labels = {
  new: "New",
  accepted: "Accepted",
  preparing: "Preparing",
  ready: "Ready",
  completed: "Completed",
  cancelled: "Cancelled"
};
const filters = ["all", "new", "accepted", "preparing", "ready", "completed", "cancelled"];

export default function AdminOrders() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";
  const ownRestaurantId = user?.restaurant?._id || user?.restaurant?.id || user?.restaurant;
  const [restaurants, setRestaurants] = useState([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState("");
  const restaurantId = isSuperAdmin ? selectedRestaurantId : ownRestaurantId;
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState("new");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isSuperAdmin) return;
    let cancelled = false;
    apiClient.request("/api/restaurants")
      .then((data) => {
        if (cancelled) return;
        setRestaurants(data || []);
        setSelectedRestaurantId((current) => current || data?.[0]?._id || data?.[0]?.id || "");
      })
      .catch((err) => { if (!cancelled) setError(err.message || "Could not load restaurants"); });
    return () => { cancelled = true; };
  }, [isSuperAdmin]);

  const loadOrders = useCallback(async (silent = false) => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await apiClient.request(`/api/orders/restaurant/${restaurantId}?limit=100`);
      setOrders(data.orders || []);
      setError("");
    } catch (err) {
      setError(err.message || "Could not load orders");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    loadOrders();
    const interval = window.setInterval(() => loadOrders(true), 15000);
    return () => window.clearInterval(interval);
  }, [loadOrders]);

  const visibleOrders = useMemo(
    () => filter === "all" ? orders : orders.filter((order) => order.status === filter),
    [orders, filter]
  );

  async function updateStatus(order, status) {
    setBusyId(order.id);
    setError("");
    try {
      await apiClient.request(`/api/orders/${order.id}/status`, {
        method: "PATCH",
        body: { status }
      });
      await loadOrders(true);
    } catch (err) {
      setError(err.message || "Could not update order");
    } finally {
      setBusyId("");
    }
  }

  if (!restaurantId) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-8">
        <ClipboardList className="mx-auto mb-3 text-stone-400" size={32} />
        <h1 className="text-center text-xl font-bold text-stone-900">Orders</h1>
        {isSuperAdmin ? (
          <label className="mx-auto mt-4 block max-w-sm text-sm font-medium text-stone-700">
            Select a restaurant
            <select value={selectedRestaurantId} onChange={(event) => setSelectedRestaurantId(event.target.value)} className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5">
              <option value="">Choose a restaurant</option>
              {restaurants.map((restaurant) => (
                <option key={restaurant._id || restaurant.id} value={restaurant._id || restaurant.id}>{restaurant.name}{restaurant.active ? "" : " (inactive)"}</option>
              ))}
            </select>
          </label>
        ) : (
          <p className="mt-2 text-center text-sm text-stone-500">Your restaurant account is not linked to a restaurant.</p>
        )}
      </div>
    );
  }

  if (loading) {
    return <div className="flex h-56 items-center justify-center"><RefreshCw className="animate-spin text-stone-400" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Order management</h1>
          <p className="mt-1 text-sm text-stone-500">Live queue · refreshes every 15 seconds</p>
        </div>
        {isSuperAdmin && (
          <select value={selectedRestaurantId} onChange={(event) => setSelectedRestaurantId(event.target.value)} className="rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm">
            {restaurants.map((restaurant) => (
              <option key={restaurant._id || restaurant.id} value={restaurant._id || restaurant.id}>{restaurant.name}{restaurant.active ? "" : " (inactive)"}</option>
            ))}
          </select>
        )}
        <button type="button" onClick={() => loadOrders(true)} disabled={refreshing} className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 disabled:opacity-50">
          <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {filters.map((value) => (
          <button key={value} type="button" onClick={() => setFilter(value)} className={`whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-semibold capitalize ${filter === value ? "bg-stone-900 text-white" : "bg-white text-stone-600 border border-stone-200"}`}>
            {value === "all" ? `All (${orders.length})` : `${labels[value]} (${orders.filter((order) => order.status === value).length})`}
          </button>
        ))}
      </div>

      {visibleOrders.length === 0 ? (
        <div className="rounded-2xl border border-stone-100 bg-white p-12 text-center">
          <ClipboardList size={30} className="mx-auto mb-3 text-stone-300" />
          <p className="font-semibold text-stone-800">No {filter === "all" ? "" : labels[filter]?.toLowerCase() + " "}orders</p>
          <p className="mt-1 text-sm text-stone-500">New customer orders will appear here.</p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {visibleOrders.map((order) => {
            const action = nextAction[order.status];
            return (
              <article key={order.id} className="rounded-2xl border border-stone-100 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-stone-900">#{order.orderNumber}</p>
                    <p className="mt-1 text-xs text-stone-500">{new Date(order.createdAt).toLocaleString()}</p>
                    <p className="mt-1 text-sm text-stone-700">{order.customerName || "Guest"}{order.customerPhone ? ` · ${order.customerPhone}` : ""}</p>
                    {order.tableNumber && <p className="mt-1 text-xs font-semibold text-amber-700">Table {order.tableNumber}</p>}
                  </div>
                  <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">{labels[order.status] || order.status}</span>
                </div>

                <div className="my-4 space-y-2 border-y border-stone-100 py-4">
                  {order.items.map((line, index) => (
                    <div key={index} className="flex justify-between gap-3 text-sm">
                      <span className="text-stone-700">{line.quantity} × {line.name}</span>
                      <span className="font-medium tabular-nums text-stone-900">{order.currency}{Number(line.lineTotal).toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-2 text-sm font-bold">
                    <span>Total</span><span>{order.currency}{Number(order.total).toFixed(2)}</span>
                  </div>
                </div>

                {order.notes && <p className="mb-3 rounded-lg bg-stone-50 p-3 text-xs text-stone-600">Note: {order.notes}</p>}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-stone-500">Payment: {order.paymentStatus || "unpaid"} · pay at restaurant</span>
                  <div className="flex gap-2">
                    {["new", "accepted"].includes(order.status) && (
                      <button type="button" disabled={busyId === order.id} onClick={() => updateStatus(order, "cancelled")} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-50">
                        <XCircle size={14} className="mr-1 inline" /> Cancel
                      </button>
                    )}
                    {action && (
                      <button type="button" disabled={busyId === order.id} onClick={() => updateStatus(order, action.status)} className="rounded-lg bg-stone-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
                        {order.status === "new" ? <CheckCircle2 size={14} className="mr-1 inline" /> : <ChefHat size={14} className="mr-1 inline" />}
                        {busyId === order.id ? "Saving…" : action.label}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
