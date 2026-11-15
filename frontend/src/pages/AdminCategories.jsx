import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, Tags } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";

export default function AdminCategories() {
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [form, setForm] = useState({ name: "", description: "", is_active: true, sort_order: 0 });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const loadData = async () => {
    const [c, i] = await Promise.all([
      base44.entities.MenuCategory.list("sort_order"),
      base44.entities.MenuItem.list(),
    ]);
    setCategories(c);
    setItems(i);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: "", description: "", is_active: true, sort_order: categories.length });
    setDialogOpen(true);
  };

  const openEdit = (cat) => {
    setEditing(cat);
    setForm({ name: cat.name, description: cat.description || "", is_active: cat.is_active !== false, sort_order: cat.sort_order || 0 });
    setDialogOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await base44.entities.MenuCategory.update(editing.id, form);
        toast({ title: "Category updated" });
      } else {
        await base44.entities.MenuCategory.create(form);
        toast({ title: "Category created" });
      }
      setDialogOpen(false);
      loadData();
    } catch (err) {
      toast({ title: "Failed to save category", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    await base44.entities.MenuCategory.delete(deleteId);
    setDeleteId(null);
    toast({ title: "Category deleted" });
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
          <h1 className="text-2xl font-heading font-bold text-stone-900">Categories</h1>
          <p className="text-stone-500 text-sm mt-1">{categories.length} categor{categories.length !== 1 ? "ies" : "y"}</p>
        </div>
        <Button onClick={openAdd} className="bg-amber-600 hover:bg-amber-700">
          <Plus size={16} className="mr-2" /> Add Category
        </Button>
      </div>

      {categories.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-100 p-12 text-center">
          <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Tags size={24} className="text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold text-stone-900">No categories yet</h3>
          <p className="text-stone-500 text-sm mt-1">Create categories like "Starters", "Mains", "Desserts"</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden divide-y divide-stone-50">
          {categories.map(cat => {
            const count = items.filter(i => i.category_id === cat.id).length;
            return (
              <div key={cat.id} className="flex items-center gap-4 p-4 hover:bg-stone-50 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center flex-shrink-0">
                  <Tags size={16} className="text-stone-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-stone-900">{cat.name}</p>
                    {!cat.is_active && <span className="text-[10px] bg-stone-200 text-stone-600 px-1.5 py-0.5 rounded-full">Hidden</span>}
                  </div>
                  <p className="text-xs text-stone-500 mt-0.5">{count} item{count !== 1 ? "s" : ""}</p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(cat)}>
                    <Pencil size={14} />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={() => setDeleteId(cat.id)}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={v => { setDialogOpen(v); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Category" : "New Category"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
              <Label className="text-sm">Active (visible on menu)</Label>
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={saving} className="bg-amber-600 hover:bg-amber-700">
                {editing ? "Update" : "Create"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={v => { if (!v) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete category?</AlertDialogTitle>
            <AlertDialogDescription>Items in this category won't be deleted but will appear uncategorized.</AlertDialogDescription>
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