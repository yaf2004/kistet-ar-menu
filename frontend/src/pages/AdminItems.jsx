import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, UtensilsCrossed, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import MenuItemForm from "@/components/admin/MenuItemForm";
import { useToast } from "@/components/ui/use-toast";

export default function AdminItems() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const { toast } = useToast();

  const loadData = async () => {
    const [i, c] = await Promise.all([
      base44.entities.MenuItem.list("-created_date"),
      base44.entities.MenuCategory.list(),
    ]);
    setItems(i);
    setCategories(c);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleSave = async (data) => {
    try {
      if (editing) {
        await base44.entities.MenuItem.update(editing.id, data);
        toast({ title: "Item updated" });
      } else {
        await base44.entities.MenuItem.create(data);
        toast({ title: "Item created" });
      }
      setDialogOpen(false);
      setEditing(null);
      loadData();
    } catch (err) {
      toast({ title: "Failed to save item", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    await base44.entities.MenuItem.delete(deleteId);
    setDeleteId(null);
    toast({ title: "Item deleted" });
    loadData();
  };

  const filtered = items.filter(i =>
    i.name?.toLowerCase().includes(search.toLowerCase()) ||
    i.description?.toLowerCase().includes(search.toLowerCase())
  );

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
          <h1 className="text-2xl font-heading font-bold text-stone-900">Menu Items</h1>
          <p className="text-stone-500 text-sm mt-1">{items.length} item{items.length !== 1 ? "s" : ""}</p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }} className="bg-amber-600 hover:bg-amber-700">
          <Plus size={16} className="mr-2" /> Add Item
        </Button>
      </div>

      {items.length > 0 && (
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search items..."
            className="pl-9"
          />
        </div>
      )}

      {filtered.length === 0 && items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-100 p-12 text-center">
          <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <UtensilsCrossed size={24} className="text-amber-600" />
          </div>
          <h3 className="text-lg font-semibold text-stone-900">No items yet</h3>
          <p className="text-stone-500 text-sm mt-1">Add your first menu item to get started</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden divide-y divide-stone-50">
          {filtered.map(item => (
            <div key={item.id} className="flex items-center gap-4 p-4 hover:bg-stone-50 transition-colors">
              {item.image_url ? (
                <img src={item.image_url} alt="" className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-stone-100 flex items-center justify-center flex-shrink-0">
                  <UtensilsCrossed size={18} className="text-stone-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-stone-900 truncate">{item.name}</p>
                  {!item.is_available && <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full flex-shrink-0">Unavailable</span>}
                  {item.ar_enabled && <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full flex-shrink-0">AR</span>}
                  {item.is_featured && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full flex-shrink-0">Featured</span>}
                </div>
                <p className="text-xs text-stone-500 mt-0.5">{categories.find(c => c.id === item.category_id)?.name || "—"}</p>
              </div>
              <p className="text-sm font-bold text-stone-900 flex-shrink-0">${item.price?.toFixed(2)}</p>
              <div className="flex gap-1 flex-shrink-0">
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditing(item); setDialogOpen(true); }}>
                  <Pencil size={14} />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={() => setDeleteId(item.id)}>
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={v => { setDialogOpen(v); if (!v) setEditing(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Item" : "Add New Item"}</DialogTitle>
          </DialogHeader>
          <MenuItemForm
            item={editing}
            categories={categories}
            onSave={handleSave}
            onCancel={() => { setDialogOpen(false); setEditing(null); }}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={v => { if (!v) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete item?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
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