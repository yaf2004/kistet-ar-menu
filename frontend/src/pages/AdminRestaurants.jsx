import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Building2, ExternalLink, Power, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const emptyForm = { name: "", address: "", phone: "", currency: "$", ownerName: "", ownerEmail: "", ownerPassword: "" };

export default function AdminRestaurants() {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleteId, setDeleteId] = useState(null);
  const { toast } = useToast();

  const loadData = async () => {
    setLoading(true);
    const list = await base44.entities.Restaurant.list();
    setRestaurants(list);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await base44.entities.Restaurant.create(form);
      toast({ title: "Restaurant created!", description: `${form.name} and its admin login are ready.` });
      setDialogOpen(false);
      setForm(emptyForm);
      loadData();
    } catch (err) {
      setError(err.message || "Failed to create restaurant");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (id) => {
    await base44.entities.Restaurant.toggleActive(id);
    loadData();
  };

  const handleDelete = async () => {
    await base44.entities.Restaurant.delete(deleteId);
    setDeleteId(null);
    toast({ title: "Restaurant deleted" });
    loadData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-stone-300 border-t-amber-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-stone-900">All Restaurants</h1>
          <p className="text-stone-500 text-sm mt-1">{restaurants.length} restaurant{restaurants.length !== 1 ? "s" : ""} on the platform</p>
        </div>
        <Button onClick={() => { setForm(emptyForm); setError(""); setDialogOpen(true); }} className="bg-amber-600 hover:bg-amber-700">
          <Plus size={16} className="mr-2" /> Add Restaurant
        </Button>
      </div>

      {restaurants.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-100 p-12 text-center">
          <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Building2 size={24} className="text-amber-600" />
          </div>
          <h3 className="text-lg font-semibold text-stone-900">No restaurants yet</h3>
          <p className="text-stone-500 text-sm mt-1">Add your first client to get started</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden divide-y divide-stone-50">
          {restaurants.map(r => (
            <div key={r.id} className="flex items-center gap-4 p-4 hover:bg-stone-50 transition-colors">
              <div className="w-12 h-12 rounded-xl bg-stone-100 flex items-center justify-center flex-shrink-0">
                <Building2 size={18} className="text-stone-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-stone-900 truncate">{r.name}</p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${r.active ? "bg-green-100 text-green-700" : "bg-stone-200 text-stone-600"}`}>
                    {r.active ? "Active" : "Suspended"}
                  </span>
                </div>
                <p className="text-xs text-stone-500 mt-0.5">/{r.slug}</p>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <Button size="icon" variant="ghost" className="h-8 w-8" title="View live menu" onClick={() => window.open(`/menu/${r.slug}`, "_blank")}>
                  <ExternalLink size={14} />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" title={r.active ? "Suspend" : "Reactivate"} onClick={() => handleToggleActive(r.id)}>
                  <Power size={14} className={r.active ? "text-amber-600" : "text-stone-400"} />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-600" title="Delete" onClick={() => setDeleteId(r.id)}>
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Restaurant</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            {error && <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm">{error}</div>}

            <div className="space-y-2">
              <Label>Restaurant Name *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g. Amro Chicken" />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+251..." />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Street, City" />
            </div>
            <div className="space-y-2">
              <Label>Currency Symbol</Label>
              <Input value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} placeholder="e.g. ETB or $" />
            </div>

            <div className="pt-3 border-t border-stone-100">
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">Owner Login (for this restaurant's admin)</p>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Owner Name</Label>
                  <Input value={form.ownerName} onChange={e => setForm(f => ({ ...f, ownerName: e.target.value }))} placeholder="e.g. Restaurant Manager" />
                </div>
                <div className="space-y-2">
                  <Label>Owner Email *</Label>
                  <Input type="email" value={form.ownerEmail} onChange={e => setForm(f => ({ ...f, ownerEmail: e.target.value }))} required placeholder="owner@restaurant.com" />
                </div>
                <div className="space-y-2">
                  <Label>Owner Password *</Label>
                  <Input type="password" value={form.ownerPassword} onChange={e => setForm(f => ({ ...f, ownerPassword: e.target.value }))} required minLength={8} placeholder="Min 8 characters" />
                </div>
              </div>
            </div>

            <Button type="submit" disabled={saving} className="w-full bg-amber-600 hover:bg-amber-700">
              {saving ? "Creating..." : "Create Restaurant & Login"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={v => { if (!v) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this restaurant?</AlertDialogTitle>
            <AlertDialogDescription>This permanently deletes the restaurant, its menu, and its admin login. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
